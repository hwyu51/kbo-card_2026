import { loadTeamCatalog } from "@/lib/admin-catalog";
import TeamTabs from "../_components/team-tabs";
import WishlistEditor from "./wishlist-editor";

export const dynamic = "force-dynamic";

export default async function WishlistPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  const { team } = await searchParams;
  const cat = await loadTeamCatalog(team);

  if (!cat) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-bold">희망 입력</h1>
        <p className="text-sm text-zinc-500">
          카탈로그가 비어 있어요. Supabase에서 <code>schema.sql</code> 실행 후 다시 열어주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">희망 입력</h1>
        <p className="text-sm text-zinc-500">
          내가 찾는 카드를 체크하세요. 공개 페이지엔 구단 구분 없이 “희망”으로만 표시됩니다.
        </p>
      </div>
      <TeamTabs teams={cat.teams} active={cat.team.slug} base="/admin/wishlist" />
      <WishlistEditor key={cat.team.slug} teamName={cat.team.name} groups={cat.groups} />
    </div>
  );
}
