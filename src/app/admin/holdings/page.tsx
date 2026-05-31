import { loadTeamCatalog } from "@/lib/admin-catalog";
import TeamTabs from "../_components/team-tabs";
import HoldingsEditor from "./holdings-editor";

export const dynamic = "force-dynamic";

export default async function HoldingsPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  const { team } = await searchParams;
  const cat = await loadTeamCatalog(team);

  if (!cat) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-bold">보유 입력</h1>
        <p className="text-sm text-zinc-500">
          카탈로그가 비어 있어요. Supabase에서 <code>schema.sql</code> 실행 후 다시 열어주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">보유 입력</h1>
        <p className="text-sm text-zinc-500">
          내가 가진 수량만 입력하면 됩니다. (다른 관리자 입력과 합산되어 공개 페이지에 표시)
        </p>
      </div>
      <TeamTabs teams={cat.teams} active={cat.team.slug} base="/admin/holdings" />
      <HoldingsEditor key={cat.team.slug} teamName={cat.team.name} groups={cat.groups} />
    </div>
  );
}
