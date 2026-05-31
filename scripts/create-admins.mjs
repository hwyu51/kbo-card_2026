// 어드민 2계정 생성/갱신 스크립트 (회원가입 비활성화 → 서비스 롤로 직접 발급)
//
// 사용법:
//   1) .env.local 에 아래 값을 채운다 (커밋 금지 — .env* 는 .gitignore 됨)
//        SUPABASE_SERVICE_ROLE_KEY=...        ← Supabase > Project Settings > API > service_role
//        ADMIN1_USERNAME=rohji
//        ADMIN1_PASSWORD=...
//        ADMIN1_NAME=노지환                    ← 수정 로그에 보일 표시명(선택)
//        ADMIN1_WISHLIST_TEAM=lg               ← 초기 희망 일괄 지정 구단 slug(선택)
//        ADMIN2_USERNAME=...
//        ADMIN2_PASSWORD=...
//        ADMIN2_NAME=...
//        ADMIN2_WISHLIST_TEAM=samsung
//   2) node scripts/create-admins.mjs
//
// ⚠️ 자격증명을 코드에 적지 말 것. 전부 .env.local 에서 읽는다.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// ⚠️ src/lib/auth.ts 의 ADMIN_EMAIL_DOMAIN 과 반드시 동일하게 유지
const DOMAIN = "gmail.com";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 를 .env.local 에 설정하세요.");
  process.exit(1);
}

const admin = createClient(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const defs = [1, 2]
  .map((n) => ({
    username: env[`ADMIN${n}_USERNAME`],
    password: env[`ADMIN${n}_PASSWORD`],
    name: env[`ADMIN${n}_NAME`],
    wishlistTeam: env[`ADMIN${n}_WISHLIST_TEAM`],
  }))
  .filter((d) => d.username && d.password);

if (defs.length === 0) {
  console.error("ADMIN1_USERNAME/ADMIN1_PASSWORD … 를 .env.local 에 설정하세요.");
  process.exit(1);
}

async function findUserByEmail(email) {
  // 계정 2개 규모 → 1페이지로 충분
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

async function seedWishlist(userId, teamSlug) {
  const { data: team } = await admin.from("teams").select("id").eq("slug", teamSlug).maybeSingle();
  if (!team) {
    console.warn(`  · 희망 시드 건너뜀: '${teamSlug}' 구단을 찾을 수 없음`);
    return;
  }
  const { data: cards } = await admin.from("cards").select("id").eq("team_id", team.id);
  const rows = (cards ?? []).map((c) => ({ card_id: c.id, owner_id: userId, is_wanted: true }));
  if (rows.length === 0) return;
  const { error } = await admin
    .from("card_holdings")
    .upsert(rows, { onConflict: "card_id,owner_id" });
  if (error) console.warn(`  · 희망 시드 실패: ${error.message}`);
  else console.log(`  · 희망 시드: ${teamSlug} ${rows.length}장 → is_wanted ON`);
}

for (const d of defs) {
  const email = `${d.username.trim().toLowerCase()}@${DOMAIN}`;
  const meta = { display_name: d.name || d.username };

  let userId;
  const created = await admin.auth.admin.createUser({
    email,
    password: d.password,
    email_confirm: true,
    user_metadata: meta,
  });

  if (created.error) {
    // 이미 있으면 비번/표시명 갱신
    const existing = await findUserByEmail(email);
    if (!existing) {
      console.error(`✗ ${d.username}: 생성 실패 — ${created.error.message}`);
      continue;
    }
    const updated = await admin.auth.admin.updateUserById(existing.id, {
      password: d.password,
      user_metadata: meta,
    });
    if (updated.error) {
      console.error(`✗ ${d.username}: 갱신 실패 — ${updated.error.message}`);
      continue;
    }
    userId = existing.id;
    console.log(`✓ ${d.username} (${email}) — 기존 계정 갱신`);
  } else {
    userId = created.data.user.id;
    console.log(`✓ ${d.username} (${email}) — 신규 생성`);
  }

  if (d.wishlistTeam) await seedWishlist(userId, d.wishlistTeam);
}

console.log("완료.");
