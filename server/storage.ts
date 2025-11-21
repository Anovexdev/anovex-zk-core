// Reference: blueprint:javascript_database
import { 
  wallets, balances, transactions, portfolio, deposits, withdrawals, systemWallets, tokenHoldings,
  type Wallet, type InsertWallet,
  type Balance, type InsertBalance,
  type Transaction, type InsertTransaction,
  type Portfolio, type InsertPortfolio,
  type Deposit, type InsertDeposit,
  type Withdrawal, type InsertWithdrawal,
  type SystemWallet, type InsertSystemWallet,
  type TokenHolding, type InsertTokenHolding
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  // Wallet operations
  getWallet(id: string): Promise<Wallet | undefined>;
  getWalletByPrivateKey(privateKey: string): Promise<Wallet | undefined>;
  getWalletByAddress(walletAddress: string): Promise<Wallet | undefined>;
  getAllWallets(): Promise<Wallet[]>;
  createWallet(wallet: InsertWallet): Promise<Wallet>;
  
  // System Wallet operations
  getSystemWallet(name: string): Promise<SystemWallet | undefined>;
  getAllSystemWallets(): Promise<SystemWallet[]>;
  createSystemWallet(wallet: InsertSystemWallet): Promise<SystemWallet>;
  
  // Balance operations
  getBalance(walletId: string): Promise<Balance | undefined>;
  createBalance(balance: InsertBalance): Promise<Balance>;
  updateBalance(walletId: string, newBalance: string): Promise<Balance>;
  
  // Transaction operations
  getTransaction(txhash: string): Promise<Transaction | undefined>;
  getTransactionsByWallet(walletId: string): Promise<Transaction[]>;
  getAllTransactions(limit?: number): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransactionStatus(txhash: string, status: 'pending' | 'completed' | 'failed'): Promise<Transaction>;
  
  // Token Holdings operations
  getTokenHoldings(walletId: string): Promise<TokenHolding[]>;
  getTokenHolding(walletId: string, mint: string): Promise<TokenHolding | undefined>;
  upsertTokenHolding(walletId: string, mint: string, symbol: string, amount: string): Promise<TokenHolding>;
  deleteTokenHolding(id: string): Promise<void>;
  
  // Portfolio operations (legacy)
  getPortfolio(walletId: string): Promise<Portfolio[]>;
  getPortfolioItem(walletId: string, tokenAddress: string): Promise<Portfolio | undefined>;
  createPortfolioItem(item: InsertPortfolio): Promise<Portfolio>;
  updatePortfolioItem(id: string, updates: Partial<Portfolio>): Promise<Portfolio>;
  
  // Deposit operations
  getDeposit(id: string): Promise<Deposit | undefined>;
  getDepositByStep1ExchangeId(exchangeId: string): Promise<Deposit | undefined>;
  getDepositByStep2ExchangeId(exchangeId: string): Promise<Deposit | undefined>;
  getDepositsByWallet(walletId: string): Promise<Deposit[]>;
  createDeposit(deposit: InsertDeposit): Promise<Deposit>;
  updateDepositStatus(id: string, status: 'waiting_step1' | 'waiting_step2' | 'finished' | 'failed' | 'refunded', solReceived?: string): Promise<Deposit>;
  updateDepositStep1(id: string, step1ExchangeId: string): Promise<Deposit>;
  updateDepositStep2(id: string, step2ExchangeId: string): Promise<Deposit>;
  
  // Withdrawal operations
  getWithdrawal(id: string): Promise<Withdrawal | undefined>;
  getWithdrawalByStep1ExchangeId(exchangeId: string): Promise<Withdrawal | undefined>;
  getWithdrawalByStep2ExchangeId(exchangeId: string): Promise<Withdrawal | undefined>;
  getWithdrawalsByWallet(walletId: string): Promise<Withdrawal[]>;
  createWithdrawal(withdrawal: InsertWithdrawal): Promise<Withdrawal>;
  updateWithdrawalStatus(id: string, status: 'waiting_step1' | 'waiting_step2' | 'finished' | 'failed' | 'refunded', solSent?: string): Promise<Withdrawal>;
  updateWithdrawalStep1(id: string, step1ExchangeId: string): Promise<Withdrawal>;
  updateWithdrawalStep2(id: string, step2ExchangeId: string): Promise<Withdrawal>;
}

export class DatabaseStorage implements IStorage {
  // Wallet operations
  async getWallet(id: string): Promise<Wallet | undefined> {
    const [wallet] = await db.select().from(wallets).where(eq(wallets.id, id));
    return wallet || undefined;
  }

  async getWalletByPrivateKey(privateKey: string): Promise<Wallet | undefined> {
    const [wallet] = await db.select().from(wallets).where(eq(wallets.privateKey, privateKey));
    return wallet || undefined;
  }

  async getWalletByAddress(walletAddress: string): Promise<Wallet | undefined> {
    const [wallet] = await db.select().from(wallets).where(eq(wallets.walletAddress, walletAddress));
    return wallet || undefined;
  }

  async getAllWallets(): Promise<Wallet[]> {
    return await db.select().from(wallets);
  }

  async createWallet(insertWallet: InsertWallet): Promise<Wallet> {
    const [wallet] = await db.insert(wallets).values(insertWallet).returning();
    return wallet;
  }

  // System Wallet operations
  async getSystemWallet(name: string): Promise<SystemWallet | undefined> {
    const [wallet] = await db.select().from(systemWallets).where(eq(systemWallets.name, name));
    return wallet || undefined;
  }

  async getAllSystemWallets(): Promise<SystemWallet[]> {
    return await db.select().from(systemWallets);
  }

  async createSystemWallet(insertSystemWallet: InsertSystemWallet): Promise<SystemWallet> {
    const [wallet] = await db.insert(systemWallets).values(insertSystemWallet).returning();
    return wallet;
  }

  // Balance operations
  async getBalance(walletId: string): Promise<Balance | undefined> {
    const [balance] = await db.select().from(balances).where(eq(balances.walletId, walletId));
    return balance || undefined;
  }

  async createBalance(insertBalance: InsertBalance): Promise<Balance> {
    const [balance] = await db.insert(balances).values(insertBalance).returning();
    return balance;
  }

  /**
   * @deprecated SECURITY WARNING: Direct balance manipulation without audit trail!
   * NEVER use this function. All balance changes MUST go through atomic transactions
   * with corresponding transaction records. See routes.ts for correct patterns:
   * - Deposit credit: polling.ts line 300-306
   * - Withdraw deduct: routes.ts line 1148-1161
   * - Swap BUY/SELL: routes.ts line 1731-1759
   * 
   * This function exists ONLY for backward compatibility and will throw error if called.
   */
  async updateBalance(walletId: string, newBalance: string): Promise<Balance> {
    throw new Error(
      "SECURITY VIOLATION: Direct balance manipulation is forbidden! " +
      "All balance changes MUST have audit trail via transaction records. " +
      "Use atomic SQL transactions in routes.ts or polling.ts instead."
    );
  }

  // Transaction operations
  async getTransaction(txhash: string): Promise<Transaction | undefined> {
    const [tx] = await db.select().from(transactions).where(eq(transactions.txhash, txhash));
    return tx || undefined;
  }

  async getTransactionsByWallet(walletId: string): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(eq(transactions.walletId, walletId))
      .orderBy(desc(transactions.timestamp));
  }

  async getAllTransactions(limit: number = 50): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .orderBy(desc(transactions.timestamp))
      .limit(limit);
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const [tx] = await db.insert(transactions).values(insertTransaction).returning();
    return tx;
  }

  async updateTransactionStatus(txhash: string, status: 'pending' | 'completed' | 'failed'): Promise<Transaction> {
    const [tx] = await db
      .update(transactions)
      .set({ status })
      .where(eq(transactions.txhash, txhash))
      .returning();
    return tx;
  }

  // Portfolio operations
  async getPortfolio(walletId: string): Promise<Portfolio[]> {
    return await db
      .select()
      .from(portfolio)
      .where(eq(portfolio.walletId, walletId));
  }

  async getPortfolioItem(walletId: string, tokenAddress: string): Promise<Portfolio | undefined> {
    const [item] = await db
      .select()
      .from(portfolio)
      .where(and(
        eq(portfolio.walletId, walletId),
        eq(portfolio.tokenAddress, tokenAddress)
      ));
    return item || undefined;
  }

  async createPortfolioItem(insertPortfolio: InsertPortfolio): Promise<Portfolio> {
    const [item] = await db.insert(portfolio).values(insertPortfolio).returning();
    return item;
  }

  async updatePortfolioItem(id: string, updates: Partial<Portfolio>): Promise<Portfolio> {
    const [item] = await db
      .update(portfolio)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(portfolio.id, id))
      .returning();
    return item;
  }

  // Token Holdings operations
  async getTokenHoldings(walletId: string): Promise<TokenHolding[]> {
    return await db
      .select()
      .from(tokenHoldings)
      .where(eq(tokenHoldings.walletId, walletId));
  }

  async getTokenHolding(walletId: string, mint: string): Promise<TokenHolding | undefined> {
    const [holding] = await db
      .select()
      .from(tokenHoldings)
      .where(and(
        eq(tokenHoldings.walletId, walletId),
        eq(tokenHoldings.mint, mint)
      ));
    return holding || undefined;
  }

  async upsertTokenHolding(walletId: string, mint: string, symbol: string, amount: string): Promise<TokenHolding> {
    // Try to find existing holding
    const existing = await this.getTokenHolding(walletId, mint);

    if (existing) {
      // Update existing
      const [updated] = await db
        .update(tokenHoldings)
        .set({ amount, updatedAt: new Date() })
        .where(eq(tokenHoldings.id, existing.id))
        .returning();
      return updated;
    } else {
      // Insert new
      const [created] = await db
        .insert(tokenHoldings)
        .values({ walletId, mint, symbol, amount })
        .returning();
      return created;
    }
  }

  async deleteTokenHolding(id: string): Promise<void> {
    await db.delete(tokenHoldings).where(eq(tokenHoldings.id, id));
  }

  // Deposit operations
  async getDeposit(id: string): Promise<Deposit | undefined> {
    const [deposit] = await db.select().from(deposits).where(eq(deposits.id, id));
    return deposit || undefined;
  }

  async getDepositByStep1ExchangeId(exchangeId: string): Promise<Deposit | undefined> {
    const [deposit] = await db.select().from(deposits).where(eq(deposits.step1ExchangeId, exchangeId));
    return deposit || undefined;
  }

  async getDepositByStep2ExchangeId(exchangeId: string): Promise<Deposit | undefined> {
    const [deposit] = await db.select().from(deposits).where(eq(deposits.step2ExchangeId, exchangeId));
    return deposit || undefined;
  }

  async getDepositsByWallet(walletId: string): Promise<Deposit[]> {
    return await db
      .select()
      .from(deposits)
      .where(eq(deposits.walletId, walletId))
      .orderBy(desc(deposits.createdAt));
  }

  async createDeposit(insertDeposit: InsertDeposit): Promise<Deposit> {
    const [deposit] = await db.insert(deposits).values(insertDeposit).returning();
    return deposit;
  }

  async updateDepositStatus(
    id: string, 
    status: 'waiting_step1' | 'waiting_step2' | 'finished' | 'failed' | 'refunded',
    solReceived?: string
  ): Promise<Deposit> {
    const updateData: any = { status };
    if (solReceived) {
      updateData.solReceived = solReceived;
    }
    
    const [deposit] = await db
      .update(deposits)
      .set(updateData)
      .where(eq(deposits.id, id))
      .returning();
    return deposit;
  }

  async updateDepositStep1(id: string, step1ExchangeId: string): Promise<Deposit> {
    const [deposit] = await db
      .update(deposits)
      .set({ step1ExchangeId, status: 'waiting_step2' })
      .where(eq(deposits.id, id))
      .returning();
    return deposit;
  }

  async updateDepositStep2(id: string, step2ExchangeId: string): Promise<Deposit> {
    const [deposit] = await db
      .update(deposits)
      .set({ step2ExchangeId })
      .where(eq(deposits.id, id))
      .returning();
    return deposit;
  }
  
  // Withdrawal operations
  async getWithdrawal(id: string): Promise<Withdrawal | undefined> {
    const [withdrawal] = await db.select().from(withdrawals).where(eq(withdrawals.id, id));
    return withdrawal || undefined;
  }

  async getWithdrawalByStep1ExchangeId(exchangeId: string): Promise<Withdrawal | undefined> {
    const [withdrawal] = await db.select().from(withdrawals).where(eq(withdrawals.step1ExchangeId, exchangeId));
    return withdrawal || undefined;
  }

  async getWithdrawalByStep2ExchangeId(exchangeId: string): Promise<Withdrawal | undefined> {
    const [withdrawal] = await db.select().from(withdrawals).where(eq(withdrawals.step2ExchangeId, exchangeId));
    return withdrawal || undefined;
  }

  async getWithdrawalsByWallet(walletId: string): Promise<Withdrawal[]> {
    return await db
      .select()
      .from(withdrawals)
      .where(eq(withdrawals.walletId, walletId))
      .orderBy(desc(withdrawals.createdAt));
  }

  async createWithdrawal(insertWithdrawal: InsertWithdrawal): Promise<Withdrawal> {
    const [withdrawal] = await db.insert(withdrawals).values(insertWithdrawal).returning();
    return withdrawal;
  }

  async updateWithdrawalStatus(
    id: string, 
    status: 'waiting_step1' | 'waiting_step2' | 'finished' | 'failed' | 'refunded',
    solSent?: string
  ): Promise<Withdrawal> {
    const updateData: any = { status };
    if (solSent) {
      updateData.solSent = solSent;
    }
    
    const [withdrawal] = await db
      .update(withdrawals)
      .set(updateData)
      .where(eq(withdrawals.id, id))
      .returning();
    return withdrawal;
  }

  async updateWithdrawalStep1(id: string, step1ExchangeId: string): Promise<Withdrawal> {
    const [withdrawal] = await db
      .update(withdrawals)
      .set({ step1ExchangeId, status: 'waiting_step2' })
      .where(eq(withdrawals.id, id))
      .returning();
    return withdrawal;
  }

  async updateWithdrawalStep2(id: string, step2ExchangeId: string): Promise<Withdrawal> {
    const [withdrawal] = await db
      .update(withdrawals)
      .set({ step2ExchangeId })
      .where(eq(withdrawals.id, id))
      .returning();
    return withdrawal;
  }
}

export const storage = new DatabaseStorage();
