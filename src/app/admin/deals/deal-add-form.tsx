"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DealDirection, DealKind } from "@/lib/types";
import { addDeal } from "../actions";

export type CardOption = { id: number; label: string };

export default function DealAddForm({ cards }: { cards: CardOption[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  // 카드 선택
  const [search, setSearch] = useState("");
  const [cardId, setCardId] = useState<number | null>(null);
  const selected = useMemo(() => cards.find((c) => c.id === cardId) ?? null, [cards, cardId]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return cards.filter((c) => c.label.toLowerCase().includes(q)).slice(0, 20);
  }, [cards, search]);

  // 거래 필드
  const [dir, setDir] = useState<DealDirection>("out");
  const [kind, setKind] = useState<DealKind>("sale");
  const [price, setPrice] = useState("");
  const [counterpart, setCounterpart] = useState("");
  const [meetAt, setMeetAt] = useState("");
  const [meetPlace, setMeetPlace] = useState("");
  const [memo, setMemo] = useState("");

  const reset = () => {
    setCardId(null);
    setSearch("");
    setPrice("");
    setCounterpart("");
    setMeetAt("");
    setMeetPlace("");
    setMemo("");
  };

  const submit = () => {
    if (!cardId) {
      setMsg("카드를 먼저 선택하세요.");
      return;
    }
    setMsg(null);
    start(async () => {
      const res = await addDeal(cardId, {
        direction: dir,
        kind,
        price: kind === "sale" && price ? Number(price) : null,
        counterpart,
        meet_at: meetAt || null,
        meet_place: meetPlace,
        memo,
      });
      if (res.ok) {
        setMsg("거래가 추가됐어요.");
        reset();
        router.refresh();
      } else setMsg(`실패: ${res.error}`);
    });
  };

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <button
          onClick={() => setOpen(true)}
          className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          + 거래/예약 추가
        </button>
        {msg && <span className="text-xs text-zinc-500">{msg}</span>}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-emerald-600/20 bg-emerald-50/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-zinc-700">거래/예약 추가</h2>
        <button
          onClick={() => {
            setOpen(false);
            reset();
            setMsg(null);
          }}
          className="rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100"
        >
          닫기
        </button>
      </div>

      {/* 1) 카드 선택 */}
      {selected ? (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm">
          <span className="font-medium text-zinc-800">{selected.label}</span>
          <button
            onClick={() => {
              setCardId(null);
              setSearch("");
            }}
            className="ml-auto rounded-md px-2 py-1 text-xs text-zinc-500 ring-1 ring-zinc-300 hover:bg-zinc-100"
          >
            변경
          </button>
        </div>
      ) : (
        <div className="mb-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="카드 검색 (선수·구단·종류)"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
          {matches.length > 0 && (
            <ul className="mt-1 max-h-52 overflow-y-auto rounded-lg border border-zinc-200 bg-white">
              {matches.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => setCardId(c.id)}
                    className="block w-full px-3 py-1.5 text-left text-sm hover:bg-sky-50"
                  >
                    {c.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {search.trim() && matches.length === 0 && (
            <p className="mt-1 text-xs text-zinc-400">일치하는 카드가 없어요.</p>
          )}
        </div>
      )}

      {/* 2) 거래 필드 (카드 선택 후) */}
      {selected && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Field label="방향">
              <Select
                value={dir}
                onChange={(v) => setDir(v as DealDirection)}
                opts={[
                  ["out", "방출(판매/교환)"],
                  ["in", "영입(희망)"],
                ]}
              />
            </Field>
            <Field label="유형">
              <Select
                value={kind}
                onChange={(v) => setKind(v as DealKind)}
                opts={[
                  ["sale", "판매"],
                  ["trade", "교환"],
                ]}
              />
            </Field>
            {kind === "sale" && (
              <Field label="가격">
                <input
                  type="number"
                  min={0}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="원"
                  className="h-9 w-full rounded-md border border-zinc-300 px-2 text-sm"
                />
              </Field>
            )}
            <Field label="상대(누구)">
              <input
                value={counterpart}
                onChange={(e) => setCounterpart(e.target.value)}
                className="h-9 w-full rounded-md border border-zinc-300 px-2 text-sm"
              />
            </Field>
            <Field label="일시">
              <input
                type="datetime-local"
                value={meetAt}
                onChange={(e) => setMeetAt(e.target.value)}
                className="h-9 w-full rounded-md border border-zinc-300 px-2 text-sm"
              />
            </Field>
            <Field label="장소">
              <input
                value={meetPlace}
                onChange={(e) => setMeetPlace(e.target.value)}
                className="h-9 w-full rounded-md border border-zinc-300 px-2 text-sm"
              />
            </Field>
            <Field label="메모">
              <input
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                className="h-9 w-full rounded-md border border-zinc-300 px-2 text-sm"
              />
            </Field>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={submit}
              disabled={pending}
              className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {pending ? "추가 중…" : "예약 추가"}
            </button>
            {msg && <span className="text-xs text-zinc-500">{msg}</span>}
            <span className="text-xs text-zinc-400">방출은 가용 수량을 초과할 수 없어요.</span>
          </div>
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-xs text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

function Select({
  value,
  onChange,
  opts,
}: {
  value: string;
  onChange: (v: string) => void;
  opts: [string, string][];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-md border border-zinc-300 px-2 text-sm"
    >
      {opts.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}
