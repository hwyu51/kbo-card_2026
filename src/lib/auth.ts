// 어드민 로그인은 아이디(username)만 입력받고, 내부적으로 이 도메인을 붙여
// Supabase 이메일로 변환한다. (화면엔 도메인 노출 안 됨)
// ⚠️ scripts/create-admins.mjs 의 DOMAIN 과 반드시 동일하게 유지할 것.
export const ADMIN_EMAIL_DOMAIN = "gmail.com";

export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${ADMIN_EMAIL_DOMAIN}`;
}
