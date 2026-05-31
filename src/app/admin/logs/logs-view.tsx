"use client";

import { useState } from "react";

export type LogEntry = {
  id: number;
  table_label: string;
  action: string;
  target: string;
  changes: Record<string, unknown> | null;
};
export type LogGroup = {
  key: string;
  changed_at: string;
  actor: string;
  entries: LogEntry[];
};

const ACTION: Record<string, { text: string; cls: string }> = {
  insert: { text: "등록", cls: "bg-emerald-100 text-emerald-700" },
  update: { text: "수정", cls: "bg-sky-100 text-sky-700" },
  delete: { text: "삭제", cls: "bg-rose-100 text-rose-700" },
};
const FIELD: Record<string, string> = {
  qty_total: "보유",
  qty_keep: "소장",
  is_wanted: "희망",
  status: "상태",
  kind: "유형",
  direction: "방향",
  price: "가격",
  counterpart: "상대",
  meet_at: "일시",
  meet_place: "장소",
  memo: "메모",
  price_override: "개별가격",
  default_price: "기본가격",
};
const VAL: Record<string, string> = {
  reserved: "예약중",
  done: "완료",
  sale: "판매",
  trade: "교환",
  out: "방출",
  in: "영입",
  true: "ON",
  false: "OFF",
};

function fmtVal(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  const s = String(v);
  return VAL[s] ?? s;
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
}

export default function LogsView({ groups }: { groups: LogGroup[] }) {
  const [open, setOpen] = useState<LogGroup | null>(null);

  if (groups.length === 0)
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-400">
        아직 기록된 변경이 없어요. (보유/거래/카드 수정 시 자동 기록)
      </div>
    );

  return (
    <>
      <ol className="flex flex-col gap-2">
        {groups.map((g) => {
          const head = g.entries[0];
          const act = ACTION[head.action] ?? { text: head.action, cls: "bg-zinc-100 text-zinc-600" };
          return (
            <li key={g.key}>
              <button
                onClick={() => setOpen(g)}
                className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-white p-3 text-left text-sm hover:border-zinc-300 hover:shadow-sm"
              >
                <span className="font-medium text-zinc-700">{g.actor}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${act.cls}`}>{act.text}</span>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">{head.table_label}</span>
                <span className="truncate">{head.target}</span>
                {g.entries.length > 1 && (
                  <span className="text-xs text-zinc-400">외 {g.entries.length - 1}건</span>
                )}
                <span className="ml-auto text-xs text-zinc-400">{fmtTime(g.changed_at)}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          onClick={() => setOpen(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="font-bold">{open.actor}</div>
                <div className="text-xs text-zinc-400">
                  {fmtTime(open.changed_at)} · {open.entries.length}건
                </div>
              </div>
              <button onClick={() => setOpen(null)} className="rounded-lg px-3 py-1 text-sm text-zinc-500 hover:bg-zinc-100">
                닫기
              </button>
            </div>

            <ul className="flex flex-col gap-2">
              {open.entries.map((e) => {
                const act = ACTION[e.action] ?? { text: e.action, cls: "bg-zinc-100 text-zinc-600" };
                const isUpdate = e.action === "update" && e.changes;
                return (
                  <li key={e.id} className="rounded-lg border border-zinc-200 p-2.5 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${act.cls}`}>{act.text}</span>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">{e.table_label}</span>
                      <span className="font-medium">{e.target}</span>
                    </div>
                    {isUpdate && (
                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-600">
                        {Object.entries(e.changes as Record<string, { old: unknown; new: unknown }>).map(
                          ([f, ch]) => (
                            <span key={f}>
                              <b className="text-zinc-500">{FIELD[f] ?? f}</b> {fmtVal(ch?.old)} →{" "}
                              <span className="text-zinc-900">{fmtVal(ch?.new)}</span>
                            </span>
                          )
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
