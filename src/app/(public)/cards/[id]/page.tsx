import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CardDeal, PublicCard } from "@/lib/types";
import { cardDisplayName, formatPrice, statusColor, statusLabel } from "@/lib/cards";
import CardAdminPanel from "./card-admin-panel";

export const dynamic = "force-dynamic";

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cardId = Number(id);
  const supabase = await createClient();

  const { data } = await supabase.from("public_cards").select("*").eq("id", cardId).maybeSingle();
  if (!data) notFound();
  const card = data as PublicCard;

  // 로그인한 어드민이면 본인 보유/거래 로드
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let holding = { qty_total: 0, qty_keep: 0, is_wanted: false };
  let deals: CardDeal[] = [];
  if (user) {
    const { data: h } = await supabase
      .from("card_holdings")
      .select("qty_total, qty_keep, is_wanted")
      .eq("card_id", cardId)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (h) holding = { qty_total: h.qty_total, qty_keep: h.qty_keep, is_wanted: h.is_wanted };
    const { data: d } = await supabase
      .from("card_deals")
      .select("*")
      .eq("card_id", cardId)
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });
    deals = (d ?? []) as CardDeal[];
  }

  return (
    <div className="flex flex-col gap-5">
      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900">
        ← 목록으로
      </Link>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="flex flex-wrap gap-1.5">
          {card.is_special && (
            <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-medium text-violet-700">
              레전드
            </span>
          )}
          {card.is_wanted && (
            <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-600">
              희망
            </span>
          )}
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusColor(card)}`}>
            {statusLabel(card)}
          </span>
        </div>

        <div className="mt-2 text-sm text-zinc-400">
          {card.team_name} · {card.card_type_name}
          {card.card_number ? ` · ${card.card_number}` : ""}
        </div>
        <h1 className="text-2xl font-bold">{cardDisplayName(card)}</h1>
        {card.variant && <div className="mt-1 text-sm text-zinc-500">{card.variant}</div>}

        <div className="mt-3 text-3xl font-extrabold">{formatPrice(card.price)}</div>

        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm sm:max-w-xs">
          <div className="rounded-xl bg-zinc-50 p-3">
            <dt className="text-zinc-400">판매/교환 가능</dt>
            <dd className="text-lg font-semibold">{card.qty_available}장</dd>
          </div>
          <div className="rounded-xl bg-zinc-50 p-3">
            <dt className="text-zinc-400">예약중</dt>
            <dd className="text-lg font-semibold">{card.qty_reserved}장</dd>
          </div>
        </dl>

        {card.memo && (
          <p className="mt-4 whitespace-pre-wrap rounded-xl bg-zinc-100 p-4 text-sm text-zinc-700">
            {card.memo}
          </p>
        )}

        <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
          구매·교환 문의는 <b>당근마켓 채팅</b>으로 부탁드려요. 🥕
        </div>
      </div>

      {user && (
        <CardAdminPanel
          cardId={cardId}
          cardTitle={cardDisplayName(card)}
          initialHolding={holding}
          initialDeals={deals}
        />
      )}
    </div>
  );
}
