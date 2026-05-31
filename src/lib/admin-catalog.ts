import { createClient } from "@/lib/supabase/server";
import type { CardType, Team } from "./types";

export type CatalogCard = {
  card_id: number;
  card_type_id: number;
  card_type_code: string;
  card_type_name: string;
  card_type_sort: number;
  card_number: string | null;
  variant: string | null;
  is_special: boolean;
  // 현재 로그인 유저의 보유/희망 (없으면 0/false)
  qty_available: number;
  qty_reserved: number;
  qty_completed: number;
  is_wanted: boolean;
};

export type PlayerGroup = {
  player_id: number | null;
  player_name: string;
  position: string | null;
  jersey_no: number | null;
  cards: CatalogCard[];
};

export type TeamCatalog = {
  teams: Team[];
  team: Team;
  cardTypes: CardType[];
  groups: PlayerGroup[];
};

type ToOne<T> = T | T[] | null;
function one<T>(v: ToOne<T>): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

// 팀별 카탈로그(선수 그룹) + 현재 유저의 holdings 병합
export async function loadTeamCatalog(teamSlug?: string): Promise<TeamCatalog | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: teamsData } = await supabase.from("teams").select("*").order("id");
  const teams = (teamsData ?? []) as Team[];
  if (teams.length === 0) return null;
  const team = teams.find((t) => t.slug === teamSlug) ?? teams[0];

  const { data: typesData } = await supabase
    .from("card_types")
    .select("*")
    .order("sort_order");
  const cardTypes = (typesData ?? []) as CardType[];

  const { data: cardsData } = await supabase
    .from("cards")
    .select(
      "id, card_number, variant, is_special, player_id, players(name, position, jersey_no), card_type_id, card_types(name, code, sort_order)"
    )
    .eq("team_id", team.id);

  const { data: holdData } = await supabase
    .from("card_holdings")
    .select("card_id, qty_available, qty_reserved, qty_completed, is_wanted")
    .eq("owner_id", user.id);

  const holdMap = new Map<
    number,
    { qty_available: number; qty_reserved: number; qty_completed: number; is_wanted: boolean }
  >();
  for (const h of holdData ?? []) {
    holdMap.set(h.card_id as number, {
      qty_available: Number(h.qty_available) || 0,
      qty_reserved: Number(h.qty_reserved) || 0,
      qty_completed: Number(h.qty_completed) || 0,
      is_wanted: Boolean(h.is_wanted),
    });
  }

  // 선수별 그룹화
  const groups = new Map<number, PlayerGroup>();
  for (const row of (cardsData ?? []) as Record<string, unknown>[]) {
    const player = one(row.players as ToOne<{ name: string; position: string | null; jersey_no: number | null }>);
    const ct = one(row.card_types as ToOne<{ name: string; code: string; sort_order: number }>);
    const pid = (row.player_id as number | null) ?? -1;

    if (!groups.has(pid)) {
      groups.set(pid, {
        player_id: pid === -1 ? null : pid,
        player_name: player?.name ?? "(미지정)",
        position: player?.position ?? null,
        jersey_no: player?.jersey_no ?? null,
        cards: [],
      });
    }
    const h = holdMap.get(row.id as number);
    groups.get(pid)!.cards.push({
      card_id: row.id as number,
      card_type_id: row.card_type_id as number,
      card_type_code: ct?.code ?? "",
      card_type_name: ct?.name ?? "",
      card_type_sort: ct?.sort_order ?? 0,
      card_number: (row.card_number as string | null) ?? null,
      variant: (row.variant as string | null) ?? null,
      is_special: Boolean(row.is_special),
      qty_available: h?.qty_available ?? 0,
      qty_reserved: h?.qty_reserved ?? 0,
      qty_completed: h?.qty_completed ?? 0,
      is_wanted: h?.is_wanted ?? false,
    });
  }

  // 각 선수 카드: 종류 정렬 / 그룹: 선수 id(=카탈로그 순서)
  const sorted = [...groups.values()].sort((a, b) => (a.player_id ?? 1e9) - (b.player_id ?? 1e9));
  for (const g of sorted) g.cards.sort((a, b) => a.card_type_sort - b.card_type_sort);

  return { teams, team, cardTypes, groups: sorted };
}
