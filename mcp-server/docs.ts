import fs from 'fs/promises';
import path from 'path';
import OpenAI from 'openai';
import {
  docsDir,
  docsChunkOverlap,
  docsChunkSize,
  ensureOpenAiKey,
  openAiEmbeddingModel,
} from './env';
import { upsertVectors, queryVectors, VectorRecord, VectorQueryResult } from './vector';

interface DocChunk {
  id: string;
  text: string;
  metadata: Record<string, unknown>;
}

async function* walkDocs(root: string): AsyncGenerator<string> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      yield* walkDocs(fullPath);
    } else {
      if (/\.(md|mdx|txt|json)$/i.test(entry.name)) {
        yield fullPath;
      }
    }
  }
}

export function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const clean = text.replace(/\r/g, '');
  const paragraphs = clean.split(/\n\s*\n/g);
  const chunks: string[] = [];
  let current = '';
  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;
    if ((current + '\n\n' + trimmed).length > chunkSize && current.length > 0) {
      chunks.push(current.trim());
      const overlapText = current.slice(Math.max(0, current.length - overlap));
      current = overlapText + '\n\n' + trimmed;
    } else {
      current = current ? `${current}\n\n${trimmed}` : trimmed;
    }
  }
  if (current.length) {
    chunks.push(current.trim());
  }
  return chunks;
}

async function createChunks(): Promise<DocChunk[]> {
  const chunks: DocChunk[] = [];
  const root = docsDir;
  try {
    await fs.access(root);
  } catch (error) {
    throw new Error(`Docs directory not found: ${root}`);
  }

  for await (const filePath of walkDocs(root)) {
    const stat = await fs.stat(filePath);
    if (stat.size > 512 * 1024) {
      continue;
    }
    const content = await fs.readFile(filePath, 'utf-8');
    const relPath = path.relative(root, filePath);
    const segments = chunkText(content, docsChunkSize, docsChunkOverlap);
    segments.forEach((segment, idx) => {
      if (!segment.trim()) return;
      chunks.push({
        id: `${relPath}#${idx}`,
        text: segment,
        metadata: {
          path: relPath,
          chunk: idx,
        },
      });
    });
  }
  return chunks;
}

async function getOpenAiClient(): Promise<OpenAI> {
  const apiKey = ensureOpenAiKey();
  return new OpenAI({ apiKey });
}

export async function indexDocsSemantic(): Promise<{ filesProcessed: number; chunksIndexed: number }> {
  const openai = await getOpenAiClient();
  const model = openAiEmbeddingModel();
  const chunks = await createChunks();
  if (!chunks.length) {
    return { filesProcessed: 0, chunksIndexed: 0 };
  }

  const embeddings: VectorRecord[] = [];
  for (const chunk of chunks) {
    const response = await openai.embeddings.create({
      model,
      input: chunk.text,
    });
    const vector = response.data?.[0]?.embedding;
    if (!vector) {
      throw new Error('OpenAI embedding response missing data');
    }
    embeddings.push({
      id: chunk.id,
      vector,
      metadata: chunk.metadata,
    });
    if (embeddings.length >= 10) {
      const batch = embeddings.splice(0, embeddings.length);
      if (batch.length) {
        await upsertVectors(batch);
      }
    }
  }
  if (embeddings.length) {
    const remaining = embeddings.splice(0, embeddings.length);
    if (remaining.length) {
      await upsertVectors(remaining);
    }
  }
  const uniqueFiles = new Set(chunks.map((c) => c.metadata.path as string));
  return { filesProcessed: uniqueFiles.size, chunksIndexed: chunks.length };
}

export interface SemanticMatch {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export async function searchDocsSemantic(query: string, topK: number): Promise<SemanticMatch[]> {
  const openai = await getOpenAiClient();
  const model = openAiEmbeddingModel();
  const embedding = await openai.embeddings.create({ model, input: query });
  const vector = embedding.data?.[0]?.embedding;
  if (!vector) {
    throw new Error('Failed to create embedding for query');
  }
  const results = await queryVectors(vector, topK);
  return results.map((item: VectorQueryResult) => ({
    id: item.id,
    score: item.score,
    metadata: item.metadata,
  }));
}
