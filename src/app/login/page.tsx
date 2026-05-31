import Link from "next/link";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;
  const redirectTo = redirect && redirect.startsWith("/admin") ? redirect : "/admin";

  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold">관리자 로그인</h1>
        <p className="mt-1 mb-5 text-sm text-zinc-500">
          등록된 관리자만 접근할 수 있어요.
        </p>
        <LoginForm redirectTo={redirectTo} />
        <Link
          href="/"
          className="mt-4 block text-center text-xs text-zinc-400 hover:text-zinc-600"
        >
          ← 공개 페이지로
        </Link>
      </div>
    </div>
  );
}
