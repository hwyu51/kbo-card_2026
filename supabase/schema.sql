-- =====================================================================
-- KBO 카드 교환/판매 관리 사이트 — Supabase 스키마 초안
-- 실행: Supabase SQL Editor 또는 supabase db push
-- =====================================================================

-- ---------- 1. 구단 ----------
create table if not exists teams (
  id    bigint generated always as identity primary key,
  name  text not null unique,          -- 예: 'LG 트윈스'
  slug  text not null unique,          -- 예: 'lg'
  logo_url text
);

-- ---------- 2. 선수 (※ 선수 실명 노출 OK — 카드 주인공) ----------
create table if not exists players (
  id      bigint generated always as identity primary key,
  team_id bigint not null references teams(id) on delete cascade,
  name    text not null
);
create index if not exists idx_players_team on players(team_id);

-- ---------- 3. 카드 종류 + 글로벌 기본 가격 ----------
create table if not exists card_types (
  id            bigint generated always as identity primary key,
  code          text not null unique,    -- normal_home / normal_away / alphabet / holo / parallel / charm / special / auto
  name          text not null,           -- 노멀(홈) / 노멀(어웨이) / 알파벳 / 홀로 / 패러렐 / 승리부적 / 스페셜 / 친필사인
  default_price integer not null default 0,  -- 글로벌 기본 가격(원)
  sort_order    integer not null default 0
);

-- ---------- 4. 카드 카탈로그 + 보유현황 ----------
create table if not exists cards (
  id             bigint generated always as identity primary key,
  player_id      bigint references players(id) on delete set null,
  team_id        bigint not null references teams(id) on delete cascade,
  card_type_id   bigint not null references card_types(id),
  card_number    text,                   -- 카드 번호/식별자
  variant        text,                   -- 부가 구분(예: 홈/어웨이, 알파벳 글자 등)
  title          text,                   -- 표시명
  image_url      text,

  price_override integer,                -- 개별 가격(없으면 종류 기본가 사용)

  -- 상태별 수량 (장마다 상태가 갈릴 수 있음)
  qty_available  integer not null default 0,  -- 판매/교환 가능
  qty_reserved   integer not null default 0,  -- 예약중
  qty_completed  integer not null default 0,  -- 완료(보유에서 빠짐, 공개 숨김)

  -- 희망(위시리스트)
  is_wanted      boolean not null default false,
  wanted_by      uuid references auth.users(id),  -- 내부용, 화면 비노출

  memo           text,
  updated_by     uuid references auth.users(id),  -- 내부 감사용, 화면 비노출
  updated_at     timestamptz not null default now(),

  constraint qty_nonneg check (qty_available >= 0 and qty_reserved >= 0 and qty_completed >= 0)
);
create index if not exists idx_cards_team on cards(team_id);
create index if not exists idx_cards_type on cards(card_type_id);
create index if not exists idx_cards_wanted on cards(is_wanted);

-- 표시가격 = 개별가 우선, 없으면 종류 기본가
-- 보유 총량 = 가능 + 예약 (완료는 제외)

-- ---------- 5. 공개용 뷰 (완료 수량/내부 필드 제외) ----------
create or replace view public_cards as
select
  c.id,
  c.team_id,
  t.name        as team_name,
  c.player_id,
  p.name        as player_name,
  ct.name       as card_type_name,
  ct.code       as card_type_code,
  c.card_number,
  c.variant,
  c.title,
  c.image_url,
  coalesce(c.price_override, ct.default_price) as price,
  c.qty_available,
  c.qty_reserved,
  (c.qty_available + c.qty_reserved) as qty_owned,   -- 보유 총량
  c.is_wanted,
  c.memo
from cards c
join teams t       on t.id = c.team_id
join card_types ct on ct.id = c.card_type_id
left join players p on p.id = c.player_id;
-- 공개 페이지는 이 뷰를 사용 (qty_completed / wanted_by / updated_by 노출 안 됨)

-- =====================================================================
-- RLS
-- =====================================================================
alter table teams       enable row level security;
alter table players     enable row level security;
alter table card_types  enable row level security;
alter table cards       enable row level security;

-- 읽기: 누구나(anon 포함)
create policy "public read teams"   on teams      for select using (true);
create policy "public read players" on players    for select using (true);
create policy "public read types"   on card_types for select using (true);
create policy "public read cards"   on cards      for select using (true);

-- 쓰기: 로그인한 어드민만
create policy "admin write teams"   on teams      for all to authenticated using (true) with check (true);
create policy "admin write players" on players    for all to authenticated using (true) with check (true);
create policy "admin write types"   on card_types for all to authenticated using (true) with check (true);
create policy "admin write cards"   on cards      for all to authenticated using (true) with check (true);

-- =====================================================================
-- 시드 데이터
-- =====================================================================

-- 10개 구단 (2026 KBO)
insert into teams (name, slug) values
  ('LG 트윈스','lg'), ('KT 위즈','kt'), ('SSG 랜더스','ssg'), ('NC 다이노스','nc'),
  ('두산 베어스','doosan'), ('KIA 타이거즈','kia'), ('롯데 자이언츠','lotte'),
  ('삼성 라이온즈','samsung'), ('한화 이글스','hanwha'), ('키움 히어로즈','kiwoom')
on conflict (name) do nothing;

-- 카드 종류 + 글로벌 기본 가격 (가격은 추후 어드민에서 조정)
insert into card_types (code, name, default_price, sort_order) values
  ('normal_home','노멀(홈)',      1000, 1),
  ('normal_away','노멀(어웨이)',  1000, 2),
  ('alphabet',   '알파벳',        1500, 3),
  ('holo',       '홀로',          3000, 4),
  ('parallel',   '패러렐',        5000, 5),
  ('charm',      '승리부적',      4000, 6),
  ('special',    '스페셜',        8000, 7),
  ('auto',       '친필사인',     30000, 8)
on conflict (code) do nothing;

-- TODO: players / cards 카탈로그는 공식 체크리스트 확보 후 시드
-- TODO: 어드민 계정 생성 후, 삼성/LG 카드에 is_wanted=true 및 wanted_by 설정
--   예) update cards set is_wanted = true where team_id = (select id from teams where slug='samsung');
--       update cards set is_wanted = true where team_id = (select id from teams where slug='lg');
