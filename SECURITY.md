# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

### Where to Report

Send security vulnerabilities to: **security@anovex.io**

### What to Include

- Type of vulnerability
- Full paths of source file(s) related to the vulnerability
- Location of the affected source code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the vulnerability

### Response Timeline

- **Initial Response**: Within 48 hours
- **Vulnerability Assessment**: Within 7 days
- **Fix Development**: Depends on severity (critical issues prioritized)
- **Public Disclosure**: After fix is deployed and users have updated

## Security Best Practices

### For Users

1. **Never share your private keys** - Anovex team will never ask for them
2. **Verify URLs** - Always check you're on trade.anovex.io
3. **Keep software updated** - Use the latest version
4. **Enable 2FA** - For Telegram bot access (if available)
5. **Use hardware wallets** - For large holdings

### For Developers

1. **Environment Variables** - Never commit `.env` files
2. **Dependency Audits** - Run `npm audit` regularly
3. **Input Validation** - Sanitize all user inputs
4. **Encryption Keys** - Use strong, randomly generated keys
5. **Session Security** - Implement proper session timeout

## Security Features

### Implemented

- ✅ AES-256-GCM encryption for private keys
- ✅ PBKDF2 key derivation (100,000 iterations)
- ✅ Secure session management with httpOnly cookies
- ✅ Input validation with Zod schemas
- ✅ SQL injection protection via Drizzle ORM
- ✅ Rate limiting on API endpoints
- ✅ Non-custodial architecture

### Roadmap

- 🔜 Zero-Knowledge proof integration (Phase 2)
- 🔜 Multi-signature wallet support
- 🔜 Hardware wallet integration
- 🔜 Audit by third-party security firm
- 🔜 Bug bounty program

## Known Limitations

1. **Master Key Security**: `ENCRYPTION_KEY` environment variable is critical - compromise means all encrypted keys are at risk
2. **Session Storage**: PostgreSQL session store - ensure database is properly secured
3. **RPC Reliance**: Depends on Solana RPC availability and integrity
4. **Third-Party APIs**: Swap execution relies on Jupiter Aggregator uptime

## Incident Response

In case of security incident:

1. **Immediate**: System shutdown if critical
2. **Assessment**: Determine scope and impact
3. **Mitigation**: Deploy fixes
4. **Communication**: Notify affected users
5. **Post-Mortem**: Publish incident report

## Security Audits

- **Internal Audits**: Quarterly code reviews
- **External Audits**: Planned
- **Penetration Testing**: Planned

## Contact

- **Security Issues**: security@anovex.io
- **General Support**: dev@anovex.io
- **Telegram**: [@AnovexCommunity](https://t.me/AnovexCommunity)

---

**PGP Key** (for encrypted communications):
```
Coming soon
```
