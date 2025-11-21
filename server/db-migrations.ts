import { db } from "./db";
import { sql } from "drizzle-orm";

/**
 * Run database migrations that cannot be handled by Drizzle
 * This executes at application startup to ensure critical constraints exist
 */
export async function runDatabaseMigrations() {
  console.log("🔧 Running database migrations...");
  
  try {
    // CRITICAL: Create partial unique index for duplicate pending transaction protection
    // This prevents spam/exploits by allowing only ONE pending buy/sell per wallet+type
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS onependingtransactionperwallettype 
      ON transactions (wallet_id, type) 
      WHERE (status = 'pending')
    `);
    
    console.log("✅ Database migrations complete");
  } catch (error: any) {
    console.error("❌ FATAL: Database migration failed:", error.message);
    console.error("❌ Cannot start application without critical security constraints");
    console.error("❌ Exiting to prevent race conditions and security vulnerabilities...");
    throw error;
  }
}
