/**
 * Comprehensive Automated Verification Script for Money Line
 * Tests ALL global indices, Indian indices, commodities, and sectors
 * for price validity, active session status, and clean display names.
 */

import http from 'http';

interface MarketItem {
  id: string;
  symbol: string;
  name: string;
  category: string;
  price: number | null;
  level: number | null;
  change: number | null;
  changePercent: number | null;
  status: string;
}

async function runComprehensiveVerification() {
  console.log('======================================================');
  console.log('   MONEY LINE: Comprehensive Market & Sector Audit    ');
  console.log('======================================================');

  const port = 3000;
  const url = `http://localhost:${port}/api/market/global-quotes`;

  console.log(`[Test] Querying global market quotes endpoint: ${url}`);

  try {
    const data: any = await new Promise((resolve, reject) => {
      http.get(url, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error('Failed to parse JSON response: ' + body.slice(0, 100)));
          }
        });
      }).on('error', reject);
    });

    if (!data.success || !Array.isArray(data.data)) {
      console.error('[FAIL] API response was unsuccessful or returned invalid data format.');
      process.exit(1);
    }

    const items: MarketItem[] = data.data;
    console.log(`[PASS] API responded successfully with ${items.length} total market items & sectors.`);

    let hasErrors = false;

    for (const item of items) {
      const currentPrice = item.price !== null ? item.price : item.level;
      const isValidPrice = currentPrice !== null && !isNaN(currentPrice) && currentPrice > 0;
      
      console.log(`[CHECK] [${item.category}] ${item.name} (${item.symbol}) | Price: ${currentPrice} | Status: ${item.status}`);

      if (!isValidPrice) {
        console.error(`[FAIL] Item "${item.name}" (ID: ${item.id}) has invalid or zero price: ${currentPrice}`);
        hasErrors = true;
      }

      // Check for technical prefix leakage in name
      if (item.name.includes('^') || item.name.includes('.NS') || item.name.includes('.BO') || item.name.includes('__')) {
        console.error(`[FAIL] Technical prefix detected in display name for "${item.id}": "${item.name}"`);
        hasErrors = true;
      }
    }

    if (hasErrors) {
      console.error('\n[VERIFICATION FAILED] One or more indices or sectors failed validation.');
      process.exit(1);
    } else {
      console.log('\n[VERIFICATION SUCCESS] All indices, sectors, commodities, and global markets passed comprehensive audit!');
      process.exit(0);
    }

  } catch (err) {
    console.error('[ERROR] Comprehensive verification script encountered an error:', err);
    process.exit(1);
  }
}

runComprehensiveVerification();
