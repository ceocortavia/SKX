# SKX

RLS satt opp med Clerk + Supabase/Neon og verifisert via `db/tests/199_final_verification.sql`.

Lokalt:

- Migrasjoner:
  make migrate
- Verifisering:
  make verify

## CI / Pipeline

- **RLS Verification** (must-pass)
  - Kjører alle migrasjoner (idempotent)
  - Kjører `db/tests/199_final_verification.sql` (GUC-basert, én sesjon)
  - Sammenligner policy-snapshot (`db/tests/policy_snapshot.txt`)
  - Laster opp `rls_199.log` som artifact

- **E2E smoke (Playwright)**
  - Starter Next-app med `TEST_AUTH_BYPASS=1` (kun i CI/dev)
  - Kjører lette API-tester: `/api/profile`, `/api/org-domains`, `/api/memberships/approve`
  - Verifiserer at request → GUC → RLS fungerer i praksis uten å drasse inn ekte JWT i CI

### Secrets (GitHub Actions)

- `DATABASE_URL_UNPOOLED` (Neon UNPOOLED, `sslmode=require`) – brukes til migrasjoner og 199
- `DATABASE_URL` (Neon POOLED) – brukes av E2E (runtime)
- (Valgfritt) `ORG_ID`, `PENDING_USER_ID` – for deterministiske 200-caser i enkelte E2E

### Branch protection (anbefalt)

- Protect `main`
- Require status checks to pass → velg: `RLS Verification` og `e2e`
- Require PR review(s)
- (Valgfritt) `CODEOWNERS` for `db/**`, `db/tests/**`, `app/api/**`
