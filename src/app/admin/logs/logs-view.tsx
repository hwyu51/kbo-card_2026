"use client";

import { useMemo, useState } from "react";
import { actionInfo, describeChanges, fmtTime, fmtVal } from "@/lib/audit";

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

const ACTION_FILTERS: { key: string; label: string }[] = [
  { key: "", label: "전체 액션" },
  { key: "insert", label: "등록" },
  { key: "update", label: "수정" },
  { key: "delete", label: "삭제" },
];

export default function LogsView({ groups }: { groups: LogGroup[] }) {
  const [open, setOpen] = useState<LogGroup | null>(null);
  const [action, setAction] = useState("");
  const [table, setTable] = useState("");
  const [actor, setActor] = useState("");
  const [q, setQ] = useState("");

  // 필터 옵션 (데이터에서 추출)
  const { tables, actors } = useMemo(() => {
    const tSet = new Set<string>();
    const aSet = new Set<string>();
    for (const g of groups) {
      aSet.add(g.actor);
      for (const e of g.entries) tSet.add(e.table_label);
    }
    return { tables: [...tSet].sort(), actors: [...aSet].sort() };
  }, [groups]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return groups
      .filter((g) => !actor || g.actor === actor)
      .map((g) => ({
        ...g,
        // 그룹 내에서도 조건에 맞는 항목만 남김
        entries: g.entries.filter(
          (e) =>
            (!action || e.action === action) &&
            (!table || e.table_label === table) &&
            (!needle || e.target.toLowerCase().includes(needle))
        ),
      }))
      .filter((g) => g.entries.length > 0);
  }, [groups, action, table, actor, q]);

  const hasFilter = action || table || actor || q;

  return (
    <>
      {/* 필터 바 */}
      <div className="flex flex-wrap gap-2">
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm"
        >
          {ACTION_FILTERS.map((a) => (
            <option key={a.key} value={a.key}>
              {a.label}
            </option>
          ))}
        </select>
        <select
          value={table}
          onChange={(e) => setTable(e.target.value)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm"
        >
          <option value="">전체 대상</option>
          {tables.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={actor}
          onChange={(e) => setActor(e.target.value)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm"
        >
          <option value="">전체 행위자</option>
          {actors.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="카드·선수 검색"
          className="flex-1 min-w-[140px] rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm"
        />
        {hasFilter && (
          <button
            onClick={() => {
              setAction("");
              setTable("");
              setActor("");
              setQ("");
            }}
            className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 ring-1 ring-zinc-200 hover:bg-zinc-100"
          >
            초기화
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-400">
          {hasFilter ? "조건에 맞는 기록이 없어요." : "아직 기록된 변경이 없어요. (보유/거래/카드 수정 시 자동 기록)"}
        </div>
      ) : (
        <ol className="mt-3 flex flex-col gap-2">
          {filtered.map((g) => {
            const head = g.entries[0];
            const act = actionInfo(head.action);
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
      )}

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
                const act = actionInfo(e.action);
                const changes = e.action === "update" ? describeChanges(e.changes) : [];
                return (
                  <li key={e.id} className="rounded-lg border border-zinc-200 p-2.5 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${act.cls}`}>{act.text}</span>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">{e.table_label}</span>
                      <span className="font-medium">{e.target}</span>
                    </div>
                    {changes.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-600">
                        {changes.map((ch) => (
                          <span key={ch.field}>
                            <b className="text-zinc-500">{ch.label}</b> {fmtVal(ch.old)} →{" "}
                            <span className="text-zinc-900">{fmtVal(ch.new)}</span>
                          </span>
                        ))}
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
