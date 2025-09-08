type Key = string;
const hits = new Map<Key, number[]>();

export function rateLimit({
  limit,
  windowMs,
  key,
}: { limit: number; windowMs: number; key: string }) {
  const now = Date.now();
  const from = now - windowMs;
  const arr = hits.get(key)?.filter((t) => t > from) ?? [];
  if (arr.length >= limit) return { allowed: false as const, remainingMs: arr[0] + windowMs - now };
  arr.push(now);
  hits.set(key, arr);
  return { allowed: true as const };
}





