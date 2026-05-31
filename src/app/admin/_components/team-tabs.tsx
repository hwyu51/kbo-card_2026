import Link from "next/link";
import type { Team } from "@/lib/types";

// 구단 선택 탭 (URL ?team=slug)
export default function TeamTabs({
  teams,
  active,
  base,
}: {
  teams: Team[];
  active: string;
  base: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {teams.map((t) => (
        <Link
          key={t.id}
          href={`${base}?team=${t.slug}`}
          className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
            t.slug === active
              ? "bg-zinc-900 text-white"
              : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-100"
          }`}
        >
          {t.name}
        </Link>
      ))}
    </div>
  );
}
