import { Context } from "grammy";
import { Keypair } from "@solana/web3.js";
import { db } from "../../db";
import { wallets, balances } from "@shared/schema";
import { encryptPrivateKey } from "../../encryption.js";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { deriveANVAddresses } from "../../anv-address";

export async function handleStartGenerate(ctx: Context) {
  if (!ctx.from) return;

  const telegramUserId = ctx.from.id.toString();
  
  try {
    // Deactivate all existing wallets for this user first
    await db.update(wallets)
      .set({ isActive: false })
      .where(eq(wallets.telegramUserId, telegramUserId));
    
    // Generate new wallet (will be set as active)
    const keypair = Keypair.generate();
    const privateKeyArray = Array.from(keypair.secretKey);
    const privateKeyBytes = new Uint8Array(privateKeyArray);
    const encryptedPrivateKey = encryptPrivateKey(privateKeyArray);
    const addresses = deriveANVAddresses(privateKeyBytes);
    const anvAddress = addresses.v2; // Use v2 (public key-based)

    const [wallet] = await db.insert(wallets).values({
      walletAddress: anvAddress,
      privateKey: encryptedPrivateKey,
      telegramUserId,
      isActive: true, // Set as active wallet
      walletName: null, // No custom name for Telegram wallets
    }).returning();

    // Create balance record
    await db.insert(balances).values({
      walletId: wallet.id,
      solBalance: "0",
    });

    // Show private key with critical security warnings
    const privateKeyStr = JSON.stringify(privateKeyArray);
    
    await ctx.reply(
      `✅ *Wallet Created Successfully*\n\n` +
      `💼 *ANV Address:*\n\`${wallet.walletAddress}\`\n\n` +
      `🔑 *Private Key (SAVE THIS):*\n\`${privateKeyStr}\`\n\n` +
      `⚠️ *CRITICAL SECURITY WARNING:*\n` +
      `• This is the ONLY time your private key will be shown\n` +
      `• Copy it NOW and store it securely offline\n` +
      `• DELETE this message immediately after saving\n` +
      `• Anyone with this key has full access to your funds\n` +
      `• Anovex cannot recover lost private keys\n\n` +
      `🔒 *Security Best Practices:*\n` +
      `1. Copy the private key to a secure password manager\n` +
      `2. Delete this Telegram message to prevent exposure\n` +
      `3. Never share your private key with anyone\n\n` +
      `*Available Commands:*\n` +
      `/deposit - Add funds via privacy relay\n` +
      `/withdraw - Withdraw to external wallet\n` +
      `/portfolio - View holdings & PnL\n` +
      `/monitor - Live portfolio tracking (auto-refresh 20s)\n` +
      `/pnl - Generate shareable PnL card\n` +
      `/wallets - View all your wallets\n` +
      `/switch - Change active wallet`,
      { parse_mode: "Markdown" }
    );
  } catch (error) {
    console.error("Error generating wallet:", error);
    await ctx.reply("❌ Failed to generate wallet. Please try again.");
  }
}
