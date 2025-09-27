# Instruks: Flere agenter samtidig

Når flere Codex-/Cursor-agenter jobber parallelt på samme repo, følg disse retningslinjene for å unngå konflikter og «breaking changes».

## 1. Fordel oppgaver tydelig

- **Funksjonelle blokker** – del arbeidet inn i moduler (f.eks. LexNord API, MCP server, admin-UI, docs/tests) og la hver agent ta én blokk.
- **Filbasert** – lag en tabell over hvilke mapper/filer hver agent eier (`app/api/lexnord/**`, `components/org/**`, `docs/**`, `mcp-server/**` osv.).
- Skriv ned oppgavene i `docs/TODO.md` eller et delt issue, med navn på ansvarlig.

## 2. Git-arbeidsflyt

- **Egen gren per agent** – `git checkout -b feature/<agent-navn>-<oppgave>`.
- Etter en endring: `git status` → `git add` → `git commit` → `git push --set-upstream origin feature/...`.
- Synk ofte (`git pull --rebase origin main`), spesielt før commit/push.

## 3. Felles knekkpunkter å passe på

- **Unngå samtidige redigeringer** av samme fil. Trenger to agenter å endre samme fil (f.eks. `app/(protected)/admin/page.tsx`), koordiner rekkefølgen – én tar jobben, den andre rebaser etterpå.
- **Miljøfiler og seeds** – avtal hvem som oppdaterer `sql/seed_*` og `scripts/`; sørg for at migrasjoner nummereres i rekkefølge.
- **Feature flagg** – noter nye flagg/env-vars i `docs/FLAGS.md` eller tilsvarende så alle vet hva som må settes.

## 4. Kommunikasjon

- Del en kort status i en felles kanal (Slack/issue/README) når du tar en oppgave («Tar MCP indexing», «Oppdaterer admin-panelet»).
- Etter ferdig blokk: gi beskjed, push, og be de andre rebase på nytt før de fortsetter.

## 5. Type-check og tester

- Kjør `npm run type-check` lokalt før du sender en PR eller lar andre overta.
- Dersom du endrer e2e-flows eller komponenter, rotér ansvar for Playwright-tester (se `docs/PLAYWRIGHT_TESTS.md`).

## 6. PR- og merge-rutiner

- Lag en PR pr. større modul. Beskriv kort hvilke filer som berøres og hvem som bør reviewe.
- Sjekk at ingen har ubekreftede `git status`-endringer før merge – unngå at to grener slettes mens de fortsatt er i bruk.

Ved å følge denne sjekklisten kan flere agenter jobbe side om side uten at endringer kolliderer.
