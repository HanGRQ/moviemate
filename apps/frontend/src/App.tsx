import { useState } from "react";
import MovieCard, { type UIMovie } from "./components/MovieCard";
import { chat } from "./lib/api";

export default function App() {
  const [sessionId] = useState(() => crypto.randomUUID());
  const [input, setInput] = useState("");
  const [summary, setSummary] = useState("");
  const [movies, setMovies] = useState<UIMovie[]>([]);
  const [loading, setLoading] = useState(false);

  async function onSend() {
    if (!input) return;
    setLoading(true);
    try {
      const res = await chat(sessionId, input);
      setSummary(res.summary || "");
      setMovies(res.movies || []);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">MovieMate</h1>
      <div className="flex gap-2">
        <input className="flex-1 border rounded-xl px-3 py-2" placeholder="跟我聊电影……"
          value={input} onChange={e=>setInput(e.target.value)} />
        <button onClick={onSend} disabled={loading}
          className="px-4 py-2 rounded-xl bg-black text-white">{loading ? "…" : "发送"}</button>
      </div>
      {summary && <div className="text-sm text-gray-600">{summary}</div>}
      <div className="grid gap-3">
        {movies.map(m => <MovieCard key={m.id} m={m} />)}
      </div>
    </div>
  );
}
