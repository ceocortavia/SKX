import OpenAI from 'openai';

export interface JsonSchema {
  name: string;
  schema: Record<string, any>;
}

export interface ProviderRequest {
  systemPrompt: string;
  userPrompt: string;
  jsonSchema?: JsonSchema;
  model?: string;
  temperature?: number;
}

export interface ProviderResponse {
  text: string;
  tokensIn: number;
  tokensOut: number;
  model: string;
}

let cached: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!cached) {
    cached = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return cached;
}

export async function callProvider(req: ProviderRequest): Promise<ProviderResponse | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const model = req.model ?? process.env.OPENAI_RESPONSES_MODEL ?? 'gpt-4.1-mini';
    const payload: any = {
      model,
      temperature: req.temperature ?? 0.2,
      input: [
        { role: 'system', content: req.systemPrompt },
        { role: 'user', content: req.userPrompt }
      ]
    };

    if (req.jsonSchema) {
      payload.response_format = {
        type: 'json_schema',
        json_schema: { name: req.jsonSchema.name, schema: req.jsonSchema.schema, strict: true }
      };
    }

    const response = await client.responses.create(payload);

    const outputText = response.output_text;
    const usage = response.usage;

    return {
      text: outputText ?? '',
      tokensIn: usage?.input_tokens ?? 0,
      tokensOut: usage?.output_tokens ?? 0,
      model: response.model ?? model,
    };
  } catch (error) {
    console.error('[ai.provider.call] fallback', error);
    return null;
  }
}
