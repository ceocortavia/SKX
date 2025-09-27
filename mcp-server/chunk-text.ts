export function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const clean = text.replace(/\r/g, '');
  const paragraphs = clean.split(/\n\s*\n/g);
  const chunks: string[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    const candidate = current ? `${current}\n\n${trimmed}` : trimmed;
    if (candidate.length > chunkSize && current.length > 0) {
      chunks.push(current.trim());
      const overlapText = current.slice(Math.max(0, current.length - overlap));
      current = overlapText ? `${overlapText}\n\n${trimmed}` : trimmed;
    } else {
      current = candidate;
    }
  }

  if (current.length) {
    chunks.push(current.trim());
  }

  return chunks;
}
