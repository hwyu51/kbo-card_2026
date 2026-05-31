import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { PublicCard } from "@/lib/types";
import { cardDisplayName, formatPrice, statusColor, statusLabel } from "@/lib/cards";

export const dynamic = "force-dynamic";

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("public_cards")
    .select("*")
    .eq("id", Number(id))
    .maybeSingle();

  if (!data) notFound();
  const card = data as PublicCard;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900">
        ← 목록으로
      </Link>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-zinc-100">
          {card.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={card.image_url}
              alt={cardDisplayName(card)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-6xl text-zinc-300">
              ⚾
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-1.5">
            {card.is_special && (
              <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-medium text-violet-700">
                레전드
              </span>
            )}
            {card.is_wanted && (
              <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-600">
                희망 카드
              </span>
            )}
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusColor(card)}`}
            >
              {statusLabel(card)}
            </span>
          </div>

          <div>
            <div className="text-sm text-zinc-400">
              {card.team_name} · {card.card_type_name}
              {card.card_number ? ` · ${card.card_number}` : ""}
            </div>
            <h1 className="mt-1 text-2xl font-bold">{cardDisplayName(card)}</h1>
            {card.variant && (
              <div className="mt-1 text-sm text-zinc-500">{card.variant}</div>
            )}
          </div>

          <div className="text-3xl font-extrabold">{formatPrice(card.price)}</div>

          <dl className="grid grid-cols-2 gap-2 rounded-xl border border-zinc-200 bg-white p-4 text-sm">
            <div>
              <dt className="text-zinc-400">판매/교환 가능</dt>
              <dd className="text-lg font-semibold">{card.qty_available}장</dd>
            </div>
            <div>
              <dt className="text-zinc-400">예약중</dt>
              <dd className="text-lg font-semibold">{card.qty_reserved}장</dd>
            </div>
          </dl>

          {card.memo && (
            <p className="whitespace-pre-wrap rounded-xl bg-zinc-100 p-4 text-sm text-zinc-700">
              {card.memo}
            </p>
          )}

          <div className="mt-2 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
            구매·교환 문의는 <b>당근마켓 채팅</b>으로 부탁드려요. 🥕
          </div>
        </div>
      </div>
    </div>
  );
}
