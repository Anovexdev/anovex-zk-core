import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import pgSession from "connect-pg-simple";
import pg from "pg";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initSystemWallets } from "./init-system-wallets";
import { storage } from "./storage";
import { db } from "./db";
import { wallets } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { decryptPrivateKey } from "./encryption";
import crypto from "crypto";
import { setupTelegramBot, getTelegramWebhook } from "./telegram-bot";
import { deriveANVAddresses } from "./anv-address";
import { runDatabaseMigrations } from "./db-migrations";

const PostgresStore = pgSession(session);

const app = express();

// CRITICAL: Trust reverse proxy for secure cookies in production
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1); // Trust first proxy (HTTPS termination)
}

// Extend Express session type
declare module 'express-session' {
  interface SessionData {
    walletId?: string;
  }
}

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

// Session middleware with PostgreSQL persistence
const pgPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

app.use(session({
  store: new PostgresStore({
    pool: pgPool,
    tableName: 'session', // PostgreSQL session table
    createTableIfMissing: true, // Auto-create session table
  }),
  secret: process.env.SESSION_SECRET || 'anovex-dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 400 * 24 * 60 * 60 * 1000, // 400 days (>1 year permanent login!)
    httpOnly: true,
    // CRITICAL FIX: Force secure: true in production (always uses HTTPS proxy)
    // But check if request is coming through HTTPS proxy properly
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', // Allow cookies on login redirects
    // CRITICAL: Let browser use current domain automatically
    domain: undefined,
    // ADDED: Ensure path is set correctly
    path: '/',
  },
  // CRITICAL: Trust first proxy (HTTPS reverse proxy)
  proxy: process.env.NODE_ENV === 'production',
}));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Migration: Upgrade all existing wallets from v1 (private key-based) to v2 (public key-based) ANV addresses
async function migrateWalletAddresses() {
  try {
    console.log('🔧 Upgrading wallets to v2 (public key-based) ANV addresses...');
    const allWallets = await storage.getAllWallets();
    
    let migratedCount = 0;
    let alreadyV2Count = 0;
    let skippedInvalidCount = 0;
    
    for (const wallet of allWallets) {
      try {
        // Decrypt private key to derive both v1 and v2 addresses
        const privateKeyArray = decryptPrivateKey(wallet.privateKey);
        const privateKeyBytes = new Uint8Array(privateKeyArray);
        
        // Skip wallets with invalid key length
        if (privateKeyBytes.length !== 64) {
          console.log(`   ⚠️  Skipped wallet ${wallet.id}: invalid key length (${privateKeyBytes.length} bytes)`);
          skippedInvalidCount++;
          continue;
        }
        
        const addresses = deriveANVAddresses(privateKeyBytes);
        
        // Check if wallet already has v2 address
        if (wallet.walletAddress === addresses.v2) {
          alreadyV2Count++;
          continue;
        }
        
        // Wallet has v1 address or no address - upgrade to v2
        const oldAddress = wallet.walletAddress || 'null';
        
        // Update wallet with v2 address
        const [updated] = await db
          .update(wallets)
          .set({ walletAddress: addresses.v2 })
          .where(eq(wallets.id, wallet.id))
          .returning();
        
        if (updated) {
          console.log(`   ✓ Upgraded wallet ${wallet.id}: ${oldAddress} → ${addresses.v2} (v2)`);
          migratedCount++;
        } else {
          console.error(`   ✗ Failed to upgrade wallet ${wallet.id}`);
        }
      } catch (error: any) {
        // Log error but continue migration for other wallets
        console.log(`   ⚠️  Skipped wallet ${wallet.id}: ${error.message}`);
        skippedInvalidCount++;
      }
    }
    
    console.log(`✅ Migration complete: ${migratedCount} upgraded to v2, ${alreadyV2Count} already v2${skippedInvalidCount > 0 ? `, ${skippedInvalidCount} skipped (invalid)` : ''}`);
  } catch (error) {
    console.error('❌ Wallet migration failed:', error);
  }
}

(async () => {
  try {
    // Initialize system wallets (TRON bridge + Solana pool)
    await initSystemWallets();
    
    // Run database migrations (create unique indexes, constraints, etc.)
    // CRITICAL: This must succeed or app cannot start safely
    await runDatabaseMigrations();
    
    // Migrate existing wallets to have ANV addresses
    await migrateWalletAddresses();
    
    // Setup Telegram bot
    const telegramBot = await setupTelegramBot();
    const telegramWebhook = getTelegramWebhook();
    
    // Add Telegram webhook endpoint
    if (telegramWebhook) {
      app.post("/api/telegram/webhook", telegramWebhook);
      log("✅ Telegram webhook endpoint registered at /api/telegram/webhook");
    }
    
    const server = await registerRoutes(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      res.status(status).json({ message });
      throw err;
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 5000 if not specified.
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = parseInt(process.env.PORT || '5000', 10);
    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      log(`serving on port ${port}`);
    });
    
    // ===== BACKGROUND POLLING JOB FOR DEPOSIT/WITHDRAWAL AUTOMATION =====
    // Polls SimpleSwap every 5 seconds to auto-trigger Step 2 and credit balances
    // No webhook needed - fully autonomous
    const { startDepositPolling } = await import('./polling');
    startDepositPolling();
  } catch (error) {
    console.error("❌ FATAL: Application startup failed:", error);
    console.error("❌ Exiting...");
    process.exit(1);
  }
})();
