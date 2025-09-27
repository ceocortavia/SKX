# MCP Server Upgrade Guide

Dette dokumentet beskriver hvordan du går fra variant **B – Docs + BRREG public** til den fullverdige MCP-serveren (Docs + BRREG authorised + Fullmakttjeneste).

## 1. Oversikt over variantene

| Variant | Innhold | Typiske env-krav |
| ------- | ------- | ---------------- |
| **B** | Semantisk docs-søk + åpne BRREG endepunkt | `OPENAI_API_KEY`, `OPENAI_EMBED_MODEL`, `UPSTASH_VECTOR_*` (Redis valgfritt) |
| **C** | Alt i B + Maskinporten (autoriserte roller) + Fullmakttjenesten + Redis caching | Alt i B + `UPSTASH_REDIS_*` + `BRREG_MODE=authorised` + `MASKINPORTEN_*` + `FULLMAKT_*` |

## 2. Trinnvis oppgradering

1. **Installer utvidet kodebase**
   - Sjekk ut grenen/PR-en som inneholder full MCP (`server.ts`, `brreg.ts`, `maskinporten.ts`, etc.).
   - Kopier filene til `mcp-server/` og oppdater `package.json` med eventuelle nye avhengigheter (`@modelcontextprotocol/sdk`, `jose`, `@upstash/redis`, `@upstash/vector`).

2. **Oppdater miljøvariabler**
   - Legg til Redis (om du vil cache):
     ```bash
     UPSTASH_REDIS_REST_URL=...
     UPSTASH_REDIS_REST_TOKEN=...
     REDIS_CACHE_TTL=3600
     ```
   - Sett `BRREG_MODE=authorised` og fyll inn alle Maskinporten-feltene:
     ```bash
     MASKINPORTEN_TOKEN_URL=...
     MASKINPORTEN_CLIENT_ID=...
     MASKINPORTEN_SCOPE=enhetsregisteret:read
     MASKINPORTEN_RESOURCE=https://data.brreg.no/enhetsregisteret/autorisert-api
     MASKINPORTEN_ISSUER=...
     MASKINPORTEN_PRIVATE_KEY_BASE64=<base64 PKCS#8>
     ```
   - (Valgfritt) Fullmakttjeneste:
     ```bash
     FULLMAKT_BASE_URL=https://data.brreg.no/fullmakt
     FULLMAKT_TOKEN=...
     ```

3. **Kjør indeksering**
   - Oppdater dokumentasjonskatalogen (`SKX_DOCS_DIR`).
   - Kjør `npm run start:mcp` og `Use tool index_docs_semantic` én gang for å fylle vector store.

4. **Test Maskinporten**
   - I Cursor: `Use tool get_brreg_roles with { "orgnr": "915501680" }`.
   - Bekreft at resultatet ikke lenger er begrenset (roller forsvinner i åpen variant). Feil 401/403? Dobbeltsjekk scope/resource og private key.

5. **Test Fullmakttjenesten (valgfritt)**
   - `Use tool get_signatur_prokura with { "orgnr": "915501680" }`.
   - Skal returnere signatur-/prokura-informasjon. Får du 404? Organisasjonen har kanskje ikke data i Fullmakttjenesten.

## 3. Driftstips

- Sett opp `npm run test:mcp` (node test + ts-node loader) for å verifisere chunking og andre helper-funksjoner.
- Bruk SSM / Secrets Manager for Maskinporten-nøkler, og roter jevnlig.
- Loggfør (eller monitorer) antall kall mot Upstash og BRREG for å unngå rate-limit.

## 4. Next.js API og RLS-kontekst

Backend-rutene som treffer `public.*` tabeller med RLS må alltid sette `request.*`-GUC-ene før de gjør spørringer. Bruk `setRequestContext(client, { orgId, userId, role, status, mfa })` (fra `@/server/request-context`) rett etter at du har slått opp medlemskapet, ellers returnerer Postgres tomt resultat eller kaster «permission denied». Dette gjelder spesielt når du kombinerer `db.tx` og nye tabeller som `person_licenses`, `policy_ack` og `case_*`.

Med disse trinnene er du oppe på full MCP-funksjonalitet (variant C). Dokumentasjonen i `/docs/GETTING_STARTED_MCP.md` dekker daglig bruk, mens denne filen beskriver oppgraderingen.
