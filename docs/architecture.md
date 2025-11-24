# Anovex Protocol Architecture

## System Overview

Anovex Protocol is a privacy-first decentralized exchange infrastructure built on Solana. The system enables anonymous cryptocurrency trading through a combination of custom wallet addressing, encrypted key storage, and privacy-preserved transaction recording.

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                          User Layer                               │
├──────────────────────────────────────────────────────────────────┤
│  Web App (trade.anovex.io)  │  Telegram Bot Integration         │
│  ┌─────────────────────────┐ │  ┌────────────────────────────┐  │
│  │ React Frontend          │ │  │ Grammy Bot Framework       │  │
│  │ - Landing Page          │ │  │ - Wallet Management        │  │
│  │ - Dashboard             │ │  │ - Portfolio Monitor        │  │
│  │ - Swap Interface        │ │  │ - Quick Trading            │  │
│  │ - Explorer View         │ │  │ - Deposit/Withdraw         │  │
│  └─────────────────────────┘ │  └────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                       API Backend Layer                           │
├──────────────────────────────────────────────────────────────────┤
│  Express.js Server (Node.js)                                     │
│  ┌────────────────┐  ┌─────────────────┐  ┌──────────────────┐ │
│  │ Authentication │  │  Swap Engine    │  │  Deposit Monitor │ │
│  │ - Sessions     │  │  - Liquidity    │  │  - Bridge Layer  │ │
│  │ - Wallet Login │  │  - Routing      │  │  - Conversion    │ │
│  └────────────────┘  └─────────────────┘  └──────────────────┘ │
│                                                                   │
│  ┌────────────────┐  ┌─────────────────┐  ┌──────────────────┐ │
│  │ Storage Layer  │  │  Encryption     │  │  Background Jobs │ │
│  │ - Drizzle ORM  │  │  - AES-256-GCM  │  │  - Swap Queue    │ │
│  │ - CRUD Ops     │  │  - Key Mgmt     │  │  - Price Updates │ │
│  └────────────────┘  └─────────────────┘  └──────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                      Database Layer                               │
├──────────────────────────────────────────────────────────────────┤
│  PostgreSQL (Neon)                                               │
│  ┌──────────────┐  ┌────────────┐  ┌──────────────────────────┐│
│  │  Wallets     │  │Transactions│  │  Token Holdings          ││
│  │  - ANV IDs   │  │- ANV Hashes│  │  - Balances              ││
│  │  - Encrypted │  │- Metadata  │  │  - Cost Basis            ││
│  │    Keys      │  │            │  │  - PnL Tracking          ││
│  └──────────────┘  └────────────┘  └──────────────────────────┘│
│                                                                   │
│  ┌──────────────┐  ┌────────────┐  ┌──────────────────────────┐│
│  │  Deposits    │  │Withdrawals │  │  Swap Jobs               ││
│  │  - Addresses │  │- Requests  │  │  - Queue Processing      ││
│  │  - Monitoring│  │- Status    │  │  - Retry Logic           ││
│  └──────────────┘  └────────────┘  └──────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Blockchain Layer                               │
├──────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐        ┌──────────────────────────┐   │
│  │  Solana Mainnet      │        │  Multi-Chain Networks    │   │
│  │  - RPC Endpoint      │        │  - Deposit Monitoring    │   │
│  │  - Swap Execution    │        │  - Bridge Operations     │   │
│  │  - Keypair Ops       │        │  - Asset Conversion      │   │
│  └──────────────────────┘        └──────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Frontend Application (client/)

**Technology**: React 18 + TypeScript + Vite

**Key Features**:
- Multi-domain routing (anovex.io, trade.anovex.io, anvscan.com, docs.anovex.io)
- Glassmorphism UI with purple (#6A00FF) accent theme
- Responsive design (mobile, tablet, desktop)
- Real-time balance and portfolio updates
- TanStack Query for data fetching

**Pages**:
- `/` - Landing page with protocol overview
- `/login` - Wallet authentication
- `/dashboard` - Portfolio overview and quick stats
- `/swap` - Token trading interface
- `/portfolio` - Detailed holdings and PnL
- `/deposit` - Multi-chain deposit flow
- `/withdraw` - Asset withdrawal
- `/explorer` - Transaction history
- `/settings` - User preferences

### 2. Backend API (server/)

**Technology**: Express.js + Node.js + TypeScript

**Core Modules**:

#### `server/index.ts`
- Express server initialization
- Session middleware with PostgreSQL storage
- Route registration
- Telegram bot integration
- System wallet initialization

#### `server/routes.ts`
- RESTful API endpoint definitions
- Request validation (Zod schemas)
- Authentication middleware
- Error handling

#### `server/storage.ts`
- Database abstraction layer
- CRUD operations for all entities
- Transaction management
- Query optimization

#### `server/encryption.ts`
- AES-256-GCM encryption for private keys
- Deterministic encryption key derivation
- Secure key storage and retrieval

#### `server/swap-engine.ts`
- Decentralized liquidity aggregation
- Real-time swap quote generation
- Transaction routing and execution
- Slippage protection mechanisms

#### `server/telegram-bot.ts`
- Grammy bot framework
- Command handlers
- Inline keyboards
- Message editing for real-time updates

### 3. Database Schema (shared/schema.ts)

**Technology**: Drizzle ORM + PostgreSQL

**Core Tables**:

#### `wallets`
- Custom ANV address system (ANV + 41 chars)
- Encrypted Solana private keys
- Telegram user ID mapping
- Multi-wallet support per user

#### `transactions`
- Privacy-preserved transaction hashes (ANVBUY, ANVSEL, etc.)
- Type: deposit, buy, sell, withdraw
- Token metadata and amounts
- Real blockchain tx hash reference

#### `tokenHoldings`
- SPL token balances
- Average entry price (cost basis)
- Realized and unrealized PnL
- Price caching from CoinGecko/Dexscreener

#### `swapJobs`
- Background swap execution queue
- Jupiter quote storage
- Idempotent processing
- Telegram message updates

#### `deposits` / `withdrawals`
- TRON bridge integration
- Status tracking (pending, completed, failed)
- Address generation and monitoring

### 4. Privacy Infrastructure

#### Custom ANV Address System
Each user wallet receives a unique ANV-prefixed identifier:
```
Format: ANV + 41 random alphanumeric characters
Example: ANVx7k2mP9wQzT4nL6vR8cH3jK1aS5dF9gB0eX2yU7i
```

Benefits:
- No exposure of Solana public keys
- Privacy-preserved wallet identification
- Easy recognition in explorer

#### Encrypted Private Key Storage
All Solana keypairs encrypted using AES-256-GCM:
```typescript
const encryptedKey = encrypt(privateKeyJSON, masterSecret);
// Stored in database as text field
// Decrypted only when needed for signing
```

#### Privacy-Preserved Transaction Hashes
Transaction IDs follow Solana format but use custom prefixes:
```
ANVBUY + 82 random chars  = Buy transactions
ANVSEL + 82 random chars  = Sell transactions
ANVDEP + 82 random chars  = Deposits
ANVWIT + 82 random chars  = Withdrawals
```

Blockchain tx hash stored separately for audit verification.

## Data Flow

### Swap Execution Flow

```
1. User initiates swap on frontend
   ↓
2. API validates request (Zod schema)
   ↓
3. Fetch Jupiter quote
   ↓
4. Create swap job in database
   ↓
5. Background worker picks up job
   ↓
6. Sign and send transaction to Solana
   ↓
7. Update transaction status
   ↓
8. Notify user via WebSocket/Telegram
   ↓
9. Update token holdings and balances
```

### Deposit Flow (Cross-Chain Bridge)

```
1. User requests deposit on trade.anovex.io
   ↓
2. Generate unique multi-chain deposit address
   ↓
3. Display QR code and address to user
   ↓
4. Background monitor polls blockchain network
   ↓
5. Detect incoming cross-chain transaction
   ↓
6. Convert assets to SOL via decentralized bridge
   ↓
7. Credit user's Anovex wallet balance
   ↓
8. Create transaction record with ANVDEP hash
```

## Security Measures

### Private Key Protection
- **At Rest**: AES-256-GCM encryption in PostgreSQL
- **In Transit**: HTTPS-only communication
- **In Memory**: Keys decrypted only for signing, immediately discarded

### Session Security
- PostgreSQL-backed sessions
- 400-day cookie lifetime for persistent login
- httpOnly, secure, sameSite cookies
- CSRF protection

### Input Validation
- Zod schemas on all API endpoints
- Decimal precision handling for crypto amounts
- Address format verification

### Rate Limiting
- Per-user swap limits
- API request throttling
- Telegram bot flood protection

## Scalability

### Database Optimization
- Indexed queries on wallet_id and transaction IDs
- Partial indexes on active records
- Connection pooling

### Background Job Processing
- Queue-based swap execution
- Retry logic with exponential backoff
- Idempotent operations

### Caching Strategy
- Token metadata caching
- Price data TTL (5 minutes)
- Session storage in Redis (future)

## Deployment

### Development
```bash
npm run dev  # Runs both Vite frontend and Express backend
```

### Production
```bash
npm run build  # Builds frontend and backend
npm start      # Runs production server
```

### Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Session encryption key
- `TELEGRAM_BOT_TOKEN`: Telegram bot API token
- `SOLANA_RPC_URL`: Solana RPC endpoint

## Future Enhancements

1. **Zero-Knowledge Proof Integration**: Full ZK-SNARK circuits for on-chain privacy
2. **Multi-Chain Expansion**: Ethereum and BSC support
3. **Liquidity Pools**: Native Anovex AMM
4. **Governance**: ANV token and DAO structure
5. **Mobile Apps**: Native iOS/Android applications
