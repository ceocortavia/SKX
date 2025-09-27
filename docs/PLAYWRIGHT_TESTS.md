# Playwright Test Catalog

Denne oversikten beskriver alle Playwright-testene i `tests/` og hva de verifiserer. Bruk den som referanse når du skal forstå dekningen, skrive nye tester eller kjøre et selektivt sett.

## API-scenarier

| Fil | Hva den tester | Nøkkelpunkter |
| --- | -------------- | ------------- |
| `api.health.spec.ts` | Helserute (`/api/health/rls`) | Verifiserer 200 + `{ status: "healthy" }` med dev-bypass-headere. |
| `api.memberships.spec.ts` | `/api/memberships` (happy path) | Bekrefter at en autentisert bruker får tilbake medlemsliste. |
| `api.orgDomains.spec.ts` | `/api/org-domains` | Sender POST med MFA-bypass og forventer 200/409 (unikhetskollisjon). |
| `api.bulk-role.spec.ts` | `/api/memberships/bulk-role` | Valideringssuite: tomme lister, ugyldig JSON, målrolle, manglende MFA, >100 brukere, ikke-eksisterende medlemmer. |
| `api.platform-admin.spec.ts` | Plattformkonsoll | Full super-admin-flow: stats, org-liste, medlemmer (PATCH/revert), liste/legg til/fjern super-admin. |
| `api.negative.spec.ts` | Beskyttelse uten auth | Sikrer at sensitive endepunkt svarer med redirect/401 når headere mangler (`expectProtected`). |

## Bulk-operasjoner

| Fil | Hva den tester | Nøkkelpunkter |
| --- | -------------- | ------------- |
| `bulk.validation.spec.ts` | `/api/memberships/bulk-approve`, `/bulk-revoke`, `/api/invitations/bulk-revoke` | Alle tre endepunkt får test for: defekt JSON → `invalid_json`, tom liste → `empty_*`, >100 elementer → `too_many_*`. |
| `bulk.happy.spec.ts` | `/api/invitations/bulk-revoke` | Seeder invitasjoner via `/api/test/seed`, kjører bulk-revoke og forventer suksess (inkl. opprydding). |

## Profil og org-velger

| Fil | Hva den tester | Nøkkelpunkter |
| --- | -------------- | ------------- |
| `profile.org-selection.spec.ts` | `/api/org/select` + profile-context | Velger org via orgnr og sjekker at context reflekterer valget. |
| `profile.e2e.org-flow.spec.ts` | E2E flyt for org-håndtering | Velg orgnr → bekreft context → bytt org (hvis finnes) → forlat org (hvis ikke owner). |

## UI-smoke

| Fil | Hva den tester | Nøkkelpunkter |
| --- | -------------- | ------------- |
| `ui.smoke.spec.ts` | Hjem-siden (desktop) | Header synlig, hero-h1 rendres og tjenestekort/accordion ekspanderer. |
| `ui.mobilemenu.spec.ts` | Mobilmeny | Setter viewport til 375px, klikker «Meny» og sjekker at `#mobile-menu` toggles. |

## Test-hjelpere

- `tests/helpers.ts` & `tests/utils.ts` gir funksjoner for POST/JSON, valideringsasserter og `expectProtected`. De brukes på tvers av API-testene for å unngå duplisering.
- `tests/README.md` beskriver miljøoppsett (`TEST_AUTH_BYPASS=1`, `expectProtected`, etc.).

## Kjøre tester

```bash
# Alle e2e-/API-tester
npm run test:e2e

# UI med Playwright UI-runner
npm run test:e2e:ui

# En bestemt fil
npx playwright test tests/api.platform-admin.spec.ts
```

## Tips for nye tester

1. **Bruk helperne** – `postJson`, `expectOk`, `expectInvalidInput`, `expectProtected` osv. gir konsistent asserts.
2. **Skill positive/negative** – legg happy path og auth-negative i separate filer for klarhet (mønsteret er etablert).
3. **Hold seed-data ryddig** – `tests/helpers.ts` har `seedInvitationsAPI` og `cleanup` for midlertidig data.
4. **Kall `no-store` når nødvendig** – f.eks. profile-context i org-flow for å unngå cache.

Dette dokumentet skal følge testmappens utvikling – oppdater tabellene når du legger til nye `.spec.ts`-filer eller endrer dekningen.

