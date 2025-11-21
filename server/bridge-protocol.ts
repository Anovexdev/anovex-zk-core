/**
 * Privacy Relay Network API Client (SimpleSwap API v3 Backend)
 * Used for dual-wallet TRON bridge: SOL ↔ TRX conversions
 * 
 * Step 1 (Deposit): User SOL → TRX → Wallet1 (TRON bridge)
 * Step 2 (Deposit): Wallet1 TRX → SOL → Wallet2 (Solana pool)
 * 
 * Withdraw reverses the flow
 */

import fetch from "node-fetch";

const RELAY_API_BASE = "https://api.simpleswap.io";
const API_KEY = process.env.SIMPLESWAP_API_KEY;

if (!API_KEY) {
  console.error("❌ Privacy Relay Network API key not configured");
}

interface CreateExchangeRequest {
  fixed: boolean;
  tickerFrom: string;
  tickerTo: string;
  networkFrom: string;
  networkTo: string;
  amount: string;
  addressTo: string;
  extraIdTo?: string;
  userRefundAddress?: string;
  userRefundExtraId?: string;
}

interface CreateExchangeResponse {
  id: string;  // SimpleSwap API v3 uses "id" not "publicId"
  type: "fixed" | "float";
  timestampCreated?: number;
  timestampUpdate?: number;
  updatedAt?: string;
  tickerFrom: string;
  tickerTo: string;
  networkFrom: string;
  networkTo: string;
  amountFrom: string | null;
  expectedAmount?: string;
  expectedAmountTo?: string;
  amountTo: string | null;
  addressFrom: string;
  addressTo: string;
  extraIdFrom: string | null;
  extraIdTo: string | null;
  userRefundAddress: string | null;
  userRefundExtraId: string | null;
  status: string;
  publicId?: string; // Keep for backward compatibility
}

interface ExchangeStatus {
  id: string;  // SimpleSwap API v3 uses "id" not "publicId"
  publicId?: string; // Keep for backward compatibility
  type: "fixed" | "float";
  timestampCreated: number;
  timestampUpdate: number;
  tickerFrom: string;
  tickerTo: string;
  networkFrom: string;
  networkTo: string;
  amountFrom: string | null;
  expectedAmountTo: string;
  amountTo: string | null;
  addressFrom: string;
  addressTo: string;
  txFrom: string | null;
  txTo: string | null;
  status: "waiting" | "confirming" | "exchanging" | "sending" | "finished" | "failed" | "refunded" | "expired";
}

/**
 * Create a new exchange via Privacy Relay Network
 * Returns exchange ID and deposit address
 */
export async function createExchange(params: CreateExchangeRequest): Promise<CreateExchangeResponse> {
  if (!API_KEY) {
    throw new Error("Privacy Relay Network not configured");
  }

  try {
    const response = await fetch(`${RELAY_API_BASE}/v3/exchanges`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error("Privacy Relay Network error:", response.status, errorData);
      
      // User-friendly error messages (never expose SimpleSwap)
      if (response.status === 400) {
        throw new Error("Invalid routing parameters. Please check amount and addresses.");
      } else if (response.status === 401) {
        throw new Error("Privacy Relay Network authentication failed");
      } else if (response.status === 422) {
        throw new Error("Amount is outside allowed range for this route");
      } else {
        throw new Error("Privacy Relay Network temporarily unavailable. Please try again.");
      }
    }

    const data: any = await response.json();
    const result = data.result || data;
    
    // Map "id" to "publicId" for backward compatibility
    if (result.id && !result.publicId) {
      result.publicId = result.id;
    }
    
    return result;
  } catch (error: any) {
    // Re-throw user-friendly errors
    if (error.message.includes("Privacy Relay") || error.message.includes("Invalid routing") || error.message.includes("Amount is outside")) {
      throw error;
    }
    // Generic network error
    console.error("Privacy Relay Network connection error:", error);
    throw new Error("Unable to connect to Privacy Relay Network. Please try again.");
  }
}

/**
 * Get exchange status by ID
 */
export async function getExchangeStatus(exchangeId: string): Promise<ExchangeStatus> {
  if (!API_KEY) {
    throw new Error("Privacy Relay Network not configured");
  }

  try {
    const response = await fetch(
      `${RELAY_API_BASE}/v3/exchanges/${exchangeId}`,
      {
        headers: {
          "Accept": "application/json",
          "x-api-key": API_KEY,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error("Privacy Relay Network status check error:", response.status, errorData);
      
      if (response.status === 404) {
        throw new Error("Exchange not found");
      }
      throw new Error("Unable to check transaction status");
    }

    const data: any = await response.json();
    const result = data.result || data;
    
    // Map "id" to "publicId" for backward compatibility
    if (result.id && !result.publicId) {
      result.publicId = result.id;
    }
    
    return result;
  } catch (error: any) {
    if (error.message.includes("Exchange not found") || error.message.includes("Unable to check")) {
      throw error;
    }
    console.error("Privacy Relay Network connection error:", error);
    throw new Error("Unable to connect to Privacy Relay Network");
  }
}

/**
 * Get estimated exchange amount
 * Returns how much 'tickerTo' you'll receive for 'amount' of 'tickerFrom'
 */
export async function getEstimate(
  tickerFrom: string,
  networkFrom: string,
  tickerTo: string,
  networkTo: string,
  amount: string,
  fixed: boolean = false
): Promise<string> {
  if (!API_KEY) {
    throw new Error("Privacy Relay Network not configured");
  }

  try {
    const params = new URLSearchParams({
      fixed: fixed.toString(),
      tickerFrom,
      networkFrom,
      tickerTo,
      networkTo,
      amount,
    });

    const response = await fetch(
      `${RELAY_API_BASE}/v3/estimates?${params}`,
      {
        headers: {
          "Accept": "application/json",
          "x-api-key": API_KEY,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error("Privacy Relay Network estimate error:", response.status, errorData);
      
      if (response.status === 404) {
        throw new Error("This exchange pair is not available");
      } else if (response.status === 422) {
        throw new Error("Amount is outside allowed range");
      }
      throw new Error("Unable to get exchange estimate");
    }

    const data: any = await response.json();
    return data.result.estimatedAmount;
  } catch (error: any) {
    if (error.message.includes("not available") || error.message.includes("outside allowed") || error.message.includes("Unable to get")) {
      throw error;
    }
    console.error("Privacy Relay Network connection error:", error);
    throw new Error("Unable to connect to Privacy Relay Network");
  }
}

/**
 * Create Step 1 exchange: SOL → TRX to TRON Bridge Wallet
 * Used for deposit flow
 */
export async function createDepositStep1Exchange(
  solAmount: string,
  tronWalletAddress: string
): Promise<CreateExchangeResponse> {
  return await createExchange({
    fixed: false,
    tickerFrom: "sol",
    networkFrom: "sol",
    tickerTo: "trx",
    networkTo: "trx",
    amount: solAmount,
    addressTo: tronWalletAddress,
  });
}

/**
 * Create Step 2 exchange: TRX → SOL to Solana Pool Wallet
 * Used for deposit flow (called after Step 1 completes)
 */
export async function createDepositStep2Exchange(
  trxAmount: string,
  solanaWalletAddress: string
): Promise<CreateExchangeResponse> {
  return await createExchange({
    fixed: false,
    tickerFrom: "trx",
    networkFrom: "trx",
    tickerTo: "sol",
    networkTo: "sol",
    amount: trxAmount,
    addressTo: solanaWalletAddress,
  });
}

/**
 * Create Step 1 exchange for withdrawal: SOL → TRX from Wallet2 to Wallet1
 * Used for withdraw flow
 */
export async function createWithdrawStep1Exchange(
  solAmount: string,
  tronWalletAddress: string
): Promise<CreateExchangeResponse> {
  return await createExchange({
    fixed: false,
    tickerFrom: "sol",
    networkFrom: "sol",
    tickerTo: "trx",
    networkTo: "trx",
    amount: solAmount,
    addressTo: tronWalletAddress,
  });
}

/**
 * Create Step 2 exchange for withdrawal: TRX → SOL to user's wallet
 * Used for withdraw flow (called after Step 1 completes)
 */
export async function createWithdrawStep2Exchange(
  trxAmount: string,
  userSolAddress: string
): Promise<CreateExchangeResponse> {
  return await createExchange({
    fixed: false,
    tickerFrom: "trx",
    networkFrom: "trx",
    tickerTo: "sol",
    networkTo: "sol",
    amount: trxAmount,
    addressTo: userSolAddress,
  });
}
