import Link from "next/link";
import type { PublicCard, Team } from "@/lib/types";
import { cardDisplayName, formatPrice, statusColor, statusLabel } from "@/lib/cards";

// 공개 카드 목록 — 구단별 카탈로그 표. 선수는 구단 안에서 한 번만 표기(〃),
// 종류/가격/상태/수량을 한 줄에. 행(선수·종류)을 누르면 상세로.
export default function CardTable({ cards, teams }: { cards: PublicCard[]; teams: Team[] }) {
  // 구단 순서 → 선수 → 종류(sort) 순 정렬
  const teamOrder = new Map(teams.map((t, i) => [t.slug, i]));
  const sorted = [...cards].sort((a, b) => {
    const ta = teamOrder.get(a.team_slug) ?? 999;
    const tb = teamOrder.get(b.team_slug) ?? 999;
    if (ta !== tb) return ta - tb;
    const pa = a.player_id ?? 1e9;
    const pb = b.player_id ?? 1e9;
    if (pa !== pb) return pa - pb;
    return a.card_type_sort - b.card_type_sort;
  });

  // 구단별 그룹
  const groups: { team: string; rows: PublicCard[] }[] = [];
  for (const c of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.team === c.team_name) last.rows.push(c);
    else groups.push({ team: c.team_name, rows: [c] });
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-zinc-100 text-xs text-zinc-500">
            <th className="px-3 py-2 text-left font-medium">선수</th>
            <th className="px-3 py-2 text-left font-medium">종류</th>
            <th className="px-3 py-2 text-right font-medium">가격</th>
            <th className="px-3 py-2 text-center font-medium">상태</th>
            <th className="px-3 py-2 text-right font-medium">가능</th>
            <th className="px-3 py-2 text-right font-medium">예약</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            return (
              <FragmentGroup key={g.team}>
                <tr className="bg-zinc-50">
                  <td colSpan={6} className="px-3 py-1.5 text-xs font-semibold text-zinc-600">
                    {g.team}
                    <span className="ml-1.5 font-normal text-zinc-400">{g.rows.length}</span>
                  </td>
                </tr>
                {g.rows.map((c, idx) => {
                  const pid = c.player_id ?? -1;
                  const prev = idx > 0 ? g.rows[idx - 1].player_id ?? -1 : -2;
                  const first = pid !== prev;
                  return (
                    <tr key={c.id} className="border-t border-zinc-100 hover:bg-sky-50/50">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {first ? (
                          <Link href={`/cards/${c.id}`} className="font-medium text-zinc-800 hover:underline">
                            {c.player_name ?? cardDisplayName(c)}
                            {c.jersey_no != null && (
                              <span className="ml-1 text-xs text-zinc-400">#{c.jersey_no}</span>
                            )}
                          </Link>
                        ) : (
                          <span className="text-zinc-300">〃</span>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <Link href={`/cards/${c.id}`} className="inline-flex items-center gap-1.5 hover:underline">
                          <span>{c.card_type_name}</span>
                          {c.is_special && (
                            <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">
                              레전드
                            </span>
                          )}
                          {c.is_wanted && (
                            <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-600">
                              희망
                            </span>
                          )}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-zinc-900 whitespace-nowrap">
                        {formatPrice(c.price)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusColor(c)}`}>
                          {statusLabel(c)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-emerald-700 whitespace-nowrap">
                        {c.qty_owned > 0 ? c.qty_available : "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-amber-600 whitespace-nowrap">
                        {c.qty_reserved > 0 ? c.qty_reserved : "—"}
                      </td>
                    </tr>
                  );
                })}
              </FragmentGroup>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// <tbody> 안에서 그룹을 묶기 위한 Fragment (key 부여용)
function FragmentGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
