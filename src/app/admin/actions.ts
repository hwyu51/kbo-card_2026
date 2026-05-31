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

  const payload = rows.map((r) => ({
    card_id: Number(r.card_id),
    owner_id: user.id,
    qty_total: num0(r.qty_total),
    qty_keep: num0(r.qty_keep),
    is_wanted: Boolean(r.is_wanted),
  }));

  if (payload.length) {
    const { error } = await supabase
      .from("card_holdings")
      .upsert(payload, { onConflict: "card_id,owner_id" });
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
  const { error } = await supabase.from("card_deals").insert({
    card_id: cardId,
    owner_id: user.id,
    status: "reserved",
    ...cleanDeal(input),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/cards/${cardId}`);
  revalidatePath("/");
  revalidatePath("/admin/holdings");
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
