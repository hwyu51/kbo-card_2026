// 감사 로그(audit_log) 표시용 라벨/포맷 — 수정 로그 화면 & 카드별 변경 이력에서 공용 사용

export const TABLE_LABEL: Record<string, string> = {
  card_holdings: "보유",
  card_deals: "거래",
  cards: "카탈로그",
  card_types: "가격설정",
};

export const ACTION: Record<string, { text: string; cls: string }> = {
  insert: { text: "등록", cls: "bg-emerald-100 text-emerald-700" },
  update: { text: "수정", cls: "bg-sky-100 text-sky-700" },
  delete: { text: "삭제", cls: "bg-rose-100 text-rose-700" },
};

export function actionInfo(action: string) {
  return ACTION[action] ?? { text: action, cls: "bg-zinc-100 text-zinc-600" };
}

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
  name: "이름",
  card_number: "카드번호",
  variant: "부가구분",
  title: "표시명",
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

export function fieldLabel(f: string): string {
  return FIELD[f] ?? f;
}

export function fmtVal(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  const s = String(v);
  return VAL[s] ?? s;
}

export type FieldChange = { field: string; label: string; old: unknown; new: unknown };

// update 변경분(jsonb {필드:{old,new}})을 표시용 배열로
export function describeChanges(changes: Record<string, unknown> | null): FieldChange[] {
  if (!changes) return [];
  const out: FieldChange[] = [];
  for (const [f, ch] of Object.entries(changes)) {
    const c = ch as { old?: unknown; new?: unknown } | null;
    if (!c || typeof c !== "object" || !("old" in c || "new" in c)) continue;
    out.push({ field: f, label: fieldLabel(f), old: c.old ?? null, new: c.new ?? null });
  }
  return out;
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
}
