// Fix Token Symbols Migration Script
// Updates all transactions with CA prefix symbols to use real token names from Helius

import { db } from "./db";
import { transactions, tokenHoldings } from "@shared/schema";
import { eq, ne, sql } from "drizzle-orm";
import { getTokenMetadataWithFallback } from "./helius-metadata";

async function fixTokenSymbols() {
  console.log('\n🔧 Starting token symbol fix migration...\n');
  
  try {
    // 1. Get all transactions with tokenAddress (buy/sell transactions)
    const allTxs = await db.select({
      id: transactions.id,
      txhash: transactions.txhash,
      tokenAddress: transactions.tokenAddress,
      tokenSymbol: transactions.tokenSymbol,
      type: transactions.type
    })
    .from(transactions)
    .where(ne(transactions.tokenAddress, ''));
    
    console.log(`📊 Found ${allTxs.length} transactions with token addresses\n`);
    
    if (allTxs.length === 0) {
      console.log('✅ No transactions to update!');
      return;
    }
    
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    
    for (const tx of allTxs) {
      if (!tx.tokenAddress) {
        skipped++;
        continue;
      }
      
      const currentSymbol = tx.tokenSymbol || '';
      
      // Only update if symbol looks like CA prefix (6 chars or less) or is empty
      if (currentSymbol && currentSymbol.length > 6) {
        console.log(`⏭️  Skipping ${tx.txhash} - already has valid symbol: ${currentSymbol}`);
        skipped++;
        continue;
      }
      
      try {
        // Fetch real metadata from Helius
        console.log(`🔍 Fetching metadata for ${tx.tokenAddress}...`);
        const metadata = await getTokenMetadataWithFallback(tx.tokenAddress);
        
        if (metadata.symbol && metadata.symbol !== currentSymbol) {
          // Update transaction
          await db.update(transactions)
            .set({ 
              tokenSymbol: metadata.symbol 
            })
            .where(eq(transactions.id, tx.id));
          
          console.log(`✅ Updated ${tx.txhash}: ${currentSymbol || 'empty'} → ${metadata.symbol}`);
          updated++;
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } else {
          console.log(`⏭️  Skipping ${tx.txhash} - no change needed`);
          skipped++;
        }
        
      } catch (error: any) {
        console.error(`❌ Failed to update ${tx.txhash}:`, error.message);
        failed++;
      }
    }
    
    // 2. Update token_holdings with correct symbols
    console.log('\n📊 Fixing token_holdings symbols...\n');
    
    const holdings = await db.select()
      .from(tokenHoldings);
    
    let holdingsUpdated = 0;
    let holdingsSkipped = 0;
    
    for (const holding of holdings) {
      const currentSymbol = holding.symbol || '';
      
      // Only update if symbol looks like CA prefix or is empty
      if (currentSymbol && currentSymbol.length > 6) {
        holdingsSkipped++;
        continue;
      }
      
      try {
        console.log(`🔍 Fetching metadata for holding ${holding.mint}...`);
        const metadata = await getTokenMetadataWithFallback(holding.mint);
        
        if (metadata.symbol && metadata.symbol !== currentSymbol) {
          await db.update(tokenHoldings)
            .set({ 
              symbol: metadata.symbol 
            })
            .where(eq(tokenHoldings.id, holding.id));
          
          console.log(`✅ Updated holding ${holding.mint}: ${currentSymbol || 'empty'} → ${metadata.symbol}`);
          holdingsUpdated++;
          
          await new Promise(resolve => setTimeout(resolve, 100));
        } else {
          holdingsSkipped++;
        }
        
      } catch (error: any) {
        console.error(`❌ Failed to update holding ${holding.mint}:`, error.message);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Transactions:`);
    console.log(`  ✅ Updated: ${updated}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);
    console.log(`  ❌ Failed: ${failed}`);
    console.log(`\nToken Holdings:`);
    console.log(`  ✅ Updated: ${holdingsUpdated}`);
    console.log(`  ⏭️  Skipped: ${holdingsSkipped}`);
    console.log('='.repeat(60) + '\n');
    
    console.log('✅ Token symbol fix migration completed!');
    
  } catch (error: any) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration
fixTokenSymbols()
  .then(() => {
    console.log('\n✅ All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
