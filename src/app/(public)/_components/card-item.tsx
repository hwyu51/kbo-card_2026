import Link from "next/link";
import type { PublicCard } from "@/lib/types";
import { cardDisplayName, formatPrice, statusColor, statusLabel } from "@/lib/cards";

export default function CardItem({ card }: { card: PublicCard }) {
  return (
    <Link
      href={`/cards/${card.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition hover:shadow-md"
    >
      <div className="relative aspect-[3/4] w-full bg-zinc-100">
        {card.image_url ? (
          // 외부/Storage 이미지 — next/image 도메인 설정 전이라 일반 img 사용
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.image_url}
            alt={cardDisplayName(card)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl text-zinc-300">
            ⚾
          </div>
        )}
        <div className="absolute left-2 top-2 flex gap-1">
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
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusColor(card)}`}
          >
            {statusLabel(card)}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <div className="flex items-center gap-1 text-xs text-zinc-400">
          <span>{card.team_name}</span>
          <span>·</span>
          <span>{card.card_type_name}</span>
        </div>
        <div className="line-clamp-2 text-sm font-semibold leading-snug">
          {cardDisplayName(card)}
        </div>
        <div className="mt-auto pt-1 text-sm font-bold text-zinc-900">
          {formatPrice(card.price)}
        </div>
      </div>
    </Link>
  );
}
