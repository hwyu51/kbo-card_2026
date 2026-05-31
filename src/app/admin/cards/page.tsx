import { createClient } from "@/lib/supabase/server";
import type { Team } from "@/lib/types";
import TeamTabs from "../_components/team-tabs";
import CardsEditor, { type CardEditRow } from "./cards-editor";

export const dynamic = "force-dynamic";

type ToOne<T> = T | T[] | null;
const one = <T,>(v: ToOne<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v);

export default async function AdminCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  const { team: teamParam } = await searchParams;
  const supabase = await createClient();

  const { data: teamsData } = await supabase.from("teams").select("*").order("id");
  const teams = (teamsData ?? []) as Team[];
  if (teams.length === 0)
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-bold">카드 관리</h1>
        <p className="text-sm text-zinc-500">
          카탈로그가 비어 있어요. Supabase에서 <code>schema.sql</code> 실행 후 다시 열어주세요.
        </p>
      </div>
    );
  const team = teams.find((t) => t.slug === teamParam) ?? teams[0];

  const { data: cardsData } = await supabase
    .from("cards")
    .select(
      "id, card_number, variant, is_special, price_override, memo, player_id, players(name, jersey_no), card_type_id, card_types(name, sort_order, default_price)"
    )
    .eq("team_id", team.id);

  const rows: CardEditRow[] = ((cardsData ?? []) as Record<string, unknown>[])
    .map((r) => {
      const p = one(r.players as ToOne<{ name: string; jersey_no: number | null }>);
      const ct = one(r.card_types as ToOne<{ name: string; sort_order: number; default_price: number }>);
      return {
        card_id: r.id as number,
        player_id: (r.player_id as number | null) ?? 0,
        player_name: p?.name ?? "(미지정)",
        jersey_no: p?.jersey_no ?? null,
        card_type_name: ct?.name ?? "",
        card_type_sort: ct?.sort_order ?? 0,
        is_special: Boolean(r.is_special),
        default_price: Number(ct?.default_price ?? 0),
        price_override: r.price_override == null ? null : Number(r.price_override),
        memo: (r.memo as string | null) ?? "",
      };
    })
    .sort((a, b) =>
      a.player_id !== b.player_id ? a.player_id - b.player_id : a.card_type_sort - b.card_type_sort
    );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">카드 관리</h1>
        <p className="text-sm text-zinc-500">
          개별 가격(비우면 종류 기본가 적용)과 메모를 수정합니다. 보유/거래는 카드 상세에서.
        </p>
      </div>
      <TeamTabs teams={teams} active={team.slug} base="/admin/cards" />
      <CardsEditor key={team.slug} rows={rows} />
    </div>
  );
}
