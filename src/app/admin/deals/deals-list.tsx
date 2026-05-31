"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CardDeal } from "@/lib/types";
import { deleteDeal, setDealStatus } from "../actions";
import { formatPrice } from "@/lib/cards";

export type DealRow = CardDeal & { card_label: string };

type Tab = "reserved" | "done" | "all";
const TABS: { key: Tab; label: string }[] = [
  { key: "reserved", label: "예약중" },
  { key: "done", label: "완료" },
  { key: "all", label: "전체" },
];

function fmtWhen(iso: string | null) {
  return iso ? new Date(iso).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "";
}

export default function DealsList({ rows }: { rows: DealRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("reserved");

  const counts = useMemo(
    () => ({
      reserved: rows.filter((r) => r.status === "reserved").length,
      done: rows.filter((r) => r.status === "done").length,
      all: rows.length,
    }),
    [rows]
  );

  const list = useMemo(() => {
    const filtered = tab === "all" ? rows : rows.filter((r) => r.status === tab);
    // 예약중은 약속 임박 순(일시 빠른 순), 그 외는 최신순(서버 정렬 유지)
    if (tab === "reserved") {
      return [...filtered].sort((a, b) => {
        const ta = a.meet_at ? new Date(a.meet_at).getTime() : Infinity;
        const tb = b.meet_at ? new Date(b.meet_at).getTime() : Infinity;
        return ta - tb;
      });
    }
    return filtered;
  }, [rows, tab]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) => {
    setMsg(null);
    start(async () => {
      const res = await fn();
      if (res.ok) {
        setMsg(ok);
        router.refresh();
      } else setMsg(`실패: ${res.error}`);
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex w-fit rounded-lg border border-zinc-200 bg-white p-0.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                tab === t.key ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              {t.label}
              <span className="ml-1 text-xs opacity-70">{counts[t.key]}</span>
            </button>
          ))}
        </div>
        {msg && <span className="text-xs text-zinc-500">{msg}</span>}
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 py-12 text-center text-sm text-zinc-400">
          해당하는 거래가 없어요.
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {list.map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
            >
              <Link href={`/cards/${d.card_id}`} className="font-medium text-zinc-800 hover:underline">
                {d.card_label}
              </Link>
              <span
                className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                  d.direction === "out" ? "bg-sky-100 text-sky-700" : "bg-teal-100 text-teal-700"
                }`}
              >
                {d.direction === "out" ? "방출" : "영입"}
              </span>
              <span className="text-zinc-600">{d.kind === "sale" ? "판매" : "교환"}</span>
              {d.kind === "sale" && d.price != null && (
                <span className="font-medium">{formatPrice(d.price)}</span>
              )}
              {d.counterpart && <span className="text-zinc-500">· {d.counterpart}</span>}
              {d.meet_at && <span className="text-zinc-500">· {fmtWhen(d.meet_at)}</span>}
              {d.meet_place && <span className="text-zinc-500">· {d.meet_place}</span>}
              {d.memo && <span className="text-zinc-400">· {d.memo}</span>}
              <span
                className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  d.status === "done" ? "bg-zinc-200 text-zinc-600" : "bg-amber-100 text-amber-700"
                }`}
              >
                {d.status === "done" ? "완료" : "예약중"}
              </span>
              <button
                onClick={() =>
                  run(
                    () => setDealStatus(d.id, d.card_id, d.status === "done" ? "reserved" : "done"),
                    "변경됨"
                  )
                }
                disabled={pending}
                className="rounded-md px-2 py-1 text-xs font-medium text-zinc-700 ring-1 ring-zinc-300 hover:bg-zinc-100 disabled:opacity-50"
              >
                {d.status === "done" ? "예약중으로" : "완료"}
              </button>
              <button
                onClick={() => {
                  if (window.confirm("이 거래를 삭제할까요?")) run(() => deleteDeal(d.id, d.card_id), "삭제됨");
                }}
                disabled={pending}
                className="rounded-md px-2 py-1 text-xs text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50 disabled:opacity-50"
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-zinc-400">
        예약/거래 추가는 카드 상세의 “관리자 — 내 보유 / 거래”에서 합니다.
      </p>
    </div>
  );
}
