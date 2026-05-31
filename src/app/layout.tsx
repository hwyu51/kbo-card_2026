import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KBO 카드 교환·판매",
  description: "KBO 2026 오피셜 컬렉션 카드 보유 현황 · 교환/판매",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
        {children}
      </body>
    </html>
  );
}
