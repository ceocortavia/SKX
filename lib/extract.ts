export type ExtractedDoc = {
  text: string;
  pages?: Array<{ index: number; text: string }>;
};

export async function extractText(name: string, bytes: Uint8Array, mime: string): Promise<ExtractedDoc> {
  const lower = (name || '').toLowerCase();
  const isMd = lower.endsWith('.md') || mime === 'text/markdown' || mime === 'text/plain';
  if (isMd) {
    const text = new TextDecoder('utf-8').decode(bytes);
    return { text, pages: [{ index: 0, text }] };
  }
  // Stubs for pdf/docx – implement proper parsers later
  const text = new TextDecoder('utf-8').decode(bytes);
  return { text, pages: [{ index: 0, text }] };
}

export function chunkText(input: string, maxChars = 4000, overlap = 400): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < input.length) {
    const end = Math.min(i + maxChars, input.length);
    chunks.push(input.slice(i, end));
    if (end >= input.length) break;
    i = Math.max(0, end - overlap);
  }
  return chunks;
}










