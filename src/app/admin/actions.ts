"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { DealDirection, DealKind, DealStatus } from "@/lib/types";

async function authed() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

const num0 = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0));

// ---------- 보유/소장/희망 저장 (본인 owner_id) ----------
export type HoldingRow = {
  card_id: number;
  qty_total: number;
  qty_keep: number;
  is_wanted: boolean;
};

export async function saveHoldings(
  rows: HoldingRow[]
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user } = await authed();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  // 의미 있는 값이 있는 행만 upsert. 모두 0/false 인 행은 빈 행을 만들지 않도록
  // (이미 있으면 정리 차원에서) 삭제 → card_holdings·감사로그 오염 방지.
  const toUpsert: {
    card_id: number;
    owner_id: string;
    qty_total: number;
    qty_keep: number;
    is_wanted: boolean;
  }[] = [];
  const toDelete: number[] = [];

  for (const r of rows) {
    const card_id = Number(r.card_id);
    const qty_total = num0(r.qty_total);
    const qty_keep = num0(r.qty_keep);
    // 보유 중(qty_total>0)인 카드는 "희망"에서 자동 제거 (보유=이미 가짐 → 찾는 카드 아님)
    const is_wanted = qty_total > 0 ? false : Boolean(r.is_wanted);
    if (qty_total === 0 && qty_keep === 0 && !is_wanted) toDelete.push(card_id);
    else toUpsert.push({ card_id, owner_id: user.id, qty_total, qty_keep, is_wanted });
  }

  if (toUpsert.length) {
    const { error } = await supabase
      .from("card_holdings")
      .upsert(toUpsert, { onConflict: "card_id,owner_id" });
    if (error) return { ok: false, error: error.message };
  }
  if (toDelete.length) {
    // 존재하지 않는 행 삭제는 no-op(감사로그도 안 남음) → 안전하게 일괄 처리.
    const { error } = await supabase
      .from("card_holdings")
      .delete()
      .eq("owner_id", user.id)
      .in("card_id", toDelete);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/admin/holdings");
  revalidatePath("/admin/wishlist");
  revalidatePath("/admin");
  revalidatePath("/");
  return { ok: true };
}

// ---------- 거래(예약/판매/교환) ----------
export type DealInput = {
  direction: DealDirection;
  kind: DealKind;
  price: number | null;
  counterpart: string | null;
  meet_at: string | null; // ISO or datetime-local
  meet_place: string | null;
  memo: string | null;
};

function cleanDeal(input: DealInput) {
  return {
    direction: input.direction === "in" ? "in" : "out",
    kind: input.kind === "trade" ? "trade" : "sale",
    price:
      input.price === null || input.price === undefined || Number.isNaN(Number(input.price))
        ? null
        : num0(input.price),
    counterpart: input.counterpart?.trim() || null,
    meet_at: input.meet_at ? new Date(input.meet_at).toISOString() : null,
    meet_place: input.meet_place?.trim() || null,
    memo: input.memo?.trim() || null,
  };
}

export async function addDeal(
  cardId: number,
  input: DealInput
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user } = await authed();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  const clean = cleanDeal(input);

  // 방출(out) 거래는 가용 수량을 초과할 수 없음. (영입(in)은 재고와 무관)
  if (clean.direction === "out") {
    const { data: h } = await supabase
      .from("card_holdings")
      .select("qty_total, qty_keep")
      .eq("card_id", cardId)
      .eq("owner_id", user.id)
      .maybeSingle();
    const total = num0(h?.qty_total);
    const keep = num0(h?.qty_keep);
    const { count: usedOut } = await supabase
      .from("card_deals")
      .select("id", { count: "exact", head: true })
      .eq("card_id", cardId)
      .eq("owner_id", user.id)
      .eq("direction", "out");
    const avail = total - keep - (usedOut ?? 0);
    if (avail < 1)
      return {
        ok: false,
        error: "방출 가능 수량이 없어요. 보유 수량을 먼저 늘리거나 소장 수량을 줄여주세요.",
      };
  }

  const { error } = await supabase.from("card_deals").insert({
    card_id: cardId,
    owner_id: user.id,
    status: "reserved",
    ...clean,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/cards/${cardId}`);
  revalidatePath("/");
  revalidatePath("/admin/holdings");
  revalidatePath("/admin/deals");
  return { ok: true };
}

export async function updateDeal(
  dealId: number,
  cardId: number,
  input: DealInput
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user } = await authed();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };
  const { error } = await supabase.from("card_deals").update(cleanDeal(input)).eq("id", dealId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/cards/${cardId}`);
  revalidatePath("/");
  revalidatePath("/admin/deals");
  return { ok: true };
}

export async function setDealStatus(
  dealId: number,
  cardId: number,
  status: DealStatus
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user } = await authed();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };
  const { error } = await supabase
    .from("card_deals")
    .update({ status: status === "done" ? "done" : "reserved" })
    .eq("id", dealId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/cards/${cardId}`);
  revalidatePath("/");
  revalidatePath("/admin/holdings");
  revalidatePath("/admin/deals");
  return { ok: true };
}

export async function deleteDeal(
  dealId: number,
  cardId: number
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user } = await authed();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };
  const { error } = await supabase.from("card_deals").delete().eq("id", dealId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/cards/${cardId}`);
  revalidatePath("/");
  revalidatePath("/admin/holdings");
  revalidatePath("/admin/deals");
  return { ok: true };
}

// ---------- 종류별 글로벌 기본 가격 ----------
export async function updateCardTypePrices(
  rows: { id: number; default_price: number }[]
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user } = await authed();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };
  for (const r of rows) {
    const { error } = await supabase
      .from("card_types")
      .update({ default_price: num0(r.default_price) })
      .eq("id", r.id);
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/admin/prices");
  revalidatePath("/");
  return { ok: true };
}

// ---------- 카드 단위 수정 (개별 가격 / 메모) ----------
export async function updateCard(
  cardId: number,
  patch: { price_override: number | null; memo: string | null }
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user } = await authed();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };
  const price =
    patch.price_override === null || Number.isNaN(Number(patch.price_override))
      ? null
      : num0(patch.price_override);
  const { error } = await supabase
    .from("cards")
    .update({ price_override: price, memo: patch.memo?.trim() || null })
    .eq("id", cardId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/cards");
  revalidatePath("/");
  revalidatePath(`/cards/${cardId}`);
  return { ok: true };
}
