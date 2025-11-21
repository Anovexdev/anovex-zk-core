import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Wallets - Anovex custom wallet system (no username/password)
export const wallets = pgTable("wallets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletAddress: varchar("wallet_address", { length: 50 }).unique(), // ANV prefix + 41 random alphanumeric chars = 44 total (internal identifier) - nullable temporarily for migration
  privateKey: text("private_key").notNull().unique(), // Solana keypair byte array as JSON string (encrypted)
  telegramUserId: text("telegram_user_id"), // Telegram user ID for bot integration (nullable for web users) - NO UNIQUE to support multi-wallet
  walletName: text("wallet_name"), // Optional user-defined wallet name (nullable)
  isActive: boolean("is_active").notNull().default(true), // Only one wallet can be active per user at a time
  createdAt: timestamp("created_at").notNull().defaultNow(),
  // Temporary conversation state (persisted across bot restarts)
  pendingWithdrawAmount: varchar("pending_withdraw_amount"), // Decimal string, null when not in withdraw flow
});

// System Wallets - Dual-wallet TRON bridge system
export const systemWallets = pgTable("system_wallets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 50 }).notNull().unique(), // 'privacy_relay_node' or 'liquidity_router_node'
  blockchain: varchar("blockchain", { enum: ['tron', 'solana'] }).notNull(),
  address: text("address").notNull(), // Public address
  privateKey: text("private_key").notNull(), // Encrypted private key
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Balances - SOL balance system
export const balances = pgTable("balances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletId: varchar("wallet_id").notNull().references(() => wallets.id, { onDelete: 'cascade' }),
  solBalance: decimal("sol_balance", { precision: 18, scale: 9 }).notNull().default("0"), // SOL has 9 decimals
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Transactions - All activity (deposit, buy, sell, withdraw)
export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletId: varchar("wallet_id").notNull().references(() => wallets.id, { onDelete: 'cascade' }),
  txhash: varchar("txhash").notNull().unique(), // ANVBUY/ANVSEL/ANVDEP/ANVWIT + 82 random chars (88 total, matching Solscan)
  txhashLegacy: text("txhash_legacy"), // Backup of old hash format (for migration safety)
  chainTxhash: text("chain_txhash"), // Real blockchain tx hash (nullable - for audit/verification)
  blockNumber: text("block_number"), // Solana block number (nullable - populated from blockchain for deposit/withdraw)
  instructions: text("instructions"), // Transaction instruction detail (e.g., "buy", "SetComputeUnitLimit")
  type: varchar("type", { enum: ['deposit', 'buy', 'sell', 'withdraw'] }).notNull(),
  tokenAddress: text("token_address"), // SPL contract address (null for deposit/withdraw)
  tokenSymbol: text("token_symbol"), // e.g., "SOL", "BONK"
  amount: decimal("amount", { precision: 18, scale: 6 }).notNull(),
  solValue: decimal("sol_value", { precision: 18, scale: 9 }), // SOL equivalent value (for display in explorer)
  priceUsd: decimal("price_usd", { precision: 18, scale: 6 }), // Price at execution
  costBasisAtSale: decimal("cost_basis_at_sale", { precision: 18, scale: 6 }), // Entry price snapshot at time of sell (for SELL only)
  realizedPnl: decimal("realized_pnl", { precision: 18, scale: 6 }), // Realized profit/loss (for SELL only)
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  status: varchar("status", { enum: ['pending', 'completed', 'failed'] }).notNull().default('pending'),
  withdrawalId: varchar("withdrawal_id").references(() => withdrawals.id, { onDelete: 'set null' }), // Link to withdrawal record (for withdraw type only)
  depositId: varchar("deposit_id").references(() => deposits.id, { onDelete: 'set null' }), // Link to deposit record (for deposit type only)
});

// Token Holdings - SPL token balances with cost basis tracking
export const tokenHoldings = pgTable("token_holdings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletId: varchar("wallet_id").notNull().references(() => wallets.id, { onDelete: 'cascade' }),
  mint: text("mint").notNull(), // SPL token mint address
  symbol: varchar("symbol", { length: 20 }).notNull(), // e.g., "BONK", "POPCAT"
  amount: decimal("amount", { precision: 18, scale: 9 }).notNull(), // Token amount (9 decimals)
  pendingInAmount: decimal("pending_in_amount", { precision: 18, scale: 9 }).notNull().default("0"), // Tokens being bought (not yet confirmed on-chain)
  averageEntryPrice: decimal("average_entry_price", { precision: 18, scale: 6 }), // Weighted average buy price in USD
  totalCostBasis: decimal("total_cost_basis", { precision: 18, scale: 6 }), // Total USD spent on this position
  lastPriceUsd: decimal("last_price_usd", { precision: 18, scale: 6 }), // Latest token price from Dexscreener
  lastPriceUpdatedAt: timestamp("last_price_updated_at"), // When price was last fetched
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  // Unique constraint for ON CONFLICT support
  walletMintUnique: sql`UNIQUE (wallet_id, mint)`,
}));

// Token Metadata - Cache for token symbols, names, logos
export const tokenMetadata = pgTable("token_metadata", {
  mint: text("mint").primaryKey(), // SPL token mint address
  symbol: varchar("symbol", { length: 20 }).notNull(), // e.g., "PUMP", "Useless"
  name: text("name"), // Full token name
  decimals: decimal("decimals", { precision: 2, scale: 0 }).notNull(), // Token decimals
  logoUri: text("logo_uri"), // Token logo URL
  coingeckoId: text("coingecko_id"), // CoinGecko ID for price tracking
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Swap Jobs - Background swap execution queue
export const swapJobs = pgTable("swap_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletId: varchar("wallet_id").notNull().references(() => wallets.id, { onDelete: 'cascade' }),
  transactionId: varchar("transaction_id").notNull().references(() => transactions.id, { onDelete: 'cascade' }), // Links to PENDING transaction
  type: varchar("type", { enum: ['buy', 'sell'] }).notNull(),
  tokenMint: text("token_mint").notNull(), // SPL token address
  tokenSymbol: varchar("token_symbol", { length: 20 }).notNull(),
  tokenDecimals: decimal("token_decimals", { precision: 2, scale: 0 }).notNull(), // Token decimals (e.g., 6, 9)
  solAmount: decimal("sol_amount", { precision: 18, scale: 9 }).notNull(), // SOL amount being spent (BUY) or received (SELL)
  tokenAmount: decimal("token_amount", { precision: 18, scale: 9 }), // Expected token amount from quote
  jupiterQuote: text("jupiter_quote").notNull(), // Serialized Jupiter quote JSON
  telegramChatId: text("telegram_chat_id"), // Telegram chat ID for message editing
  telegramMessageId: text("telegram_message_id"), // Telegram message ID for editing after completion
  chainTxhash: text("chain_txhash"), // IDEMPOTENCY: Solana transaction hash from on-chain swap execution (stored immediately after swap)
  status: varchar("status", { enum: ['pending', 'processing', 'completed', 'failed'] }).notNull().default('pending'),
  failureReason: text("failure_reason"), // Error message if failed
  createdAt: timestamp("created_at").notNull().defaultNow(),
  processedAt: timestamp("processed_at"), // When background worker picked it up
  completedAt: timestamp("completed_at"), // When swap finished
});

// Monitor Sessions - Live portfolio monitoring in Telegram
export const monitorSessions = pgTable("monitor_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chatId: text("chat_id").notNull(), // Telegram chat ID
  messageId: text("message_id").notNull(), // Telegram message ID for editing
  walletId: varchar("wallet_id").notNull().references(() => wallets.id, { onDelete: 'cascade' }),
  currentTokenIndex: decimal("current_token_index", { precision: 10, scale: 0 }).notNull().default("0"), // Which token is being displayed (0-indexed)
  tradeMode: varchar("trade_mode", { enum: ['buy', 'sell'] }).notNull().default('buy'), // Current trade mode
  isActive: boolean("is_active").notNull().default(true), // Whether auto-refresh is enabled
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  // Unique constraint: one active monitor per chat
  chatIdUnique: sql`UNIQUE (chat_id)`,
}));

// Portfolio - Holdings with PNL tracking (legacy, can be deprecated)
export const portfolio = pgTable("portfolio", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletId: varchar("wallet_id").notNull().references(() => wallets.id, { onDelete: 'cascade' }),
  tokenAddress: text("token_address").notNull(),
  tokenSymbol: text("token_symbol").notNull(),
  quantity: decimal("quantity", { precision: 18, scale: 6 }).notNull(),
  entryPrice: decimal("entry_price", { precision: 18, scale: 6 }).notNull(), // Average buy price
  currentPrice: decimal("current_price", { precision: 18, scale: 6 }), // Updated from API
  pnlPercent: decimal("pnl_percent", { precision: 10, scale: 2 }), // Calculated field
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Deposits - Dual-wallet TRON bridge tracking
export const deposits = pgTable("deposits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletId: varchar("wallet_id").notNull().references(() => wallets.id, { onDelete: 'cascade' }),
  step1DepositAddress: text("step1_deposit_address"), // Fresh SOL wallet created by SimpleSwap for Step 1
  step1ExchangeId: text("step1_exchange_id"), // SimpleSwap: User SOL → Privacy Relay Node TRX
  step2ExchangeId: text("step2_exchange_id"), // SimpleSwap: Privacy Relay Node TRX → Liquidity Router Node SOL
  solAmount: decimal("sol_amount", { precision: 18, scale: 9 }), // User deposited SOL
  trxAmount: decimal("trx_amount", { precision: 18, scale: 6 }), // TRX received from Step 1
  solReceived: decimal("sol_received", { precision: 18, scale: 9 }), // Final SOL credited to user (Step 2 output)
  telegramChatId: text("telegram_chat_id"), // Telegram chat ID for message editing
  telegramMessageId: text("telegram_message_id"), // Telegram message ID for editing during step transitions
  status: varchar("status", { enum: ['waiting_step1', 'waiting_step2', 'finished', 'failed', 'refunded', 'expired'] }).notNull().default('waiting_step1'),
  step1CompletedAt: timestamp("step1_completed_at"), // When Step 1 (SOL→TRX) finished
  step2CompletedAt: timestamp("step2_completed_at"), // When Step 2 (TRX→SOL) finished
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  // CRITICAL: Prevent deposit exploit - Only ONE pending deposit per wallet at a time
  // Partial unique index: Only enforced when status is waiting_step1 or waiting_step2
  onePendingDepositPerWallet: sql`UNIQUE (wallet_id) WHERE (status IN ('waiting_step1', 'waiting_step2'))`,
}));

// Withdrawals - Dual-wallet TRON bridge tracking (reverse flow)
export const withdrawals = pgTable("withdrawals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletId: varchar("wallet_id").notNull().references(() => wallets.id, { onDelete: 'cascade' }),
  destinationAddress: text("destination_address").notNull(), // User's SOL wallet address
  step1ExchangeId: text("step1_exchange_id"), // SimpleSwap: Liquidity Router Node SOL → Privacy Relay Node TRX
  step1TxId: text("step1_tx_id"), // Our SOL transaction ID for idempotency (prevents duplicate sends)
  step2ExchangeId: text("step2_exchange_id"), // SimpleSwap: Privacy Relay Node TRX → User SOL
  step2TxTo: text("step2_tx_to"), // Solana transaction hash of SOL sent to user (for Solscan verification)
  solDeducted: decimal("sol_deducted", { precision: 18, scale: 9 }), // SOL deducted from user balance
  trxAmount: decimal("trx_amount", { precision: 18, scale: 6 }), // TRX received from Step 1
  solSent: decimal("sol_sent", { precision: 18, scale: 9 }), // Final SOL sent to user (Step 2 output)
  telegramChatId: text("telegram_chat_id"), // Telegram chat ID for message editing
  telegramMessageId: text("telegram_message_id"), // Telegram message ID for editing during step transitions
  status: varchar("status", { enum: ['waiting_step1', 'waiting_step2', 'finished', 'failed', 'refunded', 'expired'] }).notNull().default('waiting_step1'),
  step1CompletedAt: timestamp("step1_completed_at"), // When Step 1 (SOL→TRX) finished
  step2CompletedAt: timestamp("step2_completed_at"), // When Step 2 (TRX→SOL) finished
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(), // CRITICAL: For stuck lock timeout detection
}, (table) => ({
  // CRITICAL: Prevent withdrawal exploit - Only ONE pending withdrawal per wallet at a time
  // Partial unique index: Only enforced when status is waiting_step1 or waiting_step2
  onePendingWithdrawalPerWallet: sql`UNIQUE (wallet_id) WHERE (status IN ('waiting_step1', 'waiting_step2'))`,
}));

// Insert Schemas
export const insertWalletSchema = createInsertSchema(wallets, {
  walletAddress: z.string().length(44).optional(), // ANV + 41 chars = 44 total (optional during migration)
  privateKey: z.string(), // Encrypted private key string
}).omit({
  id: true,
  createdAt: true,
});

export const insertSystemWalletSchema = createInsertSchema(systemWallets, {
  name: z.string(),
  blockchain: z.enum(['tron', 'solana']),
  address: z.string(),
  privateKey: z.string(), // Encrypted private key string
}).omit({
  id: true,
  createdAt: true,
});

export const insertBalanceSchema = createInsertSchema(balances).omit({
  id: true,
  updatedAt: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  timestamp: true,
});

export const insertTokenHoldingSchema = createInsertSchema(tokenHoldings).omit({
  id: true,
  updatedAt: true,
});

export const insertTokenMetadataSchema = createInsertSchema(tokenMetadata).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertPortfolioSchema = createInsertSchema(portfolio).omit({
  id: true,
  updatedAt: true,
});

export const insertDepositSchema = createInsertSchema(deposits).omit({
  id: true,
  createdAt: true,
});

export const insertWithdrawalSchema = createInsertSchema(withdrawals).omit({
  id: true,
  createdAt: true,
});

export const insertSwapJobSchema = createInsertSchema(swapJobs).omit({
  id: true,
  createdAt: true,
  processedAt: true,
  completedAt: true,
});

export const insertMonitorSessionSchema = createInsertSchema(monitorSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type Wallet = typeof wallets.$inferSelect;
export type InsertWallet = z.infer<typeof insertWalletSchema>;

export type SystemWallet = typeof systemWallets.$inferSelect;
export type InsertSystemWallet = z.infer<typeof insertSystemWalletSchema>;

export type Balance = typeof balances.$inferSelect;
export type InsertBalance = z.infer<typeof insertBalanceSchema>;

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

export type TokenHolding = typeof tokenHoldings.$inferSelect;
export type InsertTokenHolding = z.infer<typeof insertTokenHoldingSchema>;

export type TokenMetadata = typeof tokenMetadata.$inferSelect;
export type InsertTokenMetadata = z.infer<typeof insertTokenMetadataSchema>;

export type Portfolio = typeof portfolio.$inferSelect;
export type InsertPortfolio = z.infer<typeof insertPortfolioSchema>;

export type Deposit = typeof deposits.$inferSelect;
export type InsertDeposit = z.infer<typeof insertDepositSchema>;

export type Withdrawal = typeof withdrawals.$inferSelect;
export type InsertWithdrawal = z.infer<typeof insertWithdrawalSchema>;

export type SwapJob = typeof swapJobs.$inferSelect;
export type InsertSwapJob = z.infer<typeof insertSwapJobSchema>;

export type MonitorSession = typeof monitorSessions.$inferSelect;
export type InsertMonitorSession = z.infer<typeof insertMonitorSessionSchema>;

// pANV Linked Wallets - Track SOL addresses holding ANV tokens linked to ANV wallets
export const panvLinkedWallets = pgTable("panv_linked_wallets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  solAddress: text("sol_address").notNull(), // External SOL wallet holding ANV tokens
  anvWalletAddress: varchar("anv_wallet_address", { length: 50 }).notNull(), // ANV wallet address (not ID)
  anvTokenBalance: decimal("anv_token_balance", { precision: 18, scale: 9 }).notNull().default("0"), // Current ANV balance on SOL address
  isEligible: boolean("is_eligible").notNull().default(false), // True if balance >= 1,000,000 ANV
  lastCheckedAt: timestamp("last_checked_at"), // When balance was last verified
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  // One SOL address can only be linked to one ANV wallet
  solAddressUnique: sql`UNIQUE (sol_address)`,
}));

// pANV Rewards Cache - Store calculated rewards for performance
export const panvRewardsCache = pgTable("panv_rewards_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  linkedWalletId: varchar("linked_wallet_id").notNull().references(() => panvLinkedWallets.id, { onDelete: 'cascade' }),
  anvTokenBalance: decimal("anv_token_balance", { precision: 18, scale: 9 }).notNull(), // ANV balance snapshot
  tradingVolumeUsd: decimal("trading_volume_usd", { precision: 18, scale: 6 }).notNull(), // Total trading volume in USD
  holdingMultiplier: decimal("holding_multiplier", { precision: 5, scale: 2 }).notNull(), // e.g., 1.00, 1.50, 2.00
  volumeMultiplier: decimal("volume_multiplier", { precision: 5, scale: 2 }).notNull(), // e.g., 1.00, 1.20, 1.50
  totalPanvEarned: decimal("total_panv_earned", { precision: 18, scale: 6 }).notNull(), // Final pANV rewards
  calculatedAt: timestamp("calculated_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Insert Schemas
export const insertPanvLinkedWalletSchema = createInsertSchema(panvLinkedWallets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPanvRewardsCacheSchema = createInsertSchema(panvRewardsCache).omit({
  id: true,
  calculatedAt: true,
  updatedAt: true,
});

// Types
export type PanvLinkedWallet = typeof panvLinkedWallets.$inferSelect;
export type InsertPanvLinkedWallet = z.infer<typeof insertPanvLinkedWalletSchema>;

export type PanvRewardsCache = typeof panvRewardsCache.$inferSelect;
export type InsertPanvRewardsCache = z.infer<typeof insertPanvRewardsCacheSchema>;
