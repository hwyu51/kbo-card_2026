// 거래/보유 파생 계산 E2E 점검 (anon 키 + 어드민 로그인).
// 자격증명은 .env.local 의 E2E_EMAIL / E2E_PASSWORD 에서 읽는다 (코드에 적지 말 것).
//   E2E_EMAIL=rohji@gmail.com
//   E2E_PASSWORD=...
// 실행: node scripts/_e2e.mjs

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const anon = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// 1) 카운트 (시드 검증)
const a0 = anon();
const cnt = async (t) => (await a0.from(t).select("*", { count: "exact", head: true })).count;
console.log("players:", await cnt("players"), "/ cards:", await cnt("cards"), "/ card_types:", await cnt("card_types"));

// 2) 거래 E2E
if (!env.E2E_EMAIL || !env.E2E_PASSWORD) {
  console.log("E2E_EMAIL / E2E_PASSWORD 를 .env.local 에 설정하면 거래 E2E 까지 실행합니다.");
  process.exit(0);
}

const sb = anon();
const { data: auth, error: aerr } = await sb.auth.signInWithPassword({
  email: env.E2E_EMAIL,
  password: env.E2E_PASSWORD,
});
if (aerr) {
  console.log("로그인 실패:", aerr.message);
  process.exit(1);
}
const uid = auth.user.id;

const { data: card } = await sb
  .from("public_cards")
  .select("id, player_name, card_type_name")
  .eq("player_name", "오지환")
  .limit(1)
  .single();
const cid = card.id;
console.log(`대상: #${cid} ${card.player_name} ${card.card_type_name}`);

const pub = async () => {
  const { data } = await sb
    .from("public_cards")
    .select("qty_available, qty_reserved, qty_owned")
    .eq("id", cid)
    .single();
  return data;
};

// 보유 3 / 소장 1 → 가능 2
await sb
  .from("card_holdings")
  .upsert({ card_id: cid, owner_id: uid, qty_total: 3, qty_keep: 1, is_wanted: false }, { onConflict: "card_id,owner_id" });
let p = await pub();
console.log(`보유3·소장1 → 가능 ${p.qty_available}(=2?) 예약 ${p.qty_reserved}(=0?)`, Number(p.qty_available) === 2 ? "✓" : "✗");

// 방출 예약 1건 → 가능 1, 예약 1
const { data: deal } = await sb
  .from("card_deals")
  .insert({ card_id: cid, owner_id: uid, direction: "out", kind: "sale", price: 5000, counterpart: "테스트", status: "reserved" })
  .select("id")
  .single();
p = await pub();
console.log(`+예약1 → 가능 ${p.qty_available}(=1?) 예약 ${p.qty_reserved}(=1?)`, Number(p.qty_available) === 1 && Number(p.qty_reserved) === 1 ? "✓" : "✗");

// 완료 처리 → 예약 0, 완료가 가능 차감 유지 (가능 1)
await sb.from("card_deals").update({ status: "done" }).eq("id", deal.id);
p = await pub();
console.log(`예약→완료 → 가능 ${p.qty_available}(=1?) 예약 ${p.qty_reserved}(=0?)`, Number(p.qty_available) === 1 && Number(p.qty_reserved) === 0 ? "✓" : "✗");

// 3) 감사로그 + 행위자 이름
const { data: prof } = await sb.from("admin_profiles").select("display_name").eq("id", uid).single();
const { data: log } = await sb
  .from("audit_log")
  .select("table_name, action")
  .eq("card_id", cid)
  .order("changed_at", { ascending: false })
  .limit(1);
console.log(`감사로그 최근: ${log?.[0]?.table_name}/${log?.[0]?.action} · 행위자명: ${prof?.display_name}`);

// 4) 정리
await sb.from("card_deals").delete().eq("id", deal.id);
await sb.from("card_holdings").delete().eq("card_id", cid).eq("owner_id", uid);
p = await pub();
console.log(`정리 후 가능 ${p.qty_available}(=0?)`, Number(p.qty_available) === 0 ? "✓ 원복" : "✗");
await sb.auth.signOut();
