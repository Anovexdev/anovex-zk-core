import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const TRON_GRID_API = 'https://api.trongrid.io';

// Import TronWeb using CommonJS require (package is CJS-only)
const tronWebModule = require('tronweb');
const TronWeb = tronWebModule.TronWeb || tronWebModule.default || tronWebModule;

export async function getTronWalletBalance(walletAddress: string): Promise<number> {
  try {
    const response = await fetch(`${TRON_GRID_API}/v1/accounts/${walletAddress}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`TronGrid API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Get balance in SUN and convert to TRX
    const balanceSun = data.data?.[0]?.balance || 0;
    const trxBalance = balanceSun / 1_000_000;
    
    return trxBalance;
  } catch (error: any) {
    console.error(`[TRON] Error checking balance for ${walletAddress}:`, error.message);
    throw error;
  }
}

export async function getPrivacyRelayNodeBalance(): Promise<number> {
  const tronWalletAddress = process.env.TRON_WALLET_ADDRESS;
  
  if (!tronWalletAddress) {
    throw new Error("TRON_WALLET_ADDRESS not configured");
  }
  
  return await getTronWalletBalance(tronWalletAddress);
}

/**
 * Send TRX from Privacy Relay Node to destination address
 * @param toAddress Destination TRON address
 * @param amount Amount in TRX (will be converted to SUN)
 * @returns Transaction ID
 * @note Reserves 2 TRX for transaction fees (bandwidth + energy)
 */
export async function sendTronFromPrivacyRelayNode(
  toAddress: string,
  amount: number
): Promise<string> {
  // Reserve 2 TRX for transaction fees
  const FEE_RESERVE_TRX = 2;
  const sendAmount = Math.max(0, amount - FEE_RESERVE_TRX);
  const tronWalletSecret = process.env.TRON_WALLET_SECRET;
  const tronWalletAddress = process.env.TRON_WALLET_ADDRESS;
  const tronApiKey = process.env.TRON_PRO_API_KEY;
  
  if (!tronWalletSecret || !tronWalletAddress) {
    throw new Error("TRON wallet credentials not configured");
  }
  
  try {
    // Initialize TronWeb with mainnet (try without API key first, use free tier)
    const headers = tronApiKey ? { "TRON-PRO-API-KEY": tronApiKey } : {};
    
    const tronWeb = new TronWeb({
      fullHost: TRON_GRID_API,
      headers,
      privateKey: tronWalletSecret
    });
    
    // Verify sender address matches
    const derivedAddress = tronWeb.address.fromPrivateKey(tronWalletSecret);
    if (derivedAddress !== tronWalletAddress) {
      throw new Error("TRON wallet secret does not match address");
    }
    
    // Convert TRX to SUN (1 TRX = 1,000,000 SUN)
    const amountInSun = Math.floor(sendAmount * 1_000_000);
    
    if (sendAmount <= 0) {
      throw new Error(`Insufficient balance to send after reserving ${FEE_RESERVE_TRX} TRX for fees`);
    }
    
    console.log(`[TRON] Sending ${sendAmount.toFixed(4)} TRX (${amountInSun} SUN) from ${tronWalletAddress} to ${toAddress} [Reserved ${FEE_RESERVE_TRX} TRX for fees]`);
    
    // Create and send transaction
    const transaction = await tronWeb.transactionBuilder.sendTrx(
      toAddress,
      amountInSun,
      tronWalletAddress
    );
    
    // Sign transaction
    const signedTransaction = await tronWeb.trx.sign(transaction);
    
    // Broadcast transaction
    const result = await tronWeb.trx.sendRawTransaction(signedTransaction);
    
    if (!result.result) {
      throw new Error(`Transaction failed: ${JSON.stringify(result)}`);
    }
    
    console.log(`[TRON] ✅ Transaction successful! TX ID: ${result.txid || result.transaction?.txID}`);
    return result.txid || result.transaction?.txID;
  } catch (error: any) {
    console.error(`[TRON] Transaction failed:`, error.message);
    throw error;
  }
}
