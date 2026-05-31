"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type HoldingRow = {
  card_id: number;
  qty_available: number;
  qty_reserved: number;
  qty_completed: number;
  is_wanted: boolean;
};

// 보유/희망 공통 저장: 값이 있으면 upsert, 모두 0·미희망이면 삭제 (본인 owner_id 행만)
export async function saveHoldings(
  rows: HoldingRow[]
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  const clean = rows.map((r) => ({
    card_id: Number(r.card_id),
    qty_available: Math.max(0, Math.floor(Number(r.qty_available) || 0)),
    qty_reserved: Math.max(0, Math.floor(Number(r.qty_reserved) || 0)),
    qty_completed: Math.max(0, Math.floor(Number(r.qty_completed) || 0)),
    is_wanted: Boolean(r.is_wanted),
  }));

  const isEmpty = (r: (typeof clean)[number]) =>
    !(r.qty_available || r.qty_reserved || r.qty_completed || r.is_wanted);

  const toUpsert = clean.filter((r) => !isEmpty(r)).map((r) => ({ ...r, owner_id: user.id }));
  const toDeleteIds = clean.filter(isEmpty).map((r) => r.card_id);

  if (toUpsert.length) {
    const { error } = await supabase
      .from("card_holdings")
      .upsert(toUpsert, { onConflict: "card_id,owner_id" });
    if (error) return { ok: false, error: error.message };
  }
  if (toDeleteIds.length) {
    const { error } = await supabase
      .from("card_holdings")
      .delete()
      .eq("owner_id", user.id)
      .in("card_id", toDeleteIds);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/admin/holdings");
  revalidatePath("/admin/wishlist");
  revalidatePath("/admin");
  return { ok: true };
}
