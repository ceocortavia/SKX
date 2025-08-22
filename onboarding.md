# Onboarding – SKX (Clerk + RLS + CI)

Denne guiden tar deg fra 0 → grønn CI på under 10 minutter.

## 1) Forutsetninger
- Node 20/22 og npm
- psql-klient (psql --version)
- Tilgang til Neon (Postgres) og Clerk

## 2) Lokalt oppsett
1. Installer deps:
   - npm ci
2. Miljøvariabler (opprett .env.local):
   - DATABASE_URL = Neon POOLED-URL (runtime)
   - DATABASE_URL_UNPOOLED = Neon UNPOOLED-URL (migrasjoner, sslmode=require)
   - Clerk publishable key om du kjører appen med ekte auth
3. Kjør migrasjoner og verifikasjon:
   - make migrate
   - make verify (kjører db/tests/199_final_verification.sql – må være grønn)
4. Start app (dev):
   - npm run dev

## 3) RLS-arkitektur i korte trekk
- GUC-er (settes server-side pr request i transaksjon via withGUC):
  - request.user_id, request.clerk_user_id, request.clerk_user_email
  - request.org_id, request.org_role, request.org_status
  - request.mfa ('on'|'off')
- App bruker Postgres pg-pool; all autorisasjon håndheves i DB via RLS.
- Org-kontekst: x-org-id header → cookie → (dev) query, verifiseres mot memberships før GUC settes.
- MFA: assertMFA() sjekker nylig verifisert faktor (i CI/dev kan bypass aktiveres).

## 4) CI / Pipeline (må bestå før merge)
- Workflow: .github/workflows/rls-verify.yml
  1) Migrasjoner (idempotent) mot DATABASE_URL_UNPOOLED
  2) db/tests/199_final_verification.sql (full RLS-matrise) + artifacts (rls_199.log)
  3) Policy-snapshot diff (hindrer utilsiktede policyendringer)
  4) E2E smoke (Playwright) med TEST_AUTH_BYPASS=1
- Secrets som må settes i repoet:
  - DATABASE_URL_UNPOOLED (Neon UNPOOLED, sslmode=require)
  - DATABASE_URL (Neon POOLED)
  - (Valgfritt) ORG_ID, PENDING_USER_ID for deterministiske e2e-caser

## 5) Health / observability
- GET /api/_health/rls returnerer aktivt policy-sett og anonym RLS-sanity
  - Forventer 0 rader for users og organizations under app_client uten GUC
- Playwright-smoke inkluderer test for denne ruta

## 6) Sikker endringsflyt
- CODEOWNERS (bytt til faktiske eiere/teams): .github/CODEOWNERS
- Beskytt main og krev status checks:
  - RLS Verification (inkl. policy snapshot)
  - e2e (Playwright)
- PR-mal guider på at 199 må være grønn og at policy-snapshot må oppdateres ved bevisste endringer

## 7) Vanlige kommandoer
- Migrasjoner: make migrate
- RLS-verifisering: make verify
- Dev-server (med test-bypass aktivert i Playwright via webServer): npm run dev
- E2E lokalt: npm run test:e2e

## 8) Videre arbeid (kort release-plan)
- Onboarding/Provisioning: auto-opprett public/users ved første innlogging; lagre aktiv org i UI
- Admin-UI: invitations, approve, domener (bruker eksisterende API)
- BRREG-modul: klient + caching-tabell; RLS låser allerede felt
- MFA-UX: poler assertMFA-signalet (f.eks. «MFA innen 10 min»)
- Robust logging: marker «policy-deny» i serverlogger for sporing

Har du problemer? Start med db/tests/199_final_verification.sql – den skal være grønn i alle miljøer før appen forventes å virke.
