import { searchMoviesTool, getSimilarTool, recommendForUserTool } from "./tools.js";

type Memory = {
  filters: {
    year?: number;
    genre?: string;
    castFemale?: boolean;
    sortBy?: "imdb" | "popularity";
  };
};

const memStore = new Map<string, Memory>();

// —— 解析 key=value 指令：year=2023, genre=sci-fi, sortBy=imdb, female=true 等 ——
function parseDirectives(text: string) {
  const pairs = Array.from(text.matchAll(/\b([a-zA-Z_]+)\s*=\s*([^\s，,]+)\b/gi));
  const kv: Record<string, string> = {};
  let rest = text;
  for (const m of pairs) {
    const k = m[1].toLowerCase();
    const v = m[2];
    kv[k] = v;
    rest = rest.replace(m[0], "").trim();
  }
  return { kv, rest };
}

export async function chatOrchestrator(params: {
  sessionId: string;
  message: string;
  profile?: { likes: number[]; tags: string[] };
}) {
  const mem = memStore.get(params.sessionId) || { filters: {} };
  const raw = params.message.trim();

  // 先解析指令
  const { kv, rest } = parseDirectives(raw);

  // —— 自然语言意图 ——
  const yearMatch = rest.match(/(19|20)\d{2}/);
  const yearNL = yearMatch ? Number(yearMatch[0]) : undefined;
  const sciNL = /科幻|sci-?fi|science fiction/i.test(rest) ? "Sci-Fi" : undefined;
  const femaleMatch = /女性主演|女主|female/i.test(rest);
  const orderImdbNL = /评分|imdb|按.*分/i.test(rest) ? ("imdb" as const) : undefined;

  // —— 指令优先于自然语言 ——
  const year = kv.year ? Number(kv.year) : yearNL;
  const genre = kv.genre ? kv.genre : sciNL;
  const sortBy =
    (kv.sortby?.toLowerCase() === "imdb"
      ? "imdb"
      : kv.sortby?.toLowerCase() === "popularity"
      ? "popularity"
      : undefined) ?? orderImdbNL;
  const wantFemale = kv.female
    ? /^(1|true|yes|on)$/i.test(kv.female)
    : femaleMatch
    ? true
    : undefined;

  // 清理后的 query，避免把 sortBy=imdb 当成片名
  const cleanedQuery = rest.replace(/\s+/g, " ").trim();

  // ✅ 更新 memory（不写 undefined）
  mem.filters = {
    ...mem.filters,
    ...(year !== undefined ? { year } : {}),
    ...(genre !== undefined ? { genre } : {}),
    ...(wantFemale !== undefined ? { castFemale: wantFemale } : {}),
    ...(sortBy !== undefined ? { sortBy } : {}),
  };
  memStore.set(params.sessionId, mem);

  // —— 基础参数（筛选条件） ——
  const argsBase = {
    ...(mem.filters.year !== undefined ? { year: mem.filters.year } : {}),
    ...(mem.filters.genre !== undefined ? { genre: mem.filters.genre } : {}),
    ...(mem.filters.castFemale !== undefined ? { castFemale: mem.filters.castFemale } : {}),
    ...(mem.filters.sortBy !== undefined ? { sortBy: mem.filters.sortBy } : {}),
    limit: 6 as const,
  };

  let list: any[] = [];

  // —— 选路径 & 调工具 ——
  if (/收藏|个性化|周末片单/i.test(raw) && params.profile) {
    list = await recommendForUserTool(params.profile, 6);
  } else if (/类似|像.*?这样的|similar/i.test(raw)) {
    const arrivalId = 329865; // Arrival
    list = await getSimilarTool(arrivalId, 8);
  } else {
    if (cleanedQuery && !/^(找|推荐)$/.test(cleanedQuery)) {
      // 有 query → 搜索
      list = await searchMoviesTool({ query: cleanedQuery, ...argsBase });
      // 若搜索结果为空，fallback 到 discover
      if (!list?.length) {
        list = await searchMoviesTool({ ...argsBase });
      }
    } else {
      // 无 query → discover
      list = await searchMoviesTool({ ...argsBase });
    }
  }

  const movies = (list || []).slice(0, 4).map((m: any) => ({
    id: m.id,
    reason: mem.filters.castFemale ? "女性主演/女性角色占比高" : "匹配当前主题/口碑",
    why_for_user: params.profile?.tags?.length
      ? `命中标签：${m._reasonTags || m._explain || "相似度较高"}`
      : `与筛选一致：${[
          mem.filters.year,
          mem.filters.genre,
          mem.filters.sortBy,
        ]
          .filter(Boolean)
          .join(" / ") || "默认规则"}`,
  }));

  const summary = params.profile
    ? "结合你的收藏和偏好给出个性化片单。"
    : /类似/.test(raw)
    ? "基于相似特征做了推荐，并按口碑排序。"
    : "根据筛选检索并排序，给出候选清单。";

  return { summary, movies };
}
