import { Keypair } from "@solana/web3.js";
import { storage } from "./storage";
import { encryptPrivateKey } from "./encryption";

/**
 * Initialize system wallets for dual-wallet TRON bridge
 * Privacy Relay Node: TRON bridge wallet (handles SOL ↔ TRX conversions)
 * Liquidity Router Node: Solana pool wallet (holds user balances, executes SPL swaps)
 * 
 * SECURITY: Operator must provide wallet secrets via environment variables
 */
export async function initSystemWallets() {
  console.log("🔧 Initializing system wallets...");
  
  // Get secrets from environment
  const tronSecret = process.env.TRON_WALLET_SECRET;
  const tronAddress = process.env.TRON_WALLET_ADDRESS;
  const solanaSecret = process.env.SOLANA_WALLET_SECRET;
  
  if (!tronSecret || !tronAddress || !solanaSecret) {
    console.error("❌ CRITICAL: System wallet secrets not found!");
    console.error("   Please set environment variables:");
    console.error("   - TRON_WALLET_SECRET (TRON private key as hex string)");
    console.error("   - TRON_WALLET_ADDRESS (TRON public address, starts with 'T')");
    console.error("   - SOLANA_WALLET_SECRET (Solana private key as JSON array)");
    throw new Error("Missing system wallet secrets. Cannot start application.");
  }
  
  // Parse and validate secrets first (before DB check)
  // Parse TRON private key
  const tronPrivateKeyHex = tronSecret.replace(/^0x/, '');
  const tronPrivateKeyBuffer = Buffer.from(tronPrivateKeyHex, 'hex');
  if (tronPrivateKeyBuffer.length !== 32) {
    throw new Error("TRON private key must be 32 bytes (64 hex characters)");
  }
  
  // Parse Solana private key
  let solanaPrivateKey: number[];
  if (solanaSecret.startsWith('[')) {
    solanaPrivateKey = JSON.parse(solanaSecret);
  } else {
    throw new Error("SOLANA_WALLET_SECRET must be JSON array format: [1,2,3,...]");
  }
  if (!Array.isArray(solanaPrivateKey) || solanaPrivateKey.length !== 64) {
    throw new Error("Solana private key must be 64-byte array");
  }
  const solanaKeypair = Keypair.fromSecretKey(new Uint8Array(solanaPrivateKey));
  const solanaAddress = solanaKeypair.publicKey.toBase58();
  
  // Check if wallets already exist in DB
  const existingTronWallet = await storage.getSystemWallet("privacy_relay_node");
  const existingSolanaWallet = await storage.getSystemWallet("liquidity_router_node");
  
  // Detect secret rotation (address mismatch = operator rotated keys)
  if (existingTronWallet && existingTronWallet.address !== tronAddress) {
    console.error("❌ CRITICAL: TRON_WALLET_ADDRESS mismatch detected!");
    console.error(`   Database:    ${existingTronWallet.address}`);
    console.error(`   Environment: ${tronAddress}`);
    console.error("   This indicates wallet secret rotation.");
    console.error("   SECURITY: Cannot continue with mismatched keys.");
    console.error("   ACTION REQUIRED: Delete old wallets from DB or revert secrets.");
    throw new Error("Wallet address mismatch. Cannot start with stale credentials.");
  }
  
  if (existingSolanaWallet && existingSolanaWallet.address !== solanaAddress) {
    console.error("❌ CRITICAL: SOLANA_WALLET_ADDRESS mismatch detected!");
    console.error(`   Database:    ${existingSolanaWallet.address}`);
    console.error(`   Environment: ${solanaAddress}`);
    console.error("   This indicates wallet secret rotation.");
    console.error("   SECURITY: Cannot continue with mismatched keys.");
    console.error("   ACTION REQUIRED: Delete old wallets from DB or revert secrets.");
    throw new Error("Wallet address mismatch. Cannot start with stale credentials.");
  }
  
  if (existingTronWallet && existingSolanaWallet) {
    console.log("✅ System wallets already initialized");
    console.log(`   Privacy Relay Node: ${existingTronWallet.address}`);
    console.log(`   Liquidity Router Node: ${existingSolanaWallet.address}`);
    return;
  }
  
  // Initialize Privacy Relay Node (TRON Bridge)
  if (!existingTronWallet) {
    try {
      const encryptedTronKey = encryptPrivateKey(Array.from(tronPrivateKeyBuffer));
      
      await storage.createSystemWallet({
        name: "privacy_relay_node",
        blockchain: "tron",
        address: tronAddress,
        privateKey: encryptedTronKey,
      });
      
      console.log("✅ Privacy Relay Node initialized:", tronAddress);
    } catch (error: any) {
      console.error("❌ Failed to initialize TRON wallet:", error.message);
      throw error;
    }
  }
  
  // Initialize Liquidity Router Node (Solana Pool)
  if (!existingSolanaWallet) {
    try {
      const encryptedSolanaKey = encryptPrivateKey(solanaPrivateKey);
      
      await storage.createSystemWallet({
        name: "liquidity_router_node",
        blockchain: "solana",
        address: solanaAddress,
        privateKey: encryptedSolanaKey,
      });
      
      console.log("✅ Liquidity Router Node initialized:", solanaAddress);
    } catch (error: any) {
      console.error("❌ Failed to initialize Solana wallet:", error.message);
      throw error;
    }
  }
  
  console.log("✅ System wallets initialization complete");
}
