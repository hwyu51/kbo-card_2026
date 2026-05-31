import { createClient } from "@/lib/supabase/server";

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

const FIELD_LABEL: Record<string, string> = {
  qty_available: "가능",
  qty_reserved: "예약",
  qty_completed: "완료",
  is_wanted: "희망",
  price_override: "개별가격",
  default_price: "기본가격",
  image_url: "이미지",
  memo: "메모",
  title: "표시명",
  variant: "부가구분",
  card_number: "카드번호",
};

const TABLE_LABEL: Record<string, string> = {
  card_holdings: "보유/희망",
  cards: "카탈로그",
  card_types: "가격설정",
};

const ACTION_LABEL: Record<string, { text: string; cls: string }> = {
  insert: { text: "등록", cls: "bg-emerald-100 text-emerald-700" },
  update: { text: "수정", cls: "bg-sky-100 text-sky-700" },
  delete: { text: "삭제", cls: "bg-rose-100 text-rose-700" },
};

function fmtVal(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "ON" : "OFF";
  return String(v);
}

export default async function LogsPage() {
  const supabase = await createClient();

  const { data: logsData, error } = await supabase
    .from("audit_log")
    .select("id, table_name, card_id, action, actor, changes, changed_at")
    .order("changed_at", { ascending: false })
    .limit(100);

  const logs = (logsData ?? []) as AuditRow[];

  // 카드명 매핑 (public_cards: id → 선수/종류/구단)
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

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">수정 로그</h1>
        <span className="text-sm text-zinc-400">최근 {logs.length}건</span>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          로그를 불러오지 못했어요. <code>audit_log</code> 테이블이 아직 없으면 schema.sql 실행 후 표시됩니다.
        </div>
      )}

      {logs.length === 0 && !error && (
        <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-400">
          아직 기록된 변경이 없어요. (보유/희망/카드 수정 시 자동 기록)
        </div>
      )}

      <ol className="flex flex-col gap-2">
        {logs.map((l) => {
          const act = ACTION_LABEL[l.action] ?? { text: l.action, cls: "bg-zinc-100 text-zinc-600" };
          const target = l.card_id != null ? cardName.get(l.card_id) ?? `카드 #${l.card_id}` : TABLE_LABEL[l.table_name] ?? l.table_name;
          const isUpdate = l.action === "update" && l.changes;
          return (
            <li key={l.id} className="rounded-xl border border-zinc-200 bg-white p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${act.cls}`}>
                  {act.text}
                </span>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
                  {TABLE_LABEL[l.table_name] ?? l.table_name}
                </span>
                <span className="font-medium">{target}</span>
                <span className="ml-auto text-xs text-zinc-400">
                  {fmtTime(l.changed_at)}
                  {l.actor ? ` · ${l.actor.slice(0, 8)}` : ""}
                </span>
              </div>

              {isUpdate && (
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600">
                  {Object.entries(l.changes as Record<string, { old: unknown; new: unknown }>).map(
                    ([field, ch]) => (
                      <span key={field}>
                        <b className="text-zinc-500">{FIELD_LABEL[field] ?? field}</b>{" "}
                        {fmtVal(ch?.old)} → <span className="text-zinc-900">{fmtVal(ch?.new)}</span>
                      </span>
                    )
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <p className="text-xs text-zinc-400">
        ※ 행위자는 현재 계정 ID 일부만 표시됩니다(이름 매핑은 추후 추가).
      </p>
    </div>
  );
}
