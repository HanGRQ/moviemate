// apps/frontend/src/lib/api.ts
const base = import.meta.env.VITE_API_BASE || "";

export async function chat(sessionId: string, message: string, profile?: {likes:number[]; tags:string[]}) {
  const r = await fetch(`${base}/api/agent/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, message, profile })
  });
  return r.json(); // { summary, movies: [{ id, reason, why_for_user }] }
}
