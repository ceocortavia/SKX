import { createHash } from 'node:crypto';

export function hashInput(value: unknown): string {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  return createHash('sha256').update(serialized).digest('hex');
}

