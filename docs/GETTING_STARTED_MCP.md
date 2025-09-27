# Getting Started with the SKX MCP Server

This guide mirrors the "Hvordan bruke MCP i Cursor" canvas note, but lives in the repo so the instructions travel with the codebase.

## 1. Prerequisites

Set (at minimum) the following environment variables before starting the server:

```bash
SKX_DOCS_DIR=./docs
OPENAI_API_KEY=sk-...
OPENAI_EMBED_MODEL=text-embedding-3-small
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
UPSTASH_VECTOR_REST_URL=...
UPSTASH_VECTOR_REST_TOKEN=...
VEC_INDEX_NAME=skilllexia-docs
```

Optional for Maskinporten/authorised BRREG roles:

```bash
BRREG_MODE=authorised
MASKINPORTEN_TOKEN_URL=https://maskinporten.no/token
MASKINPORTEN_CLIENT_ID=...
MASKINPORTEN_SCOPE=enhetsregisteret:read
MASKINPORTEN_RESOURCE=https://data.brreg.no/enhetsregisteret/autorisert-api
MASKINPORTEN_ISSUER=...
MASKINPORTEN_PRIVATE_KEY_BASE64=<base64 PKCS#8>
```

Optional for Fullmakttjenesten:

```bash
FULLMAKT_BASE_URL=https://data.brreg.no/fullmakt
FULLMAKT_TOKEN=...
```

## 2. Starting the server

```bash
npm run start:mcp
```

The server speaks Model Context Protocol over stdio. Keep this process running while Cursor uses the tools.

## 3. Linking Cursor (quick recipe)

1. In Cursor → **Settings → MCP → Add Server (Command)**
2. Command: `npm run start:mcp`
3. Save, then test using the prompt snippets below.

### Daily prompt snippets

```
Use tool index_docs_semantic
Use tool search_docs_semantic with { "query": "BRREG roller diff" }
Use tool get_brreg with { "orgnr": "915501680", "includeSubunits": true }
Use tool get_brreg_roles with { "orgnr": "915501680" }
Use tool get_signatur_prokura with { "orgnr": "915501680" }
```

## 4. Tool overview

| Tool | Hva den gjør |
| ---- | ------------ |
| `index_docs_semantic` | Leser `SKX_DOCS_DIR`, lager OpenAI-embeddings og upserter til Upstash Vector. Kjør første gang og ved dokumentoppdatering. |
| `search_docs_semantic` | Semantisk søk i indekset (default topK=5). |
| `get_brreg` | Henter hovedenhet og (valgfritt) underenheter fra BRREG. Krever Redis-cache for optimal ytelse. |
| `get_brreg_roles` | Henter styre-/rolledata. Bytter automatisk til autorisert endpoint når `BRREG_MODE=authorised`. |
| `get_signatur_prokura` | Slår opp signatur/prokura via Fullmakttjenesten når `FULLMAKT_*` er satt. |

## 5. Troubleshooting

- **Maskinporten 400/401** – dobbeltsjekk at alle `MASKINPORTEN_*` variabler er satt (inkl. `resource`) og at private key er PKCS#8 base64.
- **Vector requests fail** – bekreft `UPSTASH_VECTOR_*` og at indeksen eksisterer (`VEC_INDEX_NAME`).
- **Cache misses** – Redis-kall er optional. Hvis miljøet mangler Redis settings, verktøyene faller tilbake til live-fetch (kan være tregere).
- **`search_docs_semantic` returnerer tomt** – kjør `index_docs_semantic` for å (re)indeksere, og sjekk at `OPENAI_API_KEY` er gyldig.

## 6. Sikker praksis

- Ikke sjekk inn hemmeligheter. Bruk `.env.local` eller Vercel/CI secrets.
- Maskinporten-nøkler bør roteres i henhold til virksomhetens sikkerhetspolicy.
- Overvåk antall kall til Upstash/BRREG for å holde seg innenfor rate limits.

Med denne filen + canvas-snarveien er både repo og workspace oppdatert med samme MCP-instruksjoner.

