# SKX

RLS satt opp med Clerk + Supabase/Neon og verifisert via `db/tests/199_final_verification.sql`.

<<<<<<< HEAD
Lokalt:

## Oppsett

1. **Kopier miljøvariabler:**
   ```bash
   cp .env.example .env.local
   ```

2. **Oppdater `.env.local` med dine faktiske verdier:**
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - fra Clerk Dashboard
   - `CLERK_SECRET_KEY` - fra Clerk Dashboard  
   - `DATABASE_URL` - Neon pooled URL (må inneholde `-pooler` og `?sslmode=require`)
   - `DATABASE_URL_UNPOOLED` - Neon unpooled URL

3. **Installer avhengigheter:**
   ```bash
   npm install
   npx playwright install
   ```

## Kommandoer

- Migrasjoner:
  make migrate
- Verifisering:
  make verify
- E2E tester:
  npm run test:e2e

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
=======
## 🚀 Lokalt utvikling

- **Migrasjoner:**
  ```bash
  make migrate
  ```
- **Verifisering:**
  ```bash
  make verify
  ```

## 🔧 CI/CD Pipeline

- **GitHub Actions workflow** `RLS Verification` kjører migrasjoner, 199-testen og policy-snapshot diff.

## 📋 Merge & Deploy Guide

### 🎯 Forutsetninger

- ✅ RLS Verification workflow går grønt
- ✅ Alle PRs er reviewed og approved
- ✅ Vercel project er konfigurert med riktige secrets

### 🔄 Merge-rekkefølge (viktig!)

**1. ci/rls-verification → main**
- Skip CI-feil hvis nødvendig (workflow er allerede verifisert)
- Dette sikrer at RLS-policies er på plass

**2. feat/app-rls-guc → main**
- App-laget med RLS GUC-konfigurasjon
- Krever RLS Verification check

**3. feat/ui-skeleton → main**
- UI-komponenter og frontend-logikk
- Krever RLS Verification check

### 🔐 Vercel Secrets Setup

**Påkrevde secrets:**
```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...  # Uten % på slutten
DATABASE_URL=postgresql://...@ep-...eu-central-1.aws.neon.tech/neondb?sslmode=require
DATABASE_URL_UNPOOLED=postgresql://...@ep-...eu-central-1.aws.neon.tech/neondb?sslmode=require
```

**Viktig:** `DATABASE_URL` skal ha `-pooler`, `DATABASE_URL_UNPOOLED` skal IKKE ha det.

### 🚀 Production Deploy

1. **Trigger deploy** i Vercel Dashboard
2. **Sjekk build logs** for eventuelle feil
3. **Verifiser at alle secrets er tilgjengelige**

### 🧪 Smoke Testing

**Test disse endepunktene etter deploy:**

```bash
# 1. Helse-sjekk (skal returnere 200)
curl -sS -i https://<ditt-domene>/api/health/rls

# 2. Uten autentisering (skal returnere 401)
curl -sS -i https://<ditt-domene>/api/memberships

# 3. Med autentisering (skal returnere 200)
curl -sS -i -H "Authorization: Bearer <token>" \
  https://<ditt-domene>/api/profile?orgId=<org-id>
```

**Forventede svar:**
- `/api/health/rls`: `200 OK` med JSON response
- `/api/memberships`: `401 Unauthorized`
- `/api/profile`: `200 OK` med brukerdata (etter login)

### 🛡️ Branch Protection

**Etter første merge, aktiver branch protection:**

1. **Settings → Branches → Add rule for main**
2. **Require status checks to pass:**
   - ✅ RLS Verification
   - ✅ e2e (hvis tilgjengelig)
3. **Require review from Code Owners** (valgfritt)

### 🚨 Troubleshooting

**Vanlige problemer og løsninger:**

#### CI feiler på RLS Verification
```bash
# 1. Sjekk at DATABASE_URL_UNPOOLED er satt i GitHub Environment "neon"
# 2. Kjør lokalt: make verify
# 3. Sjekk at policy_snapshot.txt er oppdatert
```

#### Vercel deploy feiler
```bash
# 1. Verifiser at alle secrets er satt
# 2. Sjekk build logs for miljøvariabel-feil
# 3. Test lokalt med .env.local
```

#### API returnerer 500
```bash
# 1. Sjekk Vercel function logs
# 2. Verifiser at DATABASE_URL fungerer
# 3. Test lokalt med make verify
```

### 👥 Team Roller

**Utvikler:**
- ✅ Merge PRs i riktig rekkefølge
- ✅ Trigger Vercel deploy
- ✅ Smoke-test endepunkter

**DevOps/Lead:**
- ✅ Konfigurere Vercel secrets
- ✅ Sette opp branch protection
- ✅ Overvåke CI/CD pipeline

**QA:**
- ✅ Teste endepunkter etter deploy
- ✅ Verifisere RLS-funksjonalitet
- ✅ Rapportere eventuelle feil

### 📚 Nyttige kommandoer

```bash
# Oppdater policy snapshot
psql "$DATABASE_URL_UNPOOLED" -Atq -f db/tests/198_policy_snapshot.sql > current_policy_snapshot.txt
cp current_policy_snapshot.txt db/tests/policy_snapshot.txt

# Test lokalt
make migrate && make verify

# Sjekk CI-status
gh pr checks  # Krever GitHub CLI
```

---

**💡 Tips:** Hold denne guiden oppdatert når prosessen endres!
>>>>>>> origin/main
