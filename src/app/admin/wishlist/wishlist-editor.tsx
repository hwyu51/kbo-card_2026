"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PlayerGroup } from "@/lib/admin-catalog";
import { saveHoldings, type HoldingRow } from "../actions";

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

  // 보유/소장은 보존, 희망만 토글. 보유 중(total>0)인 카드는 희망 대상에서 제외.
  const base = useMemo(() => {
    const hold: Record<number, { total: number; keep: number }> = {};
    const wanted: Record<number, boolean> = {};
    const held = new Set<number>();
    for (const g of groups)
      for (const c of g.cards) {
        hold[c.card_id] = { total: c.qty_total, keep: c.qty_keep };
        const isHeld = c.qty_total > 0;
        if (isHeld) held.add(c.card_id);
        wanted[c.card_id] = isHeld ? false : c.is_wanted; // 보유 중이면 희망 OFF로 간주
      }
    return { hold, wanted, held };
  }, [groups]);

  const [wanted, setWanted] = useState<Record<number, boolean>>(base.wanted);

  const allIds = useMemo(() => groups.flatMap((g) => g.cards.map((c) => c.card_id)), [groups]);
  // 보유 중인 카드는 희망 일괄 토글에서 제외
  const wishableIds = useMemo(() => allIds.filter((id) => !base.held.has(id)), [allIds, base.held]);
  const allOn = wishableIds.length > 0 && wishableIds.every((id) => wanted[id]);

  const toggle = (id: number) => {
    if (base.held.has(id)) return; // 보유 중 → 희망 불가
    setWanted((p) => ({ ...p, [id]: !p[id] }));
  };
  const setAll = (val: boolean) =>
    setWanted((p) => ({ ...p, ...Object.fromEntries(wishableIds.map((id) => [id, val])) }));

  const onSave = () => {
    // 희망 상태가 바뀐 카드만 저장 (보유/소장은 보존, 빈 행 양산 방지)
    const rows: HoldingRow[] = wishableIds
      .filter((id) => !!wanted[id] !== !!base.wanted[id])
      .map((id) => ({
        card_id: id,
        qty_total: base.hold[id]?.total ?? 0,
        qty_keep: base.hold[id]?.keep ?? 0,
        is_wanted: !!wanted[id],
      }));
    if (rows.length === 0) {
      setMsg("변경 사항이 없어요.");
      return;
    }
    setMsg(null);
    start(async () => {
      const res = await saveHoldings(rows);
      if (res.ok) {
        setMsg("저장됐어요.");
        router.refresh();
      } else setMsg(`저장 실패: ${res.error}`);
    });
  };

  if (groups.length === 0)
    return <p className="text-sm text-zinc-500">이 구단의 카탈로그가 비어 있어요.</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50/95 px-4 py-2 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-500">{teamName}</span>
          <button
            onClick={() => setAll(!allOn)}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-700 ring-1 ring-zinc-300 hover:bg-zinc-100"
          >
            {allOn ? "구단 전체 해제" : "구단 전체 희망"}
          </button>
        </div>
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
              {g.cards.map((c) => {
                const held = base.held.has(c.card_id);
                return (
                  <button
                    key={c.card_id}
                    onClick={() => toggle(c.card_id)}
                    disabled={held}
                    title={held ? "보유 중인 카드는 희망에 넣을 수 없어요" : undefined}
                    className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition ${
                      held
                        ? "cursor-not-allowed bg-zinc-100 text-zinc-400 ring-zinc-200"
                        : wanted[c.card_id]
                          ? "bg-rose-500 text-white ring-rose-500"
                          : "bg-white text-zinc-600 ring-zinc-300 hover:bg-zinc-100"
                    }`}
                  >
                    {held ? "보유중" : wanted[c.card_id] ? "♥" : "♡"} {c.card_type_name}
                    {c.is_special && <span className="opacity-70">·레전드</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
