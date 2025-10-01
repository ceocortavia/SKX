# QA Bypass

## Env
- ENABLE_QA_BYPASS=1 (skrur på QA-bypass; sett 0 i prod når ferdig)
- TEST_BYPASS_SECRET=<hemmelig> (brukes i header x-test-secret)
- TEST_BYPASS_UPSERT=1 (valgfritt; oppretter QA-bruker automatisk)

## Headers for QA-kall
- x-test-secret: <hemmelig>
- x-test-bypass: 1
- x-test-role: platform-admin (utelat for å teste 403 på platform-API)
- x-test-clerk-user-id: qa_admin
- x-test-clerk-email: qa_admin@test.local
- (valgfritt) x-test-org-id: <org-uuid>

## Rask QA

BASE="https://<prod-domene>"
H1="x-test-secret: <hemmelig>"
H2="x-test-bypass: 1"
H3="x-test-role: platform-admin"
H4="x-test-clerk-user-id: qa_admin"
H5="x-test-clerk-email: qa_admin@test.local"

# Healthz (200)
# curl -i "$BASE/api/healthz"

# Platform-API admin → 200
# curl -i -H "$H1" -H "$H2" -H "$H3" -H "$H4" -H "$H5" "$BASE/api/platform/organizations?tech=react"

# Platform-API uten rolle → 403
# curl -i -H "$H1" -H "$H2" -H "$H4" -H "$H5" "$BASE/api/platform/organizations?tech=react"

# Org-select (via orgnr) → 200 + Set-Cookie
# curl -i -c /tmp/skx.jar -b /tmp/skx.jar \
#   -H "$H1" -H "$H2" -H "$H3" -H "$H4" -H "$H5" \
#   -H 'content-type: application/json' \
#   -d '{"orgnr":"<9-sifret orgnr>"}' \
#   "$BASE/api/org/select"

# Homepage (QA) → 200
# curl -i -c /tmp/skx.jar -b /tmp/skx.jar \
#   -H "$H1" -H "$H2" -H "$H3" -H "$H4" -H "$H5" \
#   -H 'content-type: application/json' \
#   -d '{"url":"https://lexnord.test"}' \
#   "$BASE/api/org/homepage"

## Slå av QA i prod
- Sett ENABLE_QA_BYPASS=0 og/eller roter TEST_BYPASS_SECRET.
- Healthz beholdes public.











