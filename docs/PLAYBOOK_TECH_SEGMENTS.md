# Tech Stack Playbook (Admin, API, Copilot)

Denne siden samler konkrete «copy/paste»-oppskrifter for å bruke teknologistakken vi nå eksponerer i admin og API. Den er trygg å dele internt (ingen hemmeligheter) og følger det som ligger bak `/api/platform/organizations` og øvrige MCP-verktøy.

## 1. Admin-panelet (ingen kode)
- **Shopify-segment**: Skriv `shopify` i teknologi-filteret → klikk *Filtrer* → *Eksporter CSV*. Klar til kampanje.
- **React + Next.js**: Skriv `react,next.js` (komma = OR) → filtrer → bruk CSV for outreach.
- **Migreringskandidater**: Kjør først bulk-enrich («Oppdater alt») i org-visningen. Filtrer deretter på `wordpress` for å finne potensielle migreringer.

## 2. API-kall (curl)
```bash
# JSON med React ELLER Shopify
curl "/api/platform/organizations?tech=react,shopify" | jq

# CSV for deling
curl -L "/api/platform/organizations?tech=react,shopify&csv=1" -o orgs_react_shopify.csv
```

## 3. Klientkode (Next.js/Fetch)
```ts
const params = new URLSearchParams({ tech: "react,shopify" });
const res = await fetch(`/api/platform/organizations?${params}`, { cache: "no-store" });
if (!res.ok) throw new Error(await res.text());
const { organizations } = await res.json();
// organizations[i].tech_stack → [{ name, slug, version, categories[] }]
```

## 4. SQL-snutter (analyse / rapport)
```sql
-- Antall org'er med React ELLER Shopify
SELECT COUNT(*)
FROM organizations o
WHERE EXISTS (
  SELECT 1
  FROM jsonb_array_elements(o.tech_stack) t
  WHERE LOWER(t->>'slug') IN ('react','shopify')
);

-- Topp 10 teknologier (navn) i porteføljen
SELECT LOWER(t->>'name') AS tech, COUNT(*)
FROM organizations o, jsonb_array_elements(o.tech_stack) t
GROUP BY 1
ORDER BY 2 DESC
LIMIT 10;

-- Org'er uten tech_stack (kandidat for enrich)
SELECT id, name, homepage_domain
FROM organizations
WHERE homepage_domain IS NOT NULL
  AND (tech_stack IS NULL OR jsonb_array_length(tech_stack) = 0)
ORDER BY updated_at NULLS FIRST
LIMIT 100;
```

## 5. Copilot-prompter
- **Shopify-produktpitch**: «Skriv en kort invitasjon (60–90 ord) til en organisasjon som bruker Shopify og Klarna. Uthev hvordan Skilllexia sparer tid for e-handelsteam (onboarding + opplæring), og foreslå en 20-min demo. Tone: vennlig, kompetent.»
- **WordPress-migrering**: «Generer en e-postmal til org'er med WordPress og (antyd) utdaterte plugins. Foreslå 3 konkrete gevinster ved å standardisere læringsinnhold for redaktører.»
- **React/Next.js dev-fokus**: «Lag en handout-tekst for teknisk lead i org'er med React/Next.js: hvordan Skilllexia integreres i dev-stacken og QA-rutiner på under 30 min.»

## 6. CSV → kampanje-flyt
1. Eksporter: `/api/platform/organizations?tech=react,shopify&csv=1`.
2. Åpne i Sheets; filtrer på `tech_names` som inneholder "React".
3. Slå sammen med BRREG-data (orgnavn) via VLOOKUP for brevhodet.
4. Importer listen i valgfritt kampanjeverktøy og bruk copilot-malene.

## 7. Automatisering (idé)
- Cron hver 14. dag:
  - `POST /api/org/techstack/enrich-all` for å oppdatere (owner-guarded).
  - Deretter Slack: «+37 oppdatert, 5 feilet (timeout)» basert på response.

## 8. Rask QA (Playwright)
```ts
import { test, expect } from "@playwright/test";

test("platform orgs – tech filter", async ({ page }) => {
  await page.goto("/admin/platform/organizations");
  await page.getByLabel("Teknologi(er)").fill("react,shopify");
  await page.getByRole("button", { name: "Filtrer" }).click();
  await expect(page.getByText("React").first()).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Eksporter CSV" }).click(),
  ]);
  expect((await download.suggestedFilename()) || "").toContain(".csv");
});
```

## 9. Brukerhistorier
- **Salg**: «Som KAM vil jeg hente org'er med Shopify for å prioritere e-handelspitchen vår.»
- **CS**: «Som CSM vil jeg finne WordPress-org'er og sende tips om editor-kurs.»
- **Produkt**: «Som PM vil jeg se topp 10 teknologier for å prioritere integrasjoner.»

## 10. Videre utvikling
- API støtter i dag OR-logikk (kommaseparert). Om vi ønsker strict AND-logikk kan vi legge til `mode=and` eller tolke semikolon som AND. Meld fra om behov.
