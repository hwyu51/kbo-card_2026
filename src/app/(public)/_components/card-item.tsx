import Link from "next/link";
import type { PublicCard } from "@/lib/types";
import { cardDisplayName, formatPrice, statusColor, statusLabel } from "@/lib/cards";

export default function CardItem({ card }: { card: PublicCard }) {
  return (
    <Link
      href={`/cards/${card.id}`}
      className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-3.5 transition hover:border-zinc-300 hover:shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-1">
        {card.is_special && (
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700">
            레전드
          </span>
        )}
        {card.is_wanted && (
          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-600">
            희망
          </span>
        )}
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusColor(card)}`}>
          {statusLabel(card)}
        </span>
      </div>

      <div>
        <div className="text-xs text-zinc-400">
          {card.team_name} · {card.card_type_name}
        </div>
        <div className="text-base font-bold leading-tight">{cardDisplayName(card)}</div>
      </div>

      <div className="mt-auto flex items-end justify-between pt-1">
        <span className="text-lg font-extrabold text-zinc-900">{formatPrice(card.price)}</span>
        {card.qty_owned > 0 && (
          <span className="text-xs text-zinc-400">
            가능 {card.qty_available}
            {card.qty_reserved > 0 && ` · 예약 ${card.qty_reserved}`}
          </span>
        )}
      </div>
    </Link>
  );
}
