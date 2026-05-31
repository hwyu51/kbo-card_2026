-- =====================================================================
-- KBO 카드 교환/판매 관리 사이트 — Supabase 스키마
-- 실행: Supabase SQL Editor에 붙여넣고 실행 (재실행 안전 / idempotent)
-- 구조: cards(카탈로그) + card_holdings(유저별 보유/희망) + audit_log(감사)
-- 데이터 출처: templates/catalog.md (= templates/kbo-card-list.jpg 판독본)
-- =====================================================================

-- ---------- 0. 공통: updated_at 자동 갱신 함수 ----------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- 1. 구단 ----------
create table if not exists teams (
  id    bigint generated always as identity primary key,
  name  text not null unique,          -- 예: 'LG 트윈스'
  slug  text not null unique,          -- 예: 'lg'
  logo_url text
);

-- ---------- 2. 선수 (※ 선수 실명 노출 OK — 카드 주인공) ----------
create table if not exists players (
  id        bigint generated always as identity primary key,
  team_id   bigint not null references teams(id) on delete cascade,
  name      text not null,
  position  text,                      -- 투수/포수/내야수/외야수/타자
  jersey_no integer
);
create index if not exists idx_players_team on players(team_id);
-- 구단 안에서 동명이인 방지 + 선수 매칭/생성 기준
create unique index if not exists uq_players_team_name on players(team_id, name);

-- ---------- 3. 카드 종류 + 글로벌 기본 가격 ----------
create table if not exists card_types (
  id            bigint generated always as identity primary key,
  code          text not null unique,    -- normal_home / normal_away / alphabet / holo / parallel / charm / special / auto
  name          text not null,           -- 노멀(홈) / 노멀(어웨이) / 알파벳 / 홀로 / 패러렐 / 승리부적 / 스페셜 / 친필사인
  default_price integer not null default 0,
  sort_order    integer not null default 0
);

-- ---------- 4. 카드 카탈로그 (보유현황은 card_holdings로 분리) ----------
create table if not exists cards (
  id             bigint generated always as identity primary key,
  player_id      bigint references players(id) on delete set null,
  team_id        bigint not null references teams(id) on delete cascade,
  card_type_id   bigint not null references card_types(id),
  card_number    text,                   -- 카드연번 (예: KR-26/T01)
  variant        text,                   -- 부가 구분
  title          text,                   -- 표시명 (비면 선수명+종류)
  image_url      text,
  price_override integer,                -- 개별 가격(없으면 종류 기본가)
  is_special     boolean not null default false,  -- 스페셜(레전드) 카드 여부
  memo           text,
  updated_by     uuid references auth.users(id),  -- 감사용
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- 카드 식별 자연키 (같은 구단·선수·종류·연번·부가구분 = 동일 카드)
  dedupe_key text generated always as (
    team_id::text || '|' ||
    coalesce(player_id::text, '') || '|' ||
    card_type_id::text || '|' ||
    coalesce(card_number, '') || '|' ||
    coalesce(variant, '')
  ) stored,
  constraint cards_dedupe_uk unique (dedupe_key)
);
create index if not exists idx_cards_team on cards(team_id);
create index if not exists idx_cards_type on cards(card_type_id);
create index if not exists idx_cards_player on cards(player_id);

drop trigger if exists trg_cards_updated_at on cards;
create trigger trg_cards_updated_at
  before update on cards for each row execute function set_updated_at();

-- ---------- 5. 유저별 보유현황/희망 (어드민 = owner) ----------
create table if not exists card_holdings (
  card_id       bigint not null references cards(id) on delete cascade,
  owner_id      uuid   not null references auth.users(id),  -- 로그인 어드민(비공개)
  qty_available integer not null default 0,  -- 판매/교환 가능
  qty_reserved  integer not null default 0,  -- 예약중
  qty_completed integer not null default 0,  -- 완료(공개 숨김)
  is_wanted     boolean not null default false,
  updated_at    timestamptz not null default now(),
  primary key (card_id, owner_id),
  constraint qty_nonneg check (qty_available >= 0 and qty_reserved >= 0 and qty_completed >= 0)
);
create index if not exists idx_holdings_owner on card_holdings(owner_id);

drop trigger if exists trg_holdings_updated_at on card_holdings;
create trigger trg_holdings_updated_at
  before update on card_holdings for each row execute function set_updated_at();

-- ---------- 6. 공개용 뷰 (완료수량/owner/내부필드 제외, owner 합산) ----------
create or replace view public_cards as
select
  c.id,
  c.team_id,
  t.name        as team_name,
  t.slug        as team_slug,
  c.player_id,
  p.name        as player_name,
  p.position,
  p.jersey_no,
  ct.id         as card_type_id,
  ct.name       as card_type_name,
  ct.code       as card_type_code,
  c.card_number,
  c.variant,
  c.title,
  c.image_url,
  c.is_special,
  coalesce(c.price_override, ct.default_price)        as price,
  coalesce(sum(h.qty_available), 0)                   as qty_available,
  coalesce(sum(h.qty_reserved), 0)                    as qty_reserved,
  coalesce(sum(h.qty_available + h.qty_reserved), 0)  as qty_owned,   -- 보유 총량
  coalesce(bool_or(h.is_wanted), false)               as is_wanted,
  c.memo,
  c.created_at
from cards c
join teams t        on t.id = c.team_id
join card_types ct  on ct.id = c.card_type_id
left join players p on p.id = c.player_id
left join card_holdings h on h.card_id = c.id
group by c.id, t.name, t.slug, p.name, p.position, p.jersey_no,
         ct.id, ct.name, ct.code, c.price_override, ct.default_price;

-- 뷰는 정의자(소유자) 권한으로 동작 → anon은 cards/card_holdings 직접 접근 불가해도
-- 이 뷰로는 공개 컬럼/집계만 읽을 수 있다. (완료수량/owner/wanted_by 노출 안 됨)
alter view public_cards set (security_invoker = off);
grant select on public_cards to anon, authenticated;

-- =====================================================================
-- 7. RLS
-- =====================================================================
alter table teams         enable row level security;
alter table players       enable row level security;
alter table card_types    enable row level security;
alter table cards         enable row level security;
alter table card_holdings enable row level security;

-- 읽기: teams / players / card_types 는 민감정보 없음 → anon 허용
drop policy if exists "public read teams"   on teams;
drop policy if exists "public read players" on players;
drop policy if exists "public read types"   on card_types;
create policy "public read teams"   on teams      for select using (true);
create policy "public read players" on players    for select using (true);
create policy "public read types"   on card_types for select using (true);

-- ⚠️ cards / card_holdings 원본에는 anon read 정책 없음 → 공개는 public_cards 뷰만 사용.

-- 카탈로그 쓰기: 로그인 어드민만 (for all = read 포함)
drop policy if exists "admin all teams"   on teams;
drop policy if exists "admin all players" on players;
drop policy if exists "admin all types"   on card_types;
drop policy if exists "admin all cards"   on cards;
create policy "admin all teams"   on teams      for all to authenticated using (true) with check (true);
create policy "admin all players" on players    for all to authenticated using (true) with check (true);
create policy "admin all types"   on card_types for all to authenticated using (true) with check (true);
create policy "admin all cards"   on cards      for all to authenticated using (true) with check (true);

-- 보유현황: 어드민이되 본인 소유(owner_id) 행만 read/write. 집계는 public_cards 뷰로만.
drop policy if exists "own holdings read"  on card_holdings;
drop policy if exists "own holdings write" on card_holdings;
create policy "own holdings read"  on card_holdings for select to authenticated using (owner_id = auth.uid());
create policy "own holdings write" on card_holdings for all    to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- =====================================================================
-- 8. 이미지 Storage 버킷 (어드민 업로드 / 공개 읽기)
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('card-images', 'card-images', true)
on conflict (id) do nothing;

drop policy if exists "public read card images"   on storage.objects;
drop policy if exists "admin insert card images"  on storage.objects;
drop policy if exists "admin update card images"  on storage.objects;
drop policy if exists "admin delete card images"  on storage.objects;
create policy "public read card images"  on storage.objects
  for select using (bucket_id = 'card-images');
create policy "admin insert card images" on storage.objects
  for insert to authenticated with check (bucket_id = 'card-images');
create policy "admin update card images" on storage.objects
  for update to authenticated using (bucket_id = 'card-images');
create policy "admin delete card images" on storage.objects
  for delete to authenticated using (bucket_id = 'card-images');

-- =====================================================================
-- 9. 시드 데이터  (감사 트리거보다 먼저 → 시드는 로그에 안 잡힘)
-- =====================================================================

-- 9.1 구단 (2026 KBO 10개)
insert into teams (name, slug) values
  ('LG 트윈스','lg'), ('KT 위즈','kt'), ('SSG 랜더스','ssg'), ('NC 다이노스','nc'),
  ('두산 베어스','doosan'), ('KIA 타이거즈','kia'), ('롯데 자이언츠','lotte'),
  ('삼성 라이온즈','samsung'), ('한화 이글스','hanwha'), ('키움 히어로즈','kiwoom')
on conflict (name) do nothing;

-- 9.2 카드 종류 + 글로벌 기본 가격 (추후 어드민에서 조정)
insert into card_types (code, name, default_price, sort_order) values
  ('normal_home','노멀(홈)',      1000, 1),
  ('normal_away','노멀(어웨이)',  1000, 2),
  ('alphabet',   '알파벳',        3000, 3),
  ('holo',       '홀로',          5000, 4),
  ('parallel',   '패러렐',       10000, 5),
  ('charm',      '승리부적',     20000, 6),
  -- 스페셜은 등급이 아니라 cards.is_special 플래그(레전드 = 노멀/홀로/패러렐/오토) → card_type 없음
  ('auto',       '친필사인',         0, 8)   -- 0 = 가격문의 (formatPrice가 '가격문의'로 표시)
on conflict (code) do nothing;

-- 9.3 체크리스트 스테이징 (선수 1명 = 1행)
--   노멀(홈)/노멀(어웨이)는 전원 보유 → 컬럼 생략, 아래에서 일괄 생성.
--   holo = parallel (원본 단일 '홀로(패러렐)' 컬럼).  special 팀: OB→두산, 빙그레→한화.
drop table if exists seed_chk;
create temp table seed_chk (
  card_no    text, team_slug text, pos text, jersey integer, pname text,
  alphabet boolean, holo boolean, parallel boolean, charm boolean, auto boolean,
  is_special boolean default false
);

insert into seed_chk (card_no, team_slug, pos, jersey, pname, alphabet, holo, parallel, charm, auto, is_special) values
-- LG
('KR-26/T01','lg','투수',67,'김영우',  true, true, true, false, true, false),
('KR-26/T02','lg','투수',29,'손주영',  true, true, true, false, true, false),
('KR-26/T03','lg','투수',13,'송승기',  true, false,false,false,false,false),
('KR-26/T04','lg','투수',54,'유영찬',  true, false,false,false,false,false),
('KR-26/T05','lg','투수',31,'이정용',  true, false,false,false,false,false),
('KR-26/T06','lg','투수',1, '임찬규',  false,false,false,true, false,false),
('KR-26/T07','lg','포수',27,'박동원',  false,true, true, false,true, false),
('KR-26/T08','lg','내야수',6,'구본혁',  true, false,false,false,false,false),
('KR-26/T09','lg','내야수',2,'문보경',  true, true, true, false,true, false),
('KR-26/T10','lg','내야수',4,'신민재',  true, false,false,false,false,false),
('KR-26/T11','lg','내야수',10,'오지환', false,true, true, false,true, false),
('KR-26/T12','lg','외야수',8,'문성주',  true, false,false,false,true, false),
('KR-26/T13','lg','외야수',17,'박해민', true, true, true, false,true, false),
('KR-26/T14','lg','외야수',51,'홍창기', false,true, true, true, false,false),
-- 한화
('KR-26/E01','hanwha','투수',44,'김서현', true, false,false,false,true, false),
('KR-26/E02','hanwha','투수',99,'류현진', true, true, true, false,true, false),
('KR-26/E03','hanwha','투수',1, '문동주', true, true, true, true, false,false),
('KR-26/E04','hanwha','투수',61,'정우주', true, true, true, false,false,false),
('KR-26/E05','hanwha','투수',57,'조동욱', true, false,false,false,false,false),
('KR-26/E06','hanwha','투수',29,'황준서', true, false,false,false,false,false),
('KR-26/E07','hanwha','포수',13,'최재훈', false,false,false,false,true, false),
('KR-26/E08','hanwha','내야수',50,'강백호',false,true, true, false,true, false),
('KR-26/E09','hanwha','내야수',8,'노시환', false,true, true, true, false,false),
('KR-26/E10','hanwha','내야수',22,'채은성',false,true, true, false,true, false),
('KR-26/E11','hanwha','내야수',16,'하주석',true, false,false,false,false,false),
('KR-26/E12','hanwha','외야수',51,'문현빈',false,true, true, true, true, false),
('KR-26/E13','hanwha','외야수',54,'오재원',true, false,false,false,false,false),
('KR-26/E14','hanwha','외야수',10,'이진영',true, false,false,false,true, false),
-- SSG
('KR-26/S01','ssg','투수',29,'김광현',  true, false,false,true, false,false),
('KR-26/S02','ssg','투수',39,'김건우',  true, true, true, false,false,false),
('KR-26/S03','ssg','투수',1, '김민',    false,false,false,false,true, false),
('KR-26/S04','ssg','투수',38,'노경은',  true, true, true, false,false,false),
('KR-26/S05','ssg','투수',92,'이로운',  true, false,false,false,false,false),
('KR-26/S06','ssg','투수',19,'조병현',  true, false,false,false,false,false),
('KR-26/S07','ssg','투수',30,'최민준',  true, false,false,false,false,false),
('KR-26/S08','ssg','포수',20,'조형우',  false,false,false,false,true, false),
('KR-26/S09','ssg','내야수',18,'고명준', true, false,false,false,false,false),
('KR-26/S10','ssg','내야수',2,'박성한',  true, true, true, false,true, false),
('KR-26/S11','ssg','외야수',37,'오태곤', true, false,false,false,false,false),
('KR-26/S12','ssg','내야수',14,'최정',   true, true, true, true, true, false),
('KR-26/S13','ssg','외야수',54,'최지훈', true, true, true, true, false,false),
('KR-26/S14','ssg','외야수',35,'한유섬', true, false,false,false,true, false),
-- 삼성
('KR-26/L01','samsung','투수',62,'김재윤', true, false,false,false,false,false),
('KR-26/L02','samsung','투수',55,'배찬승', true, true, true, false,true, false),
('KR-26/L03','samsung','투수',29,'백정현', false,true, true, false,false,false),
('KR-26/L04','samsung','투수',28,'이승민', true, false,false,false,false,false),
('KR-26/L05','samsung','투수',57,'이승현', true, false,false,false,false,false),
('KR-26/L06','samsung','투수',20,'최원태', false,false,false,false,true, false),
('KR-26/L07','samsung','포수',47,'강민호', false,true, true, false,true, false),
('KR-26/L08','samsung','내야수',30,'김영웅',false,true, true, true, false,false),
('KR-26/L09','samsung','내야수',16,'류지혁',true, false,false,false,false,false),
('KR-26/L10','samsung','내야수',7,'이재현', true, false,false,false,false,false),
('KR-26/L11','samsung','외야수',5,'구자욱', true, true, true, false,true, false),
('KR-26/L12','samsung','외야수',39,'김성윤',true, false,false,false,false,false),
('KR-26/L13','samsung','외야수',58,'김지찬',true, true, true, false,true, false),
('KR-26/L14','samsung','외야수',34,'최형우',false,true, true, false,true, false),
-- NC
('KR-26/N01','nc','투수',59,'구창모',  false,true, true, true, false,false),
('KR-26/N02','nc','투수',17,'김영규',  true, true, true, false,true, false),
('KR-26/N03','nc','투수',54,'김진호',  true, false,false,false,true, false),
('KR-26/N04','nc','투수',41,'류진욱',  true, false,false,false,false,false),
('KR-26/N05','nc','투수',40,'이준혁',  true, false,false,false,false,false),
('KR-26/N06','nc','투수',57,'전사민',  false,true, true, false,false,false),
('KR-26/N07','nc','포수',25,'김형준',  true, false,false,false,true, false),
('KR-26/N08','nc','내야수',7,'김주원',  false,true, true, true, true, false),
('KR-26/N09','nc','내야수',44,'김휘집', true, false,false,false,false,false),
('KR-26/N10','nc','내야수',2,'박민우',  true, true, true, false,false,false),
('KR-26/N11','nc','내야수',14,'최정원', true, false,false,false,true, false),
('KR-26/N12','nc','내야수',9,'신재인',  true, false,false,false,false,false),
('KR-26/N13','nc','외야수',37,'박건우', false,true, true, false,false,false),
('KR-26/N14','nc','내야수',5,'서호철',  true, false,false,false,false,false),
-- KT
('KR-26/W01','kt','투수',1, '고영표',  true, true, true, true, false,false),
('KR-26/W02','kt','투수',60,'박영현',  true, false,false,false,true, false),
('KR-26/W03','kt','투수',30,'소형준',  false,true, true, true, true, false),
('KR-26/W04','kt','투수',26,'김민수',  true, false,false,false,false,false),
('KR-26/W05','kt','투수',12,'우규민',  true, false,false,false,true, false),
('KR-26/W06','kt','투수',35,'한승혁',  true, false,false,false,false,false),
('KR-26/W07','kt','포수',22,'장성우',  true, false,false,false,false,false),
('KR-26/W08','kt','내야수',7,'김상수',  true, true, true, false,false,false),
('KR-26/W09','kt','내야수',13,'허경민', true, true, true, false,false,false),
('KR-26/W10','kt','내야수',6,'이강민',  true, true, true, false,false,false),
('KR-26/W11','kt','외야수',10,'김현수', true, true, true, false,false,false),
('KR-26/W12','kt','외야수',27,'배정대', true, false,false,false,false,false),
('KR-26/W13','kt','외야수',23,'안현민', false,true, true, true, true, false),
('KR-26/W14','kt','외야수',3,'최원준',  true, false,false,false,false,false),
-- 롯데
('KR-26/G01','lotte','투수',34,'김원중', true, true, true, false,false,false),
('KR-26/G02','lotte','투수',15,'김진욱', true, true, true, false,false,false),
('KR-26/G03','lotte','투수',21,'박세웅', true, true, true, false,true, false),
('KR-26/G04','lotte','투수',57,'정현수', true, false,false,false,true, false),
('KR-26/G05','lotte','투수',56,'최준용', true, false,false,false,false,false),
('KR-26/G06','lotte','투수',36,'박정민', true, false,false,false,false,false),
('KR-26/G07','lotte','포수',27,'유강남', true, true, true, false,true, false),
('KR-26/G08','lotte','내야수',13,'전민재',false,true, true, true, false,false),
('KR-26/G09','lotte','내야수',25,'한동희',true, false,false,false,false,false),
('KR-26/G10','lotte','내야수',6,'한태양', true, false,false,false,false,false),
('KR-26/G11','lotte','외야수',33,'손호영',true, false,false,false,false,false),
('KR-26/G12','lotte','외야수',91,'윤동희',false,true, true, true, true, false),
('KR-26/G13','lotte','외야수',8,'전준우', true, true, true, true, true, false),
('KR-26/G14','lotte','외야수',0,'황성빈', true, false,false,false,true, false),
-- KIA
('KR-26/K01','kia','투수',49,'김범수',  true, false,false,false,false,false),
('KR-26/K02','kia','투수',10,'김태형',  true, false,false,false,false,false),
('KR-26/K03','kia','투수',65,'성영탁',  true, false,false,false,false,false),
('KR-26/K04','kia','투수',54,'양현종',  false,true, true, true, true, false),
('KR-26/K05','kia','투수',48,'이의리',  false,true, true, false,false,false),
('KR-26/K06','kia','투수',51,'전상현',  false,false,false,false,true, false),
('KR-26/K07','kia','투수',62,'정해영',  false,false,false,false,true, false),
('KR-26/K08','kia','투수',39,'최지민',  false,false,false,false,true, false),
('KR-26/K09','kia','포수',42,'김태군',  true, false,false,false,false,false),
('KR-26/K10','kia','내야수',5,'김도영',  true, true, true, true, true, false),
('KR-26/K11','kia','내야수',3,'김선빈',  true, true, true, true, true, false),
('KR-26/K12','kia','내야수',56,'오선우', false,true, true, false,false,false),
('KR-26/K13','kia','외야수',27,'김호령', true, true, true, false,false,false),
('KR-26/K14','kia','외야수',47,'나성범', true, true, true, false,true, false),
-- 두산
('KR-26/D01','doosan','투수',47,'곽빈',   false,true, true, false,false,false),
('KR-26/D02','doosan','투수',63,'김택연', false,true, true, true, false,false),
('KR-26/D03','doosan','투수',29,'이병헌', true, false,false,false,false,false),
('KR-26/D04','doosan','투수',50,'이영하', false,false,false,false,true, false),
('KR-26/D05','doosan','투수',68,'최민석', true, false,false,false,true, false),
('KR-26/D06','doosan','투수',28,'최승용', true, false,false,false,true, false),
('KR-26/D07','doosan','투수',61,'최원준', true, false,false,false,false,false),
('KR-26/D08','doosan','포수',25,'양의지', false,true, true, false,true, false),
('KR-26/D09','doosan','내야수',52,'박준순',true, true, true, false,false,false),
('KR-26/D10','doosan','내야수',7,'박찬호', false,true, true, false,false,false),
('KR-26/D11','doosan','내야수',62,'안재석',true, false,false,false,false,false),
('KR-26/D12','doosan','내야수',53,'양석환',true, false,false,false,false,false),
('KR-26/D13','doosan','내야수',6,'오명진', false,true, true, true, false,false),
('KR-26/D14','doosan','외야수',31,'정수빈',true, true, true, false,true, false),
-- 키움
('KR-26/H01','kiwoom','투수',35,'박윤성', true, false,false,false,false,false),
('KR-26/H02','kiwoom','투수',21,'김성진', true, false,false,false,false,false),
('KR-26/H03','kiwoom','투수',28,'김재웅', true, false,false,false,false,false),
('KR-26/H04','kiwoom','투수',13,'정현우', true, false,false,true, true, false),
('KR-26/H05','kiwoom','투수',20,'조영건', true, true, true, false,false,false),
('KR-26/H06','kiwoom','투수',50,'하영민', true, false,false,false,false,false),
('KR-26/H07','kiwoom','포수',12,'김건희', true, false,false,false,true, false),
('KR-26/H08','kiwoom','내야수',1,'김태진', true, false,false,false,false,false),
('KR-26/H09','kiwoom','외야수',43,'박찬혁',true, false,false,false,false,false),
('KR-26/H10','kiwoom','내야수',9,'안치홍', true, true, true, false,false,false),
('KR-26/H11','kiwoom','내야수',92,'어준서',true, true, true, false,false,false),
('KR-26/H12','kiwoom','내야수',53,'최주환',true, false,false,false,true, false),
('KR-26/H13','kiwoom','외야수',2,'이주형', false,true, true, true, true, false),
('KR-26/H14','kiwoom','외야수',29,'임지열',true, false,false,false,false,false),
-- 스페셜 (레전드 오토그래프) — 노멀+홀로+패러렐+오토.  OB→두산, 빙그레→한화
('KR-26/A01','lg',     '투수',47,'이상훈', false,true, true, false,true, true),
('KR-26/A02','doosan', '투수',21,'박철순', false,true, true, false,true, true),
('KR-26/A03','ssg',    '타자',0, '김강민', false,true, true, false,true, true),
('KR-26/A04','doosan', '타자',18,'김동주', false,true, true, false,true, true),
('KR-26/A05','lotte',  '타자',10,'이대호', false,true, true, false,true, true),
('KR-26/A06','hanwha', '투수',21,'송진우', false,true, true, false,true, true),
('KR-26/A07','samsung','투수',21,'오승환', false,true, true, false,true, true),
('KR-26/A08','kiwoom', '타자',52,'박병호', false,true, true, false,true, true),
('KR-26/A09','kiwoom', '타자',29,'이택근', false,true, true, false,true, true),
('KR-26/A10','hanwha', '타자',8, '정근우', false,true, true, false,true, true);

-- 9.4 선수
insert into players (team_id, name, position, jersey_no)
select t.id, s.pname, s.pos, s.jersey
from seed_chk s join teams t on t.slug = s.team_slug
on conflict (team_id, name) do nothing;

-- 9.5 카드: 종류별로 ● 인 선수만 생성 (노멀 홈/어웨이는 전원)
insert into cards (player_id, team_id, card_type_id, card_number, is_special)
select p.id, p.team_id, ct.id, s.card_no, s.is_special
from seed_chk s
join teams t   on t.slug = s.team_slug
join players p on p.team_id = t.id and p.name = s.pname
join card_types ct on
     ct.code in ('normal_home','normal_away')
  or (ct.code = 'alphabet' and s.alphabet)
  or (ct.code = 'holo'     and s.holo)
  or (ct.code = 'parallel' and s.parallel)
  or (ct.code = 'charm'    and s.charm)
  or (ct.code = 'auto'     and s.auto)
on conflict (dedupe_key) do nothing;

drop table if exists seed_chk;

-- =====================================================================
-- 10. 감사 로그 (수정 로그) — 트리거 기반, append-only
--     ※ 시드 이후에 트리거 생성 → 시드 INSERT 는 로그에 안 잡힘
-- =====================================================================
create table if not exists audit_log (
  id          bigint generated always as identity primary key,
  table_name  text not null,            -- card_holdings | cards | card_types
  row_pk      text not null,            -- card_id, 또는 card_id:owner_id
  card_id     bigint,
  action      text not null,            -- insert | update | delete
  actor       uuid references auth.users(id),  -- = auth.uid()
  changes     jsonb,                    -- update: {필드:{old,new}} / insert·delete: 스냅샷
  changed_at  timestamptz not null default now()
);
create index if not exists idx_audit_card on audit_log(card_id);
create index if not exists idx_audit_time on audit_log(changed_at desc);

create or replace function log_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_changes jsonb := '{}'::jsonb;
  v_card_id bigint;
  v_pk      text;
  v_old     jsonb := case when TG_OP <> 'INSERT' then to_jsonb(OLD) end;
  v_new     jsonb := case when TG_OP <> 'DELETE' then to_jsonb(NEW) end;
  k         text;
begin
  if TG_OP = 'UPDATE' then
    for k in select jsonb_object_keys(v_new) loop
      if k = 'updated_at' then continue; end if;
      if (v_old -> k) is distinct from (v_new -> k) then
        v_changes := v_changes || jsonb_build_object(k, jsonb_build_object('old', v_old->k, 'new', v_new->k));
      end if;
    end loop;
    if v_changes = '{}'::jsonb then return null; end if;   -- 실질 변경 없음
  elsif TG_OP = 'INSERT' then
    v_changes := v_new;
  else
    v_changes := v_old;
  end if;

  if TG_TABLE_NAME = 'card_holdings' then
    v_card_id := coalesce((v_new->>'card_id')::bigint, (v_old->>'card_id')::bigint);
    v_pk := v_card_id::text || ':' || coalesce(v_new->>'owner_id', v_old->>'owner_id');
  elsif TG_TABLE_NAME = 'cards' then
    v_card_id := coalesce((v_new->>'id')::bigint, (v_old->>'id')::bigint);
    v_pk := v_card_id::text;
  else
    v_pk := coalesce(v_new->>'id', v_old->>'id');
  end if;

  insert into audit_log(table_name, row_pk, card_id, action, actor, changes)
  values (TG_TABLE_NAME, v_pk, v_card_id, lower(TG_OP), auth.uid(), v_changes);
  return null;
end$$;

drop trigger if exists trg_audit_holdings on card_holdings;
drop trigger if exists trg_audit_cards    on cards;
drop trigger if exists trg_audit_types    on card_types;
create trigger trg_audit_holdings after insert or update or delete on card_holdings
  for each row execute function log_audit();
create trigger trg_audit_cards    after insert or update or delete on cards
  for each row execute function log_audit();
create trigger trg_audit_types    after insert or update or delete on card_types
  for each row execute function log_audit();

-- 감사 로그 RLS: 어드민끼리 읽기 가능, 직접 쓰기 불가(트리거가 정의자 권한으로 기록)
alter table audit_log enable row level security;
drop policy if exists "audit read" on audit_log;
create policy "audit read" on audit_log for select to authenticated using (true);

-- =====================================================================
-- TODO (어드민 계정 생성 후)
--   초기 희망 시드: 한 어드민=삼성 전체, 다른 어드민=LG 전체
--     insert into card_holdings (card_id, owner_id, is_wanted)
--     select c.id, '<어드민A-uuid>'::uuid, true
--     from cards c join teams t on t.id = c.team_id where t.slug = 'samsung'
--     on conflict (card_id, owner_id) do update set is_wanted = true;
-- =====================================================================
