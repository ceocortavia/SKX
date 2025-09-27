# SKX MCP Server

This MCP server exposes tools for BRREG lookups, Fullmakttjenesten, and semantic document search over stdio so it can be used from Cursor or any other Model Context Protocol host.

## Tools

| Tool | Description |
| --- | --- |
| `index_docs_semantic` | Reads the docs directory, creates OpenAI embeddings, and upserts them to Upstash Vector. |
| `search_docs_semantic` | Performs a semantic vector search and returns the strongest matches. |
| `get_brreg` | Fetches organization data from the BRREG Enhetsregisteret API (optionally includes subunits). |
| `get_brreg_roles` | Fetches role information, automatically switching to Maskinporten when `BRREG_MODE=authorised`. |
| `get_signatur_prokura` | Queries Brønnøysund Fullmakttjenesten for signatur/prokura data. |

## Environment variables

Set the following before running the server:

```
SKX_DOCS_DIR=./docs
OPENAI_API_KEY=...
OPENAI_EMBED_MODEL=text-embedding-3-small

UPSTASH_VECTOR_REST_URL=...
UPSTASH_VECTOR_REST_TOKEN=...
VEC_INDEX_NAME=skilllexia-docs

UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

Optional for authorised BRREG roles:

```
BRREG_MODE=authorised
MASKINPORTEN_TOKEN_URL=...
MASKINPORTEN_CLIENT_ID=...
MASKINPORTEN_SCOPE=enhetsregisteret:read
MASKINPORTEN_RESOURCE=https://data.brreg.no/enhetsregisteret/autorisert-api
MASKINPORTEN_ISSUER=...
MASKINPORTEN_PRIVATE_KEY_BASE64=<base64 PKCS#8>
```

Optional Fullmakttjeneste:

```
FULLMAKT_BASE_URL=https://data.brreg.no/fullmakt
FULLMAKT_TOKEN=...
```

## Running

```
npm run start:mcp
```

This starts a stdio MCP server. In Cursor (Settings → MCP → Add Server) point to the command above.

Example tool usage once connected:

```
Use tool index_docs_semantic
Use tool search_docs_semantic with { "query": "BRREG roller diff" }
Use tool get_brreg with { "orgnr": "915501680", "includeSubunits": true }
Use tool get_brreg_roles with { "orgnr": "915501680" }
Use tool get_signatur_prokura with { "orgnr": "915501680" }
```

