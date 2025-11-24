# Anovex Protocol - Privacy Trading Platform

<p align="center">
  <strong>Anonymous Trading on Solana | Privacy-First Architecture</strong>
</p>

<p align="center">
  <a href="https://anovex.io">Website</a> •
  <a href="https://docs.anovex.io">Documentation</a> •
  <a href="https://trade.anovex.io">Trade App</a> •
  <a href="https://anvscan.com">Explorer</a>
</p>

---

## Overview

Anovex Protocol is a **privacy-focused trading platform** built on Solana, enabling anonymous cryptocurrency trading through encrypted wallet management and privacy-preserved transaction records. Users can trade, swap, and manage digital assets without exposing wallet addresses or linking transactions to real-world identities.

The platform combines custom ANV address system, AES-256-GCM encrypted key storage, and privacy-preserved transaction hashing to deliver enhanced anonymity for retail and professional traders.

**Built with:**
- Jupiter Aggregator for optimal swap routing
- Custom privacy wallet infrastructure
- Encrypted session management
- Multi-chain bridge integration

### Key Features

- **Privacy Wallet System**: Trade anonymously with custom ANV addresses
- **Encrypted Key Storage**: AES-256-GCM encryption for private keys
- **Multi-Chain Support**: Cross-chain deposits via bridge providers
- **Telegram Bot Integration**: Instant trading through secure bot interface
- **Privacy Explorer**: Transaction monitoring at anvscan.com without address exposure
- **Non-Custodial**: Users maintain full control of private keys at all times

### Roadmap to Zero-Knowledge Privacy

Anovex is evolving toward full Zero-Knowledge privacy. **Phase 1** (current) provides privacy through encryption and custom addressing. **Phase 2-3** will implement ZK-SNARK circuits for cryptographic privacy proofs. See [ROADMAP.md](./ROADMAP.md) for details.

## Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        UI[Web Interface<br/>trade.anovex.io]
        UI --> |React + TypeScript|COMP[UI Components]
        UI --> |Glassmorphism Theme|STYLE[Purple Theme]
        UI --> |Wouter|ROUTE[Multi-Domain Routing]
    end
    
    subgraph "API Layer"
        API[Express Backend]
        API --> |Drizzle ORM|DB[(PostgreSQL<br/>Database)]
        API --> |Session Store|SESSION[Secure Sessions]
        API --> |REST API|ROUTES[API Routes]
    end
    
    subgraph "Blockchain Layer"
        SOLANA[Solana Network]
        JUPITER[Jupiter Aggregator V6]
        BRIDGE[Cross-Chain Bridge]
        SOLANA --> JUPITER
        BRIDGE --> SOLANA
    end
    
    subgraph "Privacy Infrastructure"
        ANV[ANV Address System]
        ENCRYPT[AES-256-GCM Encryption]
        HASH[Privacy Transaction Hash]
    end
    
    UI --> API
    API --> SOLANA
    API --> ENCRYPT
    API --> ANV
    SOLANA --> HASH
    
    style UI fill:#8b5cf6,stroke:#6d28d9,color:#fff
    style API fill:#7c3aed,stroke:#5b21b6,color:#fff
    style SOLANA fill:#6366f1,stroke:#4338ca,color:#fff
    style ANV fill:#a78bfa,stroke:#7c3aed,color:#fff
```

## Tech Stack

### Frontend
- **Framework**: React 18 + TypeScript
- **Routing**: Wouter
- **Styling**: Tailwind CSS with custom purple theme
- **UI Components**: Radix UI + shadcn/ui
- **State Management**: TanStack Query
- **Build Tool**: Vite

### Backend
- **Runtime**: Node.js + Express
- **Database**: PostgreSQL (Neon)
- **ORM**: Drizzle
- **Session**: connect-pg-simple
- **Authentication**: Express Session

### Blockchain
- **Network**: Solana Mainnet
- **SDK**: @solana/web3.js
- **Swap Routing**: Jupiter Aggregator V6
- **Bridge**: Multi-chain gateway providers

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL database
- Solana RPC endpoint

### Installation

```bash
# Clone repository
git clone https://github.com/Anovexdev/anovex-zk-core.git
cd anovex-zk-core

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your DATABASE_URL and RPC endpoints

# Run database migrations
npm run db:push

# Start development server
npm run dev
```

### Environment Variables

```env
DATABASE_URL=postgresql://user:password@host:5432/database
SESSION_SECRET=your-secret-key-here
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
```

## Project Structure

```
anovex-zk-core/
├── client/              # React frontend application
│   ├── src/
│   │   ├── pages/      # Page components (Landing, Dashboard, Swap, etc.)
│   │   ├── components/ # Reusable UI components
│   │   ├── lib/        # Utility functions
│   │   └── config/     # Domain and app configuration
│   └── public/         # Static assets
├── server/              # Express backend API
│   ├── index.ts        # Server entry point
│   ├── routes.ts       # API route definitions
│   ├── storage.ts      # Database operations
│   ├── encryption.ts   # Private key encryption
│   ├── jupiter.ts      # Jupiter swap integration
│   └── telegram/       # Telegram bot handlers
├── shared/              # Shared types and schemas
│   └── schema.ts       # Drizzle database schema
├── docs/                # Documentation
└── package.json         # Dependencies and scripts
```

## Features

### Anovex Privacy Wallet
Custom wallet system with ANV-prefixed addresses for enhanced privacy. Each wallet generates unique Solana keypairs stored with AES-256-GCM encryption, ensuring maximum security without compromising user experience.

### Jupiter-Powered Swaps
Leverages Jupiter Aggregator for intelligent swap routing across multiple Solana DEXs. Automatic route optimization ensures best execution prices with minimal slippage while maintaining transaction privacy through our custom ANV address system.

### Cross-Chain Bridge
Multi-chain deposit system allowing users to fund Anovex wallets from multiple blockchains. Automated monitoring, secure conversion, and instant balance updates maintain seamless user experience.

### Telegram Bot Integration
Instant portfolio monitoring and trading through secure Telegram interface. Supports multi-wallet management, real-time PnL tracking, quick swaps, and withdrawal requests—all from encrypted chat sessions.

### Privacy Explorer (anvscan.com)
Dedicated transaction explorer with privacy-preserved hashing system. View complete trade history, portfolio analytics, and blockchain confirmations without exposing wallet addresses or sensitive transaction metadata.

## API Endpoints

### Wallet Management
- `POST /api/wallet/create` - Generate new Anovex wallet
- `POST /api/wallet/login` - Authenticate with private key
- `GET /api/wallet/balance` - Retrieve wallet balances

### Trading
- `POST /api/swap/buy` - Execute buy order
- `POST /api/swap/sell` - Execute sell order
- `GET /api/swap/quote` - Get real-time swap quote with optimal routing

### Deposits & Withdrawals
- `GET /api/deposit/address` - Generate deposit address
- `POST /api/withdraw` - Submit withdrawal request
- `GET /api/transactions` - Transaction history

See [API Documentation](https://docs.anovex.io/api) for complete endpoint reference.

## Security

- **Private Key Encryption**: AES-256-GCM encryption for all stored private keys
- **Session Security**: Secure session management with PostgreSQL persistence
- **Input Validation**: Comprehensive Zod schema validation on all API inputs
- **Rate Limiting**: Protection against abuse and DDoS attacks
- **Non-Custodial**: Users control their own keys at all times

Read more in [Security Documentation](./docs/security.md).

## Development Roadmap

Anovex Protocol is built in phases to deliver progressive privacy enhancements. See [ROADMAP.md](./ROADMAP.md) for detailed roadmap.

### Phase 1: Foundation (Current)
- Privacy wallet infrastructure with ANV addressing
- Encrypted key storage and session management
- Decentralized swap execution
- Multi-chain deposit bridges
- Telegram bot interface

### Phase 2: Advanced Privacy
- Zero-Knowledge proof circuits for transaction privacy
- On-chain proof verification system
- Enhanced anonymity set algorithms
- Mixer protocol integration
- Privacy-preserved order matching

### Phase 3: Full Protocol
- Native Anovex liquidity pools
- Governance token (ANV) and DAO
- Cross-chain ZK bridge infrastructure
- Mobile applications (iOS/Android)
- Institutional trading APIs

## Contributing

We welcome contributions to Anovex Protocol. Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Links

- **Website**: [anovex.io](https://anovex.io)
- **Documentation**: [docs.anovex.io](https://docs.anovex.io)
- **Trade Application**: [trade.anovex.io](https://trade.anovex.io)
- **Explorer**: [anvscan.com](https://anvscan.com)
- **X (Twitter)**: [@anovexofficial](https://x.com/anovexofficial)

## Contact

For questions, partnerships, or security reports:
- Email: dev@anovex.io
- X (Twitter): [@anovexofficial](https://x.com/anovexofficial)

---

<p align="center">
  <strong>Built with privacy in mind. Trade without a trace.</strong><br>
  © 2025 Anovex Protocol. All rights reserved.
</p>
