// apps/backend/src/infra/cache.ts
// 无 Redis 时使用内存缓存；有 REDIS_URL 时可换成你之前的 redis.ts
const mem = new Map<string, { exp: number; val: any }>();

export async function getCache(key: string) {
  const item = mem.get(key);
  if (!item) return null;
  if (Date.now() > item.exp) { mem.delete(key); return null; }
  return item.val;
}

export async function setCache(key: string, val: any, ttlSec = 1800) {
  mem.set(key, { exp: Date.now() + ttlSec * 1000, val });
}

export function k(prefix: string, data: unknown) {
  return `${prefix}:${Buffer.from(JSON.stringify(data)).toString("base64url")}`;
}
