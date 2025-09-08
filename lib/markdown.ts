import 'server-only';

import fs from 'node:fs/promises';
import path from 'node:path';
import { marked } from 'marked';
import hljs from 'highlight.js';
import DOMPurify from 'isomorphic-dompurify';
import matter from 'gray-matter';

marked.setOptions({
  gfm: true,
  breaks: false,
  smartypants: true,
  headerIds: true,
  highlight(code, lang) {
    try {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    } catch {
      return code;
    }
  },
});

const cache = new Map<string, string>();

// Prioritert rekkefølge: forsøk å lese fra 'lib/src_full', deretter fra app/(marketing)/_content
const contentRoots = [
  path.join(process.cwd(), 'lib', 'src_full'),
  path.join(process.cwd(), 'app', '(marketing)', '_content'),
];

type SanitizeOpts = Parameters<typeof DOMPurify.sanitize>[1];

const sanitizeOptions: SanitizeOpts = {
  USE_PROFILES: { html: true },
  ADD_ATTR: ['class'],
};

function resolveFromRoot(...segments: string[]) {
  return path.join(process.cwd(), ...segments);
}

async function readFromAnyRoot(relFile: string): Promise<string> {
  let firstErr: unknown | null = null;
  for (const root of contentRoots) {
    const abs = path.join(root, relFile);
    try {
      return await fs.readFile(abs, 'utf8');
    } catch (err) {
      if (!firstErr) firstErr = err;
      // fortsett til neste rot
    }
  }
  throw firstErr ?? new Error(`File not found in roots: ${relFile}`);
}

/** Les markdown → { html, data } (frontmatter-støtte) */
export async function readMarkdownWithMeta(relFile: string): Promise<{ html: string; data: Record<string, unknown> }> {
  const raw = await readFromAnyRoot(relFile);
  const { content, data } = matter(raw);
  const unsafeHtml = marked.parse(content);
  const safeHtml = DOMPurify.sanitize(unsafeHtml as string, sanitizeOptions);
  return { html: safeHtml, data };
}

export async function readMarkdownHtml(
  filePath: string | string[],
  { cacheKey }: { cacheKey?: string } = {}
): Promise<string> {
  // Kompat: dersom det er en enkel streng uten path-separator, tolk som relativ fil under content-roots
  if (typeof filePath === 'string' && !filePath.includes('/') && !filePath.includes('\\')) {
    const { html } = await readMarkdownWithMeta(filePath);
    return html;
  }

  const absPath = Array.isArray(filePath) ? resolveFromRoot(...filePath) : filePath;
  const key = cacheKey ?? absPath;

  if (process.env.NODE_ENV !== 'development' && cache.has(key)) {
    return cache.get(key)!;
  }

  const raw = await fs.readFile(absPath, 'utf8');
  const unsafeHtml = marked.parse(raw);
  const safeHtml = DOMPurify.sanitize(unsafeHtml as string, sanitizeOptions);
  cache.set(key, safeHtml);
  return safeHtml;
}

export async function readManyMarkdownHtml(files: Record<string, string | string[]>) {
  const entries = await Promise.all(
    Object.entries(files).map(async ([k, v]) => [k, await readMarkdownHtml(v)] as const)
  );
  return Object.fromEntries(entries);
}

