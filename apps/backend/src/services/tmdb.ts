// apps/backend/src/services/tmdb.ts
import fetch from "node-fetch";
import https from "https";
import { setTimeout as delay } from "timers/promises";

const TMDB_BASE = "https://api.themoviedb.org/3";
const READ_TOKEN = process.env.TMDB_READ_TOKEN; // v4 Read Access Token
const V3_KEY = process.env.TMDB_KEY;            // v3 api_key（备用）

/** 强制 IPv4 + keepAlive，规避部分网络的 IPv6 超时 */
const httpsAgent = new https.Agent({
  keepAlive: true,
});

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (READ_TOKEN && READ_TOKEN.length > 0) {
    headers.Authorization = `Bearer ${READ_TOKEN}`;
  }
  return headers;
}


function withKey(url: string) {
  if (READ_TOKEN) return url;        // 用 v4 Bearer 时不拼 api_key
  if (!V3_KEY) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}api_key=${V3_KEY}`;
}

/** 最小的重试/超时封装：防抖网络波动 */
async function fetchJSON<T>(url: string, { retries = 2, timeoutMs = 15000 } = {}): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const r = await fetch(url, {
        headers: authHeaders(),
        // @ts-ignore
        agent: httpsAgent,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!r.ok) {
        const text = await r.text().catch(() => "");
        throw new Error(`[tmdb] ${r.status} ${r.statusText} for ${url} :: ${text}`);
      }
      return (await r.json()) as T;
    } catch (err: any) {
      clearTimeout(timeout); // ✅ 确保异常时也清理
      const transient = err?.name === "AbortError" || ["ETIMEDOUT", "ECONNRESET"].includes(err?.code);
      if (!transient || attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    }
  }
  throw new Error("Unreachable");
}


// —— 类型最小定义 ——
type TMDBPaginated<T> = { results: T[] };
type TMDBMovieRaw = any;

export type TMDBMovie = {
  id: number;
  title: string;
  year?: string;
  poster?: string | null;
  overview?: string;
  vote_average?: number;
  popularity?: number;
  genres?: Array<{ id: number; name: string }> | number[];
  credits?: any;
  cast?: Array<{ id: number; name: string; gender: number }>;
};

function img(p?: string | null) {
  return p ? `https://image.tmdb.org/t/p/w342${p}` : null;
}
function normalizeMovie(x: TMDBMovieRaw): TMDBMovie {
  return {
    id: x.id,
    title: x.title || x.name,
    year: (x.release_date || "").slice(0, 4),
    poster: img(x.poster_path),
    overview: x.overview,
    vote_average: x.vote_average,
    popularity: x.popularity,
    genres: x.genres || x.genre_ids || [],
    credits: x.credits,
    cast: (x.credits?.cast || []).map((c: any) => ({ id: c.id, name: c.name, gender: c.gender })),
  };
}

/** 常见类型名→ID 映射（必要时你可补全） */
const GENRE_ID: Record<string, number> = {
  "Action": 28,
  "Adventure": 12,
  "Animation": 16,
  "Comedy": 35,
  "Crime": 80,
  "Documentary": 99,
  "Drama": 18,
  "Family": 10751,
  "Fantasy": 14,
  "History": 36,
  "Horror": 27,
  "Music": 10402,
  "Mystery": 9648,
  "Romance": 10749,
  "Science Fiction": 878,  // = Sci-Fi
  "Sci-Fi": 878,           // 兼容写法
  "TV Movie": 10770,
  "Thriller": 53,
  "War": 10752,
  "Western": 37,
};

function toGenreId(genre?: string | number) {
  if (genre == null || genre === "") return undefined;
  if (typeof genre === "number") return genre;
  // 兼容大小写与常见别名
  const key = genre.trim();
  return GENRE_ID[key] ?? GENRE_ID[capitalize(key)] ?? undefined;
}
function capitalize(s: string) {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

export const tmdb = {
  /** 搜索或发现；支持中文 query；支持 year、genre（名或ID）、分页、排序 */
  async search(params: {
    query?: string;
    year?: number;
    genre?: string | number;
    page?: number;
    /** 排序：仅 discover 生效。常用：vote_average.desc、popularity.desc */
    sort_by?: "vote_average.desc" | "popularity.desc" | "release_date.desc";
    /** 门槛：给评分排序加一个投票数下限避免冷门片（例如 200） */
    vote_count_gte?: number;
  }) {
    const { query, year, genre, page, sort_by, vote_count_gte } = params;
    if (query?.trim()) {
      const url = withKey(
        `${TMDB_BASE}/search/movie?query=${encodeURIComponent(query)}&include_adult=false` +
          (year ? `&year=${year}` : "") +
          (page ? `&page=${page}` : "")
      );
      const j = await fetchJSON<TMDBPaginated<TMDBMovieRaw>>(url);
      return (j.results ?? []).map(normalizeMovie);
    }

    const g = toGenreId(genre);
    const url =
      withKey(`${TMDB_BASE}/discover/movie?include_adult=false`) +
      (year ? `&year=${year}` : "") +
      (g ? `&with_genres=${g}` : "") +
      (page ? `&page=${page}` : "") +
      (sort_by ? `&sort_by=${encodeURIComponent(sort_by)}` : "") +
      (vote_count_gte ? `&vote_count.gte=${vote_count_gte}` : "");

    const j = await fetchJSON<TMDBPaginated<TMDBMovieRaw>>(url);
    return (j.results ?? []).map(normalizeMovie);
  },

  async detail(id: number) {
    const url = withKey(`${TMDB_BASE}/movie/${id}?append_to_response=credits,external_ids`);
    const j = await fetchJSON<TMDBMovieRaw>(url);
    return normalizeMovie(j);
  },

  async similar(id: number) {
    const url = withKey(`${TMDB_BASE}/movie/${id}/similar`);
    const j = await fetchJSON<TMDBPaginated<TMDBMovieRaw>>(url);
    return (j.results ?? []).map(normalizeMovie);
  },

  async filterByFemaleCast(list: TMDBMovie[]) {
    const first = await Promise.all(list.slice(0, 20).map((m) => this.detail(m.id)));
    return first.filter((m) => (m.cast || []).some((c) => c.gender === 1));
  },

  async sortByScore(list: TMDBMovie[], by: "imdb" | "popularity" = "imdb") {
    if (by === "popularity") return [...list].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
    return [...list].sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0));
  },
};
