import { createClient } from "@/lib/supabase/server";
import type { CardDeal } from "@/lib/types";
import DealsList, { type DealRow } from "./deals-list";
import DealAddForm, { type CardOption } from "./deal-add-form";

export const dynamic = "force-dynamic";

export default async function AdminDealsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null; // 레이아웃에서 이미 보호됨

  // 전체 카드 카탈로그 (거래 추가 시 카드 선택용) + 내 거래
  const [{ data: dealsData }, { data: allCards }] = await Promise.all([
    supabase
      .from("card_deals")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("public_cards")
      .select("id, team_name, player_name, card_type_name, team_id, player_id, card_type_sort")
      .order("team_id")
      .order("player_id")
      .order("card_type_sort"),
  ]);
  const deals = (dealsData ?? []) as CardDeal[];

  const labelOf = (c: { team_name: string; player_name: string | null; card_type_name: string }) =>
    `${c.team_name} ${c.player_name ?? ""} · ${c.card_type_name}`.replace(/\s+/g, " ").trim();

  const cardOptions: CardOption[] = (allCards ?? []).map((c) => ({
    id: c.id as number,
    label: labelOf(c as { team_name: string; player_name: string | null; card_type_name: string }),
  }));
  const cardLabel = new Map<number, string>(cardOptions.map((c) => [c.id, c.label]));

  const rows: DealRow[] = deals.map((d) => ({
    ...d,
    card_label: cardLabel.get(d.card_id) ?? `카드 #${d.card_id}`,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">거래 / 예약 리스트</h1>
        <p className="text-sm text-zinc-500">
          내가 등록한 거래 전체. 예약중을 한눈에 보고 완료 처리·삭제할 수 있어요. (나만 보임)
        </p>
      </div>
      <DealAddForm cards={cardOptions} />
      <DealsList rows={rows} />
    </div>
  );
}
