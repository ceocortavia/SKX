import path from 'path';

const required = (name: string, value: string | undefined): string => {
  if (!value) {
    throw new Error(`${name} is required for this operation`);
  }
  return value;
};

export interface UpstashRedisConfig {
  url: string;
  token: string;
}

export interface UpstashVectorConfig {
  url: string;
  token: string;
  index: string;
}

export interface MaskinportenConfig {
  mode: 'open' | 'authorised';
  tokenUrl?: string;
  clientId?: string;
  scope?: string;
  resource?: string;
  issuer?: string;
  privateKeyBase64?: string;
}

export interface FullmaktConfig {
  baseUrl: string;
  token: string;
}

export const docsDir = process.env.SKX_DOCS_DIR
  ? path.resolve(process.cwd(), process.env.SKX_DOCS_DIR)
  : path.resolve(process.cwd(), 'docs');

export const redisConfig = (): UpstashRedisConfig | null => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url, token };
};

export const vectorConfig = (): UpstashVectorConfig | null => {
  const url = process.env.UPSTASH_VECTOR_REST_URL;
  const token = process.env.UPSTASH_VECTOR_REST_TOKEN;
  const index = process.env.VEC_INDEX_NAME;
  if (!url || !token || !index) return null;
  return { url, token, index };
};

export const openAiApiKey = (): string | null => process.env.OPENAI_API_KEY ?? null;

export const openAiEmbeddingModel = (): string => process.env.OPENAI_EMBED_MODEL ?? 'text-embedding-3-small';

export const maskinportenConfig = (): MaskinportenConfig => {
  const modeRaw = (process.env.BRREG_MODE || '').toLowerCase();
  const mode: MaskinportenConfig['mode'] = modeRaw === 'authorised' ? 'authorised' : 'open';
  if (mode === 'open') {
    return { mode: 'open' };
  }
  return {
    mode,
    tokenUrl: process.env.MASKINPORTEN_TOKEN_URL,
    clientId: process.env.MASKINPORTEN_CLIENT_ID,
    scope: process.env.MASKINPORTEN_SCOPE,
    resource: process.env.MASKINPORTEN_RESOURCE,
    issuer: process.env.MASKINPORTEN_ISSUER,
    privateKeyBase64: process.env.MASKINPORTEN_PRIVATE_KEY_BASE64,
  };
};

export const fullmaktConfig = (): FullmaktConfig | null => {
  const baseUrl = process.env.FULLMAKT_BASE_URL;
  const token = process.env.FULLMAKT_TOKEN;
  if (!baseUrl || !token) return null;
  return { baseUrl, token };
};

export const ensureVectorConfig = (): UpstashVectorConfig => {
  const cfg = vectorConfig();
  if (!cfg) {
    throw new Error('Upstash Vector environment variables are missing');
  }
  return cfg;
};

export const ensureRedisConfig = (): UpstashRedisConfig => {
  const cfg = redisConfig();
  if (!cfg) {
    throw new Error('Upstash Redis environment variables are missing');
  }
  return cfg;
};

export const ensureOpenAiKey = (): string => required('OPENAI_API_KEY', openAiApiKey() ?? undefined);

export const docsChunkSize = parseInt(process.env.DOCS_CHUNK_SIZE || '1200', 10);
export const docsChunkOverlap = parseInt(process.env.DOCS_CHUNK_OVERLAP || '200', 10);
export const redisTtlSeconds = parseInt(process.env.REDIS_CACHE_TTL || '3600', 10);

