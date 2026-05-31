import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Row = {
  qty_available: number;
  qty_reserved: number;
  qty_completed: number;
  is_wanted: boolean;
};

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
  const { data } = await supabase
    .from("cards")
    .select("qty_available, qty_reserved, qty_completed, is_wanted");

  const rows = (data ?? []) as Row[];

  const owned = rows.reduce((s, r) => s + r.qty_available + r.qty_reserved, 0);
  const available = rows.reduce((s, r) => s + r.qty_available, 0);
  const reserved = rows.reduce((s, r) => s + r.qty_reserved, 0);
  const completed = rows.reduce((s, r) => s + r.qty_completed, 0);
  const notOwnedTypes = rows.filter((r) => r.qty_available + r.qty_reserved === 0).length;
  const wantedTypes = rows.filter((r) => r.is_wanted).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">대시보드</h1>
        <span className="text-sm text-zinc-400">등록 카드 종류 {rows.length}종</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="보유 총 장수" value={owned} sub="가능 + 예약" />
        <Stat label="판매/교환 가능" value={available} />
        <Stat label="예약중" value={reserved} />
        <Stat label="거래 완료" value={completed} sub="공개 숨김" />
        <Stat label="미보유" value={`${notOwnedTypes}종`} />
        <Stat label="희망" value={`${wantedTypes}종`} />
      </div>

      {rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
          아직 등록된 카드가 없어요.
          <div className="mt-3">
            <Link
              href="/admin/cards/bulk"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-white"
            >
              CSV로 벌크 업로드 하기 →
            </Link>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/admin/cards"
          className="rounded-xl border border-zinc-200 bg-white p-5 hover:shadow-sm"
        >
          <div className="font-semibold">카드 관리 →</div>
          <div className="text-sm text-zinc-500">등록·수정, 수량/가격/희망, 예약·완료 리스트</div>
        </Link>
        <Link
          href="/admin/cards/bulk"
          className="rounded-xl border border-zinc-200 bg-white p-5 hover:shadow-sm"
        >
          <div className="font-semibold">벌크 업로드 →</div>
          <div className="text-sm text-zinc-500">CSV 양식으로 보유 카드 일괄 등록/갱신</div>
        </Link>
      </div>
    </div>
  );
}
