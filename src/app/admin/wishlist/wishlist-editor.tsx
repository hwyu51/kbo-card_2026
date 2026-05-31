"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PlayerGroup } from "@/lib/admin-catalog";
import { saveHoldings, type HoldingRow } from "../actions";

type Qty = { a: number; r: number; c: number };

export default function WishlistEditor({
  teamName,
  groups,
}: {
  teamName: string;
  groups: PlayerGroup[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  // 보존용 수량 + 초기 희망값
  const base = useMemo(() => {
    const qty: Record<number, Qty> = {};
    const wanted: Record<number, boolean> = {};
    for (const g of groups)
      for (const c of g.cards) {
        qty[c.card_id] = { a: c.qty_available, r: c.qty_reserved, c: c.qty_completed };
        wanted[c.card_id] = c.is_wanted;
      }
    return { qty, wanted };
  }, [groups]);

  const [wanted, setWanted] = useState<Record<number, boolean>>(base.wanted);

  const allIds = useMemo(() => groups.flatMap((g) => g.cards.map((c) => c.card_id)), [groups]);
  const allOn = allIds.length > 0 && allIds.every((id) => wanted[id]);

  const toggle = (id: number) => setWanted((p) => ({ ...p, [id]: !p[id] }));
  const setAll = (val: boolean) =>
    setWanted(() => Object.fromEntries(allIds.map((id) => [id, val])));

  const onSave = () => {
    setMsg(null);
    const rows: HoldingRow[] = allIds.map((id) => ({
      card_id: id,
      qty_available: base.qty[id]?.a ?? 0,
      qty_reserved: base.qty[id]?.r ?? 0,
      qty_completed: base.qty[id]?.c ?? 0,
      is_wanted: !!wanted[id],
    }));
    start(async () => {
      const res = await saveHoldings(rows);
      if (res.ok) {
        setMsg("저장됐어요.");
        router.refresh();
      } else {
        setMsg(`저장 실패: ${res.error}`);
      }
    });
  };

  if (groups.length === 0) {
    return <p className="text-sm text-zinc-500">이 구단의 카탈로그가 비어 있어요.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between border-b border-zinc-200 bg-zinc-50/95 px-4 py-2 backdrop-blur">
        <button
          onClick={() => setAll(!allOn)}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-700 ring-1 ring-zinc-300 hover:bg-zinc-100"
        >
          {allOn ? "구단 전체 해제" : "구단 전체 희망"}
        </button>
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

      <div className="flex flex-col gap-3">
        {groups.map((g) => (
          <div key={g.player_id ?? g.player_name} className="rounded-xl border border-zinc-200 bg-white p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="font-semibold">{g.player_name}</span>
              {g.jersey_no != null && <span className="text-xs text-zinc-400">#{g.jersey_no}</span>}
              {g.position && <span className="text-xs text-zinc-400">{g.position}</span>}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {g.cards.map((c) => (
                <button
                  key={c.card_id}
                  onClick={() => toggle(c.card_id)}
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition ${
                    wanted[c.card_id]
                      ? "bg-rose-500 text-white ring-rose-500"
                      : "bg-white text-zinc-600 ring-zinc-300 hover:bg-zinc-100"
                  }`}
                >
                  {wanted[c.card_id] ? "♥" : "♡"} {c.card_type_name}
                  {c.is_special && <span className="opacity-70">·레전드</span>}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
