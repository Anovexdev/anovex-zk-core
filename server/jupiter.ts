import fetch from 'node-fetch';
import { Connection, VersionedTransaction, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';

const JUPITER_ULTRA_API_BASE = 'https://lite-api.jup.ag/ultra/v1';
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const SOLANA_RPC = 'https://api.mainnet-beta.solana.com'; // Force public RPC (Helius key invalid)

const connection = new Connection(SOLANA_RPC, 'confirmed');

// Separate connection for public RPC calls (token decimals fetch) - no auth required
const publicConnection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

export interface JupiterQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
  requestId?: string;
  transaction?: string;
}

export interface SwapParams {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps: number;
  userPublicKey: string;
}

export async function getJupiterQuote(params: {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps?: number;
  taker?: string;
  onlyDirectRoutes?: boolean;
}): Promise<JupiterQuote> {
  const slippage = params.slippageBps || 200; // Default 2% for anti-frontrunning
  
  const orderUrl = `${JUPITER_ULTRA_API_BASE}/order?` +
    `inputMint=${params.inputMint}` +
    `&outputMint=${params.outputMint}` +
    `&amount=${params.amount}` +
    `&slippageBps=${slippage}` + // CRITICAL: Add slippage protection
    (params.taker ? `&taker=${params.taker}` : '') +
    (params.onlyDirectRoutes ? `&onlyDirectRoutes=true` : ''); // MEV protection: simpler routes
  
  console.log('🔍 Fetching Jupiter Ultra order:', orderUrl);
  
  const response = await fetch(orderUrl);
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Jupiter Ultra order failed: ${error}`);
  }
  
  const orderData = await response.json() as any;
  
  const quote: JupiterQuote = {
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    inAmount: params.amount,
    outAmount: orderData.outAmount || '0',
    priceImpactPct: orderData.priceImpactPct || '0',
    requestId: orderData.requestId,
    transaction: orderData.transaction
  };
  
  console.log(`✅ Jupiter Ultra order: ${quote.inAmount} → ${quote.outAmount} (impact: ${quote.priceImpactPct}%)`);
  
  return quote;
}

function parsePrivateKey(privateKeyInput: string): Uint8Array {
  try {
    if (privateKeyInput.startsWith('[') && privateKeyInput.endsWith(']')) {
      const parsed = JSON.parse(privateKeyInput);
      return new Uint8Array(parsed);
    }
  } catch (e) {
  }
  
  try {
    return bs58.decode(privateKeyInput.trim());
  } catch (e) {
    throw new Error('Invalid private key format. Expected base58 string or JSON array.');
  }
}

export async function executeJupiterSwap(
  quote: JupiterQuote,
  walletPrivateKey: string,
  walletPublicKey: string
): Promise<string> {
  console.log('🔄 Executing Jupiter Ultra swap on-chain...');
  
  if (!quote.transaction) {
    throw new Error('No transaction in quote - taker wallet was not provided');
  }
  
  if (!quote.requestId) {
    throw new Error('No requestId in quote - invalid order response');
  }
  
  const swapTransactionBuf = Buffer.from(quote.transaction, 'base64');
  const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
  
  const secretKey = parsePrivateKey(walletPrivateKey);
  const keypair = Keypair.fromSecretKey(secretKey);
  transaction.sign([keypair]);
  
  const signedTransaction = Buffer.from(transaction.serialize()).toString('base64');
  
  const executeResponse = await fetch(`${JUPITER_ULTRA_API_BASE}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      signedTransaction: signedTransaction,
      requestId: quote.requestId
    })
  });
  
  if (!executeResponse.ok) {
    const error = await executeResponse.text();
    throw new Error(`Jupiter Ultra execute failed: ${error}`);
  }
  
  const executeData = await executeResponse.json() as any;
  
  if (!executeData.signature) {
    throw new Error('No signature returned from Jupiter Ultra execute');
  }
  
  const txid = executeData.signature;
  console.log(`📡 Transaction sent via Jupiter Ultra: ${txid}`);
  
  console.log(`✅ Transaction confirmed: ${txid}`);
  
  return txid;
}

export const SOL_MINT = 'So11111111111111111111111111111111111111112';

export function toLamports(solAmount: number): string {
  return Math.floor(solAmount * 1e9).toString();
}

export function fromLamports(lamports: string): number {
  return parseInt(lamports) / 1e9;
}

export async function getTokenDecimals(mintAddress: string): Promise<number> {
  try {
    const mintPublicKey = new PublicKey(mintAddress);
    // Use public RPC connection (no auth required) for metadata fetch
    const mintInfo = await publicConnection.getParsedAccountInfo(mintPublicKey);
    
    if (mintInfo.value && 'parsed' in mintInfo.value.data) {
      const decimals = mintInfo.value.data.parsed.info.decimals;
      console.log(`✅ Fetched ${decimals} decimals for token ${mintAddress}`);
      return decimals;
    }
    
    console.warn(`⚠️ Could not parse decimals for ${mintAddress}, defaulting to 9`);
    return 9; // Default to 9 if can't fetch
  } catch (error) {
    console.error(`❌ Failed to fetch decimals for ${mintAddress}:`, error);
    return 9; // Default to 9 on error
  }
}

/**
 * Send SOL from Liquidity Router Node wallet to an address
 * Used for withdrawal Step 1: send SOL to SimpleSwap exchange address
 * @param toAddress - Destination Solana address
 * @param amount - Amount of SOL to send
 * @returns Transaction signature
 */
export async function sendSolFromLiquidityRouterNode(
  toAddress: string,
  amount: number
): Promise<string> {
  const solanaWalletSecret = process.env.SOLANA_WALLET_SECRET;
  
  if (!solanaWalletSecret) {
    throw new Error("SOLANA_WALLET_SECRET not configured");
  }
  
  try {
    // Parse private key
    const privateKeyBytes = parsePrivateKey(solanaWalletSecret);
    const senderKeypair = Keypair.fromSecretKey(privateKeyBytes);
    const senderPublicKey = senderKeypair.publicKey;
    
    console.log(`[SOL] Sending ${amount.toFixed(9)} SOL from ${senderPublicKey.toString()} to ${toAddress}`);
    
    // Convert SOL to lamports
    const lamports = Math.floor(amount * LAMPORTS_PER_SOL);
    
    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    
    // Create transfer instruction
    const transferInstruction = SystemProgram.transfer({
      fromPubkey: senderPublicKey,
      toPubkey: new PublicKey(toAddress),
      lamports,
    });
    
    // Create transaction and set properties
    const transaction = new Transaction().add(transferInstruction);
    transaction.feePayer = senderPublicKey;
    transaction.recentBlockhash = blockhash;
    
    // Send and confirm transaction
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [senderKeypair],
      {
        commitment: 'confirmed',
      }
    );
    
    console.log(`[SOL] ✅ Transfer successful! TX: ${signature}`);
    
    return signature;
  } catch (error: any) {
    console.error(`[SOL] Transfer failed:`, error.message);
    throw new Error(`Failed to send SOL: ${error.message}`);
  }
}
