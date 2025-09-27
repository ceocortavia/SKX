# PRD – LexNord MVP

## 1. Målbilde
- **LexNord Advokat AS** skal få et første MVP i plattformen med sakshåndtering (tildeling, attestasjon, klarstatus) og OCG-registrering.
- To admin-brukere, to advokater og én fagassistent skal kunne logge inn og utføre sine oppgaver.

## 2. Scope
- Sak: `cases` med statusflyt `pending_assignment → awaiting_ocg → awaiting_lockdown → ready`.
- Oppgaver: Tildele sak til advokat, registrere OCG (oppsett og compliance guard), sette infosperre, attestasjon.
- Feature-flagg: `lexnord.mission_control` (admin-panel), `lexnord.ocg_required` (sperre før klar status).

## 3. Brukerhistorier

| ID | Rolle | Historie | Akseptkriterier |
|----|-------|----------|-----------------|
| US-LEX-1 | Admin | Tildele sak til advokat | *Gitt* pending sak / *Når* admin velger advokat / *Da* status → `awaiting_ocg` og ansvarlig advokat settes. |
| US-LEX-2 | Advokat | Registrere OCG | *Gitt* sak `awaiting_ocg` / *Når* advokat sender OCG JSON / *Da* oppdateres metadata, status → `awaiting_lockdown`. |
| US-LEX-3 | Advokat | Informasjonssperre | *Gitt* `awaiting_lockdown` / *Når* advokat aktiverer sperre / *Da* status → `ready` og logg føres. |
| US-LEX-4 | Assistent | Se todo-liste | Finner sak i `awaiting_ocg`/`awaiting_lockdown`, kan trigge varsling, men har ikke lov til finale attest. |

## 4. Datastruktur

| Tabell | Felter |
|--------|--------|
| `cases` | `id uuid`, `organization_id uuid`, `title`, `client_name`, `status`, `assigned_user_id`, `metadata jsonb`, `created_at`, `updated_at` |
| `case_audit` | `id uuid`, `case_id`, `action`, `actor_user_id`, `notes jsonb`, `created_at` |

`metadata` for sak kan inneholde `{"ocg": {...}, "lockdown": {"applied_at": ts}}`.

## 5. API-skisser

| Endpoint | Method | Body | Result |
|----------|--------|------|--------|
| `/api/lexnord/cases` | GET | `status?=` | Liste over saker med filter. |
| `/api/lexnord/cases/assign` | POST | `{ caseId, assigneeUserId }` | Oppdaterer `assigned_user_id`, status → `awaiting_ocg`. |
| `/api/lexnord/cases/ocg` | POST | `{ caseId, ocgData }` | Lagrer OCG JSON, status → `awaiting_lockdown`. |
| `/api/lexnord/cases/lockdown` | POST | `{ caseId, confirmedBy }` | Setter `metadata.lockdown`, status → `ready`. |

Alle endepunkt krever LexNord-org (via `x-org-id`) og roller: admin for `assign`, advokat for `ocg/lockdown`.

## 6. UX-panels
- **Admin (Mission Control)**: liste med pending saker → dropdown for advokat → knapp «Tildele».
- **Advokat-dashboard**: to lister (OCG-ventende, Lockdown-ventende) med knapper for å sende OCG-data (JSON editor) og toggles for sperre.
- **Assistent**: read-only liste + «Varsle admin» knapp.

## 7. Feature Flags
- `lexnord.mission_control`: toggler admin-panelet i UI.
- `lexnord.ocg_required`: guard i backend som nekter `lockdown` uten OCG-data.
- `NEXT_PUBLIC_LEXNORD_PANEL=1`: gjør Lenord-siden (`/lexnord`) synlig i sidemenyen.

## 8. Seed/Hendelser
- `sql/seed_lexnord.sql` oppretter:
  * Org `LexNord Advokat AS` `orgnr=920123456`
  * Brukere: `admin1`, `admin2`, `advokat1`, `advokat2`, `assistent`
  * Sak: `Acme v. Beta (LexNord seed)` → status `pending_assignment`

## 9. QA-oppskrift
1. Kjør seed i Neon/psql.
2. Logg inn som `admin1@lexnord.test` → `/admin/lexnord` → tildel «Acme v. Beta» til `advokat1@lexnord.test`.
3. Logg inn som advokaten → lever OCG-data (fiktiv JSON) → status `awaiting_lockdown`.
4. Sett infosperre → status `ready`; verifiser audit-logg oppføring.

## 10. Risiko & videre
- OCG-/lockdown-data lagres som JSON; vurder strengere skjema senere.
- Ingen automatisk varsling (Slack/e-post); kan legges på i v2.
- Sørg for RBAC-policy i database (rollen til advokater må være `member` med ekstra flagg/metadata).
