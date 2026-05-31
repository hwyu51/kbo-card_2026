"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCard } from "../actions";
import { formatPrice } from "@/lib/cards";

export type CardEditRow = {
  card_id: number;
  player_id: number;
  player_name: string;
  jersey_no: number | null;
  card_type_name: string;
  card_type_sort: number;
  is_special: boolean;
  default_price: number;
  price_override: number | null;
  memo: string;
};

export default function CardsEditor({ rows }: { rows: CardEditRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const [price, setPrice] = useState<Record<number, string>>(
    Object.fromEntries(rows.map((r) => [r.card_id, r.price_override == null ? "" : String(r.price_override)]))
  );
  const [memo, setMemo] = useState<Record<number, string>>(
    Object.fromEntries(rows.map((r) => [r.card_id, r.memo]))
  );

  const onSave = () => {
    setMsg(null);
    // 변경된 행만 저장
    const changed = rows.filter((r) => {
      const p = price[r.card_id] === "" ? null : Number(price[r.card_id]);
      return p !== r.price_override || (memo[r.card_id] ?? "") !== (r.memo ?? "");
    });
    if (changed.length === 0) {
      setMsg("변경 사항이 없어요.");
      return;
    }
    start(async () => {
      for (const r of changed) {
        const p = price[r.card_id] === "" ? null : Number(price[r.card_id]);
        const res = await updateCard(r.card_id, { price_override: p, memo: memo[r.card_id] || null });
        if (!res.ok) {
          setMsg(`저장 실패: ${res.error}`);
          return;
        }
      }
      setMsg(`${changed.length}건 저장됨`);
      router.refresh();
    });
  };

  if (rows.length === 0)
    return <p className="text-sm text-zinc-500">이 구단의 카드가 없어요.</p>;

  let lastPlayer = -1;
  return (
    <div className="flex flex-col gap-3">
      <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between border-b border-zinc-200 bg-zinc-50/95 px-4 py-2 backdrop-blur">
        <span className="text-sm text-zinc-500">개별 가격 · 메모</span>
        <div className="flex items-center gap-3">
          {msg && <span className="text-xs text-zinc-500">{msg}</span>}
          <button
            onClick={onSave}
            disabled={pending}
            className="rounded-lg bg-zinc-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            {pending ? "저장 중…" : "저장"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-zinc-100 text-xs text-zinc-500">
              <th className="border border-zinc-200 px-2 py-1.5 text-left">선수</th>
              <th className="border border-zinc-200 px-2 py-1.5 text-left">종류</th>
              <th className="border border-zinc-200 px-2 py-1.5 text-left">개별가격(원)</th>
              <th className="border border-zinc-200 px-2 py-1.5 text-left">메모(공개)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const first = r.player_id !== lastPlayer;
              lastPlayer = r.player_id;
              return (
                <tr key={r.card_id} className={first ? "border-t-2 border-t-zinc-300" : ""}>
                  <td className="border border-zinc-200 px-2 py-1 whitespace-nowrap">
                    {first ? (
                      <span className="font-medium">
                        {r.player_name}
                        {r.jersey_no != null && <span className="ml-1 text-xs text-zinc-400">#{r.jersey_no}</span>}
                      </span>
                    ) : (
                      <span className="text-zinc-300">〃</span>
                    )}
                  </td>
                  <td className="border border-zinc-200 px-2 py-1 whitespace-nowrap">
                    {r.card_type_name}
                    {r.is_special && <span className="ml-1 text-[10px] text-violet-600">레전드</span>}
                  </td>
                  <td className="border border-zinc-200 p-0">
                    <input
                      type="number"
                      min={0}
                      value={price[r.card_id]}
                      placeholder={`기본 ${formatPrice(r.default_price)}`}
                      onChange={(e) => setPrice((p) => ({ ...p, [r.card_id]: e.target.value }))}
                      className="h-8 w-full bg-transparent px-2 outline-none focus:bg-sky-50"
                    />
                  </td>
                  <td className="border border-zinc-200 p-0">
                    <input
                      type="text"
                      value={memo[r.card_id]}
                      onChange={(e) => setMemo((m) => ({ ...m, [r.card_id]: e.target.value }))}
                      className="h-8 w-full min-w-[160px] bg-transparent px-2 outline-none focus:bg-sky-50"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
