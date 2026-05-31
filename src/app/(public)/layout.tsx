import Link from "next/link";

export default function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-lg font-bold tracking-tight">
            ⚾ KBO 카드 교환·판매
          </Link>
          <nav className="text-sm text-zinc-500">
            <span className="hidden sm:inline">2026 오피셜 컬렉션</span>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>

      <footer className="border-t border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 text-xs text-zinc-400">
          <span>문의는 당근마켓 채팅으로 부탁드려요.</span>
          <Link href="/admin" className="hover:text-zinc-600">
            관리자
          </Link>
        </div>
      </footer>
    </div>
  );
}
