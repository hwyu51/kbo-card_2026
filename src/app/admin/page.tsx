import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="text-xs text-zinc-400">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {sub && <div className="text-xs text-zinc-400">{sub}</div>}
    </div>
  );
}

export default async function AdminDashboard() {
  const supabase = await createClient();

  // 합산 통계는 public_cards 뷰(owner 전체 합산) 기준.
  // 완료/소장은 RLS상 본인 행만 보이므로 "내 기준"으로 표시.
  const [{ data: pub }, { data: ownHold }, { data: ownDeals }] = await Promise.all([
    supabase.from("public_cards").select("qty_owned, qty_available, qty_reserved, is_wanted"),
    supabase.from("card_holdings").select("qty_keep"),
    supabase.from("card_deals").select("id").eq("direction", "out").eq("status", "done"),
  ]);

  const rows = pub ?? [];
  const owned = rows.reduce((s, r) => s + Number(r.qty_owned ?? 0), 0);
  const available = rows.reduce((s, r) => s + Number(r.qty_available ?? 0), 0);
  const reserved = rows.reduce((s, r) => s + Number(r.qty_reserved ?? 0), 0);
  const wantedTypes = rows.filter((r) => r.is_wanted).length;
  const notOwnedTypes = rows.filter((r) => Number(r.qty_owned ?? 0) === 0).length;
  const totalTypes = rows.length;
  const myKeep = (ownHold ?? []).reduce((s, r) => s + Number(r.qty_keep ?? 0), 0);
  const myCompleted = (ownDeals ?? []).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">대시보드</h1>
        <span className="text-sm text-zinc-400">등록 카드 종류 {totalTypes}종</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        <Stat label="보유 총 장수" value={owned} sub="가능 + 예약 (전체)" />
        <Stat label="판매/교환 가능" value={available} />
        <Stat label="예약중" value={reserved} />
        <Stat label="거래 완료" value={myCompleted} sub="내 방출 기준" />
        <Stat label="소장(비매)" value={myKeep} sub="내 기준" />
        <Stat label="미보유" value={`${notOwnedTypes}종`} />
        <Stat label="희망" value={`${wantedTypes}종`} />
      </div>

      {totalTypes === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
          아직 카탈로그가 비어 있어요. Supabase에서 <code>schema.sql</code>을 실행하면 카드가 채워집니다.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/admin/holdings"
          className="rounded-xl border border-zinc-200 bg-white p-5 hover:shadow-sm"
        >
          <div className="font-semibold">보유 입력 →</div>
          <div className="text-sm text-zinc-500">구단별 카탈로그에 가능/예약/완료 수량 입력</div>
        </Link>
        <Link
          href="/admin/wishlist"
          className="rounded-xl border border-zinc-200 bg-white p-5 hover:shadow-sm"
        >
          <div className="font-semibold">희망 입력 →</div>
          <div className="text-sm text-zinc-500">찾는 카드 체크 · 구단 일괄 희망 지정</div>
        </Link>
      </div>
    </div>
  );
}
