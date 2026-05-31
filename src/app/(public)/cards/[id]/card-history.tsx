import { actionInfo, describeChanges, fmtTime, fmtVal } from "@/lib/audit";

export type HistoryEntry = {
  id: number;
  table_label: string;
  action: string;
  actor: string;
  changes: Record<string, unknown> | null;
  changed_at: string;
};

// 카드 상세(어드민) — 이 카드의 변경 이력 (audit_log에서 card_id 기준)
export default function CardHistory({ entries }: { entries: HistoryEntry[] }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5">
      <h2 className="mb-3 font-bold">이 카드 변경 이력</h2>
      {entries.length === 0 ? (
        <p className="text-sm text-zinc-400">아직 변경 이력이 없어요.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((e) => {
            const act = actionInfo(e.action);
            const changes = e.action === "update" ? describeChanges(e.changes) : [];
            return (
              <li key={e.id} className="rounded-lg border border-zinc-200 p-2.5 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${act.cls}`}>{act.text}</span>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">{e.table_label}</span>
                  <span className="font-medium text-zinc-700">{e.actor}</span>
                  <span className="ml-auto text-xs text-zinc-400">{fmtTime(e.changed_at)}</span>
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
      )}
    </div>
  );
}
