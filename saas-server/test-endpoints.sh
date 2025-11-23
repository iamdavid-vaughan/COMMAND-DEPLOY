#!/bin/bash
# Quick endpoint testing script

BASE_URL="http://localhost:3000"

echo "🧪 Testing Focal Deploy SaaS Server Endpoints"
echo "=============================================="
echo ""

# Test health endpoint
echo "1. Testing health endpoint..."
curl -s -w "\nStatus: %{http_code}\n" $BASE_URL/api/health
echo ""

# Test pricing endpoint (should be cached)
echo "2. Testing pricing endpoint..."
curl -s -w "\nStatus: %{http_code}\n" $BASE_URL/api/pricing
echo ""

# Test authentication endpoints
echo "3. Testing auth endpoints (should return 400 for missing data)..."
curl -s -X POST -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n" \
  $BASE_URL/api/auth/register
echo ""

echo "4. Testing login endpoint (should return 400 for missing data)..."
curl -s -X POST -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n" \
  $BASE_URL/api/auth/login
echo ""

echo ""
echo "✅ Endpoint tests complete!"
echo "All endpoints should return appropriate responses."
echo "Check the server logs to verify Winston structured logging is working."
