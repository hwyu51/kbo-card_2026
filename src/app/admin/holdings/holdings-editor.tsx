"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PlayerGroup } from "@/lib/admin-catalog";
import { saveHoldings, type HoldingRow } from "../actions";

const EDIT_COLS = ["total", "keep"] as const; // 붙여넣기 가능한 열: 보유/소장
type EditCol = (typeof EDIT_COLS)[number];

type FlatRow = {
  card_id: number;
  player_name: string;
  jersey_no: number | null;
  card_type_name: string;
  is_special: boolean;
  reserved: number;
  done: number;
  firstOfPlayer: boolean;
};

export default function HoldingsEditor({
  teamName,
  groups,
}: {
  teamName: string;
  groups: PlayerGroup[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const { flat, initTotal, initKeep, wanted } = useMemo(() => {
    const flat: FlatRow[] = [];
    const initTotal: number[] = [];
    const initKeep: number[] = [];
    const wanted: boolean[] = [];
    for (const g of groups) {
      g.cards.forEach((c, idx) => {
        flat.push({
          card_id: c.card_id,
          player_name: g.player_name,
          jersey_no: g.jersey_no,
          card_type_name: c.card_type_name,
          is_special: c.is_special,
          reserved: c.reserved,
          done: c.done,
          firstOfPlayer: idx === 0,
        });
        initTotal.push(c.qty_total);
        initKeep.push(c.qty_keep);
        wanted.push(c.is_wanted);
      });
    }
    return { flat, initTotal, initKeep, wanted };
  }, [groups]);

  const [total, setTotal] = useState<number[]>(initTotal);
  const [keep, setKeep] = useState<number[]>(initKeep);

  const setterFor = (col: EditCol) => (col === "total" ? setTotal : setKeep);
  const valuesFor = (col: EditCol) => (col === "total" ? total : keep);

  const setCell = (col: EditCol, row: number, v: string) => {
    const n = Math.max(0, Math.floor(Number(v) || 0));
    setterFor(col)((prev) => prev.map((x, i) => (i === row ? n : x)));
  };

  // 엑셀 붙여넣기 (보유/소장 2열, 탭=열·줄바꿈=행)
  const onPaste = (col: EditCol, row: number) => (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text");
    if (!text.includes("\t") && !text.includes("\n")) return;
    e.preventDefault();
    const matrix = text
      .replace(/\r/g, "")
      .replace(/\n$/, "")
      .split("\n")
      .map((l) => l.split("\t"));
    const startCol = EDIT_COLS.indexOf(col);
    const nextTotal = [...total];
    const nextKeep = [...keep];
    matrix.forEach((line, dr) => {
      line.forEach((val, dc) => {
        const ri = row + dr;
        const ci = startCol + dc;
        if (ri >= flat.length || ci >= EDIT_COLS.length) return;
        const n = Math.max(0, Math.floor(Number(String(val).trim()) || 0));
        if (EDIT_COLS[ci] === "total") nextTotal[ri] = n;
        else nextKeep[ri] = n;
      });
    });
    setTotal(nextTotal);
    setKeep(nextKeep);
  };

  // 변경된 행만 추려서 저장 (불필요한 빈 행/감사로그 양산 방지)
  const changedRows = (t: number[], k: number[]): HoldingRow[] =>
    flat
      .map((f, i) => ({ f, i }))
      .filter(({ i }) => t[i] !== initTotal[i] || k[i] !== initKeep[i])
      .map(({ f, i }) => ({
        card_id: f.card_id,
        qty_total: t[i],
        qty_keep: k[i],
        is_wanted: wanted[i],
      }));

  const persist = (rows: HoldingRow[], okMsg: string) => {
    if (rows.length === 0) {
      setMsg("변경 사항이 없어요.");
      return;
    }
    setMsg(null);
    start(async () => {
      const res = await saveHoldings(rows);
      if (res.ok) {
        setMsg(okMsg);
        router.refresh();
      } else setMsg(`저장 실패: ${res.error}`);
    });
  };

  const onSave = () => persist(changedRows(total, keep), "저장됐어요.");

  const onReset = () => {
    if (
      !window.confirm(
        `${teamName} — 내 보유/소장 입력을 모두 0으로 초기화할까요?\n예약/거래·희망은 유지됩니다. 되돌릴 수 없어요.`
      )
    )
      return;
    const z = flat.map(() => 0);
    const rows = changedRows(z, z); // 기존에 값이 있던 행만 0으로 → saveHoldings가 삭제
    setTotal(z);
    setKeep([...z]);
    persist(rows, "초기화했어요.");
  };

  const avail = (i: number) => Math.max(total[i] - flat[i].reserved - flat[i].done - keep[i], 0);

  if (flat.length === 0)
    return <p className="text-sm text-zinc-500">이 구단의 카탈로그가 비어 있어요.</p>;

  return (
    <div className="flex flex-col gap-3">
      <div className="sticky top-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50/95 px-4 py-2 backdrop-blur">
        <span className="text-sm text-zinc-500">
          {teamName} · <b>보유·소장</b>만 입력(엑셀 복사→붙여넣기 OK). 가능/예약/완료는 자동.
        </span>
        <div className="flex items-center gap-2">
          {msg && <span className="text-xs text-zinc-500">{msg}</span>}
          <button
            onClick={onReset}
            disabled={pending}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50 disabled:opacity-50"
          >
            초기화
          </button>
          <button
            onClick={onSave}
            disabled={pending}
            className="rounded-lg bg-zinc-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            {pending ? "저장 중…" : "저장"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-zinc-100 text-xs text-zinc-500">
              <th className="border border-zinc-200 px-2 py-1.5 text-left">선수</th>
              <th className="border border-zinc-200 px-2 py-1.5 text-left">종류</th>
              <th className="border border-zinc-200 px-2 py-1.5 w-16 bg-amber-50">보유</th>
              <th className="border border-zinc-200 px-2 py-1.5 w-16 bg-amber-50">소장</th>
              <th className="border border-zinc-200 px-2 py-1.5 w-14 text-emerald-600">가능</th>
              <th className="border border-zinc-200 px-2 py-1.5 w-14">예약</th>
              <th className="border border-zinc-200 px-2 py-1.5 w-14">완료</th>
            </tr>
          </thead>
          <tbody>
            {flat.map((f, i) => (
              <tr key={f.card_id} className={f.firstOfPlayer && i > 0 ? "border-t-2 border-t-zinc-300" : ""}>
                <td className="border border-zinc-200 px-2 py-1 whitespace-nowrap">
                  {f.firstOfPlayer ? (
                    <span className="font-medium">
                      {f.player_name}
                      {f.jersey_no != null && <span className="ml-1 text-xs text-zinc-400">#{f.jersey_no}</span>}
                    </span>
                  ) : (
                    <span className="text-zinc-300">〃</span>
                  )}
                </td>
                <td className="border border-zinc-200 px-2 py-1 whitespace-nowrap">
                  {f.card_type_name}
                  {f.is_special && <span className="ml-1 text-[10px] text-violet-600">레전드</span>}
                </td>
                {EDIT_COLS.map((col) => (
                  <td key={col} className="border border-zinc-200 p-0 bg-amber-50/40">
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={valuesFor(col)[i] === 0 ? "" : valuesFor(col)[i]}
                      placeholder="0"
                      onChange={(e) => setCell(col, i, e.target.value)}
                      onPaste={onPaste(col, i)}
                      className="h-8 w-full bg-transparent px-1 text-center outline-none focus:bg-sky-100"
                    />
                  </td>
                ))}
                <td className="border border-zinc-200 px-1 text-center font-semibold text-emerald-700">
                  {avail(i)}
                </td>
                <td className="border border-zinc-200 px-1 text-center text-zinc-500">{f.reserved || ""}</td>
                <td className="border border-zinc-200 px-1 text-center text-zinc-400">{f.done || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-400">
        예약·완료는 카드 상세의 거래 관리에서 변경됩니다. 가능 = 보유 − 예약 − 완료 − 소장.
      </p>
    </div>
  );
}
