"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CardDeal, DealDirection, DealKind } from "@/lib/types";
import { addDeal, deleteDeal, saveHoldings, setDealStatus } from "@/app/admin/actions";
import { formatPrice } from "@/lib/cards";

type Holding = { qty_total: number; qty_keep: number; is_wanted: boolean };

export default function CardAdminPanel({
  cardId,
  cardTitle,
  initialHolding,
  initialDeals,
}: {
  cardId: number;
  cardTitle: string;
  initialHolding: Holding;
  initialDeals: CardDeal[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const [total, setTotal] = useState(initialHolding.qty_total);
  const [keep, setKeep] = useState(initialHolding.qty_keep);
  const [wanted, setWanted] = useState(initialHolding.is_wanted);

  const reservedOut = initialDeals.filter((d) => d.direction === "out" && d.status === "reserved").length;
  const doneOut = initialDeals.filter((d) => d.direction === "out" && d.status === "done").length;
  const avail = Math.max(total - reservedOut - doneOut - keep, 0);

  const run = (
    fn: () => Promise<{ ok: boolean; error?: string }>,
    ok: string,
    onSuccess?: () => void
  ) => {
    setMsg(null);
    start(async () => {
      const res = await fn();
      if (res.ok) {
        setMsg(ok);
        onSuccess?.();
        router.refresh();
      } else setMsg(`실패: ${res.error}`);
    });
  };

  const saveHolding = () =>
    run(
      () => saveHoldings([{ card_id: cardId, qty_total: total, qty_keep: keep, is_wanted: wanted }]),
      "보유 저장됨"
    );

  // 거래 추가 폼
  const [dir, setDir] = useState<DealDirection>(total > 0 ? "out" : "in");
  const [kind, setKind] = useState<DealKind>("sale");
  const [price, setPrice] = useState("");
  const [counterpart, setCounterpart] = useState("");
  const [meetAt, setMeetAt] = useState("");
  const [meetPlace, setMeetPlace] = useState("");
  const [memo, setMemo] = useState("");

  const submitDeal = () =>
    run(
      () =>
        addDeal(cardId, {
          direction: dir,
          kind,
          price: kind === "sale" && price ? Number(price) : null,
          counterpart,
          meet_at: meetAt || null,
          meet_place: meetPlace,
          memo,
        }),
      "거래 추가됨",
      () => {
        setPrice("");
        setCounterpart("");
        setMeetAt("");
        setMeetPlace("");
        setMemo("");
      }
    );

  const fmtWhen = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "";

  return (
    <div className="rounded-2xl border-2 border-zinc-900/10 bg-zinc-50 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold">관리자 — 내 보유 / 거래</h2>
        {msg && <span className="text-xs text-zinc-500">{msg}</span>}
      </div>

      {/* 보유/소장/희망 */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl bg-white p-3">
        <Field label="보유">
          <NumInput value={total} onChange={setTotal} />
        </Field>
        <Field label="소장(비매)">
          <NumInput value={keep} onChange={setKeep} />
        </Field>
        <div className="text-sm">
          <div className="text-xs text-zinc-400">가능</div>
          <div className="px-1 text-lg font-bold text-emerald-700">{avail}</div>
        </div>
        <div className="text-xs text-zinc-400">
          예약 {reservedOut} · 완료 {doneOut}
        </div>
        <label
          className="ml-auto flex items-center gap-1.5 text-sm"
          title={total > 0 ? "보유 중인 카드는 희망에 넣을 수 없어요" : undefined}
        >
          <input
            type="checkbox"
            checked={total > 0 ? false : wanted}
            disabled={total > 0}
            onChange={(e) => setWanted(e.target.checked)}
          />
          <span className={total > 0 ? "text-zinc-400" : ""}>희망</span>
        </label>
        <button
          onClick={saveHolding}
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          저장
        </button>
      </div>

      {/* 거래 목록 */}
      <div className="mt-4">
        <div className="mb-1 text-sm font-semibold text-zinc-600">거래 / 예약</div>
        {initialDeals.length === 0 ? (
          <p className="text-sm text-zinc-400">아직 등록된 거래가 없어요.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {initialDeals.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm">
                <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${d.direction === "out" ? "bg-sky-100 text-sky-700" : "bg-teal-100 text-teal-700"}`}>
                  {d.direction === "out" ? "방출" : "영입"}
                </span>
                <span className="text-zinc-600">{d.kind === "sale" ? "판매" : "교환"}</span>
                {d.kind === "sale" && d.price != null && <span className="font-medium">{formatPrice(d.price)}</span>}
                {d.counterpart && <span className="text-zinc-500">· {d.counterpart}</span>}
                {d.meet_at && <span className="text-zinc-500">· {fmtWhen(d.meet_at)}</span>}
                {d.meet_place && <span className="text-zinc-500">· {d.meet_place}</span>}
                {d.memo && <span className="text-zinc-400">· {d.memo}</span>}
                <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium ${d.status === "done" ? "bg-zinc-200 text-zinc-600" : "bg-amber-100 text-amber-700"}`}>
                  {d.status === "done" ? "완료" : "예약중"}
                </span>
                <button
                  onClick={() => run(() => setDealStatus(d.id, cardId, d.status === "done" ? "reserved" : "done"), "변경됨")}
                  disabled={pending}
                  className="rounded-md px-2 py-1 text-xs font-medium text-zinc-700 ring-1 ring-zinc-300 hover:bg-zinc-100 disabled:opacity-50"
                >
                  {d.status === "done" ? "예약중으로" : "완료"}
                </button>
                <button
                  onClick={() => {
                    if (window.confirm("이 거래를 삭제할까요?")) run(() => deleteDeal(d.id, cardId), "삭제됨");
                  }}
                  disabled={pending}
                  className="rounded-md px-2 py-1 text-xs text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50 disabled:opacity-50"
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 거래 추가 */}
      <div className="mt-4 rounded-xl bg-white p-3">
        <div className="mb-2 text-sm font-semibold text-zinc-600">예약/거래 추가</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Field label="방향">
            <Select value={dir} onChange={(v) => setDir(v as DealDirection)} opts={[["out", "방출(판매/교환)"], ["in", "영입(희망)"]]} />
          </Field>
          <Field label="유형">
            <Select value={kind} onChange={(v) => setKind(v as DealKind)} opts={[["sale", "판매"], ["trade", "교환"]]} />
          </Field>
          {kind === "sale" && (
            <Field label="가격">
              <input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="원" className="h-9 w-full rounded-md border border-zinc-300 px-2 text-sm" />
            </Field>
          )}
          <Field label="상대(누구)">
            <input value={counterpart} onChange={(e) => setCounterpart(e.target.value)} className="h-9 w-full rounded-md border border-zinc-300 px-2 text-sm" />
          </Field>
          <Field label="일시">
            <input type="datetime-local" value={meetAt} onChange={(e) => setMeetAt(e.target.value)} className="h-9 w-full rounded-md border border-zinc-300 px-2 text-sm" />
          </Field>
          <Field label="장소">
            <input value={meetPlace} onChange={(e) => setMeetPlace(e.target.value)} className="h-9 w-full rounded-md border border-zinc-300 px-2 text-sm" />
          </Field>
          <Field label="메모">
            <input value={memo} onChange={(e) => setMemo(e.target.value)} className="h-9 w-full rounded-md border border-zinc-300 px-2 text-sm" />
          </Field>
        </div>
        <button
          onClick={submitDeal}
          disabled={pending}
          className="mt-3 rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          예약 추가
        </button>
      </div>
      <p className="mt-2 text-xs text-zinc-400">
        {cardTitle} · 가능 = 보유 − 예약 − 완료 − 소장. 방출 거래만 가능 수량에 반영됩니다.
      </p>
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

function NumInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <input
      type="number"
      min={0}
      inputMode="numeric"
      value={value === 0 ? "" : value}
      placeholder="0"
      onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
      className="h-9 w-20 rounded-md border border-zinc-300 px-2 text-center text-sm"
    />
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
    <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-full rounded-md border border-zinc-300 px-2 text-sm">
      {opts.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}
