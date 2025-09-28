import { indexDocsSemantic, searchDocsSemantic } from './docs';
import { getBrreg, getBrregRoles, getSignaturProkura } from './brreg';
import { maskinportenConfig, vectorConfig, fullmaktConfig } from './env';
import { chrome_probe } from './tools.chrome';

type JsonSchema = Record<string, unknown>;

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  handler: (args: any) => Promise<any>;
}

function ensureFeature(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

export const tools: ToolDefinition[] = [
  {
    name: 'index_docs_semantic',
    description: 'Index documentation files into the vector store for semantic search.',
    inputSchema: {
      type: 'object',
      properties: {
        reindex: {
          type: 'boolean',
          description: 'Optional flag for future use. Currently ignored.',
        },
      },
    },
    handler: async () => {
      ensureFeature(!!vectorConfig(), 'Upstash Vector is not configured');
      return indexDocsSemantic();
    },
  },
  chrome_probe as any,
  {
    name: 'search_docs_semantic',
    description: 'Search the documentation index using semantic similarity.',
    inputSchema: {
      type: 'object',
      required: ['query'],
      properties: {
        query: { type: 'string' },
        topK: { type: 'integer', minimum: 1, maximum: 10, default: 5 },
      },
    },
    handler: async (args: any) => {
      ensureFeature(!!vectorConfig(), 'Upstash Vector is not configured');
      const query = typeof args?.query === 'string' ? args.query.trim() : '';
      if (!query) {
        throw new Error('query must be a non-empty string');
      }
      const topK = Math.min(Math.max(Number(args?.topK) || 5, 1), 10);
      return searchDocsSemantic(query, topK);
    },
  },
  {
    name: 'get_brreg',
    description: 'Fetch organization details from BRREG with optional subunits.',
    inputSchema: {
      type: 'object',
      required: ['orgnr'],
      properties: {
        orgnr: { type: 'string', pattern: '^\\d{9}$' },
        includeSubunits: { type: 'boolean', default: false },
      },
    },
    handler: async (args: any) => {
      const orgnr = String(args?.orgnr ?? '');
      const includeSubunits = Boolean(args?.includeSubunits);
      return getBrreg(orgnr, includeSubunits);
    },
  },
  {
    name: 'get_brreg_roles',
    description: 'Fetch role information (styre, signatur etc.) for an organization from BRREG.',
    inputSchema: {
      type: 'object',
      required: ['orgnr'],
      properties: {
        orgnr: { type: 'string', pattern: '^\\d{9}$' },
      },
    },
    handler: async (args: any) => {
      const cfg = maskinportenConfig();
      if (cfg.mode === 'authorised') {
        ensureFeature(
          !!cfg.tokenUrl && !!cfg.clientId && !!cfg.scope && !!cfg.privateKeyBase64 && !!cfg.resource,
          'Maskinporten configuration is incomplete for authorised BRREG access'
        );
      }
      const orgnr = String(args?.orgnr ?? '');
      return getBrregRoles(orgnr);
    },
  },
  {
    name: 'get_signatur_prokura',
    description: 'Fetch signatur and prokura information from Brønnøysund Fullmakttjenesten.',
    inputSchema: {
      type: 'object',
      required: ['orgnr'],
      properties: {
        orgnr: { type: 'string', pattern: '^\\d{9}$' },
      },
    },
    handler: async (args: any) => {
      ensureFeature(!!fullmaktConfig(), 'Fullmakttjenesten is not configured');
      const orgnr = String(args?.orgnr ?? '');
      return getSignaturProkura(orgnr);
    },
  },
];

export const toolsByName = new Map(tools.map((tool) => [tool.name, tool]));
