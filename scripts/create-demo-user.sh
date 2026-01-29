#!/bin/bash

# Create demo user for local development
# Run this script after `supabase db reset`

echo "Creating demo user..."

# Get Supabase credentials
SUPABASE_URL="http://127.0.0.1:54321"
ANON_KEY="sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"

# Create auth user
RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/auth/v1/signup" \
  -H "apikey: ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@pragmatica.com",
    "password": "demo1234",
    "email_confirm": true
  }')

# Extract user ID
USER_ID=$(echo $RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$USER_ID" ]; then
  echo "❌ Failed to create auth user"
  echo "Response: $RESPONSE"
  exit 1
fi

echo "✅ Auth user created with ID: $USER_ID"

# Get access token from response
ACCESS_TOKEN=$(echo $RESPONSE | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

# Insert into users table
USER_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/rest/v1/users" \
  -H "apikey: ${ANON_KEY}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{
    \"id\": \"${USER_ID}\",
    \"company_id\": \"00000000-0000-0000-0000-000000000001\",
    \"username\": \"demo\",
    \"email\": \"demo@pragmatica.com\",
    \"first_name\": \"Demo\",
    \"last_name\": \"User\",
    \"is_active\": true
  }")

echo "✅ User record created in users table"
echo ""
echo "================================================"
echo "Demo user created successfully!"
echo "================================================"
echo "Email: demo@pragmatica.com"
echo "Password: demo1234"
echo "================================================"
