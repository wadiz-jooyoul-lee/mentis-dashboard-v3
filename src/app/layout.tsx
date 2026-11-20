import type { Metadata } from "next";
import "@/styles/tokens.css";
import "@/styles/ui.css";
import AppShell from "@/components/AppShell";
import Toaster from "@/components/ui/Toaster";
import { isDemoMode } from "@/lib/demo";
import { accentFg } from "@/lib/color";
import { needsRestart, readSettings } from "@/lib/dashboardSettings";

// 설정 창에서 바꾼 색과 갱신 간격을 요청마다 읽는다. 미리 만들어 두는 페이지가 옛 색으로 굳지 않게 한다
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mentis Dashboard",
  description: "issue-test 결과(.issue-test) 리포트 대시보드",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const s = readSettings();
  return (
    <html lang="ko" style={{ "--accent": s.accent, "--accent-fg": accentFg(s.accent) } as React.CSSProperties}>
      <body style={{ margin: 0 }}>
        <AppShell demo={isDemoMode()} refreshSec={s.refreshSec} needRestart={needsRestart(s)}>
          {children}
        </AppShell>
        <Toaster />
      </body>
    </html>
  );
}
