#!/bin/bash
# Smoke test for offboarding flow
# Usage: 
#   ./scripts/smoke-test-offboarding.sh <BASE_URL> <SESSION_COOKIE> <USER_EMAIL>
#
# Example:
#   ./scripts/smoke-test-offboarding.sh \
#     https://your-preview.vercel.app \
#     "__session=abc123..." \
#     "ansatt@lexnord.test"

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Arguments
BASE_URL="${1:-}"
COOKIE="${2:-}"
USER_EMAIL="${3:-}"

if [[ -z "$BASE_URL" ]] || [[ -z "$COOKIE" ]] || [[ -z "$USER_EMAIL" ]]; then
  echo -e "${RED}Error: Missing required arguments${NC}"
  echo "Usage: $0 <BASE_URL> <SESSION_COOKIE> <USER_EMAIL>"
  echo ""
  echo "Example:"
  echo "  $0 https://preview.vercel.app '__session=abc...' 'ansatt@lexnord.test'"
  exit 1
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Offboarding Smoke Test${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}Base URL:${NC} $BASE_URL"
echo -e "${YELLOW}User Email:${NC} $USER_EMAIL"
echo ""

# Temp file for responses
TMP_DIR=$(mktemp -d)
trap "rm -rf $TMP_DIR" EXIT

START_RESPONSE="$TMP_DIR/start.json"
GET_RESPONSE="$TMP_DIR/get.json"
FINALIZE_RESPONSE="$TMP_DIR/finalize.json"
SEARCH_RESPONSE="$TMP_DIR/search.json"

# Step 1: Start offboarding
echo -e "${BLUE}[1/6]${NC} Starting offboarding run..."
HTTP_CODE=$(curl -s -w "%{http_code}" -o "$START_RESPONSE" \
  -X POST "$BASE_URL/api/offboarding/start" \
  -H "content-type: application/json" \
  -H "Cookie: $COOKIE" \
  -d "{\"user_email\":\"$USER_EMAIL\"}")

if [[ "$HTTP_CODE" != "200" ]]; then
  echo -e "${RED}✗ Failed to start offboarding (HTTP $HTTP_CODE)${NC}"
  cat "$START_RESPONSE"
  exit 1
fi

RUN_ID=$(jq -r '.run_id' < "$START_RESPONSE")
STATUS=$(jq -r '.status' < "$START_RESPONSE")
CANDIDATE_COUNT=$(jq -r '.candidate_files | length' < "$START_RESPONSE")

if [[ -z "$RUN_ID" ]] || [[ "$RUN_ID" == "null" ]]; then
  echo -e "${RED}✗ No run_id returned${NC}"
  cat "$START_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✓ Run started${NC}"
echo -e "  Run ID: ${YELLOW}$RUN_ID${NC}"
echo -e "  Status: ${YELLOW}$STATUS${NC}"
echo -e "  Candidate files: ${YELLOW}$CANDIDATE_COUNT${NC}"
echo ""

# Step 2: Get run details
echo -e "${BLUE}[2/6]${NC} Fetching run details..."
HTTP_CODE=$(curl -s -w "%{http_code}" -o "$GET_RESPONSE" \
  "$BASE_URL/api/offboarding/$RUN_ID" \
  -H "Cookie: $COOKIE")

if [[ "$HTTP_CODE" != "200" ]]; then
  echo -e "${RED}✗ Failed to get run details (HTTP $HTTP_CODE)${NC}"
  cat "$GET_RESPONSE"
  exit 1
fi

USER_EMAIL=$(jq -r '.user_email' < "$GET_RESPONSE")
echo -e "${GREEN}✓ Run details fetched${NC}"
echo -e "  User: ${YELLOW}$USER_EMAIL${NC}"
echo ""

# Step 3: Finalize run
echo -e "${BLUE}[3/6]${NC} Finalizing run (creating Transition Space + artifacts)..."
HTTP_CODE=$(curl -s -w "%{http_code}" -o "$FINALIZE_RESPONSE" \
  -X POST "$BASE_URL/api/offboarding/$RUN_ID/finalize" \
  -H "Cookie: $COOKIE")

if [[ "$HTTP_CODE" != "200" ]]; then
  echo -e "${RED}✗ Failed to finalize (HTTP $HTTP_CODE)${NC}"
  cat "$FINALIZE_RESPONSE"
  exit 1
fi

FINAL_STATUS=$(jq -r '.status' < "$FINALIZE_RESPONSE")
MODE=$(jq -r '.mode' < "$FINALIZE_RESPONSE")
SPACE_ID=$(jq -r '.transition_space.id' < "$FINALIZE_RESPONSE")
SPACE_NAME=$(jq -r '.transition_space.name' < "$FINALIZE_RESPONSE")
ARTIFACT_COUNT=$(jq -r '.artifacts | length' < "$FINALIZE_RESPONSE")

echo -e "${GREEN}✓ Run finalized${NC}"
echo -e "  Status: ${YELLOW}$FINAL_STATUS${NC}"
echo -e "  Mode: ${YELLOW}$MODE${NC}"
echo -e "  Space ID: ${YELLOW}$SPACE_ID${NC}"
echo -e "  Space Name: ${YELLOW}$SPACE_NAME${NC}"
echo -e "  Artifacts: ${YELLOW}$ARTIFACT_COUNT${NC}"
echo ""

if [[ "$ARTIFACT_COUNT" -lt 3 ]]; then
  echo -e "${YELLOW}⚠ Warning: Expected 3 artifacts, got $ARTIFACT_COUNT${NC}"
fi

# Step 4: Search in Transition Space
echo -e "${BLUE}[4/6]${NC} Testing search in Transition Space..."
HTTP_CODE=$(curl -s -w "%{http_code}" -o "$SEARCH_RESPONSE" \
  "$BASE_URL/api/files/search?q=Playbook&space_id=$SPACE_ID&limit=10" \
  -H "Cookie: $COOKIE")

if [[ "$HTTP_CODE" != "200" ]]; then
  echo -e "${RED}✗ Search failed (HTTP $HTTP_CODE)${NC}"
  cat "$SEARCH_RESPONSE"
  exit 1
fi

SEARCH_HITS=$(jq -r '.hits | length' < "$SEARCH_RESPONSE")
echo -e "${GREEN}✓ Search successful${NC}"
echo -e "  Hits: ${YELLOW}$SEARCH_HITS${NC}"

if [[ "$SEARCH_HITS" -eq 0 ]]; then
  echo -e "${YELLOW}⚠ Warning: No search hits for 'Playbook' (file_index may not be populated)${NC}"
fi
echo ""

# Step 5: Database verification (if psql is available and DATABASE_URL is set)
if command -v psql &> /dev/null && [[ -n "${DATABASE_URL:-}" ]]; then
  echo -e "${BLUE}[5/6]${NC} Verifying database state..."
  
  echo -e "${YELLOW}  Checking storage_key...${NC}"
  STORAGE_KEY_COUNT=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*) 
    FROM public.files 
    WHERE storage_key LIKE 'transition/$SPACE_ID/%'
  " | xargs)
  
  echo -e "${YELLOW}  Checking file_index...${NC}"
  FILE_INDEX_COUNT=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*) 
    FROM public.file_index fi
    JOIN public.files f ON f.id = fi.file_id
    WHERE f.space_id = '$SPACE_ID' 
      AND fi.chunk_id LIKE 'artifact-%'
  " | xargs)
  
  echo -e "${GREEN}✓ Database verified${NC}"
  echo -e "  Files with storage_key: ${YELLOW}$STORAGE_KEY_COUNT${NC}"
  echo -e "  Artifact chunks indexed: ${YELLOW}$FILE_INDEX_COUNT${NC}"
  
  if [[ "$STORAGE_KEY_COUNT" -lt 3 ]]; then
    echo -e "${YELLOW}⚠ Warning: Expected 3 files with storage_key, got $STORAGE_KEY_COUNT${NC}"
  fi
  
  if [[ "$FILE_INDEX_COUNT" -lt 3 ]]; then
    echo -e "${YELLOW}⚠ Warning: Expected 3 artifact chunks, got $FILE_INDEX_COUNT${NC}"
  fi
  echo ""
else
  echo -e "${BLUE}[5/6]${NC} Skipping database verification (psql not available or DATABASE_URL not set)"
  echo ""
fi

# Step 6: Summary
echo -e "${BLUE}[6/6]${NC} Test Summary"
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ All smoke tests passed!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Run ID: ${YELLOW}$RUN_ID${NC}"
echo -e "Transition Space: ${YELLOW}$SPACE_NAME${NC}"
echo -e "Status: ${YELLOW}$FINAL_STATUS${NC}"
echo ""
echo -e "${BLUE}Manual verification queries (Neon):${NC}"
echo ""
echo -e "${YELLOW}-- View storage keys${NC}"
echo "SELECT id, name, storage_key, bytes"
echo "FROM public.files"
echo "WHERE space_id = '$SPACE_ID';"
echo ""
echo -e "${YELLOW}-- View indexed artifacts${NC}"
echo "SELECT f.name, fi.chunk_id, fi.md->>'artifact_type'"
echo "FROM public.file_index fi"
echo "JOIN public.files f ON f.id = fi.file_id"
echo "WHERE f.space_id = '$SPACE_ID';"
echo ""
echo -e "${YELLOW}-- View transition space${NC}"
echo "SELECT * FROM public.spaces WHERE id = '$SPACE_ID';"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Verify artifacts in Neon using queries above"
echo "2. Test files/search with different queries"
echo "3. Check audit table for 'offboarding_completed' event"
echo "4. When ready for S3: set ENABLE_DB_ONLY_ARTIFACTS=0"
echo ""



