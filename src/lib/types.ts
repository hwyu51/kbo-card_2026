// 공개 뷰(public_cards) 한 행 — 내부 필드(qty_completed/wanted_by/updated_by) 없음
export type PublicCard = {
  id: number;
  team_id: number;
  team_name: string;
  team_slug: string;
  player_id: number | null;
  player_name: string | null;
  card_type_id: number;
  card_type_name: string;
  card_type_code: string;
  card_number: string | null;
  variant: string | null;
  title: string | null;
  image_url: string | null;
  price: number;
  qty_available: number;
  qty_reserved: number;
  qty_owned: number; // 가능 + 예약
  is_wanted: boolean;
  memo: string | null;
  created_at: string;
};

export type Team = {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
};

export type CardType = {
  id: number;
  code: string;
  name: string;
  default_price: number;
  sort_order: number;
};

// 어드민 전용: cards 원본 테이블 (내부 필드 포함)
export type AdminCard = Omit<
  PublicCard,
  "team_name" | "team_slug" | "player_name" | "card_type_name" | "card_type_code" | "qty_owned" | "price"
> & {
  price_override: number | null;
  qty_completed: number;
  wanted_by: string | null;
  updated_by: string | null;
  updated_at: string;
};
