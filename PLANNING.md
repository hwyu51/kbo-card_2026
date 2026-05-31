# KBO 카드 교환/판매 관리 사이트 — 기획서

> 당근마켓 유입용 공개 카드 현황 페이지 + 어드민 관리 도구
> 스택: **Next.js + Vercel + Supabase**

---

## 1. 목표 & 사용자

- **목적**: 우리가 보유/희망하는 KBO 2026 오피셜 컬렉션 카드를 공개적으로 보여주고, 당근마켓 거래(판매/교환)로 연결한다.
- **공개 사용자(비로그인)**: 우리가 무슨 카드를 몇 장 가졌는지, 가격/상태/희망 카드를 본다. 문의는 **당근 채팅**으로만.
- **어드민(2명)**: 카드 등록/수정, 상태·수량 변경, 가격 관리, 희망 카드 관리, 예약/완료/전체 리스트 관리.
  - 회원가입 없음 → 계정 2개를 개발 중 직접 발급.
  - **실명(2명) 절대 비노출.** 누가 등록/수정/희망했는지는 내부 데이터로만 보관.

---

## 2. 핵심 개념

### 2.1 카드 = 카탈로그 + 우리 보유현황
- 카탈로그: 2026 컬렉션의 **전체 카드 종류**(오토그래프 포함)를 미리 시드.
- 각 카드에 대해 **보유현황**(상태별 수량)과 **희망 여부**를 관리.

### 2.2 상태 × 수량 (상태별 수량 분리)
카드 1종이 여러 장일 수 있고, 장마다 상태가 갈릴 수 있다.

| 필드 | 의미 | 공개 노출 |
|---|---|---|
| `qty_available` | 판매/교환 가능 보유 수량 | ✅ |
| `qty_reserved` | 예약중 수량 | ✅ |
| `qty_completed` | 거래 완료 수량 (보유에서 빠짐) | ❌ 숨김 |

- **보유 총 장수** (홈 상단 지표) = `qty_available + qty_reserved` 의 전체 합
- **미보유** = `qty_available + qty_reserved == 0`
- 표시용 상태 뱃지(파생):
  - `available > 0` → **보유(판매가능)** (+ `reserved>0`이면 "예약 n" 함께)
  - `available == 0 && reserved > 0` → **예약중**
  - 모두 0 → **미보유**

### 2.3 희망 (Wishlist)
- `is_wanted` 플래그로 "우리가 찾는 카드" 표시.
- 보유와 **독립** → 미보유+희망(전형적), 보유+희망(더 원함) 모두 가능.
- 내부용 `wanted_by`(어드민 식별)는 보관하되 **화면 비노출**.
- 초기 시드: 한 어드민 = 삼성 전체 희망 / 다른 어드민 = LG 전체 희망.
  → 공개 페이지에서는 구단 구분 없이 "희망"으로만 묶어서 표시.
- 어드민 화면에서 **팀 단위 일괄 희망 지정** 지원.

### 2.4 가격
- `card_types.default_price` = 종류별 **글로벌 기본 가격** (노멀/알파벳/홀로/패러렐/승리부적/스페셜/오토).
- `cards.price_override` = **카드 개별 가격** (있으면 우선).
- **표시가격 = `price_override ?? default_price`**
- 글로벌 가격을 바꾸면 오버라이드 안 한 카드는 전부 자동 반영.

---

## 3. 화면 설계

### 3.1 공개 페이지 (비로그인)
- **홈**
  - 상단: `보유 카드 총 OOO장` 대형 지표 + 판매/교환 가능 수, 예약중 수 요약
  - **기본 필터 = 보유** (진입 시 보유 카드만 표시)
- **카드 목록**
  - 필터: **전체 보기 / 보유 / 희망** + **팀** + **종류**
  - 검색: 선수명
  - 카드 카드(card): 이미지, 선수, 팀, 종류, 가격, 수량(가능/예약), 상태 뱃지
  - **완료 카드는 숨김**
- **카드 상세**: 큰 이미지, 가격, 수량/상태, 메모, "당근 채팅으로 문의" 안내
- **푸터**: 작은 "관리자" 링크 → 로그인

### 3.2 어드민 (로그인 후, `/admin`)
- **대시보드**: 보유 총 장수 / 가능 / 예약중 / 완료 / 미보유 / 희망 통계
- **카드 관리**: 등록·수정·삭제, 이미지 업로드(Supabase Storage), 상태별 수량 조정, 개별 가격, 희망 토글, 팀 단위 일괄 희망
- **보유 입력** (`/admin/holdings`) · **희망 입력** (`/admin/wishlist`): 카탈로그 그리드에 숫자/체크 입력 (§7 참고)
- **가격 설정**: 종류별 글로벌 기본 가격 일괄 관리
- **리스트 뷰(탭)**: 예약 리스트 / 완료 리스트 / 전체 리스트 (검색·정렬·필터)
- **수정 로그** (`/admin/logs`): 누가·언제·무엇을 바꿨는지 변경 이력 (§8 참고)

---

## 4. 인증 & 권한
- Supabase Auth(이메일+비번), **회원가입 비활성화**, 어드민 2계정 사전 생성.
- RLS:
  - 카탈로그/카드 테이블: anon **read 허용** (완료 수량·내부 필드는 공개 뷰에서 제외).
  - **write는 authenticated(어드민)만.**
- `/admin/*`는 미들웨어로 보호, 비로그인 시 로그인 페이지로.
- `updated_by` / `owner_id`는 내부 감사용 → **공개 페이지엔 실명·계정 절대 비노출.**
  단, **수정 로그(`audit_log`)는 어드민 전용**이며 어드민끼리는 행위자(계정)를 서로 볼 수 있다(§8).

---

## 5. 단계별 개발 로드맵
1. **셋업** — Next.js + Vercel + Supabase 연결, 환경변수, 폴더 구조
2. **DB 스키마 + 시드** — teams / players / card_types(기본가격) / cards 카탈로그 (`supabase/schema.sql`)
3. **인증** — 어드민 2계정, `/admin` 보호, 푸터 로그인 링크
4. **공개 페이지** — 홈(총 장수) · 목록(필터: 전체/보유/희망 + 팀/종류) · 상세
5. **어드민 기능** — 카드 CRUD, 가격(글로벌/개별), 예약/완료/전체 리스트, **보유/희망 입력 페이지(§7)**, **수정 로그(§8)**
6. **배포·QA** — Vercel 배포, 도메인 연결, 테스트

---

## 6. 남은 작업/준비물
- [x] **공식 체크리스트 데이터** 확보 → `templates/catalog.md` (점/이름 최종 검증만 남음)
- [ ] 어드민 2계정 이메일/비번 (개발 단계에서 전달)
- [ ] 당근마켓 안내 문구(상세 페이지 "당근 채팅으로 문의" 카피)
- [ ] 도메인 (배포 시)

---

## 7. 보유/희망 벌크 입력 (어드민 페이지)

카탈로그가 고정(144명 × 종류)이라 **CSV 업로드 대신 어드민 입력 페이지**로 처리한다.
카탈로그를 구단별 그리드로 깔고, 어드민은 **숫자만 입력**. 로그인 유저 = 보유자/희망자 → **별도 "보유자" 컬럼 불필요**.

> 기존 CSV 양식(`templates/보유카드_업로드_양식.csv`, `templates/README.md`)은 **폐기**.
> 카탈로그 데이터는 `templates/catalog.md`(= `templates/kbo-card-list.jpg` 판독본) 유지.

**보유 입력 / 희망 입력 2개 화면으로 분리** — `is_wanted`도 유저별로 깔끔히 처리.

### 7.1 카탈로그
- 출처: 2026 KBO 공식 컬렉션 카드 체크리스트. 144명(10구단×14 + 스페셜 10).
- 카드연번 `KR-26/{팀코드}{NN}` (LG=T, 한화=E, SSG=S, 삼성=L, NC=N, KT=W, 롯데=G, KIA=K, 두산=D, 키움=H, 스페셜=A).
- 종류 컬럼 → `card_types` **확장 매핑**:
  - `노멀(홈/어웨이)` ● → **노멀(홈) + 노멀(어웨이)** 2종
  - `홀로(패러렐)` ● → **홀로 + 패러렐** 2종
  - `알파벳`/`승리부적`/`오토` ● → 각 1종
  - 스페셜(A) = 레전드 오토그래프(노멀·홀로·패러렐·오토 보유).
- 각 (선수 × 보유 종류) = `cards` 1행으로 시드. 카탈로그에 **없는 종류 칸은 페이지에서 비활성화**.

### 7.2 스키마 변경 — 유저별 보유현황 분리
어드민 2명이 같은 카드를 각자 보유/희망할 수 있으므로, 수량을 `cards`에서 떼어 **유저별 holdings 테이블**로 분리.

```sql
-- cards: 카탈로그(종류/식별/가격/이미지/메모)만 보유. qty_* / is_wanted 제거.
create table card_holdings (
  card_id       bigint  references cards(id) on delete cascade,
  owner_id      uuid    references auth.users(id),  -- 로그인 어드민 = 보유자(비공개)
  qty_available integer not null default 0,
  qty_reserved  integer not null default 0,
  qty_completed integer not null default 0,
  is_wanted     boolean not null default false,
  updated_at    timestamptz not null default now(),
  primary key (card_id, owner_id)
);
```
- **공개 집계**: `public_cards` 뷰 = 카드별 `sum(qty_available)`, `sum(qty_reserved)`, `bool_or(is_wanted)`. `owner_id`/완료수량은 노출 안 함(§4 실명 비노출).
- 보유 총량 = Σ(가능+예약) — 기획 §2.2 그대로.

### 7.3 보유 입력 페이지 (`/admin/holdings`)
- 구단 탭/선택 → 그 구단 14명 카탈로그 그리드.
- 행=선수, 열=종류(노멀홈/노멀어웨이/알파벳/홀로/패러렐/승리부적/오토). 각 셀에 **가능/예약/완료 수량 입력**.
- 카탈로그에 없는 종류 셀 = **disabled**.
- 로그인 유저의 `card_holdings`만 로드·저장(upsert `(card_id, owner_id)`). 0이면 행 삭제 가능.
- 저장: 셀 단위 자동저장 또는 구단 단위 "저장" 버튼(배치 upsert).

### 7.4 희망 입력 페이지 (`/admin/wishlist`)
- 동일 그리드, 셀은 **체크박스(희망 ON/OFF)** = `card_holdings.is_wanted`.
- "구단 전체 희망" 일괄 토글(기획 §2.3 팀 단위 일괄 희망).
- 초기: 한 어드민=삼성 전체, 다른 어드민=LG 전체.

### 7.5 구현 메모
- 라우트: `/admin/holdings`, `/admin/wishlist` (미들웨어 보호, authenticated만).
- 저장: Server Action으로 `card_holdings` upsert. RLS: 본인 `owner_id` 행만 write.
- 가격(`price_override`)·이미지·메모는 카드 단위라 별도 카드 편집 화면에서.

### 7.6 남은 결정 사항
- [ ] catalog.md 점/이름 검증 완료 → 시드 확정
- [ ] `card_holdings` 도입(위 스키마) — 기존 `cards.qty_*`/`is_wanted`/`wanted_by` 제거 확정
- [ ] 수량 0 입력 시 행 삭제 vs 0 저장
- [ ] 저장 방식: 셀 자동저장 vs 구단 단위 저장 버튼

---

## 8. 수정 로그 (감사 로그)

> "누가·언제·무엇을 어떻게 바꿨는지" 어드민이 확인. **어드민 전용**(`/admin/logs`).

- **행위자 표시**: 어드민끼리는 서로 보임(로그에 계정 이메일/표시명 노출). **공개 페이지엔 절대 비노출**(기획 §1/§4).
- **상세도**: **필드별 before/after**. 예) `가능수량 2→1`, `is_wanted false→true`, `가격(price_override) 8000→9000`.
- **대상**: `card_holdings`(수량/희망 변경), `cards`(가격·이미지·메모·카탈로그 편집), 필요시 `card_types`(글로벌 가격).
- **메커니즘**: **DB 트리거 기반** — 개별 수정/배치 입력/일괄 토글 등 코드 경로와 무관하게 모든 변경을 자동 기록(앱 코드 누락 위험 없음).

### 8.1 스키마 (※ `card_holdings` 마이그레이션과 함께 추가)
```sql
create table audit_log (
  id          bigint generated always as identity primary key,
  table_name  text not null,          -- 'card_holdings' | 'cards' | 'card_types'
  row_pk      text not null,          -- 대상 식별(card_id, 또는 card_id+owner_id)
  card_id     bigint,                 -- 카드 기준 조회용(있으면 채움)
  action      text not null,          -- insert | update | delete
  actor       uuid references auth.users(id),  -- = auth.uid()
  changes     jsonb,                  -- update: {필드:{old,new}} / insert·delete: 전체 스냅샷
  changed_at  timestamptz not null default now()
);
create index on audit_log(card_id);
create index on audit_log(changed_at desc);
-- RLS: authenticated read/insert만 (어드민끼리 공유). anon 접근 없음.
```
- **트리거**: 대상 테이블에 `after insert/update/delete`. update 시 컬럼별 `OLD is distinct from NEW`만 diff로 기록(`updated_at` 등 자동필드 제외). `actor = auth.uid()`.
- 로그는 **append-only**(수정/삭제 불가) — 어드민도 read/insert만.

### 8.2 화면 (`/admin/logs`)
- 최신순 타임라인. 필터: **카드 / 구단 / 행위자 / 기간 / 액션**.
- 각 항목: `시각 · 행위자 · 카드(선수·종류) · 액션 · 필드별 변경(before→after)`.
- 카드 편집 화면에도 "이 카드 변경 이력" 섹션(해당 `card_id` 로그).

### 8.3 남은 결정 사항
- [ ] 행위자 표시명: 이메일 그대로 vs 별칭 매핑(예: 계정→"노지환/유혜원" 내부 표시)
- [ ] 보존 기간(무기한 vs N개월 후 정리)
