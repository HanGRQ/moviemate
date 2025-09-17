// apps/backend/src/routes/agent.ts
import { Router } from "express";
import { chatOrchestrator } from "../agent/orchestrator.js";

const r: import("express").Router = Router();
/**
 * POST /api/agent/chat
 * body: { sessionId: string, message: string, profile?: { likes:number[], tags:string[] } }
 * resp: { summary: string, movies: [{ id, reason, why_for_user }] }
 */
r.post("/chat", async (req, res) => {
  try {
    const { sessionId, message, profile } = req.body || {};
    if (!sessionId || !message) return res.status(400).json({ error: "sessionId & message required" });
    const out = await chatOrchestrator({ sessionId, message, profile });
    res.json(out);
  } catch (e: any) {
    console.error("[/api/agent/chat]", e);
    res.status(500).json({ summary: "抱歉，Agent 暂时开小差了，先给你关键词检索结果。", movies: [] });
  }
});

export default r;
