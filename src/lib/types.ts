// 공개 뷰(public_cards) 한 행 — owner 합산, 내부 필드(완료수량/owner) 제외
export type PublicCard = {
  id: number;
  team_id: number;
  team_name: string;
  team_slug: string;
  player_id: number | null;
  player_name: string | null;
  position: string | null;
  jersey_no: number | null;
  card_type_id: number;
  card_type_name: string;
  card_type_code: string;
  card_number: string | null;
  variant: string | null;
  title: string | null;
  image_url: string | null;
  is_special: boolean;
  price: number;
  qty_available: number;
  qty_reserved: number;
  qty_owned: number; // 가능 + 예약 (owner 합산)
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

// cards 원본(카탈로그) — 어드민
export type CardCatalog = {
  id: number;
  player_id: number | null;
  team_id: number;
  card_type_id: number;
  card_number: string | null;
  variant: string | null;
  title: string | null;
  image_url: string | null;
  price_override: number | null;
  is_special: boolean;
  memo: string | null;
  created_at: string;
  updated_at: string;
};

// 유저별 보유/희망
export type CardHolding = {
  card_id: number;
  owner_id: string;
  qty_available: number;
  qty_reserved: number;
  qty_completed: number;
  is_wanted: boolean;
  updated_at: string;
};

export type Player = {
  id: number;
  team_id: number;
  name: string;
  position: string | null;
  jersey_no: number | null;
};
