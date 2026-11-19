import type { Metadata } from "next";
import "@/styles/tokens.css";
import "@/styles/ui.css";
import AppShell from "@/components/AppShell";
import Toaster from "@/components/ui/Toaster";
import { isDemoMode } from "@/lib/demo";

export const metadata: Metadata = {
  title: "Mentis Dashboard",
  description: "issue-test 결과(.issue-test) 리포트 대시보드",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body style={{ margin: 0 }}>
        <AppShell demo={isDemoMode()}>{children}</AppShell>
        <Toaster />
      </body>
    </html>
  );
}
