import { createClient } from "@/lib/supabase/server";
import LogsView, { type LogGroup } from "./logs-view";

export const dynamic = "force-dynamic";

type AuditRow = {
  id: number;
  table_name: string;
  card_id: number | null;
  action: string;
  actor: string | null;
  changes: Record<string, unknown> | null;
  changed_at: string;
};

const TABLE_LABEL: Record<string, string> = {
  card_holdings: "보유",
  card_deals: "거래",
  cards: "카탈로그",
  card_types: "가격설정",
};

export default async function LogsPage() {
  const supabase = await createClient();

  const { data: logsData, error } = await supabase
    .from("audit_log")
    .select("id, table_name, card_id, action, actor, changes, changed_at")
    .order("changed_at", { ascending: false })
    .limit(300);
  const logs = (logsData ?? []) as AuditRow[];

  // 행위자 이름
  const { data: profs } = await supabase.from("admin_profiles").select("id, display_name");
  const nameOf = new Map<string, string>();
  for (const p of profs ?? []) nameOf.set(p.id as string, (p.display_name as string) ?? "");

  // 카드명
  const cardIds = [...new Set(logs.map((l) => l.card_id).filter((x): x is number => x != null))];
  const cardName = new Map<number, string>();
  if (cardIds.length) {
    const { data: cards } = await supabase
      .from("public_cards")
      .select("id, team_name, player_name, card_type_name")
      .in("id", cardIds);
    for (const c of cards ?? [])
      cardName.set(
        c.id as number,
        `${c.team_name} ${c.player_name ?? ""} ${c.card_type_name}`.replace(/\s+/g, " ").trim()
      );
  }

  // 같은 행위자 + 같은 시각(초)으로 묶기
  const groupsMap = new Map<string, LogGroup>();
  for (const l of logs) {
    const key = `${l.actor ?? "?"}__${l.changed_at.slice(0, 19)}`;
    if (!groupsMap.has(key)) {
      groupsMap.set(key, {
        key,
        changed_at: l.changed_at,
        actor: l.actor ? nameOf.get(l.actor) || `${l.actor.slice(0, 8)}…` : "—",
        entries: [],
      });
    }
    groupsMap.get(key)!.entries.push({
      id: l.id,
      table_label: TABLE_LABEL[l.table_name] ?? l.table_name,
      action: l.action,
      target: l.card_id != null ? cardName.get(l.card_id) ?? `카드 #${l.card_id}` : TABLE_LABEL[l.table_name] ?? l.table_name,
      changes: l.changes,
    });
  }
  const groups = [...groupsMap.values()];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">수정 로그</h1>
        <span className="text-sm text-zinc-400">최근 {groups.length}묶음</span>
      </div>
      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          로그를 불러오지 못했어요. schema.sql 실행 후 표시됩니다.
        </div>
      )}
      <LogsView groups={groups} />
    </div>
  );
}
