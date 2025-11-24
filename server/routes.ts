import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { deposits, balances, transactions, withdrawals, tokenHoldings, panvLinkedWallets, panvRewardsCache } from "@shared/schema";
import { eq, and, sql, desc, isNull, or } from "drizzle-orm";
import { Keypair } from "@solana/web3.js";
import { insertWalletSchema } from "@shared/schema";
import { encryptPrivateKey, verifyPrivateKey, decryptPrivateKey } from "./encryption";
import { getSolanaPrice, solToUsd, usdToSol } from "./coingecko";
import { getTokenPrices, getTokenMetadata } from "./pricing";
import { 
  createDepositStep1Exchange, 
  createDepositStep2Exchange,
  createWithdrawStep1Exchange,
  createWithdrawStep2Exchange,
  getExchangeStatus 
} from "./bridge-protocol";
import { getJupiterQuote, executeJupiterSwap, SOL_MINT, toLamports, getTokenDecimals, sendSolFromLiquidityRouterNode } from "./jupiter";
import { wallets, type Wallet } from "@shared/schema";
import { generateAnxTxHash } from "./swap-helpers";
import crypto from "crypto";
import { deriveANVAddressV2, deriveANVAddressV1, deriveANVAddresses, getPublicKeyFromPrivateKey } from "./anv-address";

// Anovex Liquidity Router (uses Jupiter Aggregator backend)
const LIQUIDITY_ROUTER_URL = "https://quote-api.jup.ag/v6";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // USDC SPL token

// Helper to create or retrieve wallet with deterministic ANV address
// Uses v2 (public key-based) with v1 (private key-based) fallback for migration
async function createWalletWithDeterministicAddress(encryptedKey: string, privateKeyBytes: Uint8Array): Promise<Wallet> {
  const addresses = deriveANVAddresses(privateKeyBytes);
  const walletAddressV2 = addresses.v2;
  const walletAddressV1 = addresses.v1;
  
  // STEP 1: Try to find wallet by v2 address (new, secure standard)
  let existingWallet = await db
    .select()
    .from(wallets)
    .where(eq(wallets.walletAddress, walletAddressV2))
    .limit(1)
    .then(rows => rows[0]);
  
  if (existingWallet) {
    return existingWallet;
  }
  
  // STEP 2: Try to find wallet by v1 address (legacy compatibility)
  existingWallet = await db
    .select()
    .from(wallets)
    .where(eq(wallets.walletAddress, walletAddressV1))
    .limit(1)
    .then(rows => rows[0]);
  
  if (existingWallet) {
    // Found legacy wallet - migrate it to v2 address
    console.log(`[ANV MIGRATION] Upgrading wallet ${existingWallet.id} from v1 (${walletAddressV1}) to v2 (${walletAddressV2})`);
    
    const [updated] = await db
      .update(wallets)
      .set({ walletAddress: walletAddressV2 })
      .where(eq(wallets.id, existingWallet.id))
      .returning();
    
    if (!updated) {
      throw new Error("Wallet migration failed: could not update to v2 address");
    }
    
    return updated;
  }
  
  // STEP 3: No existing wallet found - create new one with v2 address
  const [wallet] = await db
    .insert(wallets)
    .values({
      walletAddress: walletAddressV2,
      privateKey: encryptedKey,
    })
    .onConflictDoNothing()
    .returning();
  
  if (wallet) {
    return wallet;
  }
  
  // Race condition: wallet was created by another request, retrieve it
  const [newWallet] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.walletAddress, walletAddressV2));
  
  if (!newWallet) {
    throw new Error("Wallet creation failed: address exists but could not be retrieved");
  }
  
  return newWallet;
}

// Helper to update wallet address deterministically from private key
// Uses v2 (public key-based) standard
async function updateWalletAddress(walletId: string): Promise<string> {
  // Fetch wallet to get private key
  const [wallet] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.id, walletId));
  
  if (!wallet) {
    throw new Error(`Wallet not found: ${walletId}`);
  }
  
  // If already has address, return it
  if (wallet.walletAddress) {
    return wallet.walletAddress;
  }
  
  // Decrypt private key to derive ANV address (v2 - public key-based)
  const privateKeyArray = decryptPrivateKey(wallet.privateKey);
  const privateKeyBytes = new Uint8Array(privateKeyArray);
  const addresses = deriveANVAddresses(privateKeyBytes);
  const walletAddress = addresses.v2; // Use v2 (public key-based)
  
  // Try to update only if address is still null (prevents race with other updates)
  const [updated] = await db
    .update(wallets)
    .set({ walletAddress })
    .where(and(
      eq(wallets.id, walletId),
      sql`${wallets.walletAddress} IS NULL`
    ))
    .returning();
  
  if (updated) {
    return updated.walletAddress!;
  }
  
  // Check if wallet now has an address (another request succeeded)
  const [current] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.id, walletId));
  
  if (current?.walletAddress) {
    return current.walletAddress;
  }
  
  throw new Error("Failed to update wallet address");
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Wallet API routes
  
  // POST /api/wallet/create - Generate new Anovex wallet
  app.post("/api/wallet/create", async (req, res) => {
    try {
      // Generate Solana keypair
      const keypair = Keypair.generate();
      const privateKeyArray = Array.from(keypair.secretKey);
      
      // Encrypt private key before storing
      const encryptedKey = encryptPrivateKey(privateKeyArray);
      
      // Create wallet with deterministic ANV address derived from private key
      const wallet = await createWalletWithDeterministicAddress(encryptedKey, keypair.secretKey);
      
      // Create initial balance (0 SOL)
      await storage.createBalance({
        walletId: wallet.id,
        solBalance: "0",
      });
      
      // Create session immediately after wallet creation
      if (req.session) {
        req.session.walletId = wallet.id;
      }
      
      // Return private key to user (ONLY ONCE!)
      res.json({
        success: true,
        walletId: wallet.id,
        privateKey: privateKeyArray, // Return unencrypted to user
        message: "Save this private key! You won't see it again.",
      });
    } catch (error: any) {
      console.error("Wallet creation error:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to create wallet" 
      });
    }
  });
  
  // POST /api/wallet/login - Login with private key
  app.post("/api/wallet/login", async (req, res) => {
    try {
      const { privateKey } = req.body;
      console.log(`[LOGIN] Attempting login... Session ID: ${req.sessionID || 'none'}`);
      
      // Validate input
      if (!Array.isArray(privateKey) || privateKey.length !== 64) {
        return res.status(400).json({ 
          success: false, 
          error: "Invalid private key format. Expected 64-byte array." 
        });
      }
      
      // Encrypt and find/create wallet with this private key
      const privateKeyBytes = new Uint8Array(privateKey);
      const encryptedKey = encryptPrivateKey(privateKey);
      
      // createWalletWithDeterministicAddress handles v2/v1 lookup and migration
      const matchedWallet = await createWalletWithDeterministicAddress(encryptedKey, privateKeyBytes);
      
      console.log(`[LOGIN] Found/created wallet: ${matchedWallet.id} with ANV address: ${matchedWallet.walletAddress}`);
      
      // CRITICAL: Clear Telegram ownership when web user logs in
      // This enforces single-owner-per-wallet across all channels
      if (matchedWallet.telegramUserId) {
        console.log(`[LOGIN] Clearing Telegram ownership from wallet ${matchedWallet.id} (was: ${matchedWallet.telegramUserId})`);
        const [updated] = await db
          .update(wallets)
          .set({ 
            telegramUserId: null,
            isActive: false  // Deactivate for Telegram
          })
          .where(eq(wallets.id, matchedWallet.id))
          .returning();
        
        // Update in-memory reference with fresh data
        if (updated) {
          Object.assign(matchedWallet, updated);
        }
      }
      
      // CRITICAL: Activate wallet for web session (mirrors Telegram's ownership model)
      // This ensures symmetric ownership: Telegram uses isActive, web uses isActive + session
      if (!matchedWallet.isActive) {
        console.log(`[LOGIN] Activating wallet ${matchedWallet.id} for web session`);
        const [activated] = await db
          .update(wallets)
          .set({ isActive: true })
          .where(eq(wallets.id, matchedWallet.id))
          .returning();
        
        // Update in-memory reference with fresh data
        if (activated) {
          Object.assign(matchedWallet, activated);
        }
      }
      
      // Ensure wallet has a balance entry
      let balance = await storage.getBalance(matchedWallet.id);
      if (!balance) {
        await storage.createBalance({
          walletId: matchedWallet.id,
          solBalance: "0",
        });
        balance = await storage.getBalance(matchedWallet.id);
      }
      
      // Get balance
      const solBalance = parseFloat(balance?.solBalance || "0");
      const solPrice = await getSolanaPrice();
      const usdValue = solBalance * solPrice;
      
      // Create session (explicitly save for PostgreSQL session store)
      if (req.session) {
        req.session.walletId = matchedWallet.id;
        console.log(`[LOGIN] Setting session walletId: ${matchedWallet.id}, Session ID: ${req.sessionID}`);
        
        // Explicitly save session to ensure it's persisted
        await new Promise<void>((resolve, reject) => {
          req.session!.save((err) => {
            if (err) {
              console.error(`[LOGIN] Session save error:`, err);
              reject(err);
            } else {
              console.log(`[LOGIN] Session saved successfully! Session ID: ${req.sessionID}`);
              resolve();
            }
          });
        });
      } else {
        console.error(`[LOGIN] ERROR: req.session is undefined!`);
      }
      
      console.log(`[LOGIN] Success - returning response`);
      console.log(`[LOGIN] Cookie settings - httpOnly: true, secure: ${process.env.NODE_ENV === 'production'}, sameSite: lax, domain: undefined`);
      
      res.json({
        success: true,
        walletId: matchedWallet.id,
        solBalance: solBalance.toFixed(9),
        usdValue: usdValue.toFixed(2),
        solPrice: solPrice.toFixed(2),
        message: "Login successful",
      });
    } catch (error: any) {
      console.error("[LOGIN] Error:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Login failed" 
      });
    }
  });
  
  // GET /api/wallet/address - Get user's Anovex wallet address (internal identifier, NOT blockchain address)
  app.get("/api/wallet/address", async (req, res) => {
    try {
      const walletId = req.session?.walletId;
      
      if (!walletId) {
        return res.status(401).json({ 
          success: false, 
          error: "Not authenticated" 
        });
      }
      
      // Get wallet from database
      const wallet = await storage.getWallet(walletId);
      if (!wallet) {
        return res.status(404).json({ 
          success: false, 
          error: "Wallet not found" 
        });
      }
      
      // Return internal ANV wallet address (privacy-preserving identifier)
      // This is NOT a blockchain address - it's only trackable in Anovex's custom explorer
      
      // Auto-fix: If wallet has no address (migration failure), generate one now
      if (!wallet.walletAddress) {
        console.log(`[WALLET ADDRESS] Auto-generating address for wallet ${wallet.id}`);
        const newAddress = await updateWalletAddress(wallet.id);
        console.log(`[WALLET ADDRESS] Successfully generated ${newAddress} for wallet ${wallet.id}`);
        
        return res.json({
          success: true,
          address: newAddress,
          walletId: wallet.id,
        });
      }
      
      res.json({
        success: true,
        address: wallet.walletAddress,
        walletId: wallet.id,
      });
    } catch (error: any) {
      console.error("Wallet address fetch error:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to fetch wallet address" 
      });
    }
  });
  
  // GET /api/wallet/balance - Get portfolio balance (SOL + all tokens + total USD)
  app.get("/api/wallet/balance", async (req, res) => {
    try {
      console.log(`[BALANCE] Request - Session ID: ${req.sessionID || 'none'}, walletId: ${req.session?.walletId || 'none'}`);
      const walletId = req.session?.walletId;
      
      if (!walletId) {
        console.log(`[BALANCE] Unauthorized - no walletId in session`);
        return res.status(401).json({ 
          success: false, 
          error: "Not authenticated" 
        });
      }
      
      console.log(`[BALANCE] Authenticated - fetching balance for wallet: ${walletId}`);
      
      // Fetch SOL balance
      const balance = await storage.getBalance(walletId);
      const solAmount = parseFloat(balance?.solBalance || "0");
      const solPrice = await getSolanaPrice();
      const solUsd = solAmount * solPrice;
      
      // Fetch token holdings
      const holdings = await storage.getTokenHoldings(walletId);
      
      // Get metadata (price + logo) for all tokens in parallel
      const metadataPromises = holdings.map(async (holding) => {
        const metadata = await getTokenMetadata(holding.mint);
        return {
          holding,
          metadata
        };
      });
      
      const metadataResults = await Promise.all(metadataPromises);
      
      // Calculate token values with logos
      const tokens = metadataResults.map(({ holding, metadata }) => {
        const amount = parseFloat(holding.amount);
        const price = metadata?.price || 0;
        const usd = amount * price;
        
        return {
          mint: holding.mint,
          symbol: holding.symbol,
          amount: amount.toFixed(9),
          priceUsd: price.toFixed(6),
          totalUsd: usd.toFixed(2),
          logoURI: metadata?.logoURI
        };
      });
      
      // Calculate total portfolio value
      const tokensTotal = tokens.reduce((sum, t) => sum + parseFloat(t.totalUsd), 0);
      const totalUsd = solUsd + tokensTotal;
      
      res.json({
        success: true,
        sol: {
          amount: solAmount.toFixed(9),
          priceUsd: solPrice.toFixed(2),
          totalUsd: solUsd.toFixed(2),
        },
        tokens,
        totalUsd: totalUsd.toFixed(2),
      });
    } catch (error: any) {
      console.error("Balance fetch error:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to fetch balance" 
      });
    }
  });
  
  // POST /api/wallet/logout - Logout
  app.post("/api/wallet/logout", async (req, res) => {
    try {
      req.session?.destroy((err: any) => {
        if (err) {
          return res.status(500).json({ success: false, error: "Logout failed" });
        }
        res.json({ success: true, message: "Logged out successfully" });
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/wallet/list - Get all wallets for authenticated user
  app.get("/api/wallet/list", async (req, res) => {
    try {
      const walletId = req.session?.walletId;
      
      if (!walletId) {
        return res.status(401).json({ 
          success: false, 
          error: "Not authenticated" 
        });
      }
      
      // Get current wallet to check session ownership
      const [currentWallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.id, walletId));
      
      if (!currentWallet || currentWallet.telegramUserId) {
        // For now, only support multiple wallets for web users (no telegramUserId)
        // Telegram users get single wallet per user
        return res.json({
          success: true,
          wallets: currentWallet ? [currentWallet] : []
        });
      }
      
      // For web users without telegramUserId, fetch all wallets with same session pattern
      // Since we don't have userId, we use the session-based approach
      // For simplicity, return just the current wallet for now
      // TODO: Implement proper user ID system for multi-wallet support
      const allWallets = await db
        .select()
        .from(wallets)
        .where(eq(wallets.id, walletId));
      
      res.json({
        success: true,
        wallets: allWallets
      });
    } catch (error: any) {
      console.error("Wallet list error:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to fetch wallets" 
      });
    }
  });

  // POST /api/wallet/switch - Switch active wallet
  app.post("/api/wallet/switch", async (req, res) => {
    try {
      const walletId = req.session?.walletId;
      const { walletId: targetWalletId } = req.body;
      
      if (!walletId) {
        return res.status(401).json({ 
          success: false, 
          error: "Not authenticated" 
        });
      }
      
      if (!targetWalletId) {
        return res.status(400).json({ 
          success: false, 
          error: "Target wallet ID required" 
        });
      }
      
      // Verify target wallet exists
      const [targetWallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.id, targetWalletId));
      
      if (!targetWallet) {
        return res.status(404).json({ 
          success: false, 
          error: "Target wallet not found" 
        });
      }
      
      // Deactivate current wallet
      await db
        .update(wallets)
        .set({ isActive: false })
        .where(eq(wallets.id, walletId));
      
      // Activate target wallet
      await db
        .update(wallets)
        .set({ isActive: true })
        .where(eq(wallets.id, targetWalletId));
      
      // Update session to new wallet
      if (req.session) {
        req.session.walletId = targetWalletId;
        await new Promise<void>((resolve, reject) => {
          req.session!.save((err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }
      
      res.json({
        success: true,
        message: "Wallet switched successfully"
      });
    } catch (error: any) {
      console.error("Wallet switch error:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to switch wallet" 
      });
    }
  });

  // GET /api/wallet/export-key - Export private key for active wallet
  app.get("/api/wallet/export-key", async (req, res) => {
    try {
      const walletId = req.session?.walletId;
      
      if (!walletId) {
        return res.status(401).json({ 
          success: false, 
          error: "Not authenticated" 
        });
      }
      
      // Get wallet
      const [wallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.id, walletId));
      
      if (!wallet) {
        return res.status(404).json({ 
          success: false, 
          error: "Wallet not found" 
        });
      }
      
      // Decrypt private key
      const privateKeyArray = decryptPrivateKey(wallet.privateKey);
      
      // Return as JSON array format
      res.json({
        success: true,
        privateKey: JSON.stringify(privateKeyArray)
      });
    } catch (error: any) {
      console.error("Export key error:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to export private key" 
      });
    }
  });

  // POST /api/wallet/import - Import wallet from private key
  app.post("/api/wallet/import", async (req, res) => {
    try {
      const walletId = req.session?.walletId;
      const { privateKey } = req.body;
      
      if (!walletId) {
        return res.status(401).json({ 
          success: false, 
          error: "Not authenticated" 
        });
      }
      
      // Parse private key
      let privateKeyArray: number[];
      try {
        privateKeyArray = JSON.parse(privateKey);
      } catch {
        return res.status(400).json({ 
          success: false, 
          error: "Invalid private key format. Expected JSON array." 
        });
      }
      
      // Validate private key
      if (!Array.isArray(privateKeyArray) || privateKeyArray.length !== 64) {
        return res.status(400).json({ 
          success: false, 
          error: "Invalid private key. Expected 64-byte array." 
        });
      }
      
      // Encrypt private key
      const encryptedKey = encryptPrivateKey(privateKeyArray);
      const privateKeyBytes = new Uint8Array(privateKeyArray);
      
      // createWalletWithDeterministicAddress handles v2/v1 lookup and migration
      // If wallet already exists (v2 or v1), it will return the existing wallet
      const newWallet = await createWalletWithDeterministicAddress(encryptedKey, privateKeyBytes);
      
      // Check if this is the same wallet as the currently active one
      if (newWallet.id === walletId) {
        return res.status(400).json({ 
          success: false, 
          error: "This is the currently active wallet. Try a different private key." 
        });
      }
      
      // CRITICAL: Clear Telegram ownership when web user imports
      // This enforces single-owner-per-wallet across all channels
      if (newWallet.telegramUserId) {
        console.log(`[IMPORT] Clearing Telegram ownership from wallet ${newWallet.id} (was: ${newWallet.telegramUserId})`);
        const [updated] = await db
          .update(wallets)
          .set({ 
            telegramUserId: null,
            isActive: false  // Deactivate for Telegram
          })
          .where(eq(wallets.id, newWallet.id))
          .returning();
        
        // Update in-memory reference with fresh data
        if (updated) {
          Object.assign(newWallet, updated);
        }
      }
      
      // Check if this wallet is already in the user's wallet list
      const userWallets = await db
        .select()
        .from(wallets)
        .where(sql`${wallets.id} = ${newWallet.id}`);
      
      const isAlreadyOwnedByUser = userWallets.length > 0;
      if (isAlreadyOwnedByUser) {
        // Wallet exists and belongs to this user - just switch to it
        await db
          .update(wallets)
          .set({ isActive: false })
          .where(eq(wallets.id, walletId));
        
        await db
          .update(wallets)
          .set({ isActive: true })
          .where(eq(wallets.id, newWallet.id));
        
        if (req.session) {
          req.session.walletId = newWallet.id;
          await new Promise<void>((resolve, reject) => {
            req.session!.save((err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        }
        
        return res.json({
          success: true,
          message: "Switched to existing wallet successfully",
          walletId: newWallet.id
        });
      }
      
      // Create initial balance
      await storage.createBalance({
        walletId: newWallet.id,
        solBalance: "0",
      });
      
      // Deactivate current wallet
      await db
        .update(wallets)
        .set({ isActive: false })
        .where(eq(wallets.id, walletId));
      
      // Activate new wallet
      await db
        .update(wallets)
        .set({ isActive: true })
        .where(eq(wallets.id, newWallet.id));
      
      // Update session to new wallet
      if (req.session) {
        req.session.walletId = newWallet.id;
        await new Promise<void>((resolve, reject) => {
          req.session!.save((err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }
      
      res.json({
        success: true,
        message: "Wallet imported successfully",
        walletId: newWallet.id
      });
    } catch (error: any) {
      console.error("Import wallet error:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to import wallet" 
      });
    }
  });

  // Deposit API routes (Dual-Wallet TRON Bridge)
  
  // POST /api/deposit/initiate - Initialize dual-bridge deposit flow
  // Step 1: SOL → TRX to Privacy Relay Node (TRON Bridge)
  app.post("/api/deposit/initiate", async (req, res) => {
    try {
      const walletId = req.session?.walletId;
      
      if (!walletId) {
        return res.status(401).json({ 
          success: false, 
          error: "Not authenticated" 
        });
      }
      
      // SECURITY: Check if user already has a pending deposit
      const existingDeposits = await db
        .select()
        .from(deposits)
        .where(and(
          eq(deposits.walletId, walletId),
          sql`${deposits.status} IN ('waiting_step1', 'waiting_step2')`
        ));
      
      if (existingDeposits.length > 0) {
        return res.status(400).json({
          success: false,
          error: "You already have a pending deposit. Please wait for it to complete before creating a new one."
        });
      }
      
      const { solAmount } = req.body;
      const solAmountNum = parseFloat(solAmount);
      
      if (!solAmount || isNaN(solAmountNum) || solAmountNum < 0.05) {
        return res.status(400).json({ 
          success: false, 
          error: "Invalid SOL amount (minimum 0.05 SOL)" 
        });
      }
      
      // Get SOL price for USD display
      const solPrice = await getSolanaPrice();
      const usdAmount = solAmountNum * solPrice;
      
      // Get Privacy Relay Node (TRON Bridge)
      const tronWallet = await storage.getSystemWallet("privacy_relay_node");
      if (!tronWallet) {
        return res.status(500).json({ 
          success: false, 
          error: "System wallet not initialized" 
        });
      }
      
      // Create Step 1 exchange: SOL → TRX to Privacy Relay Node
      const step1Exchange = await createDepositStep1Exchange(
        solAmountNum.toString(),
        tronWallet.address
      );
      
      // Save deposit record AND transaction record (for history persistence)
      // Wrapped in try-catch to handle unique constraint violation gracefully
      let deposit;
      try {
        deposit = await storage.createDeposit({
          walletId,
          step1DepositAddress: step1Exchange.addressFrom,
          step1ExchangeId: step1Exchange.publicId,
          solAmount: solAmountNum.toFixed(9),
          status: 'waiting_step1'
        });
      } catch (dbError: any) {
        // CRITICAL: Unique constraint violation = user tried to create duplicate pending deposit
        if (dbError.code === '23505' || dbError.message?.includes('unique constraint')) {
          return res.status(400).json({
            success: false,
            error: "You already have a pending deposit. Please wait for it to complete before creating a new one."
          });
        }
        throw dbError; // Re-throw non-constraint errors
      }
      
      // Create transaction record immediately (visible in explorer)
      await db.insert(transactions).values({
        walletId,
        txhash: generateAnxTxHash('deposit'),
        type: 'deposit',
        instructions: 'transfer in',
        tokenAddress: null,
        tokenSymbol: 'SOL',
        amount: solAmountNum.toFixed(9),
        solValue: solAmountNum.toFixed(9),
        priceUsd: solPrice.toFixed(2),
        status: 'pending',
        depositId: deposit.id,
      });
      
      res.json({
        success: true,
        deposit: {
          id: deposit.id,
          status: 'waiting_step1',
          usdAmount: usdAmount.toFixed(2),
          solAmount: solAmountNum.toFixed(9),
          step1DepositAddress: step1Exchange.addressFrom,
          step1ExchangeId: step1Exchange.publicId,
          technicalSteps: [
            { step: 1, status: 'pending', label: 'STEALTH FUNDING REQUEST', description: `Send ${solAmountNum.toFixed(4)} SOL to privacy relay address` },
            { step: 2, status: 'waiting', label: 'ZK RELAY NETWORK SYNC', description: 'Privacy relay node coordinating anonymization' },
            { step: 3, status: 'waiting', label: 'SHADOW CONVERSION INITIATED', description: 'Initiating stealth liquidity conversion' },
            { step: 4, status: 'waiting', label: 'LIQUIDITY ROUTER PASS', description: 'Routing stealth assets to Anovex Liquidity Router' },
            { step: 5, status: 'waiting', label: 'RETURN CHANNEL FINALIZATION', description: 'Finalizing return channel conversion' },
            { step: 6, status: 'waiting', label: 'VAULT BALANCE SETTLEMENT', description: 'Anonymous balance credited to vault' },
          ]
        },
        message: `Send ${solAmountNum.toFixed(4)} SOL (≈ $${usdAmount.toFixed(2)}) to begin dual-bridge deposit`,
      });
      
    } catch (error: any) {
      console.error("Deposit initiation error:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to initiate deposit" 
      });
    }
  });
  
  // GET /api/deposit/status/:depositId - Check dual-bridge deposit status
  app.get("/api/deposit/status/:depositId", async (req, res) => {
    try {
      const { depositId } = req.params;
      const walletId = req.session?.walletId;
      
      if (!walletId) {
        return res.status(401).json({ 
          success: false, 
          error: "Not authenticated" 
        });
      }
      
      // Get deposit record
      const deposit = await storage.getDeposit(depositId);
      if (!deposit || deposit.walletId !== walletId) {
        return res.status(404).json({ 
          success: false, 
          error: "Deposit not found" 
        });
      }
      
      // Build technical steps with real-time status
      let technicalSteps = [
        { step: 1, status: 'waiting', label: 'STEALTH FUNDING REQUEST', description: `Send ${parseFloat(deposit.solAmount || "0").toFixed(4)} SOL to privacy relay address` },
        { step: 2, status: 'waiting', label: 'ZK RELAY NETWORK SYNC', description: 'Privacy relay node coordinating anonymization' },
        { step: 3, status: 'waiting', label: 'SHADOW CONVERSION INITIATED', description: 'Initiating stealth liquidity conversion' },
        { step: 4, status: 'waiting', label: 'LIQUIDITY ROUTER PASS', description: 'Routing stealth assets to Anovex Liquidity Router' },
        { step: 5, status: 'waiting', label: 'RETURN CHANNEL FINALIZATION', description: 'Finalizing return channel conversion' },
        { step: 6, status: 'waiting', label: 'VAULT BALANCE SETTLEMENT', description: 'Anonymous balance credited to vault' },
      ];
      
      // Update steps based on current status
      if (deposit.status === 'waiting_step1' && deposit.step1ExchangeId) {
        const step1Status = await getExchangeStatus(deposit.step1ExchangeId);
        
        if (step1Status.status === 'waiting') {
          technicalSteps[0].status = 'active';
          technicalSteps[0].description = 'Awaiting your stealth funding request...';
        } else if (step1Status.status === 'confirming') {
          technicalSteps[0].status = 'completed';
          technicalSteps[1].status = 'active';
          technicalSteps[1].description = 'Deposit detected, syncing ZK relay network...';
        } else if (step1Status.status === 'exchanging') {
          technicalSteps[0].status = 'completed';
          technicalSteps[1].status = 'completed';
          technicalSteps[2].status = 'active';
          technicalSteps[2].description = 'Executing shadow conversion protocol...';
        }
      } else if (deposit.status === 'waiting_step2' && deposit.step2ExchangeId) {
        const step2Status = await getExchangeStatus(deposit.step2ExchangeId);
        
        // Step 1-3 completed, Step 4 active immediately (optimistic UI)
        technicalSteps[0].status = 'completed';
        technicalSteps[1].status = 'completed';
        technicalSteps[2].status = 'completed';
        technicalSteps[3].status = 'completed';
        technicalSteps[4].status = 'active';
        technicalSteps[4].description = 'Finalizing return channel conversion...';
        
        // Only advance to step 6 when actually sending
        if (step2Status.status === 'sending') {
          technicalSteps[4].status = 'completed';
          technicalSteps[5].status = 'active';
          technicalSteps[5].description = 'Crediting anonymous balance to vault...';
        }
      } else if (deposit.status === 'finished') {
        // All steps completed
        technicalSteps.forEach(step => step.status = 'completed');
        technicalSteps[5].description = `${deposit.solReceived} SOL anonymously credited`;
      } else if (deposit.status === 'failed') {
        // Mark as failed
        const failedIndex = technicalSteps.findIndex(s => s.status === 'active');
        if (failedIndex >= 0) {
          technicalSteps[failedIndex].status = 'failed';
        }
      }
      
      res.json({
        success: true,
        depositId: deposit.id,
        status: deposit.status,
        solAmount: deposit.solAmount,
        solReceived: deposit.solReceived,
        technicalSteps,
      });
      
    } catch (error: any) {
      console.error("Deposit status check error:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to check status" 
      });
    }
  });
  
  // POST /api/deposit/recover/:depositId - Emergency recovery for stuck deposits
  app.post("/api/deposit/recover/:depositId", async (req, res) => {
    try {
      const { depositId } = req.params;
      const { trxAmount } = req.body; // User provides TRX amount received
      const walletId = req.session?.walletId;
      
      if (!walletId) {
        return res.status(401).json({ success: false, error: "Not authenticated" });
      }
      
      if (!trxAmount || parseFloat(trxAmount) <= 0) {
        return res.status(400).json({ success: false, error: "Invalid TRX amount" });
      }
      
      const deposit = await storage.getDeposit(depositId);
      if (!deposit || deposit.walletId !== walletId) {
        return res.status(404).json({ success: false, error: "Deposit not found" });
      }
      
      if (deposit.status !== 'waiting_step1') {
        return res.status(400).json({ success: false, error: `Deposit status is ${deposit.status}, cannot recover` });
      }
      
      // Get Liquidity Router Node
      const solanaWallet = await storage.getSystemWallet("liquidity_router_node");
      if (!solanaWallet) {
        return res.status(500).json({ success: false, error: "System wallet not initialized" });
      }
      
      // Create Step 2 exchange: TRX → SOL to Liquidity Router Node
      console.log(`[RECOVERY] Creating Step 2: ${trxAmount} TRX → SOL to ${solanaWallet.address}`);
      const step2Exchange = await createDepositStep2Exchange(
        trxAmount,
        solanaWallet.address
      );
      
      // Update deposit: Skip Step 1, go directly to Step 2
      await db.update(deposits)
        .set({
          trxAmount: trxAmount,
          step2ExchangeId: step2Exchange.publicId,
          status: 'waiting_step2',
          step1CompletedAt: new Date(), // Mark Step 1 as completed
        })
        .where(eq(deposits.id, deposit.id));
      
      console.log(`[RECOVERY] Deposit ${depositId} recovered - Step 2 initiated: ${step2Exchange.publicId}`);
      
      res.json({
        success: true,
        message: `Deposit recovered! Step 2 initiated.`,
        step2ExchangeId: step2Exchange.publicId,
        depositStatus: 'waiting_step2'
      });
      
    } catch (error: any) {
      console.error("[RECOVERY] Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // POST /api/deposit/manual-trigger/:depositId - Manual trigger Step 2 (FOR TESTING)
  app.post("/api/deposit/manual-trigger/:depositId", async (req, res) => {
    try {
      const { depositId } = req.params;
      const walletId = req.session?.walletId;
      
      if (!walletId) {
        return res.status(401).json({ success: false, error: "Not authenticated" });
      }
      
      const deposit = await storage.getDeposit(depositId);
      if (!deposit || deposit.walletId !== walletId) {
        return res.status(404).json({ success: false, error: "Deposit not found" });
      }
      
      if (deposit.status !== 'waiting_step1') {
        return res.status(400).json({ success: false, error: `Deposit status is ${deposit.status}, cannot trigger Step 2` });
      }
      
      if (!deposit.step1ExchangeId) {
        return res.status(400).json({ success: false, error: "No Step 1 exchange ID found" });
      }
      
      // Check Step 1 status
      const step1Exchange = await getExchangeStatus(deposit.step1ExchangeId);
      console.log(`[MANUAL TRIGGER] Step 1 status for deposit ${depositId}: ${step1Exchange.status}`);
      
      if (step1Exchange.status !== 'finished') {
        return res.status(400).json({ 
          success: false, 
          error: `Step 1 exchange status is ${step1Exchange.status}, must be 'finished' to trigger Step 2` 
        });
      }
      
      const trxReceived = step1Exchange.amountTo || "0";
      if (parseFloat(trxReceived) <= 0) {
        return res.status(400).json({ success: false, error: `Invalid TRX amount: ${trxReceived}` });
      }
      
      // Get Liquidity Router Node
      const solanaWallet = await storage.getSystemWallet("liquidity_router_node");
      if (!solanaWallet) {
        return res.status(500).json({ success: false, error: "System wallet not initialized" });
      }
      
      // Create Step 2 exchange: TRX → SOL to Liquidity Router Node
      console.log(`[MANUAL TRIGGER] Creating Step 2: ${trxReceived} TRX → SOL to ${solanaWallet.address}`);
      const step2Exchange = await createDepositStep2Exchange(
        trxReceived,
        solanaWallet.address
      );
      
      // Update deposit
      await db.update(deposits)
        .set({
          trxAmount: trxReceived,
          step2ExchangeId: step2Exchange.publicId,
          status: 'waiting_step2',
          step1CompletedAt: new Date(),
        })
        .where(eq(deposits.id, deposit.id));
      
      console.log(`[MANUAL TRIGGER] Step 2 initiated: ${step2Exchange.publicId}`);
      
      res.json({
        success: true,
        message: `Step 2 triggered manually`,
        step2ExchangeId: step2Exchange.publicId,
        trxAmount: trxReceived,
        depositStatus: 'waiting_step2'
      });
      
    } catch (error: any) {
      console.error("[MANUAL TRIGGER] Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // GET /api/deposit/history - Get deposit history
  app.get("/api/deposit/history", async (req, res) => {
    try {
      const walletId = req.session?.walletId;
      
      if (!walletId) {
        return res.status(401).json({ 
          success: false, 
          error: "Not authenticated" 
        });
      }
      
      const deposits = await storage.getDepositsByWallet(walletId);
      
      res.json({
        success: true,
        deposits
      });
      
    } catch (error: any) {
      console.error("Deposit history error:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // WITHDRAWAL ENDPOINTS (Dual-bridge: Liquidity Router Node → Privacy Relay Node → User)
  
  // POST /api/withdraw/initiate - Initiate withdrawal request
  app.post("/api/withdraw/initiate", async (req, res) => {
    try {
      const walletId = req.session?.walletId;
      
      if (!walletId) {
        return res.status(401).json({ 
          success: false, 
          error: "Not authenticated" 
        });
      }
      
      // SECURITY: Check if user already has a pending withdrawal
      const existingWithdrawals = await db
        .select()
        .from(withdrawals)
        .where(and(
          eq(withdrawals.walletId, walletId),
          sql`${withdrawals.status} IN ('waiting_step1', 'waiting_step2')`
        ));
      
      if (existingWithdrawals.length > 0) {
        return res.status(400).json({
          success: false,
          error: "You already have a pending withdrawal. Please wait for it to complete before creating a new one."
        });
      }
      
      const { destinationAddress, solAmount: solAmountStr } = req.body;
      
      if (!destinationAddress || !solAmountStr || parseFloat(solAmountStr) <= 0) {
        return res.status(400).json({ 
          success: false, 
          error: "Invalid destination address or amount" 
        });
      }
      
      const solAmount = parseFloat(solAmountStr);
      
      // Minimum withdrawal: 0.05 SOL
      if (solAmount < 0.05) {
        return res.status(400).json({
          success: false,
          error: "Minimum withdrawal is 0.05 SOL"
        });
      }
      
      // Check balance
      const balance = await storage.getBalance(walletId);
      const currentSolBalance = parseFloat(balance?.solBalance || "0");
      
      if (currentSolBalance < solAmount) {
        return res.status(400).json({ 
          success: false, 
          error: "Insufficient balance" 
        });
      }
      
      // Get Privacy Relay Node (TRON Bridge) - fail fast before transaction
      const tronWallet = await storage.getSystemWallet("privacy_relay_node");
      if (!tronWallet) {
        throw new Error("System wallet not initialized");
      }
      
      // ATOMIC TRANSACTION: Deduct balance + create exchange + create records
      // If ANY step fails, balance is NOT deducted (funds safe)
      const result = await db.transaction(async (tx) => {
        // 1. Deduct SOL from balance (contention-safe decrement with guard)
        const updatedBalances = await tx.execute(sql`
          UPDATE ${balances}
          SET 
            sol_balance = sol_balance - ${solAmount.toString()}::decimal,
            updated_at = NOW()
          WHERE wallet_id = ${walletId}
            AND sol_balance >= ${solAmount.toString()}::decimal
          RETURNING *
        `);
        
        // Critical: Verify row was actually updated (prevents free withdrawals)
        if (updatedBalances.rowCount === 0) {
          throw new Error("Insufficient balance or concurrent withdrawal detected");
        }
        
        // 2. Create Step 1 exchange: Liquidity Router Node SOL → Privacy Relay Node TRX
        // NOTE: This is an external API call - if it fails, transaction rolls back
        const step1Exchange = await createWithdrawStep1Exchange(
          solAmount.toFixed(9),
          tronWallet.address
        );
        
        // 3. Create withdrawal record (unique constraint prevents duplicate pending withdrawals)
        let withdrawal;
        try {
          [withdrawal] = await tx.insert(withdrawals).values({
            walletId,
            destinationAddress,
            step1ExchangeId: step1Exchange.publicId,
            step2ExchangeId: null,
            solDeducted: solAmount.toFixed(9),
            trxAmount: null,
            solSent: null,
            status: 'waiting_step1',
            step1CompletedAt: null,
            step2CompletedAt: null,
          }).returning();
        } catch (dbError: any) {
          // CRITICAL: Unique constraint violation = user tried to create duplicate pending withdrawal
          if (dbError.code === '23505' || dbError.message?.includes('unique constraint')) {
            throw new Error("You already have a pending withdrawal. Please wait for it to complete before creating a new one.");
          }
          throw dbError; // Re-throw non-constraint errors
        }
        
        // 4. Create pending transaction record
        await tx.insert(transactions).values({
          walletId,
          txhash: generateAnxTxHash('withdraw'),
          type: 'withdraw',
          instructions: 'transfer out',
          tokenAddress: null,
          tokenSymbol: 'SOL',
          amount: solAmount.toFixed(9),
          solValue: solAmount.toFixed(9),
          priceUsd: (await getSolanaPrice()).toFixed(2),
          status: 'pending'
        });
        
        return { withdrawal, step1Exchange };
      });
      
      // 5. Send SOL from Liquidity Router Node to Step 1 exchange address
      // This happens AFTER the DB transaction, so if it fails, we can retry later
      console.log(`[WITHDRAWAL] Sending ${solAmount.toFixed(9)} SOL to Step 1 exchange address: ${result.step1Exchange.addressFrom}`);
      
      // CRITICAL ATOMIC LOCK: Set placeholder BEFORE sending to prevent duplicate sends
      // This prevents polling from sending duplicate SOL during network delays
      // MUST check both NULL and empty string to prevent race conditions with legacy data
      // MUST update updatedAt atomically for stuck lock detection
      const lockResult = await db.update(withdrawals)
        .set({ step1TxId: 'PROCESSING', updatedAt: new Date() })
        .where(and(
          eq(withdrawals.id, result.withdrawal.id),
          or(
            isNull(withdrawals.step1TxId),
            eq(withdrawals.step1TxId, '')
          )
        ))
        .returning();
      
      if (lockResult.length === 0) {
        console.log(`[WITHDRAWAL] Another process is already sending SOL for withdrawal ${result.withdrawal.id} - rejecting duplicate request`);
        return res.status(409).json({
          success: false,
          error: "Withdrawal is already being processed. Please wait."
        });
      }
      
      console.log(`[WITHDRAWAL] 🔒 Atomic lock acquired - sending SOL now`);
      
      try {
        const txId = await sendSolFromLiquidityRouterNode(
          result.step1Exchange.addressFrom,
          solAmount
        );
        
        console.log(`[WITHDRAWAL] ✅ SOL sent successfully! TX: ${txId}`);
        
        // Update withdrawal with real TX ID
        await db.update(withdrawals)
          .set({ step1TxId: txId })
          .where(eq(withdrawals.id, result.withdrawal.id));
        
        res.json({
          success: true,
          withdrawal: {
            id: result.withdrawal.id,
            status: result.withdrawal.status,
            solDeducted: result.withdrawal.solDeducted,
            step1DepositAddress: result.step1Exchange.addressFrom,
            step1ExchangeId: result.step1Exchange.publicId
          }
        });
      } catch (error: any) {
        console.error(`[WITHDRAWAL] Failed to send SOL to Step 1:`, error.message);
        
        // CRITICAL: Release lock on failure so polling can retry
        // MUST update updatedAt to prevent timeout mis-classification
        await db.update(withdrawals)
          .set({ step1TxId: null, updatedAt: new Date() })
          .where(eq(withdrawals.id, result.withdrawal.id));
        
        console.error(`[WITHDRAWAL] Withdrawal ${result.withdrawal.id} remains in waiting_step1 - will retry via polling`);
        
        // Return error so client can detect send failure and trigger operator intervention
        // Note: Withdrawal is already created and balance deducted - polling will auto-retry
        return res.status(502).json({
          success: false,
          error: `Withdrawal created (ID: ${result.withdrawal.id}) but SOL send failed: ${error.message}. System will automatically retry.`,
          withdrawalId: result.withdrawal.id
        });
      }
      
    } catch (error: any) {
      console.error("Withdraw initiate error:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });
  
  // POST /api/withdraw/test-create - Test endpoint to create withdrawal (development only)
  app.post("/api/withdraw/test-create", async (req, res) => {
    try {
      const { walletId, destinationAddress, solAmount } = req.body;
      
      if (!walletId || !destinationAddress || !solAmount) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields"
        });
      }
      
      const solAmountNum = parseFloat(solAmount);
      
      // Get Privacy Relay Node
      const tronWallet = await storage.getSystemWallet("privacy_relay_node");
      if (!tronWallet) {
        throw new Error("System wallet not initialized");
      }
      
      // Create Step 1 exchange
      const step1Exchange = await createWithdrawStep1Exchange(
        solAmountNum.toFixed(9),
        tronWallet.address
      );
      
      // Create withdrawal record
      const [withdrawal] = await db.insert(withdrawals).values({
        walletId,
        destinationAddress,
        step1ExchangeId: step1Exchange.publicId,
        step2ExchangeId: null,
        solDeducted: solAmountNum.toFixed(9),
        trxAmount: null,
        solSent: null,
        status: 'waiting_step1',
        step1CompletedAt: null,
        step2CompletedAt: null,
      }).returning();
      
      // Send SOL with atomic lock
      try {
        // Atomic lock to prevent duplicate sends
        // MUST check both NULL and empty string to prevent race conditions with legacy data
        // MUST update updatedAt atomically for stuck lock detection
        const lockResult = await db.update(withdrawals)
          .set({ step1TxId: 'PROCESSING', updatedAt: new Date() })
          .where(and(
            eq(withdrawals.id, withdrawal.id),
            or(
              isNull(withdrawals.step1TxId),
              eq(withdrawals.step1TxId, '')
            )
          ))
          .returning();
        
        if (lockResult.length === 0) {
          return res.status(409).json({
            success: false,
            error: "Withdrawal is already being processed. Please wait."
          });
        }
        
        const txId = await sendSolFromLiquidityRouterNode(
          step1Exchange.addressFrom,
          solAmountNum
        );
        
        console.log(`[TEST] ✅ SOL sent! TX: ${txId}`);
        
        // Update with real TX ID
        await db.update(withdrawals)
          .set({ step1TxId: txId })
          .where(eq(withdrawals.id, withdrawal.id));
          
        res.json({
          success: true,
          withdrawal: {
            id: withdrawal.id,
            status: withdrawal.status,
            step1TxId: txId,
            step1ExchangeId: step1Exchange.publicId
          }
        });
      } catch (error: any) {
        console.error(`[TEST] Failed to send SOL:`, error.message);
        
        // Release lock on failure
        // MUST update updatedAt to prevent timeout mis-classification
        await db.update(withdrawals)
          .set({ step1TxId: null, updatedAt: new Date() })
          .where(eq(withdrawals.id, withdrawal.id));
        
        return res.status(502).json({
          success: false,
          error: `Withdrawal created (ID: ${withdrawal.id}) but SOL send failed: ${error.message}. System will automatically retry.`,
          withdrawalId: withdrawal.id
        });
      }
      
    } catch (error: any) {
      console.error("Test withdrawal error:", error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  // GET /api/withdraw/status/:withdrawId - Get withdrawal status
  app.get("/api/withdraw/status/:withdrawId", async (req, res) => {
    try {
      const walletId = req.session?.walletId;
      
      if (!walletId) {
        return res.status(401).json({ 
          success: false, 
          error: "Not authenticated" 
        });
      }
      
      const { withdrawId } = req.params;
      const withdrawal = await storage.getWithdrawal(withdrawId);
      
      if (!withdrawal || withdrawal.walletId !== walletId) {
        return res.status(404).json({ 
          success: false, 
          error: "Withdrawal not found" 
        });
      }
      
      // Build technical steps with real-time status
      let technicalSteps = [
        { step: 1, status: 'waiting', label: 'VAULT BALANCE DEDUCTION', description: `Deducting ${parseFloat(withdrawal.solDeducted || "0").toFixed(4)} SOL from anonymous vault` },
        { step: 2, status: 'waiting', label: 'STEALTH LIQUIDITY EXTRACTION', description: 'Extracting funds from Anovex Liquidity Router' },
        { step: 3, status: 'waiting', label: 'SHADOW CONVERSION INITIATED', description: 'Initiating stealth liquidity conversion' },
        { step: 4, status: 'waiting', label: 'ZK RELAY NETWORK PASS', description: 'Routing through privacy relay network' },
        { step: 5, status: 'waiting', label: 'RETURN CHANNEL FINALIZATION', description: 'Finalizing outbound conversion' },
        { step: 6, status: 'waiting', label: 'DESTINATION SETTLEMENT', description: 'SOL delivered to recipient wallet' },
      ];
      
      if (withdrawal.status === 'finished') {
        // All steps completed
        technicalSteps.forEach(step => step.status = 'completed');
        technicalSteps[0].description = `${parseFloat(withdrawal.solDeducted || "0").toFixed(4)} SOL deducted from vault`;
        technicalSteps[1].description = 'Funds extracted from Liquidity Router';
        technicalSteps[2].description = 'Shadow conversion completed';
        technicalSteps[3].description = 'ZK relay network pass completed';
        technicalSteps[4].description = 'Return channel finalized';
        technicalSteps[5].description = `${withdrawal.solSent || withdrawal.solDeducted} SOL delivered anonymously`;
      } else if (withdrawal.status === 'failed' || withdrawal.status === 'refunded' || withdrawal.status === 'expired') {
        // Mark first incomplete step as failed
        technicalSteps[0].status = 'completed';
        technicalSteps[1].status = 'completed';
        technicalSteps[2].status = 'failed';
        technicalSteps[2].description = 'Privacy protocol encountered an error';
      } else if (withdrawal.status === 'waiting_step1') {
        // MINIMUM guaranteed progress: Steps 1-2 always completed in waiting_step1
        technicalSteps[0].status = 'completed';
        technicalSteps[1].status = 'completed';
        
        if (withdrawal.step1ExchangeId) {
          try {
            const step1Status = await getExchangeStatus(withdrawal.step1ExchangeId);
            
            if (step1Status.status === 'waiting') {
              technicalSteps[2].status = 'active';
              technicalSteps[2].description = 'Awaiting stealth liquidity conversion...';
            } else if (step1Status.status === 'confirming') {
              technicalSteps[2].status = 'completed';
              technicalSteps[3].status = 'active';
              technicalSteps[3].description = 'Deposit confirmed, routing through ZK relay network...';
            } else if (step1Status.status === 'exchanging') {
              technicalSteps[2].status = 'completed';
              technicalSteps[3].status = 'active';
              technicalSteps[3].description = 'Processing through privacy relay nodes...';
            } else if (step1Status.status === 'sending' || step1Status.status === 'finished') {
              technicalSteps[2].status = 'completed';
              technicalSteps[3].status = 'completed';
              technicalSteps[4].status = 'active';
              technicalSteps[4].description = 'First hop complete, preparing return channel...';
            } else {
              // Unknown status - use guaranteed minimum (steps 1-2 done, step 3 active)
              technicalSteps[2].status = 'active';
              technicalSteps[2].description = 'Processing stealth conversion...';
            }
          } catch (error) {
            // API error - show guaranteed minimum progress (steps 1-2 done, step 3 active)
            technicalSteps[2].status = 'active';
            technicalSteps[2].description = 'Processing stealth conversion...';
          }
        } else {
          // No exchange ID yet - liquidity extraction in progress
          technicalSteps[1].status = 'active';
          technicalSteps[1].description = 'Extracting funds from Liquidity Router...';
        }
      } else if (withdrawal.status === 'waiting_step2') {
        // MINIMUM guaranteed progress: Steps 1-4 always completed in waiting_step2
        technicalSteps[0].status = 'completed';
        technicalSteps[1].status = 'completed';
        technicalSteps[2].status = 'completed';
        technicalSteps[3].status = 'completed';
        
        if (withdrawal.step2ExchangeId) {
          try {
            const step2Status = await getExchangeStatus(withdrawal.step2ExchangeId);
            
            if (step2Status.status === 'waiting') {
              technicalSteps[4].status = 'active';
              technicalSteps[4].description = 'Awaiting return channel conversion...';
            } else if (step2Status.status === 'confirming') {
              technicalSteps[4].status = 'active';
              technicalSteps[4].description = 'Return channel deposit confirmed...';
            } else if (step2Status.status === 'exchanging') {
              technicalSteps[4].status = 'active';
              technicalSteps[4].description = 'Finalizing return channel conversion...';
            } else if (step2Status.status === 'sending') {
              technicalSteps[4].status = 'completed';
              technicalSteps[5].status = 'active';
              technicalSteps[5].description = 'Sending SOL to destination wallet...';
            } else if (step2Status.status === 'finished') {
              technicalSteps[4].status = 'completed';
              technicalSteps[5].status = 'completed';
              technicalSteps[5].description = `${withdrawal.solSent || withdrawal.solDeducted} SOL delivered anonymously`;
            } else {
              // Unknown status - use guaranteed minimum (steps 1-4 done, step 5 active)
              technicalSteps[4].status = 'active';
              technicalSteps[4].description = 'Processing return channel...';
            }
          } catch (error) {
            // API error - show guaranteed minimum progress (steps 1-4 done, step 5 active)
            technicalSteps[4].status = 'active';
            technicalSteps[4].description = 'Processing return channel...';
          }
        } else {
          // No step 2 exchange yet - transitioning from step 1
          technicalSteps[4].status = 'active';
          technicalSteps[4].description = 'Initiating return channel...';
        }
      } else {
        // Initial/unknown state - just created
        technicalSteps[0].status = 'completed';
        technicalSteps[1].status = 'active';
        technicalSteps[1].description = 'Initiating stealth liquidity extraction...';
      }
      
      res.json({
        success: true,
        withdrawal: {
          id: withdrawal.id,
          status: withdrawal.status,
          destinationAddress: withdrawal.destinationAddress,
          solDeducted: withdrawal.solDeducted,
          solSent: withdrawal.solSent,
          step2TxTo: withdrawal.step2TxTo,
        },
        technicalSteps,
      });
      
    } catch (error: any) {
      console.error("Withdrawal status error:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });
  
  // GET /api/withdraw/history - Get withdrawal history
  app.get("/api/withdraw/history", async (req, res) => {
    try {
      const walletId = req.session?.walletId;
      
      if (!walletId) {
        return res.status(401).json({ 
          success: false, 
          error: "Not authenticated" 
        });
      }
      
      const withdrawals = await storage.getWithdrawalsByWallet(walletId);
      
      res.json({
        success: true,
        withdrawals
      });
      
    } catch (error: any) {
      console.error("Withdrawal history error:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // Trading API routes (Anovex Liquidity Router integration)
  
  // POST /api/swap/quote - Get price quote for token swap
  app.post("/api/swap/quote", async (req, res) => {
    try {
      const walletId = req.session?.walletId;
      
      if (!walletId) {
        return res.status(401).json({ 
          success: false, 
          error: "Not authenticated" 
        });
      }
      
      const { tokenAddress, amount, type } = req.body; // type: 'buy' or 'sell'
      
      if (!tokenAddress || !amount || !type) {
        return res.status(400).json({ 
          success: false, 
          error: "Missing required fields" 
        });
      }
      
      const balance = await storage.getBalance(walletId);
      const solBalance = parseFloat(balance?.solBalance || "0");
      
      // Get Liquidity Router Node (needed for Jupiter Ultra order with transaction)
      const solanaPool = await storage.getSystemWallet("liquidity_router_node");
      if (!solanaPool) {
        return res.status(500).json({ 
          success: false, 
          error: "System wallet not initialized" 
        });
      }
      
      let inputMint: string, outputMint: string, swapAmount: string;
      
      // Fetch token decimals for accurate conversion
      const tokenDecimals = await getTokenDecimals(tokenAddress);
      console.log(`📊 Token ${tokenAddress} has ${tokenDecimals} decimals`);
      
      if (type === 'buy') {
        // Buy token: SOL → Token
        inputMint = SOL_MINT;
        outputMint = tokenAddress;
        swapAmount = toLamports(parseFloat(amount)); // Convert SOL to lamports
        
        if (solBalance < parseFloat(amount)) {
          return res.status(400).json({ 
            success: false, 
            error: "Insufficient SOL balance" 
          });
        }
      } else {
        // Sell token: Token → SOL
        inputMint = tokenAddress;
        outputMint = SOL_MINT;
        // Use token's actual decimals instead of hardcoded 9
        swapAmount = Math.floor(parseFloat(amount) * Math.pow(10, tokenDecimals)).toString();
      }
      
      // Get quote from Jupiter Ultra API with taker wallet (required for transaction generation)
      const jupiterQuote = await getJupiterQuote({
        inputMint,
        outputMint,
        amount: swapAmount,
        slippageBps: 50,
        taker: solanaPool.address // Required for Jupiter Ultra to generate transaction
      });
      
      // Convert outputAmount using correct decimals
      // BUY: outputMint is token (use token decimals)
      // SELL: outputMint is SOL (use 9 decimals)
      const outputDecimals = type === 'buy' ? tokenDecimals : 9;
      const outputAmount = parseFloat(jupiterQuote.outAmount) / Math.pow(10, outputDecimals);
      const priceImpact = parseFloat(jupiterQuote.priceImpactPct);
      const cost = type === 'buy' ? parseFloat(amount) : outputAmount;
      
      res.json({
        success: true,
        quote: {
          inputAmount: amount,
          outputAmount: outputAmount.toFixed(6),
          priceImpactPct: priceImpact.toFixed(2),
          // Include Jupiter Ultra fields for execute endpoint
          transaction: jupiterQuote.transaction,
          requestId: jupiterQuote.requestId,
          inAmount: jupiterQuote.inAmount,
          outAmount: jupiterQuote.outAmount,
          inputMint: jupiterQuote.inputMint,
          outputMint: jupiterQuote.outputMint
        },
        cost: cost.toFixed(6)
      });
      
    } catch (error: any) {
      console.error("Quote error:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to get quote" 
      });
    }
  });
  
  // POST /api/swap/execute - Execute REAL on-chain token swap via Jupiter (ATOMIC & RACE-SAFE)
  app.post("/api/swap/execute", async (req, res) => {
    try {
      const walletId = req.session?.walletId;
      
      if (!walletId) {
        return res.status(401).json({ 
          success: false, 
          error: "Not authenticated" 
        });
      }
      
      const { tokenAddress, tokenSymbol, amount, type, quote } = req.body;
      
      if (!tokenAddress || !amount || !type || !quote) {
        return res.status(400).json({ 
          success: false, 
          error: "Missing required fields" 
        });
      }
      
      // Get Liquidity Router Node (Solana Pool) for executing on-chain swaps
      const solanaPool = await storage.getSystemWallet("liquidity_router_node");
      if (!solanaPool) {
        return res.status(500).json({ 
          success: false, 
          error: "System wallet not initialized" 
        });
      }
      
      // Use SOLANA_WALLET_SECRET for signing (already in base58 format)
      const privateKeyBase58 = process.env.SOLANA_WALLET_SECRET;
      if (!privateKeyBase58) {
        return res.status(500).json({ 
          success: false, 
          error: "SOLANA_WALLET_SECRET not configured" 
        });
      }
      
      // Fetch token decimals for accurate conversion
      const tokenDecimals = await getTokenDecimals(tokenAddress);
      console.log(`📊 Token ${tokenAddress} has ${tokenDecimals} decimals`);
      
      let transactionAmount: string, priceUsd: string, cost: number;
      let inputMint: string, outputMint: string, swapAmount: string;
      
      if (type === 'buy') {
        // Buy token: SOL → Token
        cost = parseFloat(amount); // USD cost
        // Convert Jupiter's outAmount (smallest units) to human-readable using token's actual decimals
        const tokenAmountReceived = parseFloat(quote.outAmount) / Math.pow(10, tokenDecimals);
        transactionAmount = tokenAmountReceived.toFixed(tokenDecimals);
        priceUsd = (cost / tokenAmountReceived).toFixed(6);
        
        inputMint = SOL_MINT;
        outputMint = tokenAddress;
        swapAmount = toLamports(cost / await getSolanaPrice()); // Convert USD to lamports
      } else {
        // Sell token: Token → SOL
        cost = 0; // Not used for sell
        transactionAmount = amount; // Token amount to sell
        priceUsd = (parseFloat(quote.outputAmount) / parseFloat(amount)).toFixed(6);
        
        inputMint = tokenAddress;
        outputMint = SOL_MINT;
        // Use token's actual decimals instead of hardcoded 9
        swapAmount = Math.floor(parseFloat(amount) * Math.pow(10, tokenDecimals)).toString();
      }
      
      console.log(`🔄 Executing ${type} swap: ${swapAmount} ${type === 'buy' ? 'SOL' : tokenSymbol} → ${type === 'buy' ? tokenSymbol : 'SOL'}`);
      
      // STEP 1: Execute REAL on-chain swap via Jupiter using Liquidity Router Node
      // REUSE quote from frontend (already fetched in /api/swap/quote with transaction)
      let realTxHash: string;
      try {
        // Reconstruct full Jupiter quote object from frontend data
        const jupiterQuote = {
          inputMint: quote.inputMint || inputMint,
          outputMint: quote.outputMint || outputMint,
          inAmount: quote.inAmount || swapAmount,
          outAmount: quote.outAmount,
          priceImpactPct: quote.priceImpactPct,
          transaction: quote.transaction,
          requestId: quote.requestId
        };
        
        if (!jupiterQuote.transaction) {
          throw new Error('Quote missing transaction data. Please get a fresh quote.');
        }
        
        realTxHash = await executeJupiterSwap(
          jupiterQuote,
          privateKeyBase58,
          solanaPool.address
        );
        
        console.log(`✅ On-chain swap executed: ${realTxHash}`);
      } catch (swapError: any) {
        console.error("❌ Jupiter swap failed:", swapError);
        return res.status(500).json({ 
          success: false, 
          error: `Swap failed: ${swapError.message}` 
        });
      }
      
      // STEP 2: ATOMIC DB TRANSACTION - Update balance + token holdings + transaction record
      // Prevents race conditions in concurrent buy/sell operations
      const result = await db.transaction(async (tx) => {
        // 1. Update SOL balance atomically (like deposit/withdraw)
        let updatedBalance;
        
        if (type === 'buy') {
          // BUY: Atomic decrement (like withdraw)
          const updatedBalances = await tx.execute(sql`
            UPDATE ${balances}
            SET 
              sol_balance = sol_balance - ${cost.toString()}::decimal,
              updated_at = NOW()
            WHERE wallet_id = ${walletId}
              AND sol_balance >= ${cost.toString()}::decimal
            RETURNING *
          `);
          
          // Verify row was updated (prevent overdraft)
          if (updatedBalances.rowCount === 0) {
            throw new Error("Insufficient balance");
          }
          
          updatedBalance = updatedBalances.rows[0];
        } else {
          // SELL: Atomic increment (like deposit)
          const sellProceeds = parseFloat(quote.outputAmount);
          const updatedBalances = await tx.execute(sql`
            UPDATE ${balances}
            SET 
              sol_balance = sol_balance + ${sellProceeds.toString()}::decimal,
              updated_at = NOW()
            WHERE wallet_id = ${walletId}
            RETURNING *
          `);
          
          updatedBalance = updatedBalances.rows[0];
        }
        
        // 2. Get entry price snapshot for SELL transactions (BEFORE updating holdings)
        let costBasisAtSale: string | undefined;
        let realizedPnl: string | undefined;
        
        if (type === 'sell') {
          const holdingForSale = await tx.select().from(tokenHoldings)
            .where(and(
              eq(tokenHoldings.walletId, walletId),
              eq(tokenHoldings.mint, tokenAddress)
            ))
            .limit(1);
            
          if (holdingForSale.length > 0) {
            const entryPrice = parseFloat(holdingForSale[0].averageEntryPrice || "0");
            const sellPrice = parseFloat(priceUsd);
            const soldAmount = parseFloat(transactionAmount);
            
            // Calculate realized PnL: (sellPrice - entryPrice) * amount
            const realizedPnlValue = (sellPrice - entryPrice) * soldAmount;
            
            costBasisAtSale = entryPrice.toFixed(6);
            realizedPnl = realizedPnlValue.toFixed(6);
          }
        }
        
        // 3. Create transaction record with custom ANX hash (+ real blockchain hash for audit)
        const customTxHash = generateAnxTxHash(type);
        
        // Calculate solValue for Explorer display (full precision)
        const solValue = type === 'buy' 
          ? cost.toString() // BUY: SOL spent (already in SOL)
          : (parseFloat(quote.outAmount) / 1e9).toString(); // SELL: SOL received (convert lamports to SOL with full precision)
        
        await tx.insert(transactions).values({
          walletId,
          txhash: customTxHash, // Custom Anovex Explorer hash (ANV-BUY-xxx or ANV-SELL-xxx)
          chainTxhash: realTxHash, // Real Solana blockchain tx hash (for audit/verification)
          type,
          tokenAddress,
          tokenSymbol,
          amount: transactionAmount,
          solValue, // ✅ FIX: SOL amount for Explorer display
          instructions: type, // ✅ FIX: 'buy' or 'sell' for Explorer
          priceUsd,
          costBasisAtSale, // Entry price at time of sell (for SELL only)
          realizedPnl, // Profit/loss realized from this sell (for SELL only)
          status: 'completed'
        });
        
        // 4. Update token holdings in portfolio
        if (type === 'buy') {
          // Check if token already in portfolio
          const existing = await tx.select().from(tokenHoldings)
            .where(and(
              eq(tokenHoldings.walletId, walletId),
              eq(tokenHoldings.mint, tokenAddress)
            ))
            .limit(1);
          
          if (existing.length > 0) {
            // Update existing position - calculate weighted average entry price
            const current = existing[0];
            const currentAmount = parseFloat(current.amount);
            const currentCostBasis = parseFloat(current.totalCostBasis || "0") || 
                                    (currentAmount * parseFloat(current.averageEntryPrice || "0"));
            
            const newAmount = parseFloat(transactionAmount);
            const newCost = cost; // USD spent on this purchase
            
            const totalAmount = currentAmount + newAmount;
            const totalCostBasis = currentCostBasis + newCost;
            const averageEntryPrice = totalCostBasis / totalAmount;
            
            await tx.update(tokenHoldings)
              .set({
                amount: totalAmount.toFixed(tokenDecimals),
                averageEntryPrice: averageEntryPrice.toFixed(6),
                totalCostBasis: totalCostBasis.toFixed(6),
                updatedAt: new Date()
              })
              .where(eq(tokenHoldings.id, current.id));
          } else {
            // Create new token holding with cost basis
            await tx.insert(tokenHoldings).values({
              walletId,
              mint: tokenAddress,
              amount: parseFloat(transactionAmount).toFixed(tokenDecimals),
              symbol: tokenSymbol,
              averageEntryPrice: parseFloat(priceUsd).toFixed(6),
              totalCostBasis: cost.toFixed(6)
            });
          }
        } else {
          // SELL: decrease quantity and adjust cost basis proportionally
          const existing = await tx.select().from(tokenHoldings)
            .where(and(
              eq(tokenHoldings.walletId, walletId),
              eq(tokenHoldings.mint, tokenAddress)
            ))
            .limit(1);
            
          if (existing.length > 0) {
            const current = existing[0];
            const currentAmount = parseFloat(current.amount);
            const soldAmount = parseFloat(transactionAmount);
            const newQuantity = currentAmount - soldAmount;
            
            if (newQuantity <= 0.000001) {
              // Fully sold - delete from holdings (with small dust tolerance)
              await tx.delete(tokenHoldings).where(eq(tokenHoldings.id, current.id));
            } else {
              // Partial sell - adjust cost basis proportionally
              const currentCostBasis = parseFloat(current.totalCostBasis || "0");
              const portionSold = soldAmount / currentAmount;
              const newCostBasis = currentCostBasis * (1 - portionSold);
              
              await tx.update(tokenHoldings)
                .set({
                  amount: newQuantity.toFixed(tokenDecimals),
                  totalCostBasis: newCostBasis.toFixed(6),
                  updatedAt: new Date()
                })
                .where(eq(tokenHoldings.id, current.id));
            }
          }
        }
        
        return { updatedBalance, txhash: customTxHash };
      });
      
      res.json({
        success: true,
        txhash: result.txhash,
        newBalance: result.updatedBalance.sol_balance,
        message: `${type === 'buy' ? 'Bought' : 'Sold'} ${transactionAmount} ${tokenSymbol}`,
        blockchainTx: `https://anvscan.com/tx/${result.txhash}` // Anovex Explorer link (custom ANV hash)
      });
      
    } catch (error: any) {
      console.error("Swap execution error:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Swap failed" 
      });
    }
  });
  
  // Telegram bot swap helper - Creates temporary authenticated session
  // This is called server-side only (not exposed as HTTP endpoint)
  // Security: Wallet ownership is verified before session creation
  async function createTelegramSwapSession(telegramUserId: string, walletId: string): Promise<{ sessionId: string } | null> {
    // Verify wallet belongs to Telegram user
    const wallet = await db.select()
      .from(wallets)
      .where(and(
        eq(wallets.id, walletId),
        eq(wallets.telegramUserId, telegramUserId),
        eq(wallets.isActive, true)
      ))
      .limit(1);
    
    if (wallet.length === 0) {
      return null; // Unauthorized
    }
    
    // Generate temporary session ID (valid for 5 minutes)
    const sessionId = `tg_${telegramUserId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    return { sessionId };
  }
  
  // GET /api/swap/token-info/:address - Get token metadata
  app.get("/api/swap/token-info/:address", async (req, res) => {
    try {
      const { address } = req.params;
      
      // Fetch token info from Solana (simplified - would use actual RPC)
      // For now return basic structure
      res.json({
        success: true,
        token: {
          address,
          symbol: "TOKEN", // Would fetch from blockchain
          name: "Token Name",
          decimals: 6
        }
      });
      
    } catch (error: any) {
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  /*
  // Explorer API routes (OLD - DISABLED - Duplicates of public routes below)
  
  // GET /api/explorer/transactions - Get user's transactions (for Dashboard)
  app.get("/api/explorer/transactions", async (req, res) => {
    try {
      const walletId = req.session?.walletId;
      
      if (!walletId) {
        return res.status(401).json({ 
          success: false, 
          error: "Not authenticated" 
        });
      }
      
      const transactions = await storage.getTransactionsByWallet(walletId);
      
      // Remove wallet ID for privacy (Explorer shows no wallet addresses)
      const sanitizedTxs = transactions.map(tx => ({
        txhash: tx.txhash,
        type: tx.type,
        tokenSymbol: tx.tokenSymbol,
        amount: tx.amount,
        priceUsd: tx.priceUsd,
        timestamp: tx.timestamp,
        status: tx.status
      }));
      
      res.json({
        success: true,
        transactions: sanitizedTxs
      });
      
    } catch (error: any) {
      console.error("Explorer fetch error:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });
  
  // GET /api/explorer/global - Get ALL transactions from ALL users (Global Explorer)
  app.get("/api/explorer/global", async (req, res) => {
    try {
      const walletId = req.session?.walletId;
      
      if (!walletId) {
        return res.status(401).json({ 
          success: false, 
          error: "Not authenticated" 
        });
      }
      
      const transactions = await storage.getAllTransactions(100); // Get last 100 transactions from all users
      
      // Remove wallet ID for maximum privacy (Explorer shows no wallet addresses)
      const sanitizedTxs = transactions.map(tx => ({
        txhash: tx.txhash,
        type: tx.type,
        tokenSymbol: tx.tokenSymbol,
        amount: tx.amount,
        priceUsd: tx.priceUsd,
        timestamp: tx.timestamp,
        status: tx.status
      }));
      
      res.json({
        success: true,
        transactions: sanitizedTxs
      });
      
    } catch (error: any) {
      console.error("Global explorer fetch error:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });
  
  // GET /api/explorer/stats - Get network statistics
  app.get("/api/explorer/stats", async (req, res) => {
    try {
      const walletId = req.session?.walletId;
      
      if (!walletId) {
        return res.status(401).json({ 
          success: false, 
          error: "Not authenticated" 
        });
      }
      
      const allTransactions = await storage.getAllTransactions(10000);
      const completedTransactions = allTransactions.filter(tx => tx.status === 'completed');
      
      const uniqueWallets = new Set(allTransactions.map(tx => tx.walletId)).size;
      
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentActivity = allTransactions.filter(tx => 
        new Date(tx.timestamp) > last24h
      ).length;
      
      const totalVolume = completedTransactions.reduce((sum, tx) => 
        sum + parseFloat(tx.priceUsd || '0'), 0
      );
      
      res.json({
        success: true,
        stats: {
          totalTransactions: allTransactions.length,
          activeUsers: uniqueWallets,
          relayStatus: 'operational',
          networkUptime: 99.8,
          last24hActivity: recentActivity,
          totalVolumeUsd: totalVolume.toFixed(2),
          networkHealth: 100
        }
      });
      
    } catch (error: any) {
      console.error("Stats fetch error:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });
  
  // GET /api/explorer/transaction/:txhash - Get transaction details
  app.get("/api/explorer/transaction/:txhash", async (req, res) => {
    try {
      const { txhash } = req.params;
      const walletId = req.session?.walletId;
      
      if (!walletId) {
        return res.status(401).json({ 
          success: false, 
          error: "Not authenticated" 
        });
      }
      
      const transaction = await storage.getTransaction(txhash);
      
      if (!transaction || transaction.walletId !== walletId) {
        return res.status(404).json({ 
          success: false, 
          error: "Transaction not found" 
        });
      }
      
      // Return privacy-focused details (no wallet address)
      res.json({
        success: true,
        transaction: {
          txhash: transaction.txhash,
          type: transaction.type,
          tokenAddress: transaction.tokenAddress,
          tokenSymbol: transaction.tokenSymbol,
          amount: transaction.amount,
          priceUsd: transaction.priceUsd,
          timestamp: transaction.timestamp,
          status: transaction.status
        }
      });
      
    } catch (error: any) {
      console.error("Transaction detail error:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });
  */
  
  // Portfolio API routes
  
  // GET /api/portfolio - Get portfolio with live PNL tracking
  app.get("/api/portfolio", async (req, res) => {
    try {
      // Support BOTH session (web) and query param (Telegram bot)
      const walletId = req.session?.walletId || (req.query.walletId as string);
      
      if (!walletId) {
        return res.status(401).json({ 
          success: false, 
          error: "Not authenticated" 
        });
      }
      
      // 1. Get SOL balance
      const balance = await storage.getBalance(walletId);
      const solBalance = parseFloat(balance?.solBalance || "0");
      const solPrice = await getSolanaPrice();
      const solValue = solBalance * solPrice;
      
      // 2. Get current token holdings (filter out zero-balance)
      const rawHoldings = await storage.getTokenHoldings(walletId);
      const holdings = rawHoldings.filter(h => parseFloat(h.amount) > 0);
      
      // 2. Fetch live prices for all holdings in parallel
      const mints = holdings.map(h => h.mint);
      const priceMap = await getTokenPrices(mints);
      
      // 3. Update holdings with current prices and calculate unrealized PnL
      const holdingsWithPnl = await Promise.all(holdings.map(async (holding) => {
        const currentPrice = priceMap.get(holding.mint);
        const entryPrice = parseFloat(holding.averageEntryPrice || "0");
        const amount = parseFloat(holding.amount);
        const costBasis = parseFloat(holding.totalCostBasis || "0");
        
        // Update price in database if we got a fresh one
        if (currentPrice !== null && currentPrice !== undefined) {
          await db.update(tokenHoldings)
            .set({
              lastPriceUsd: currentPrice.toFixed(6),
              lastPriceUpdatedAt: new Date()
            })
            .where(eq(tokenHoldings.id, holding.id));
        }
        
        const effectivePrice = currentPrice || parseFloat(holding.lastPriceUsd || "0") || entryPrice;
        const currentValue = amount * effectivePrice;
        const unrealizedPnl = currentValue - costBasis;
        // Guard against division by zero for free tokens or zero cost basis
        const pnlPercent = costBasis > 0 ? ((unrealizedPnl / costBasis) * 100) : (unrealizedPnl > 0 ? 999 : 0);
        
        return {
          mint: holding.mint,
          symbol: holding.symbol,
          amount: amount.toFixed(6),
          entryPrice: entryPrice.toFixed(6),
          currentPrice: effectivePrice.toFixed(6),
          costBasis: costBasis.toFixed(2),
          currentValue: currentValue.toFixed(2),
          unrealizedPnl: unrealizedPnl.toFixed(2),
          pnlPercent: pnlPercent.toFixed(2)
        };
      }));
      
      // 4. Calculate total unrealized PnL (tokens only, SOL has no PnL tracking)
      const totalUnrealizedPnl = holdingsWithPnl.reduce((sum, h) => 
        sum + parseFloat(h.unrealizedPnl), 0
      );
      
      // Include SOL value in total portfolio value
      const tokenValue = holdingsWithPnl.reduce((sum, h) => 
        sum + parseFloat(h.currentValue), 0
      );
      const totalValue = solValue + tokenValue;
      
      // 5. Get all trades (buy + sell) for stats
      const allTrades = await db.select()
        .from(transactions)
        .where(and(
          eq(transactions.walletId, walletId),
          eq(transactions.status, 'completed')
        ))
        .orderBy(desc(transactions.timestamp));
      
      // 6. Calculate realized PnL from saved transaction data (not recalculated!)
      const sells = allTrades.filter(t => t.type === 'sell');
      
      let totalRealizedPnl = 0;
      let profitableSells = 0;
      
      for (const sell of sells) {
        // Use saved realized PnL from transaction record (snapshot at time of sell)
        const realizedPnlValue = parseFloat(sell.realizedPnl || "0");
        
        totalRealizedPnl += realizedPnlValue;
        if (realizedPnlValue > 0) profitableSells++;
      }
      
      // 7. Calculate stats
      const totalTrades = sells.length;
      const winRate = totalTrades > 0 ? (profitableSells / totalTrades) * 100 : 0;
      const totalPnl = totalUnrealizedPnl + totalRealizedPnl;
      
      // 8. Recent trades (last 10)
      const recentTrades = allTrades.slice(0, 10).map(t => ({
        txhash: t.txhash,
        type: t.type,
        tokenSymbol: t.tokenSymbol,
        amount: t.amount,
        priceUsd: t.priceUsd,
        timestamp: t.timestamp
      }));
      
      // Prepend SOL to holdings array
      const allHoldings = [
        {
          mint: 'SOL',
          symbol: 'SOL',
          amount: solBalance.toFixed(6),
          entryPrice: solPrice.toFixed(2),
          currentPrice: solPrice.toFixed(2),
          costBasis: solValue.toFixed(2),
          currentValue: solValue.toFixed(2),
          unrealizedPnl: "0.00",
          pnlPercent: "0.00"
        },
        ...holdingsWithPnl
      ];
      
      res.json({
        success: true,
        summary: {
          totalPnl: totalPnl.toFixed(2),
          unrealizedPnl: totalUnrealizedPnl.toFixed(2),
          realizedPnl: totalRealizedPnl.toFixed(2),
          totalTrades,
          winRate: winRate.toFixed(1),
          totalValue: totalValue.toFixed(2)
        },
        holdings: allHoldings,
        recentTrades
      });
      
    } catch (error: any) {
      console.error("Portfolio fetch error:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // ============================================================================
  // ANVS CAN EXPLORER API ENDPOINTS (Read-only transaction explorer)
  // ============================================================================

  // Get paginated list of all transactions for explorer
  app.get("/api/explorer/transactions", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const type = req.query.type as string; // filter by type: deposit, withdraw, buy, sell
      const status = req.query.status as string; // filter by status: pending, completed, failed
      const offset = (page - 1) * limit;

      // Build WHERE conditions
      const conditions = [];
      if (type) {
        conditions.push(eq(transactions.type, type as any));
      }
      if (status) {
        conditions.push(eq(transactions.status, status as any));
      }

      // Query transactions with wallet info (ANV addresses only, never blockchain addresses)
      const txQuery = db.select({
        id: transactions.id,
        txhash: transactions.txhash,
        type: transactions.type,
        instructions: transactions.instructions,
        blockNumber: transactions.blockNumber,
        solValue: transactions.solValue,
        tokenSymbol: transactions.tokenSymbol,
        amount: transactions.amount,
        priceUsd: transactions.priceUsd,
        status: transactions.status,
        timestamp: transactions.timestamp,
        walletAddress: wallets.walletAddress, // ANV address only
      })
      .from(transactions)
      .innerJoin(wallets, eq(transactions.walletId, wallets.id))
      .orderBy(desc(transactions.timestamp))
      .limit(limit)
      .offset(offset);

      // Apply filters if present
      const txList = conditions.length > 0
        ? await txQuery.where(and(...conditions))
        : await txQuery;

      // Get total count for pagination
      const countQuery = db.select({ count: sql<number>`count(*)` })
        .from(transactions);
      
      const [{ count: totalCount }] = conditions.length > 0
        ? await countQuery.where(and(...conditions))
        : await countQuery;

      // Calculate USD value for each transaction
      const enrichedTxList = txList.map(tx => {
        const amount = parseFloat(tx.amount || "0");
        const price = parseFloat(tx.priceUsd || "0");
        const usdValue = amount * price;

        // Categorize transaction for explorer
        let category = 'Transfer In'; // deposit
        if (tx.type === 'withdraw') category = 'Transfer Out';
        else if (tx.type === 'buy') category = 'Buy';
        else if (tx.type === 'sell') category = 'Sell';

        return {
          txhash: tx.txhash,
          category,
          type: tx.type,
          instructions: tx.instructions, // User-friendly instructions (transfer in/out, buy, sell)
          blockNumber: tx.blockNumber, // Block number (optional)
          solValue: tx.solValue, // SOL amount for the transaction
          tokenSymbol: tx.tokenSymbol || 'SOL',
          amount: tx.amount,
          usdValue: usdValue.toFixed(2),
          status: tx.status,
          timestamp: tx.timestamp,
          wallet: tx.walletAddress, // ANV address (truncated in frontend)
        };
      });

      res.json({
        success: true,
        transactions: enrichedTxList,
        pagination: {
          page,
          limit,
          totalCount: Number(totalCount),
          totalPages: Math.ceil(Number(totalCount) / limit),
        }
      });

    } catch (error: any) {
      console.error("Explorer transactions list error:", error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get explorer statistics (dashboard metrics)
  app.get("/api/explorer/stats", async (req, res) => {
    try {
      // 1. Total transactions count (all statuses)
      const [{ count: totalTransactions }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(transactions);

      // 2. Completed transactions count
      const [{ count: completedTransactions }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(transactions)
        .where(eq(transactions.status, 'completed'));

      // 3. Unique wallets (anonymous sessions) count
      const [{ count: uniqueWallets }] = await db
        .select({ count: sql<number>`count(DISTINCT ${transactions.walletId})` })
        .from(transactions);

      // 4. All-time volume (sum USD value of ALL completed transactions) - USE SQL SUM with REAL for precision
      const [{ totalVolume: allTimeVolume }] = await db
        .select({
          totalVolume: sql<number>`COALESCE(SUM(CAST(${transactions.amount} AS REAL) * CAST(${transactions.priceUsd} AS REAL)), 0)`
        })
        .from(transactions)
        .where(eq(transactions.status, 'completed'));

      // 5. 24h volume (sum USD value in last 24 hours) - USE SQL SUM with REAL for precision
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [{ volume24h }] = await db
        .select({
          volume24h: sql<number>`COALESCE(SUM(CAST(${transactions.amount} AS REAL) * CAST(${transactions.priceUsd} AS REAL)), 0)`
        })
        .from(transactions)
        .where(sql`${transactions.timestamp} >= ${twentyFourHoursAgo} AND ${transactions.status} = 'completed'`);

      // 6. Average transaction value (computed from allTimeVolume / completedTransactions for consistency)
      const avgTransactionValue = Number(completedTransactions) > 0 
        ? Number(allTimeVolume) / Number(completedTransactions)
        : 0;

      // 7. Network status (check if any transaction in last 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const [{ count: recentTxCount }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(transactions)
        .where(sql`${transactions.timestamp} >= ${fiveMinutesAgo}`);
      
      const networkStatus = Number(recentTxCount) > 0 ? 'Online' : 'Offline';
      const networkActivity = Number(recentTxCount);

      // 8. 24h transaction count (ONLY COMPLETED to match 24h volume)
      const [{ count: transactions24h }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(transactions)
        .where(sql`${transactions.timestamp} >= ${twentyFourHoursAgo} AND ${transactions.status} = 'completed'`);

      res.json({
        success: true,
        stats: {
          totalTransactions: Number(totalTransactions),
          completedTransactions: Number(completedTransactions),
          uniqueWallets: Number(uniqueWallets),
          allTimeVolume: Number(allTimeVolume).toFixed(2),
          volume24h: Number(volume24h).toFixed(2),
          avgTransactionValue: Number(avgTransactionValue).toFixed(2),
          transactions24h: Number(transactions24h),
          networkStatus,
          networkActivity,
        }
      });

    } catch (error: any) {
      console.error("Explorer stats error:", error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get transaction detail by ANX hash
  app.get("/api/explorer/tx/:hash", async (req, res) => {
    try {
      const { hash } = req.params;

      const [tx] = await db.select({
        id: transactions.id,
        txhash: transactions.txhash,
        chainTxhash: transactions.chainTxhash,
        type: transactions.type,
        tokenAddress: transactions.tokenAddress,
        tokenSymbol: transactions.tokenSymbol,
        amount: transactions.amount,
        priceUsd: transactions.priceUsd,
        solValue: transactions.solValue,
        instructions: transactions.instructions,
        blockNumber: transactions.blockNumber,
        costBasisAtSale: transactions.costBasisAtSale,
        realizedPnl: transactions.realizedPnl,
        status: transactions.status,
        timestamp: transactions.timestamp,
        walletAddress: wallets.walletAddress, // ANV address
      })
      .from(transactions)
      .innerJoin(wallets, eq(transactions.walletId, wallets.id))
      .where(eq(transactions.txhash, hash))
      .limit(1);

      if (!tx) {
        return res.status(404).json({
          success: false,
          error: "Transaction not found"
        });
      }

      // Calculate USD value
      const amount = parseFloat(tx.amount || "0");
      const price = parseFloat(tx.priceUsd || "0");
      const usdValue = amount * price;

      // Categorize transaction
      let category = 'Transfer In';
      if (tx.type === 'withdraw') category = 'Transfer Out';
      else if (tx.type === 'buy') category = 'Buy';
      else if (tx.type === 'sell') category = 'Sell';

      res.json({
        success: true,
        transaction: {
          txhash: tx.txhash,
          chainTxhash: tx.chainTxhash, // Real blockchain hash (nullable)
          category,
          type: tx.type,
          tokenAddress: tx.tokenAddress,
          tokenSymbol: tx.tokenSymbol || 'SOL',
          amount: tx.amount,
          priceUsd: tx.priceUsd,
          solValue: tx.solValue,
          instructions: tx.instructions,
          blockNumber: tx.blockNumber,
          usdValue: usdValue.toFixed(2),
          costBasisAtSale: tx.costBasisAtSale,
          realizedPnl: tx.realizedPnl,
          status: tx.status,
          timestamp: tx.timestamp,
          wallet: tx.walletAddress, // ANV address
        }
      });

    } catch (error: any) {
      console.error("Explorer transaction detail error:", error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get wallet transaction history by ANV address
  app.get("/api/explorer/wallet/:anvAddress", async (req, res) => {
    try {
      const { anvAddress } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const type = req.query.type as string;
      const offset = (page - 1) * limit;

      // Find wallet by ANV address
      const [wallet] = await db.select()
        .from(wallets)
        .where(eq(wallets.walletAddress, anvAddress))
        .limit(1);

      if (!wallet) {
        return res.status(404).json({
          success: false,
          error: "Wallet not found"
        });
      }

      // Build WHERE conditions
      const conditions = [eq(transactions.walletId, wallet.id)];
      if (type) {
        conditions.push(eq(transactions.type, type as any));
      }

      // Query transactions
      const txList = await db.select()
        .from(transactions)
        .where(and(...conditions))
        .orderBy(desc(transactions.timestamp))
        .limit(limit)
        .offset(offset);

      // Get total count
      const [{ count: totalCount }] = await db.select({ count: sql<number>`count(*)` })
        .from(transactions)
        .where(and(...conditions));

      // Enrich transactions
      const enrichedTxList = txList.map(tx => {
        const amount = parseFloat(tx.amount || "0");
        const price = parseFloat(tx.priceUsd || "0");
        const usdValue = amount * price;

        let category = 'Transfer In';
        if (tx.type === 'withdraw') category = 'Transfer Out';
        else if (tx.type === 'buy') category = 'Buy';
        else if (tx.type === 'sell') category = 'Sell';

        return {
          txhash: tx.txhash,
          category,
          type: tx.type,
          tokenSymbol: tx.tokenSymbol || 'SOL',
          amount: tx.amount,
          usdValue: usdValue.toFixed(2),
          status: tx.status,
          timestamp: tx.timestamp,
        };
      });

      res.json({
        success: true,
        wallet: {
          anvAddress: wallet.walletAddress,
          createdAt: wallet.createdAt,
        },
        transactions: enrichedTxList,
        pagination: {
          page,
          limit,
          totalCount: Number(totalCount),
          totalPages: Math.ceil(Number(totalCount) / limit),
        }
      });

    } catch (error: any) {
      console.error("Explorer wallet history error:", error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // ======================
  // pANV Rewards API
  // ======================

  /**
   * Calculate pANV rewards for a SOL address holding ANV tokens
   * POST /api/panv/calculate-rewards
   * Body: { solAddress: string, anvWalletAddress: string }
   */
  app.post("/api/panv/calculate-rewards", async (req, res) => {
    try {
      const { solAddress, anvWalletAddress } = req.body;

      if (!solAddress || !anvWalletAddress) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: solAddress and anvWalletAddress"
        });
      }

      // TODO: Replace with actual ANV token mint address when provided
      const ANV_TOKEN_MINT = "PLACEHOLDER_ANV_MINT_ADDRESS";
      const MINIMUM_ANV_HOLDING = 1000000; // 1 million ANV

      // TEMPORARY: Mock ANV balance lookup for testing until real token mint address is provided
      // In production, this will be replaced with Helius getAssetsByOwner API call
      // Simulate different balances per SOL address for testing different tiers
      const getMockAnvBalance = (solAddr: string): number => {
        // Use last character of address to determine tier (simulates varied balances)
        const lastChar = solAddr.slice(-1).toLowerCase();
        const charCode = lastChar.charCodeAt(0);
        
        if (charCode % 3 === 0) return 12000000; // Tier 3: 12M ANV (2x multiplier)
        if (charCode % 3 === 1) return 6000000;  // Tier 2: 6M ANV (1.5x multiplier)
        return 3000000; // Tier 1: 3M ANV (1x multiplier)
      };
      
      const anvTokenBalance = getMockAnvBalance(solAddress); // TODO: Replace with real Helius API
      const isEligible = anvTokenBalance >= MINIMUM_ANV_HOLDING;

      if (!isEligible) {
        return res.json({
          success: true,
          eligible: false,
          message: `Minimum ${MINIMUM_ANV_HOLDING.toLocaleString()} ANV tokens required. Current balance: ${anvTokenBalance.toLocaleString()}`,
          data: {
            anvTokenBalance: anvTokenBalance.toString(),
            minimumRequired: MINIMUM_ANV_HOLDING.toString(),
            eligible: false
          }
        });
      }

      // Find wallet by ANV address
      const [wallet] = await db.select()
        .from(wallets)
        .where(eq(wallets.walletAddress, anvWalletAddress))
        .limit(1);

      if (!wallet) {
        return res.status(404).json({
          success: false,
          error: "ANV wallet not found"
        });
      }

      // Calculate total trading volume (all completed BUY + SELL transactions)
      const [volumeResult] = await db.select({
        totalVolumeUsd: sql<string>`
          COALESCE(SUM(
            CASE
              WHEN type = 'buy' THEN CAST(sol_value AS DECIMAL) * COALESCE(CAST(price_usd AS DECIMAL), 0)
              WHEN type = 'sell' THEN CAST(amount AS DECIMAL) * COALESCE(CAST(price_usd AS DECIMAL), 0)
              ELSE 0
            END
          ), 0)
        `
      })
        .from(transactions)
        .where(and(
          eq(transactions.walletId, wallet.id),
          eq(transactions.status, 'completed'),
          or(
            eq(transactions.type, 'buy'),
            eq(transactions.type, 'sell')
          )
        ));

      const tradingVolumeUsd = parseFloat(volumeResult?.totalVolumeUsd || "0");

      // Calculate holding multiplier
      let holdingMultiplier = 1.0;
      if (anvTokenBalance >= 10000000) {
        holdingMultiplier = 2.0; // 10M+ ANV
      } else if (anvTokenBalance >= 5000000) {
        holdingMultiplier = 1.5; // 5M-10M ANV
      }

      // Calculate volume multiplier
      let volumeMultiplier = 1.0;
      if (tradingVolumeUsd >= 50000) {
        volumeMultiplier = 1.5; // $50k+ volume
      } else if (tradingVolumeUsd >= 10000) {
        volumeMultiplier = 1.2; // $10k-$50k volume
      }

      // Base rate: $1 volume = 1 pANV
      const totalPanvEarned = tradingVolumeUsd * holdingMultiplier * volumeMultiplier;

      // Save or update linked wallet
      const [existingLink] = await db.select()
        .from(panvLinkedWallets)
        .where(eq(panvLinkedWallets.solAddress, solAddress))
        .limit(1);

      let linkedWalletId: string;
      
      if (existingLink) {
        // Update existing link
        await db.update(panvLinkedWallets)
          .set({
            anvWalletAddress,
            anvTokenBalance: anvTokenBalance.toString(),
            isEligible,
            lastCheckedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(panvLinkedWallets.id, existingLink.id));
        linkedWalletId = existingLink.id;
      } else {
        // Create new link
        const [newLink] = await db.insert(panvLinkedWallets)
          .values({
            solAddress,
            anvWalletAddress,
            anvTokenBalance: anvTokenBalance.toString(),
            isEligible,
            lastCheckedAt: new Date()
          })
          .returning();
        linkedWalletId = newLink.id;
      }

      // Save to cache
      const [existingCache] = await db.select()
        .from(panvRewardsCache)
        .where(eq(panvRewardsCache.linkedWalletId, linkedWalletId))
        .limit(1);

      if (existingCache) {
        await db.update(panvRewardsCache)
          .set({
            anvTokenBalance: anvTokenBalance.toString(),
            tradingVolumeUsd: tradingVolumeUsd.toString(),
            holdingMultiplier: holdingMultiplier.toString(),
            volumeMultiplier: volumeMultiplier.toString(),
            totalPanvEarned: totalPanvEarned.toString(),
            updatedAt: new Date()
          })
          .where(eq(panvRewardsCache.id, existingCache.id));
      } else {
        await db.insert(panvRewardsCache)
          .values({
            linkedWalletId,
            anvTokenBalance: anvTokenBalance.toString(),
            tradingVolumeUsd: tradingVolumeUsd.toString(),
            holdingMultiplier: holdingMultiplier.toString(),
            volumeMultiplier: volumeMultiplier.toString(),
            totalPanvEarned: totalPanvEarned.toString()
          });
      }

      res.json({
        success: true,
        eligible: true,
        data: {
          anvTokenBalance: anvTokenBalance.toString(),
          tradingVolumeUsd: tradingVolumeUsd.toFixed(2),
          holdingMultiplier: holdingMultiplier.toString(),
          volumeMultiplier: volumeMultiplier.toString(),
          totalPanvEarned: totalPanvEarned.toFixed(6),
          calculatedAt: new Date().toISOString()
        }
      });

    } catch (error: any) {
      console.error("pANV calculate rewards error:", error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * Get cached pANV rewards for a SOL address
   * GET /api/panv/rewards/:solAddress
   */
  app.get("/api/panv/rewards/:solAddress", async (req, res) => {
    try {
      const { solAddress } = req.params;

      const [linkedWallet] = await db.select()
        .from(panvLinkedWallets)
        .where(eq(panvLinkedWallets.solAddress, solAddress))
        .limit(1);

      if (!linkedWallet) {
        return res.status(404).json({
          success: false,
          error: "SOL address not linked to any ANV wallet"
        });
      }

      const [cache] = await db.select()
        .from(panvRewardsCache)
        .where(eq(panvRewardsCache.linkedWalletId, linkedWallet.id))
        .limit(1);

      if (!cache) {
        return res.json({
          success: true,
          data: null,
          message: "No rewards calculated yet. Please calculate first."
        });
      }

      res.json({
        success: true,
        data: {
          solAddress: linkedWallet.solAddress,
          anvWalletAddress: linkedWallet.anvWalletAddress,
          anvTokenBalance: cache.anvTokenBalance,
          tradingVolumeUsd: cache.tradingVolumeUsd,
          holdingMultiplier: cache.holdingMultiplier,
          volumeMultiplier: cache.volumeMultiplier,
          totalPanvEarned: cache.totalPanvEarned,
          isEligible: linkedWallet.isEligible,
          calculatedAt: cache.calculatedAt,
          lastCheckedAt: linkedWallet.lastCheckedAt
        }
      });

    } catch (error: any) {
      console.error("pANV get rewards error:", error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
