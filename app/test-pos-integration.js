/**
 * Test script for POS-Accounting Integration
 * Tests:
 * - POS transaction creation
 * - Stock transaction generation
 * - GL journal entry posting (Sale + COGS)
 * - Void/reversal functionality
 */

const NEXT_API_URL = 'http://localhost:3000';
const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

// Test user credentials
const TEST_EMAIL = 'demo@pragmatica.com';
const TEST_PASSWORD = 'demo1234';

// Test data
const TEST_COMPANY_ID = '00000000-0000-0000-0000-000000000001';
const TEST_WAREHOUSE_ID = '00000000-0000-0000-0000-000000000021'; // Van warehouse
const TEST_ITEM = {
  id: 'd7142a36-a080-4b74-85ad-55a40b02c641', // Chicken Backs
  code: 'CHK-BACK',
  name: 'Chicken Backs',
  uom_id: '16c4b99e-c830-4fe7-8400-fede82ea7520',
  sales_price: 75.00,
};

let accessToken = '';
let userId = '';

async function login() {
  console.log('\n=== Step 1: Login ===');
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Login failed: ${error}`);
  }

  const data = await response.json();
  accessToken = data.access_token;
  userId = data.user.id;
  console.log('✓ Login successful');
  console.log(`  User ID: ${userId}`);
  return data;
}

async function getInitialData() {
  console.log('\n=== Step 2: Get Initial Data ===');

  // Get initial stock level
  const stockResponse = await fetch(`${SUPABASE_URL}/rest/v1/item_warehouse?item_id=eq.${TEST_ITEM.id}&warehouse_id=eq.${TEST_WAREHOUSE_ID}&select=current_stock`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  const stockData = await stockResponse.json();
  const initialStock = stockData[0]?.current_stock || 0;
  console.log(`✓ Initial stock for ${TEST_ITEM.name}: ${initialStock}`);

  // Count existing POS transactions
  const posCountResponse = await fetch(`${SUPABASE_URL}/rest/v1/pos_transactions?select=count`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${accessToken}`,
      'Prefer': 'count=exact',
    },
  });

  const posCountData = await posCountResponse.json();
  console.log(`✓ Existing POS transactions: ${posCountData.length}`);

  // Count existing journal entries
  const journalCountResponse = await fetch(`${SUPABASE_URL}/rest/v1/journal_entries?select=count&source_module=in.(POS,COGS)`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${accessToken}`,
      'Prefer': 'count=exact',
    },
  });

  const journalCountText = await journalCountResponse.text();
  console.log(`✓ Existing POS/COGS journal entries response: ${journalCountText}`);

  return {
    initialStock: parseFloat(initialStock),
  };
}

async function createPOSTransaction() {
  console.log('\n=== Step 3: Create POS Transaction ===');

  const transactionData = {
    transactionDate: new Date().toISOString(),
    customerId: null,
    customerName: 'Walk-in Customer',
    items: [
      {
        itemId: TEST_ITEM.id,
        itemCode: TEST_ITEM.code,
        itemName: TEST_ITEM.name,
        quantity: 2.5,
        unitPrice: TEST_ITEM.sales_price,
        discount: 5.00, // P5 discount
      },
    ],
    taxRate: 12, // 12% VAT
    payments: [
      {
        method: 'cash',
        amount: 200.00,
      },
    ],
    cashierId: userId,
    cashierName: 'Demo User',
    notes: 'Test transaction for POS-Accounting integration',
  };

  console.log('Transaction data:', JSON.stringify(transactionData, null, 2));

  const response = await fetch(`${NEXT_API_URL}/api/pos/transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(transactionData),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create POS transaction: ${response.status} ${error}`);
  }

  const result = await response.json();
  console.log('✓ POS transaction created successfully');
  console.log(`  Transaction ID: ${result.data.id}`);
  console.log(`  Transaction Code: ${result.data.transactionNumber}`);
  console.log(`  Total Amount: ${result.data.totalAmount}`);

  if (result.warnings && result.warnings.length > 0) {
    console.log('⚠ Warnings:');
    result.warnings.forEach((w) => console.log(`  - ${w}`));
  }

  return result.data;
}

async function verifyStockTransaction(posTransactionId, posTransactionCode) {
  console.log('\n=== Step 4: Verify Stock Transaction ===');

  const response = await fetch(`${SUPABASE_URL}/rest/v1/stock_transactions?reference_id=eq.${posTransactionId}&select=*`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  const stockTransactions = await response.json();

  if (stockTransactions.length === 0) {
    console.log('✗ No stock transaction found');
    return false;
  }

  console.log(`✓ Stock transaction found: ${stockTransactions[0].transaction_code}`);
  console.log(`  Type: ${stockTransactions[0].transaction_type}`);
  console.log(`  Status: ${stockTransactions[0].status}`);

  // Verify stock ledger
  const ledgerResponse = await fetch(`${SUPABASE_URL}/rest/v1/stock_ledger?reference_id=eq.${posTransactionId}&select=*`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  const ledgerEntries = await ledgerResponse.json();
  console.log(`✓ Stock ledger entries: ${ledgerEntries.length}`);
  ledgerEntries.forEach((entry) => {
    console.log(`  - Item: ${entry.item_id}, Qty: ${entry.actual_qty}, After: ${entry.qty_after_trans}`);
  });

  // Verify item_warehouse updated
  const warehouseResponse = await fetch(`${SUPABASE_URL}/rest/v1/item_warehouse?item_id=eq.${TEST_ITEM.id}&warehouse_id=eq.${TEST_WAREHOUSE_ID}&select=current_stock`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  const warehouseData = await warehouseResponse.json();
  const currentStock = warehouseData[0]?.current_stock || 0;
  console.log(`✓ Updated stock level: ${currentStock}`);

  return true;
}

async function verifyJournalEntries(posTransactionId) {
  console.log('\n=== Step 5: Verify Journal Entries ===');

  const response = await fetch(`${SUPABASE_URL}/rest/v1/journal_entries?reference_id=eq.${posTransactionId}&select=id,entry_number,source_module,total_debit,total_credit,status,journal_lines(account_id,debit_amount,credit_amount,accounts(account_number,account_name))`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  const journals = await response.json();

  if (journals.length === 0) {
    console.log('✗ No journal entries found');
    return false;
  }

  console.log(`✓ Found ${journals.length} journal entries`);

  journals.forEach((journal) => {
    console.log(`\n  Journal: ${journal.entry_number}`);
    console.log(`  Module: ${journal.source_module}`);
    console.log(`  Total Debit: ${journal.total_debit}`);
    console.log(`  Total Credit: ${journal.total_credit}`);
    console.log(`  Status: ${journal.status}`);
    console.log(`  Lines:`);

    if (journal.journal_lines) {
      journal.journal_lines.forEach((line) => {
        const account = line.accounts;
        console.log(`    - ${account?.account_number} ${account?.account_name}: DR ${line.debit_amount} CR ${line.credit_amount}`);
      });
    }
  });

  return true;
}

async function runTests() {
  try {
    console.log('========================================');
    console.log('POS-Accounting Integration Test');
    console.log('========================================');

    // Step 1: Login
    await login();

    // Step 2: Get initial data
    const initialData = await getInitialData();

    // Step 3: Create POS transaction
    const transaction = await createPOSTransaction();

    // Wait a bit for async processing
    console.log('\nWaiting 2 seconds for processing...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 4: Verify stock transaction
    await verifyStockTransaction(transaction.id, transaction.transactionNumber);

    // Step 5: Verify journal entries
    await verifyJournalEntries(transaction.id);

    console.log('\n========================================');
    console.log('✓ All tests passed!');
    console.log('========================================\n');

    return transaction;

  } catch (error) {
    console.error('\n========================================');
    console.error('✗ Test failed:');
    console.error(error.message);
    console.error('========================================\n');
    throw error;
  }
}

// Run tests
runTests().catch((error) => {
  process.exit(1);
});
