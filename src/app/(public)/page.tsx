import { createClient } from "@/lib/supabase/server";
import type { CardType, PublicCard, Team } from "@/lib/types";
import CardTable from "./_components/card-table";
import FilterBar from "./_components/filter-bar";

export const dynamic = "force-dynamic";

type SearchParams = {
  view?: string;
  team?: string;
  type?: string;
  q?: string;
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const view = sp.view ?? "owned";
  const teamSlug = sp.team ?? "";
  const typeCode = sp.type ?? "";
  const q = (sp.q ?? "").trim().toLowerCase();

  const supabase = await createClient();

  const [{ data: cardsData }, { data: teamsData }, { data: typesData }] =
    await Promise.all([
      supabase.from("public_cards").select("*").order("created_at", { ascending: false }),
      supabase.from("teams").select("*").order("id"),
      supabase.from("card_types").select("*").order("sort_order"),
    ]);

  const allCards = (cardsData ?? []) as PublicCard[];
  const teams = (teamsData ?? []) as Team[];
  const cardTypes = (typesData ?? []) as CardType[];

  // 실제 카드가 존재하는 종류만 필터 옵션으로 노출 (빈 종류 숨김)
  const presentCodes = new Set(allCards.map((c) => c.card_type_code));
  const visibleTypes = cardTypes.filter((ct) => presentCodes.has(ct.code));

  // 상단 지표 (전체 기준)
  const totalOwned = allCards.reduce((s, c) => s + c.qty_owned, 0);
  const totalAvailable = allCards.reduce((s, c) => s + c.qty_available, 0);
  const totalReserved = allCards.reduce((s, c) => s + c.qty_reserved, 0);
  const wantedCount = allCards.filter((c) => c.is_wanted).length;

  // 필터 적용
  const filtered = allCards.filter((c) => {
    if (view === "owned" && c.qty_owned <= 0) return false;
    if (view === "wanted" && !c.is_wanted) return false;
    if (teamSlug && c.team_slug !== teamSlug) return false;
    if (typeCode && c.card_type_code !== typeCode) return false;
    if (q) {
      const hay = `${c.player_name ?? ""} ${c.title ?? ""} ${c.card_number ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* 상단 지표 */}
      <section className="rounded-2xl bg-zinc-900 px-6 py-8 text-white">
        <div className="text-sm text-zinc-400">보유 카드 총</div>
        <div className="mt-1 text-5xl font-extrabold tracking-tight">
          {totalOwned.toLocaleString("ko-KR")}
          <span className="ml-1 text-2xl font-bold text-zinc-300">장</span>
        </div>
        <div className="mt-4 flex gap-4 text-sm text-zinc-300">
          <span>판매/교환 가능 <b className="text-white">{totalAvailable}</b></span>
          <span>예약중 <b className="text-white">{totalReserved}</b></span>
          <span>희망 카드 <b className="text-white">{wantedCount}</b></span>
        </div>
      </section>

      <FilterBar teams={teams} cardTypes={visibleTypes} />

      <div className="text-sm text-zinc-500">{filtered.length}개</div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 py-16 text-center text-zinc-400">
          조건에 맞는 카드가 없어요.
        </div>
      ) : (
        <CardTable cards={filtered} teams={teams} wishlist={view === "wanted"} />
      )}
    </div>
  );
}
