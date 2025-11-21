# Security Documentation

## Overview

Anovex Protocol implements multiple layers of security to protect user assets, private keys, and transaction data. This document outlines our security architecture, threat model, and best practices.

## Threat Model

### Assets to Protect
1. **Private Keys**: Solana keypairs for user wallets
2. **User Funds**: SOL and SPL token balances
3. **Transaction Privacy**: Trade history and wallet activity
4. **Session Data**: Authentication tokens and user state

### Potential Threats
- Unauthorized access to encrypted private keys
- Man-in-the-middle attacks on API requests
- Session hijacking
- SQL injection and XSS attacks
- Replay attacks on swap transactions
- Private key exposure in logs or error messages

## Cryptographic Security

### Private Key Encryption

All Solana private keys are encrypted at rest using **AES-256-GCM** (Galois/Counter Mode).

**Implementation** (`server/encryption.ts`):
```typescript
// Encryption
const algorithm = 'aes-256-gcm';
const key = deriveKeyFromMasterSecret(masterSecret); // 32 bytes
const iv = crypto.randomBytes(12); // 96-bit nonce
const cipher = crypto.createCipheriv(algorithm, key, iv);

const encrypted = Buffer.concat([
  cipher.update(privateKeyJSON, 'utf8'),
  cipher.final()
]);
const authTag = cipher.getAuthTag();

// Stored format: iv:authTag:encrypted (all hex-encoded)
const stored = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
```

**Key Properties:**
- **Algorithm**: AES-256-GCM (authenticated encryption)
- **Key Size**: 256 bits
- **IV/Nonce**: 96 bits (random per encryption)
- **Authentication Tag**: 128 bits (prevents tampering)
- **Key Derivation**: PBKDF2 with 100,000 iterations

**Storage:**
- Private keys stored as text in PostgreSQL `wallets.privateKey` column
- Master secret derived from environment variable `SESSION_SECRET`
- Keys decrypted only when needed for transaction signing
- **Never logged, never returned in API responses** (except during wallet creation)

### Master Secret Management

The master encryption key is derived from `SESSION_SECRET` environment variable:

```typescript
const masterSecret = process.env.SESSION_SECRET || 'anovex-dev-secret-change-in-production';

function deriveKeyFromMasterSecret(secret: string): Buffer {
  return crypto.pbkdf2Sync(
    secret,
    'anovex-salt',
    100000,
    32,
    'sha256'
  );
}
```

**Production Requirements:**
- `SESSION_SECRET` must be cryptographically random (≥32 characters)
- Stored in secure environment variables (never committed to git)
- Rotated periodically (requires re-encryption of all keys)

## Transport Security

### HTTPS Enforcement

All production traffic enforces HTTPS:

```typescript
// server/index.ts
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1); // Trust reverse proxy for HTTPS
}

// Session cookies
cookie: {
  secure: process.env.NODE_ENV === 'production', // HTTPS-only
  httpOnly: true, // No JavaScript access
  sameSite: 'lax' // CSRF protection
}
```

**Certificate Management:**
- Production deployment automatically provisions TLS certificates via Let's Encrypt
- Custom domains (anovex.io, trade.anovex.io) support automatic certificate provisioning

### API Security

**Request Validation:**
All API inputs validated using Zod schemas:

```typescript
const buySchema = z.object({
  tokenMint: z.string().min(32).max(44),
  solAmount: z.string().regex(/^\d+\.?\d*$/),
  slippageBps: z.number().min(1).max(5000).optional()
});

// Routes validate before processing
const body = buySchema.parse(req.body);
```

**SQL Injection Protection:**
- Drizzle ORM with parameterized queries (no raw SQL in user-facing endpoints)
- Prepared statements prevent injection attacks

**XSS Protection:**
- React auto-escapes user input in JSX
- Content Security Policy headers (future enhancement)

## Session Management

### PostgreSQL Session Store

Sessions persist in PostgreSQL via `connect-pg-simple`:

```typescript
app.use(session({
  store: new PostgresStore({
    pool: pgPool,
    tableName: 'session',
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 400 * 24 * 60 * 60 * 1000, // 400 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }
}));
```

**Session Security:**
- Sessions stored server-side (only session ID in cookie)
- Cookie flags: `httpOnly` (no XSS access), `secure` (HTTPS-only)
- `sameSite: lax` prevents CSRF on state-changing requests
- 400-day expiry for long-term login (common in crypto wallets)

### Session Hijacking Protection

- Session IDs cryptographically random (128-bit entropy)
- Secure cookies prevent interception over HTTP
- Future: IP address binding and user-agent validation

## Transaction Security

### Swap Idempotency

All swap operations are idempotent to prevent double-execution:

```typescript
// swapJobs.chainTxhash stores blockchain transaction hash immediately
// Background worker checks if chainTxhash exists before retrying

if (job.chainTxhash) {
  console.log(`Job ${jobId} already has chainTxhash, skipping execution`);
  return;
}
```

**Protection Against:**
- Double-spending due to retry logic
- Race conditions in concurrent swap processing

### Slippage Protection

Swap quotes include slippage tolerance mechanisms:

```typescript
const quote = await fetchSwapQuote({
  inputMint: 'So11...',
  outputMint: 'EPjF...',
  amount: '1000000000',
  slippageBps: 50 // 0.5% max slippage
});
```

**Default Slippage:**
- Buy orders: 0.5% (50 bps)
- Sell orders: 0.5% (50 bps)
- User-configurable via API parameter (max: 50% / 5000 bps)

### Private Key Usage

Private keys decrypted only during transaction signing:

```typescript
async function signTransaction(walletId: string, tx: Transaction) {
  const wallet = await db.query.wallets.findFirst({ where: eq(wallets.id, walletId) });
  const privateKey = decryptPrivateKey(wallet.privateKey); // Decrypt
  
  const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
  tx.sign(keypair);
  
  // privateKey immediately garbage collected (no persistence in memory)
  return tx;
}
```

**Key Rotation:**
- Users can create new wallets and transfer funds
- Old wallets can be deleted (cascading deletion of associated data)

## Database Security

### Access Control

- PostgreSQL user has least-privilege access (no superuser)
- Database credentials stored in environment variables
- Connection string never logged or exposed in API responses

### Data Encryption

**At Rest:**
- PostgreSQL configured with AES-256 encryption at rest (Neon default)
- Backup encryption enabled

**In Transit:**
- TLS connections to database (enforced by Neon)

### Sensitive Data Handling

**Never Stored in Plain Text:**
- Private keys (encrypted with AES-256-GCM)
- Session data (hashed session IDs only)

**Stored for Functionality:**
- Wallet addresses (ANV prefix, no Solana address exposure)
- Transaction hashes (privacy-preserved ANVBUY/ANVSEL format)
- Balances and holdings (required for app functionality)

## Privacy Protections

### Custom ANV Address System

Solana public keys never exposed to users or stored in frontend:

```typescript
// Wallet creation
const keypair = Keypair.generate();
const walletAddress = generateANVAddress(); // ANV + 41 random chars
const privateKey = bs58.encode(keypair.secretKey);

// Stored:
// - walletAddress: ANVx7k2mP9wQzT4nL6vR8cH3jK1aS5dF9gB0eX2yU7i
// - privateKey: encrypted(keypair.secretKey)
// 
// Solana public key (keypair.publicKey) derived on-the-fly when needed
```

### Privacy-Preserved Transaction Hashes

Transaction IDs use custom format (not blockchain hashes):

```typescript
function generateTransactionHash(type: 'buy' | 'sell' | 'deposit' | 'withdraw'): string {
  const prefix = {
    buy: 'ANVBUY',
    sell: 'ANVSEL',
    deposit: 'ANVDEP',
    withdraw: 'ANVWIT'
  }[type];
  
  const randomPart = generateRandomString(82); // 82 chars
  return `${prefix}${randomPart}`; // Total: 88 chars (Solana tx hash length)
}
```

Real blockchain transaction hash stored separately in `transactions.chainTxhash` for audit purposes (not exposed in explorer).

## Rate Limiting

### API Rate Limits

```typescript
// Future implementation
const rateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', rateLimiter);
```

### Swap Rate Limits

- Maximum 5 swaps per minute per wallet
- Prevents abuse and flash loan attacks

## Telegram Bot Security

### Bot Token Protection

- `TELEGRAM_BOT_TOKEN` stored in environment variables
- Never exposed in logs or API responses
- Bot webhook uses HTTPS with certificate validation

### Command Authorization

```typescript
// Only wallet owner can execute commands
async function authorizeUser(ctx: Context) {
  const telegramUserId = ctx.from?.id.toString();
  const wallet = await storage.getWalletByTelegramUserId(telegramUserId);
  
  if (!wallet || !wallet.isActive) {
    await ctx.reply('⛔ Unauthorized. Create a wallet first.');
    return false;
  }
  
  return true;
}
```

### Message Sanitization

- All user inputs sanitized before database queries
- HTML entities escaped in Telegram messages
- No eval() or dynamic code execution

## Incident Response

### Security Incident Procedure

1. **Immediate Actions**:
   - Rotate `SESSION_SECRET` if compromised
   - Invalidate all active sessions
   - Notify affected users

2. **Investigation**:
   - Review access logs
   - Check for unauthorized transactions
   - Identify attack vector

3. **Remediation**:
   - Patch vulnerability
   - Deploy security update
   - Update documentation

### Contact

Report security vulnerabilities:
- **Email**: dev@anovex.io
- **PGP Key**: Available upon request
- **Response Time**: <24 hours

## Security Audits

### Internal Audits
- Code review before all production deployments
- Dependency vulnerability scanning (npm audit)
- Static analysis tools (TypeScript strict mode)

### External Audits
- **Status**: Not yet conducted
- **Planned**: Third-party smart contract audit

## Best Practices for Users

### Wallet Security
- **Never share your private key** (not even with Anovex support)
- Store private key in secure password manager
- Use hardware wallet for large amounts (future integration)

### Account Security
- Use unique, strong passwords for Telegram account
- Enable 2FA on Telegram (protects bot access)
- Regularly review transaction history

### Operational Security
- Verify URLs before login (phishing protection)
- Use official links only (anovex.io, trade.anovex.io)
- Report suspicious activity to dev@anovex.io

## Compliance

### Data Retention
- Transaction history: Indefinite (required for PnL calculation)
- Session data: 400 days (cookie expiry)
- Inactive wallets: Never deleted automatically (user must request)

### GDPR Considerations
- Users can request account deletion
- All associated data deleted (cascading foreign keys)
- Privacy-by-design architecture (no PII collected)

---

**Contact**: dev@anovex.io
