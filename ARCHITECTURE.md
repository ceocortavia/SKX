# ARCHITECTURE.md

## 🚀 Oversikt
Fullstack SaaS-app med **Next.js + Clerk + Neon**, deployet på **Vercel**, og med CI/CD via **GitHub Actions**.  
Fokus: sikkerhet (RLS), MFA, multi-tenancy.

---

## 🖥️ Frontend
- **Framework:** Next.js 15.5 (App Router, TS, Tailwind CSS)
- **UI:** Dashboard, Admin-panel, Org-switcher
- **Auth:** Clerk hooks for session, MFA hints

---

## ⚙️ Backend (API Routes)
- **Runtime:** Node.js (eksplisitt `export const runtime = "nodejs"`)
- **Auth-context:** `getAuthContext(req)`  
  - Dev-bypass via `x-test-clerk-user-id` + `x-test-clerk-email`  
- **Eksempler:**
  - `GET /api/health/rls` → DB + RLS status
  - `GET /api/memberships` → Krever auth
  - `POST /api/org-update` → MFA-guarded

---

## 🗄️ Database
- **Provider:** Neon (serverless PostgreSQL)  
- **Tilkobling:**
  - `DATABASE_URL` → pooled (`-pooler`) for app
  - `DATABASE_URL_UNPOOLED` → unpooled for migrasjoner
- **Kjerne-tabeller:**  
  - `users`  
  - `organizations`  
  - `memberships`  
  - `invitations`  
  - `audit_events` (append-only)  
- **Sikkerhet:**  
  - RLS på alle tabeller  
  - Session-vars: `request.user_id`, `request.org_id`, `request.mfa`  
  - Policies testet via snapshot i CI

---

## 🔑 Autentisering
- **Clerk**  
  - JWT + sessionclaims (`mfa_verified_at`)  
  - MFA kreves på sensitive POSTs  
  - Middleware beskytter alle API-ruter (unntatt health/dev)

---

## ☁️ Hosting & Deploy
- **Vercel**  
  - Deploy fra `main`  
  - Preview-deploy fra PRs  
  - Secrets: `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `DATABASE_URL`, `DATABASE_URL_UNPOOLED`

---

## 🔄 CI/CD
- **GitHub Actions**
  - **RLS Verification:** migrasjoner + snapshot-diff
  - **e2e Tests:** Playwright-smokes for `/dashboard` og `/admin`
- **Snapshot-prosess:**
  ```bash
  # Produser snapshot
  psql "$DATABASE_URL_UNPOOLED" -Atq -f db/tests/198_policy_snapshot.sql > current_policy_snapshot.txt
  # Oppdater baseline
  cp current_policy_snapshot.txt db/tests/policy_snapshot.txt