// ✨ 关键：加 .js 后缀
import { tmdb, type TMDBMovie } from "../services/tmdb.js";
import { getCache, setCache, k } from "../infra/cache.js";

export async function searchMoviesTool(params: {
  query?: string; year?: number; genre?: string; castFemale?: boolean;
  sortBy?: "imdb" | "popularity"; limit?: number;
}) {
  const key = k("search", params);
  const hit = await getCache(key);
  if (hit) return hit as TMDBMovie[];

  // ❌ 不要 { query: params.query } 这种可能是 undefined 的“显式键”
  // ✅ 用条件展开，省掉 undefined 的键
  const searchArgs: { query?: string; year?: number; genre?: string } = {
    ...(params.query !== undefined ? { query: params.query } : {}),
    ...(params.year  !== undefined ? { year:  params.year  } : {}),
    ...(params.genre !== undefined ? { genre: params.genre } : {}),
  };

  let items = await tmdb.search(searchArgs);

  if (params.castFemale) items = await tmdb.filterByFemaleCast(items);
  items = await tmdb.sortByScore(items, params.sortBy || "imdb");

  const out = params.limit ? items.slice(0, params.limit) : items;
  await setCache(key, out, 60 * 60);
  return out;
}

export async function getMovieDetailTool(id: number) {
  const key = `detail:${id}`;
  const hit = await getCache(key);
  if (hit) return hit as TMDBMovie;
  const d = await tmdb.detail(id);
  await setCache(key, d, 60 * 120);
  return d;
}

export async function getSimilarTool(id: number, limit = 10) {
  const key = `similar:${id}`;
  const hit = await getCache(key);
  if (hit) return (hit as TMDBMovie[]).slice(0, limit);
  const list = await tmdb.similar(id);
  await setCache(key, list, 60 * 60);
  return list.slice(0, limit);
}

export async function recommendForUserTool(
  profile: { likes: number[]; tags: string[] },
  limit = 8
) {
  const pool = new Map<number, TMDBMovie>();
  for (const mid of profile.likes || []) {
    const sims = await getSimilarTool(mid, 20);
    for (const m of sims) pool.set(m.id, m);
  }
  const arr = [...pool.values()].map((m) => {
    const tagBag = new Set<string>(
      (m.genres as any[] || []).map((g: any) => (g.name || g).toString().toLowerCase())
    );
    const hit = (profile.tags || []).filter((t) => tagBag.has(t.toLowerCase()));
    const score = (m.vote_average || 0) * 0.7 + (hit.length ? 3 : 0);
    return { m, score, hit };
  });
  arr.sort((a, b) => b.score - a.score);
  return arr.slice(0, limit).map(({ m, hit }) => ({
    ...m,
    _explain: `命中标签：${hit.join("/") || "—"}`
  }));
}
