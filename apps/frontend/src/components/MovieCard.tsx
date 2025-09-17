export type UIMovie = {
    id:number; title:string; year?:string; poster?:string|null;
    vote_average?:number; reason?:string; why_for_user?:string;
  };
  
  export default function MovieCard({ m }: { m: UIMovie }) {
    return (
      <div className="rounded-2xl shadow p-4 flex gap-4 bg-white">
        {m.poster
          ? <img src={m.poster} alt={m.title} className="w-24 h-36 object-cover rounded-xl" />
          : <div className="w-24 h-36 bg-gray-100 rounded-xl" />}
        <div className="flex-1">
          <div className="text-lg font-semibold">
            {m.title} <span className="text-gray-500">{m.year || ""}</span>
          </div>
          <div className="text-sm text-gray-600">评分：{m.vote_average ?? "N/A"}</div>
          {m.reason && <div className="mt-2 text-sm">理由：{m.reason}</div>}
          {m.why_for_user && <div className="text-xs text-gray-500">适配：{m.why_for_user}</div>}
          <button className="mt-3 px-3 py-1 rounded-xl bg-black text-white text-sm">⭐ 收藏</button>
        </div>
      </div>
    );
  }
  