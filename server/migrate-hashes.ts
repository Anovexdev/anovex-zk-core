import { db } from "./db";
import { transactions } from "@shared/schema";
import { eq } from "drizzle-orm";
import { generateAnxTxHash } from "./swap-helpers";

async function migrateTransactionHashes() {
  console.log("🔄 Starting transaction hash migration...");
  
  try {
    // Get all transactions
    const allTransactions = await db.select().from(transactions);
    console.log(`📊 Found ${allTransactions.length} transactions to migrate`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const tx of allTransactions) {
      try {
        // Check if hash has old prefix format (ANVBUY, ANVSEL, ANVDEP, ANVWIT)
        const hasOldPrefix = tx.txhash.startsWith('ANVBUY') || 
                           tx.txhash.startsWith('ANVSEL') || 
                           tx.txhash.startsWith('ANVDEP') || 
                           tx.txhash.startsWith('ANVWIT');
        
        // Skip if already migrated (no prefix)
        if (!hasOldPrefix) {
          console.log(`✓ Transaction ${tx.id} already migrated (no prefix), skipping`);
          continue;
        }
        
        // Generate new hash with collision detection
        let newHash: string;
        let attempts = 0;
        const maxAttempts = 100;
        
        while (attempts < maxAttempts) {
          newHash = generateAnxTxHash(tx.type);
          
          // Check if hash already exists in database
          const existing = await db.select()
            .from(transactions)
            .where(eq(transactions.txhash, newHash))
            .limit(1);
          
          if (existing.length === 0) {
            // Hash is unique, break loop
            break;
          }
          
          attempts++;
          console.log(`⚠️ Collision detected for ${newHash}, retrying... (attempt ${attempts}/${maxAttempts})`);
        }
        
        if (attempts >= maxAttempts) {
          throw new Error(`Failed to generate unique hash after ${maxAttempts} attempts`);
        }
        
        // Map type to user-friendly instructions
        const instructionsMap = {
          deposit: 'transfer in',
          withdraw: 'transfer out',
          buy: 'buy',
          sell: 'sell'
        };
        
        // Update transaction with backup of old hash
        await db.update(transactions)
          .set({
            txhashLegacy: tx.txhash,  // Backup old hash
            txhash: newHash!,          // New 88-char hash (guaranteed unique)
            instructions: instructionsMap[tx.type], // User-friendly instructions
          })
          .where(eq(transactions.id, tx.id));
        
        console.log(`✅ Migrated ${tx.type} transaction: ${tx.txhash} → ${newHash!}`);
        successCount++;
      } catch (error) {
        console.error(`❌ Error migrating transaction ${tx.id}:`, error);
        errorCount++;
      }
    }
    
    console.log("\n📈 Migration Summary:");
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📦 Total: ${allTransactions.length}`);
    
    if (errorCount === 0) {
      console.log("\n🎉 Migration completed successfully!");
    } else {
      console.log("\n⚠️ Migration completed with errors. Please review logs.");
    }
    
  } catch (error) {
    console.error("💥 Fatal migration error:", error);
    throw error;
  }
}

// Run migration
migrateTransactionHashes()
  .then(() => {
    console.log("✨ Migration script finished");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Migration failed:", error);
    process.exit(1);
  });
