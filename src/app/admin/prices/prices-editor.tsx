"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CardType } from "@/lib/types";
import { updateCardTypePrices } from "../actions";

export default function PricesEditor({ cardTypes }: { cardTypes: CardType[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<number, number>>(
    Object.fromEntries(cardTypes.map((c) => [c.id, c.default_price]))
  );

  const onSave = () => {
    setMsg(null);
    const rows = cardTypes.map((c) => ({ id: c.id, default_price: prices[c.id] ?? 0 }));
    start(async () => {
      const res = await updateCardTypePrices(rows);
      setMsg(res.ok ? "저장됐어요." : `저장 실패: ${res.error}`);
      if (res.ok) router.refresh();
    });
  };

  return (
    <div className="flex max-w-md flex-col gap-3">
      {cardTypes.map((c) => (
        <div key={c.id} className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-3">
          <span className="font-medium">{c.name}</span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              step={500}
              value={prices[c.id] === 0 ? "" : prices[c.id]}
              placeholder="0"
              onChange={(e) =>
                setPrices((p) => ({ ...p, [c.id]: Math.max(0, Math.floor(Number(e.target.value) || 0)) }))
              }
              className="w-28 rounded-md border border-zinc-300 px-2 py-1 text-right text-sm"
            />
            <span className="text-sm text-zinc-400">원</span>
          </div>
        </div>
      ))}

      <p className="text-xs text-zinc-400">
        0원으로 두면 공개 페이지에 “가격문의”로 표시됩니다. 개별 가격이 지정된 카드는 영향받지 않아요.
      </p>

      <div className="flex items-center gap-3">
        <button
          onClick={onSave}
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {pending ? "저장 중…" : "저장"}
        </button>
        {msg && <span className="text-sm text-zinc-500">{msg}</span>}
      </div>
    </div>
  );
}
