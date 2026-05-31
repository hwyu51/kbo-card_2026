import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "../login/actions";

const NAV = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/holdings", label: "보유 입력" },
  { href: "/admin/wishlist", label: "희망 입력" },
  { href: "/admin/deals", label: "거래 리스트" },
  { href: "/admin/cards", label: "카드 관리" },
  { href: "/admin/prices", label: "가격 설정" },
  { href: "/admin/logs", label: "수정 로그" },
];

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // 미들웨어가 1차 보호하지만, 레이아웃에서도 한 번 더 검증 (defense in depth)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/admin");

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-zinc-200 bg-zinc-900 text-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="font-bold">
              ⚙️ 관리자
            </Link>
            <nav className="hidden gap-4 text-sm text-zinc-300 sm:flex">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="hover:text-white">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/" className="text-zinc-300 hover:text-white" target="_blank">
              공개 페이지 ↗
            </Link>
            <form action={logout}>
              <button className="rounded-md bg-white/10 px-3 py-1 hover:bg-white/20">
                로그아웃
              </button>
            </form>
          </div>
        </div>
        {/* 모바일 네비 */}
        <nav className="flex gap-4 overflow-x-auto px-4 pb-2 text-sm text-zinc-300 sm:hidden">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="whitespace-nowrap hover:text-white">
              {n.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
