import OpenAI from 'openai';

const EMBED_MODEL = process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small';

export async function embedChunks(chunks: string[]): Promise<number[][]> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const res = await client.embeddings.create({ model: EMBED_MODEL, input: chunks });
  return res.data.map((d) => d.embedding as number[]);
}










