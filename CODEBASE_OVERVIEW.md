# SKX Codebase Overview

## TL;DR
- **Mission:** Secure Knowledge Exchange platform focused on multi-tenant RLS and MFA-first workflows.
- **Stack:** Next.js 15 App Router (TypeScript, Tailwind), Clerk auth, Neon PostgreSQL, Playwright e2e tests.
- **Key Ideas:** RLS-enforced APIs powered by `withGUC`, feature-flagged admin tooling, platform-level admins, automated org enrichment, and CI-ready seeding/testing utilities.

## Application Architecture
- **Next.js App Router:** All pages and API routes live under `app/`, split into marketing, auth, and protected segments.
- **Providers & Layout:** `app/layout.tsx` pulls in global CSS and wraps everything with `ClerkProvider` from `app/providers.tsx`, so every route inherits auth context and marketing chrome.
- **Feature Flags:** Runtime behaviour toggled through env vars (e.g. `NEXT_PUBLIC_EXPORTS_ENABLED`, `ENABLE_TECH_STACK`, `ADMIN_BULK_ROLE_ENABLED`).

## Authentication & Authorization
- **Clerk Integration:** Middleware (`middleware.ts`) gates all non-public routes, redirecting unauthenticated users to Clerk.
- **Test Bypass:** Controlled by `TEST_AUTH_BYPASS` in non-production and `TEST_SEED_SECRET` for secured automation flows.
- **Auth Context Helper:** `lib/auth-context.ts` centralises Clerk lookups, MFA awareness, and the bypass logic, returning a consistent `AuthContext` for APIs.

## Data Access & RLS Strategy
- **Database:** Neon/PostgreSQL with migrations in `db/migrations/`; tables defined in `010_base_schema.sql` and subsequent migrations add policies (`130_memberships_policies.sql`, etc.).
- **withGUC Helper:** `lib/withGUC.ts` runs queries in a transaction where `request.*` GUCs get set via `set_config(..., true)`, ensuring RLS policies evaluate with the correct user/org context.
- **Org Context:** `lib/org-context.ts` resolves the active organization from headers or primary membership and is reused across API handlers.
- **Platform Admins:** `db/migrations/220_platform_admins.sql` introduces `platform_admins` and `221_platform_admin_policies.sql` extends RLS to respect `request.platform_role`.

## API Surface
- **Location:** API routes under `app/api/**` handle memberships, org selection, analytics, invitations, exports, enrichment tasks, and test utilities.
- **Pattern:** Each handler loads the auth context, resolves the org, sets GUCs, and queries through the shared `pg` pool (`lib/db.ts`).
- **Highlights:**
  - `app/api/org/select/route.ts`: ensures the user record exists, persists org choice, seeds a pending membership, and triggers enrichment.
  - `app/api/profile/context/route.ts`: returns current org + permissions, falling back to an `orgId` cookie when needed.
  - `app/api/export/pdf/route.ts`: feature-flagged PDF export backed by Puppeteer with in-memory rate limiting.
  - `app/api/tasks/enrich/route.ts`: cron-compatible endpoint that batches organizations for enrichment.
  - `app/api/platform/*`: platform admin surface for listing organizations and updating memberships with global RLS bypass.

## Frontend Composition
- **Marketing Pages:** `app/page.tsx` pulls hero/about/services/contact sections from `lib/src_full/components/sections/*` using the `@srcfull/*` alias.
- **Protected Shell:** `app/(protected)/layout.tsx` renders `components/admin/AppShell` providing sidebar/topbar chrome for dashboard/admin/profile routes, including the new `/admin/platform` super-admin view.
- **Admin UI:** Components in `components/admin/` use SWR + JSON fetchers for live analytics, membership management, and export actions.
- **Profile Flow:** `components/profile/ProfileClient.tsx` consumes `/api/profile/context`, offers org search via `/api/brreg`, and posts selections to `/api/org/select`.

## Background Jobs & Integrations
- **Organization Enrichment:**
  - `lib/enrich.ts` hydrates core org fields from Brønnøysund (mockable via env).
  - `lib/enrichmentService.ts` augments with accounting, job ads, public contracts, and optional tech stack discovery (`lib/techStackService.ts`).
  - Triggered synchronously on org selection and asynchronously via the enrich task or UI button (`components/ui/EnrichNowButton.tsx`).
- **Model Context Provider:** `mcp-server/` hosts an Express placeholder that reacts to GitHub webhooks and inventories the repo (future automation hook).

## Testing & QA
- **End-to-End:** Playwright specs in `tests/` cover positive/negative API paths, bulk operations, org selection, and UI smoke tests.
- **Platform Admin Tests:** `tests/api.platform-admin.spec.ts` validates global admin capabilities (listing orgs, editing memberships).
- **Helpers:** `tests/helpers.ts` centralises headers, seeding helpers, and expectation utilities for consistent assertions.
- **Seeding:** `app/api/test/seed/route.ts` creates invitations for test runs (dev-only, guarded by `TEST_SEED_SECRET`).
- **Policy Snapshots:** SQL snapshots under `db/tests/` verify RLS policy drift as part of CI.

## Local Development & Tooling
- **Scripts:** See `package.json` for `dev`, `build`, `test:e2e`, `db:seed`, and `start:mcp` commands.
- **Environment:** Base env vars documented in `README.md`; clone `.env.example` to `.env.local` and supply Neon/Clerk credentials.
- **Database:** `npm run db:seed` seeds minimal data via `db/tests/local_seed_min.sql` using `DATABASE_URL_UNPOOLED`.
- **Testing:** `npm run test:e2e` executes the Playwright suite (UI mode available via `test:e2e:ui`).

## Repository Guide
```
app/                 # Next.js app router (marketing, auth, protected pages, APIs)
components/          # Shared UI for admin, profile, marketing
lib/                 # Data access, services, helpers, feature modules, src_full library
mcp-server/          # Express webhook server placeholder
db/                  # SQL migrations, policies, RLS snapshots, seed scripts
docs/                # Additional product/design documentation
tests/               # Playwright test suite + helpers
```

## Key References
- `README.md` – Quick start, architecture, security model, testing strategy.
- `ARCHITECTURE.md` – Deeper explanation of auth flow, org selection, hosting topology.
- `Release Note – Bulk-endepunkter & Testdekning.md` – Context on bulk admin operations and their test coverage.
- Tailwind/Tokens – `styles/`, `app/globals.css`, `tailwind.config.js`, `postcss.config.js`.

## Suggested Next Steps
1. Run `npm run db:seed` with valid env vars to populate baseline data.
2. Execute `npm run test:e2e` to validate RLS-protected endpoints before making backend changes.
