"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import type { CardType, Team } from "@/lib/types";

type View = "owned" | "wanted" | "all";

const VIEWS: { key: View; label: string }[] = [
  { key: "owned", label: "보유" },
  { key: "wanted", label: "희망" },
  { key: "all", label: "전체" },
];

export default function FilterBar({
  teams,
  cardTypes,
}: {
  teams: Team[];
  cardTypes: CardType[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  const view = (params.get("view") as View) || "owned";
  const team = params.get("team") || "";
  const type = params.get("type") || "";
  const q = params.get("q") || "";

  const update = useCallback(
    (patch: Record<string, string>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      router.push(`/?${next.toString()}`, { scroll: false });
    },
    [params, router]
  );

  return (
    <div className="flex flex-col gap-3">
      {/* 보기 토글 */}
      <div className="inline-flex w-fit rounded-lg border border-zinc-200 bg-white p-0.5">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            onClick={() => update({ view: v.key === "owned" ? "" : v.key })}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
              view === v.key
                ? "bg-zinc-900 text-white"
                : "text-zinc-500 hover:text-zinc-900"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* 팀 / 종류 / 검색 */}
      <div className="flex flex-wrap gap-2">
        <select
          value={team}
          onChange={(e) => update({ team: e.target.value })}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm"
        >
          <option value="">전체 구단</option>
          {teams.map((t) => (
            <option key={t.id} value={t.slug}>
              {t.name}
            </option>
          ))}
        </select>

        <select
          value={type}
          onChange={(e) => update({ type: e.target.value })}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm"
        >
          <option value="">전체 종류</option>
          {cardTypes.map((ct) => (
            <option key={ct.id} value={ct.code}>
              {ct.name}
            </option>
          ))}
        </select>

        <input
          type="search"
          defaultValue={q}
          placeholder="선수명 검색"
          onKeyDown={(e) => {
            if (e.key === "Enter") update({ q: (e.target as HTMLInputElement).value });
          }}
          className="flex-1 min-w-[140px] rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm"
        />
      </div>
    </div>
  );
}
