"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PlayerGroup } from "@/lib/admin-catalog";
import { saveHoldings, type HoldingRow } from "../actions";

type Qty = { a: number; r: number; c: number };

export default function HoldingsEditor({
  teamName,
  groups,
}: {
  teamName: string;
  groups: PlayerGroup[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  // card_id → 수량 상태 / card_id → is_wanted (보존용)
  const initial = useMemo(() => {
    const q: Record<number, Qty> = {};
    const wanted: Record<number, boolean> = {};
    for (const g of groups)
      for (const c of g.cards) {
        q[c.card_id] = { a: c.qty_available, r: c.qty_reserved, c: c.qty_completed };
        wanted[c.card_id] = c.is_wanted;
      }
    return { q, wanted };
  }, [groups]);

  const [qty, setQty] = useState<Record<number, Qty>>(initial.q);

  const set = (id: number, key: keyof Qty, value: string) => {
    const n = Math.max(0, Math.floor(Number(value) || 0));
    setQty((prev) => ({ ...prev, [id]: { ...prev[id], [key]: n } }));
  };

  const onSave = () => {
    setMsg(null);
    const rows: HoldingRow[] = Object.entries(qty).map(([id, v]) => ({
      card_id: Number(id),
      qty_available: v.a,
      qty_reserved: v.r,
      qty_completed: v.c,
      is_wanted: initial.wanted[Number(id)] ?? false, // 희망값 보존
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
        <span className="text-sm text-zinc-500">{teamName} · 가능/예약/완료 수량 입력</span>
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

            <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5">
              {g.cards.map((c) => {
                const v = qty[c.card_id];
                return (
                  <div key={c.card_id} className="contents">
                    <div className="flex items-center gap-1.5 text-sm">
                      <span>{c.card_type_name}</span>
                      {c.is_special && (
                        <span className="rounded bg-violet-100 px-1.5 text-[10px] font-medium text-violet-700">
                          레전드
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <NumCell label="가능" value={v.a} onChange={(x) => set(c.card_id, "a", x)} />
                      <NumCell label="예약" value={v.r} onChange={(x) => set(c.card_id, "r", x)} />
                      <NumCell label="완료" value={v.c} onChange={(x) => set(c.card_id, "c", x)} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NumCell({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col items-center">
      <span className="text-[10px] text-zinc-400">{label}</span>
      <input
        type="number"
        min={0}
        inputMode="numeric"
        value={value === 0 ? "" : value}
        placeholder="0"
        onChange={(e) => onChange(e.target.value)}
        className="w-12 rounded-md border border-zinc-300 px-1 py-1 text-center text-sm"
      />
    </label>
  );
}
