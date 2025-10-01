#!/bin/bash
set -euo pipefail

# Offboarding verification script
# Usage: ./scripts/verify-offboarding.sh <preview-url> <cookie>

BASE="${1:-}"
COOKIE="${2:-}"

if [[ -z "$BASE" || -z "$COOKIE" ]]; then
  echo "Usage: $0 <preview-url> <cookie>"
  echo "Example: $0 https://skx-abc123.vercel.app 'session=abc123; auth=def456'"
  exit 1
fi

echo "🔍 Verifying offboarding API at $BASE"

# Test 1: Start offboarding
echo "📝 Starting offboarding..."
START_RESPONSE=$(curl -sS -X POST "$BASE/api/offboarding/start" \
  -H "content-type: application/json" \
  -H "Cookie: $COOKIE" \
  -d '{"user_id":"cd144e25-4d4e-4799-8895-35a1fad7f163"}')

echo "Start response: $START_RESPONSE"

RUN_ID=$(echo "$START_RESPONSE" | jq -r '.run_id // empty')
if [[ -z "$RUN_ID" || "$RUN_ID" == "null" ]]; then
  echo "❌ Failed to get run_id from start response"
  exit 1
fi

echo "✅ Offboarding started with run_id: $RUN_ID"

# Test 2: Get run status
echo "📊 Getting run status..."
GET_RESPONSE=$(curl -sS "$BASE/api/offboarding/$RUN_ID" -H "Cookie: $COOKIE")
echo "Get response: $GET_RESPONSE"

STATUS=$(echo "$GET_RESPONSE" | jq -r '.status // empty')
if [[ "$STATUS" != "processing" ]]; then
  echo "❌ Expected status 'processing', got '$STATUS'"
  exit 1
fi

echo "✅ Run status is correct: $STATUS"

# Test 3: Finalize run
echo "🏁 Finalizing run..."
FINALIZE_RESPONSE=$(curl -sS -X POST "$BASE/api/offboarding/$RUN_ID/finalize" -H "Cookie: $COOKIE")
echo "Finalize response: $FINALIZE_RESPONSE"

FINAL_STATUS=$(echo "$FINALIZE_RESPONSE" | jq -r '.status // empty')
if [[ "$FINAL_STATUS" != "completed" ]]; then
  echo "❌ Expected final status 'completed', got '$FINAL_STATUS'"
  exit 1
fi

ARTIFACTS_COUNT=$(echo "$FINALIZE_RESPONSE" | jq -r '.artifacts | length // 0')
if [[ "$ARTIFACTS_COUNT" -lt 3 ]]; then
  echo "❌ Expected at least 3 artifacts, got $ARTIFACTS_COUNT"
  exit 1
fi

echo "✅ Run finalized successfully with $ARTIFACTS_COUNT artifacts"

# Test 4: Verify UI is accessible
echo "🖥️  Testing UI accessibility..."
UI_RESPONSE=$(curl -sS "$BASE/admin/offboarding" -H "Cookie: $COOKIE")
if echo "$UI_RESPONSE" | grep -q "404\|Not Found"; then
  echo "❌ UI returned 404 - check NEXT_PUBLIC_OFFBOARDING_ENABLED=1"
  exit 1
fi

echo "✅ UI is accessible"

echo ""
echo "🎉 All offboarding tests passed!"
echo "   Run ID: $RUN_ID"
echo "   Status: $FINAL_STATUS"
echo "   Artifacts: $ARTIFACTS_COUNT"
echo ""
echo "Next steps:"
echo "1. Open $BASE/admin/offboarding in browser"
echo "2. Verify the run appears in the list"
echo "3. Check that Transition Space was created"
echo "4. Verify artifacts have correct labels"








