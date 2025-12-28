/**
 * Test Business Unit Isolation
 *
 * This script tests if the BU isolation is working by making API calls
 * with different business unit contexts
 */

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

// You'll need to replace this with actual auth token from your browser
// Open DevTools -> Application -> Local Storage -> Look for supabase auth token
const AUTH_TOKEN = 'YOUR_AUTH_TOKEN_HERE';

const businessUnits = {
  main: '00000000-0000-0000-0000-000000000100',
  downtown: '00000000-0000-0000-0000-000000000101',
  uptown: '00000000-0000-0000-0000-000000000102',
  mall: '00000000-0000-0000-0000-000000000103',
};

async function testBUContext(buName, buId) {
  console.log(`\n========================================`);
  console.log(`Testing: ${buName} (${buId})`);
  console.log(`========================================`);

  try {
    // First, set the BU context
    const setContextResponse = await fetch(`${SUPABASE_URL}/functions/v1/set_business_unit_context`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ bu_id: buId }),
    });

    console.log('Set context response:', await setContextResponse.text());

    // Then query customers
    const customersResponse = await fetch(`${SUPABASE_URL}/rest/v1/customers?select=customer_code,customer_name&deleted_at=is.null&order=customer_code`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'apikey': SUPABASE_ANON_KEY,
        'x-business-unit-id': buId,
      },
    });

    const customers = await customersResponse.json();
    console.log(`Found ${customers.length} customers:`);
    customers.forEach(c => console.log(`  - ${c.customer_code}: ${c.customer_name}`));

  } catch (error) {
    console.error('Error:', error.message);
  }
}

async function main() {
  if (AUTH_TOKEN === 'YOUR_AUTH_TOKEN_HERE') {
    console.error('ERROR: Please set your auth token in the script');
    console.error('Get it from browser DevTools -> Application -> Local Storage');
    return;
  }

  for (const [name, id] of Object.entries(businessUnits)) {
    await testBUContext(name, id);
  }
}

main();
