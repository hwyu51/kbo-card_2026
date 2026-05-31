import { createClient } from "@/lib/supabase/server";
import type { CardType } from "@/lib/types";
import PricesEditor from "./prices-editor";

export const dynamic = "force-dynamic";

export default async function AdminPricesPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("card_types").select("*").order("sort_order");
  const cardTypes = (data ?? []) as CardType[];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">가격 설정</h1>
        <p className="text-sm text-zinc-500">
          종류별 글로벌 기본 가격. 변경하면 개별 가격이 없는 카드에 즉시 반영됩니다.
        </p>
      </div>
      <PricesEditor cardTypes={cardTypes} />
    </div>
  );
}
