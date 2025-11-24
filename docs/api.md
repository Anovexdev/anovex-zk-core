# Anovex API Documentation

Base URL: `https://trade.anovex.io/api`

All API endpoints require HTTPS. Sessions are managed via secure cookies.

## Authentication

### POST `/api/wallet/create`
Generate a new Anovex privacy wallet.

**Request Body:**
```json
{
  "walletName": "My Wallet" // Optional
}
```

**Response:**
```json
{
  "walletId": "uuid",
  "walletAddress": "ANVx7k2mP9wQzT4nL6vR8cH3jK1aS5dF9gB0eX2yU7i",
  "privateKey": "base58-encoded-keypair",
  "solanaAddress": "8vN3Q..."
}
```

**Notes:**
- Private key returned only once. Store securely.
- Session automatically created.

---

### POST `/api/wallet/login`
Authenticate with existing wallet.

**Request Body:**
```json
{
  "privateKey": "base58-encoded-keypair"
}
```

**Response:**
```json
{
  "success": true,
  "walletId": "uuid",
  "walletAddress": "ANVx..."
}
```

---

### POST `/api/wallet/logout`
Destroy current session.

**Response:**
```json
{
  "success": true
}
```

---

## Wallet Operations

### GET `/api/wallet/balance`
Retrieve current wallet balances.

**Headers:**
```
Cookie: connect.sid=...
```

**Response:**
```json
{
  "solBalance": "1.234567890",
  "usdValue": "245.67",
  "walletAddress": "ANVx..."
}
```

---

### GET `/api/wallet/holdings`
Get all token holdings with PnL.

**Response:**
```json
{
  "holdings": [
    {
      "mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "symbol": "USDC",
      "amount": "100.500000",
      "usdValue": "100.50",
      "averageEntryPrice": "1.00",
      "unrealizedPnl": "0.00",
      "pnlPercentage": "0.00"
    }
  ],
  "totalValue": "100.50"
}
```

---

## Swap Operations

### GET `/api/swap/quote`
Get real-time swap quote with optimal routing.

**Query Parameters:**
- `inputMint` (string): Input token mint address
- `outputMint` (string): Output token mint address  
- `amount` (string): Amount in token decimals
- `slippageBps` (number, optional): Slippage tolerance in basis points (default: 50)

**Example:**
```
GET /api/swap/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjF...&amount=1000000000
```

**Response:**
```json
{
  "inputMint": "So11...",
  "outputMint": "EPjF...",
  "inAmount": "1000000000",
  "outAmount": "995000000",
  "priceImpactPct": "0.12",
  "route": {
    "marketInfos": [...],
    "amount": "1000000000",
    "slippageBps": 50
  }
}
```

---

### POST `/api/swap/buy`
Execute buy order (SOL → Token).

**Request Body:**
```json
{
  "tokenMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "solAmount": "0.1",
  "slippageBps": 50
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "uuid",
  "transactionId": "uuid",
  "txhash": "ANVBUYx7k2...",
  "estimatedTokenAmount": "100.50",
  "status": "pending"
}
```

**Notes:**
- Swap executed asynchronously via background job queue
- Poll `/api/swap/status/:jobId` for updates

---

### POST `/api/swap/sell`
Execute sell order (Token → SOL).

**Request Body:**
```json
{
  "tokenMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "tokenAmount": "100.0",
  "slippageBps": 50
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "uuid",
  "transactionId": "uuid",
  "txhash": "ANVSELx7k2...",
  "estimatedSolAmount": "0.095",
  "realizedPnl": "0.005",
  "status": "pending"
}
```

---

### GET `/api/swap/status/:jobId`
Check swap job status.

**Response:**
```json
{
  "jobId": "uuid",
  "status": "completed",
  "chainTxhash": "5Zx7...", // Real Solana transaction hash
  "completedAt": "2024-11-20T12:34:56.789Z"
}
```

**Possible statuses:**
- `pending` - Job queued
- `processing` - Transaction being signed
- `completed` - Successfully executed
- `failed` - Error occurred (see `failureReason`)

---

## Deposit & Withdrawal

### GET `/api/deposit/address`
Generate TRON deposit address.

**Response:**
```json
{
  "depositId": "uuid",
  "tronAddress": "TXyz123...",
  "qrCode": "data:image/png;base64,...",
  "instructions": "Send USDT (TRC20) to this address"
}
```

**Notes:**
- Deposits automatically monitored
- Conversion to SOL happens via SimpleSwap
- Credited to wallet balance upon confirmation

---

### POST `/api/withdraw`
Submit withdrawal request.

**Request Body:**
```json
{
  "destinationAddress": "8vN3Q...", // Solana address
  "amount": "0.5",
  "tokenMint": "So11111111111111111111111111111111111111112" // SOL
}
```

**Response:**
```json
{
  "success": true,
  "withdrawalId": "uuid",
  "txhash": "ANVWITx7k2...",
  "status": "pending",
  "estimatedFee": "0.000005"
}
```

---

### GET `/api/withdraw/status/:withdrawalId`
Check withdrawal status.

**Response:**
```json
{
  "withdrawalId": "uuid",
  "status": "completed",
  "chainTxhash": "5Zx7...",
  "completedAt": "2024-11-20T12:34:56.789Z"
}
```

---

## Transaction History

### GET `/api/transactions`
Retrieve transaction history.

**Query Parameters:**
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Results per page (default: 20, max: 100)
- `type` (string, optional): Filter by type (`deposit`, `buy`, `sell`, `withdraw`)

**Example:**
```
GET /api/transactions?page=1&limit=20&type=buy
```

**Response:**
```json
{
  "transactions": [
    {
      "id": "uuid",
      "txhash": "ANVBUYx7k2...",
      "type": "buy",
      "tokenSymbol": "USDC",
      "amount": "100.50",
      "priceUsd": "1.00",
      "timestamp": "2024-11-20T12:34:56.789Z",
      "status": "completed"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

---

### GET `/api/transactions/:txhash`
Get transaction details.

**Response:**
```json
{
  "id": "uuid",
  "txhash": "ANVBUYx7k2...",
  "chainTxhash": "5Zx7...",
  "type": "buy",
  "tokenAddress": "EPjF...",
  "tokenSymbol": "USDC",
  "amount": "100.50",
  "solValue": "0.095",
  "priceUsd": "1.00",
  "timestamp": "2024-11-20T12:34:56.789Z",
  "status": "completed",
  "blockNumber": "123456789"
}
```

---

## Token Metadata

### GET `/api/tokens/search`
Search for tokens by name or symbol.

**Query Parameters:**
- `q` (string): Search query

**Example:**
```
GET /api/tokens/search?q=BONK
```

**Response:**
```json
{
  "tokens": [
    {
      "mint": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
      "symbol": "BONK",
      "name": "Bonk",
      "decimals": 5,
      "logoUri": "https://..."
    }
  ]
}
```

---

### GET `/api/tokens/:mint`
Get token metadata.

**Response:**
```json
{
  "mint": "EPjF...",
  "symbol": "USDC",
  "name": "USD Coin",
  "decimals": 6,
  "logoUri": "https://...",
  "priceUsd": "1.00",
  "priceUpdatedAt": "2024-11-20T12:34:56.789Z"
}
```

---

## Portfolio Analytics

### GET `/api/portfolio/summary`
Get portfolio summary and statistics.

**Response:**
```json
{
  "totalValueUsd": "1234.56",
  "totalPnl": "123.45",
  "pnlPercentage": "11.11",
  "topHolding": {
    "symbol": "SOL",
    "valueUsd": "950.00"
  },
  "tradingVolume24h": "500.00",
  "activePositions": 5
}
```

---

## Error Responses

All endpoints return standard error format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request (validation error)
- `401` - Unauthorized (not logged in)
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

---

## Rate Limits

- **Anonymous**: 10 requests/minute
- **Authenticated**: 60 requests/minute
- **Swap Operations**: 5 swaps/minute per user

Exceeded limits return `429 Too Many Requests`.

---

## Webhooks (Coming Soon)

Future support for webhook notifications:
- Deposit confirmations
- Swap completions
- Withdrawal updates

---

For support: dev@anovex.io
