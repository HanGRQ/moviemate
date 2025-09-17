import { Router } from "express";
import { tmdb } from "../services/tmdb.js";
import { k, getCache, setCache } from "../infra/cache.js";

// ✅ 显式标注，解决 “inferred type cannot be named …” 问题
const r: import("express").Router = Router();

r.get("/search", async (req, res) => {
  try {
    const { q, year, genre, page } = req.query as Partial<Record<"q"|"year"|"genre"|"page", string>>;
    const key = k("search-api", { q, year, genre, page });
    const hit = await getCache(key);
    if (hit) return res.json({ results: hit });

    const list = await tmdb.search({
      ...(q     ? { query: q } : {}),
      ...(year  ? { year: Number(year) } : {}),
      ...(genre ? { genre } : {}),
      ...(page  ? { page: Number(page) } : {}),
    });
    await setCache(key, list, 1800);
    res.json({ results: list });
  } catch (e) {
    console.error("[/api/movies/search]", e);
    res.status(500).json({ results: [] });
  }
});

r.get("/:id/detail", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const key = `detail-api:${id}`;
    const hit = await getCache(key);
    if (hit) return res.json(hit);
    const d = await tmdb.detail(id);
    await setCache(key, d, 7200);
    res.json(d);
  } catch (e) {
    console.error("[/api/movies/:id/detail]", e);
    res.status(500).json({ error: "failed" });
  }
});

r.get("/:id/similar", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const key = `similar-api:${id}`;
    const hit = await getCache(key);
    if (hit) return res.json({ results: hit });
    const list = await tmdb.similar(id);
    await setCache(key, list, 3600);
    res.json({ results: list });
  } catch (e) {
    console.error("[/api/movies/:id/similar]", e);
    res.status(500).json({ results: [] });
  }
});

r.get("/recommend", async (_req, res) => {
  res.json({ results: [] });
});

export default r;
