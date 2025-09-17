// ✅ 1) 先加载环境变量（.env）
import "dotenv/config";

// ✅ 2) 全局把 DNS 解析顺序设为 IPv4 优先（安全，不会破坏 http 内部 lookup 形态）
import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

import express from "express";
import cors from "cors";
import agentRouter from "./routes/agent";
import moviesRouter from "./routes/movies";
import path from "path";
import { fileURLToPath } from "url";

// ✅ 在 ESM 里模拟 CommonJS 的 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../.env") });



const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/agent", agentRouter);
app.use("/api/movies", moviesRouter);

app.get("/health", (_, res) => res.json({ ok: true }));

const port = process.env.PORT || 9000;

// （可选）启动时给个关键变量提示，便于诊断鉴权问题
console.log("[backend] TMDB_READ_TOKEN:", process.env.TMDB_READ_TOKEN ? "loaded" : "missing");
console.log("[backend] TMDB_KEY:", process.env.TMDB_KEY ? "loaded" : "missing");

app.listen(port, () => console.log(`[backend] listening on ${port}`));

// （可选）兜底日志，避免静默错误
process.on("unhandledRejection", (e) => {
  console.error("[backend] Unhandled Rejection:", e);
});
