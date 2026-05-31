import type { PublicCard } from "./types";

// 표시용 상태 (파생)
export type CardStatus = "available" | "reserved" | "none";

export function cardStatus(c: Pick<PublicCard, "qty_available" | "qty_reserved">): CardStatus {
  if (c.qty_available > 0) return "available";
  if (c.qty_reserved > 0) return "reserved";
  return "none";
}

export function statusLabel(c: Pick<PublicCard, "qty_available" | "qty_reserved">): string {
  const s = cardStatus(c);
  if (s === "available") {
    return c.qty_reserved > 0 ? `보유 (예약 ${c.qty_reserved})` : "보유";
  }
  if (s === "reserved") return "예약중";
  return "미보유";
}

export function statusColor(c: Pick<PublicCard, "qty_available" | "qty_reserved">): string {
  const s = cardStatus(c);
  if (s === "available") return "bg-emerald-100 text-emerald-700";
  if (s === "reserved") return "bg-amber-100 text-amber-700";
  return "bg-zinc-100 text-zinc-500";
}

// 0(또는 음수) = 가격 미정 → "가격문의" (예: 친필사인/오토)
export function formatPrice(won: number): string {
  if (won <= 0) return "가격문의";
  return `${won.toLocaleString("ko-KR")}원`;
}

// 카드 표시명: title 있으면 사용, 없으면 선수명 + 종류
export function cardDisplayName(c: Pick<PublicCard, "title" | "player_name" | "card_type_name">): string {
  if (c.title) return c.title;
  const player = c.player_name ?? "";
  return `${player} ${c.card_type_name}`.trim();
}
