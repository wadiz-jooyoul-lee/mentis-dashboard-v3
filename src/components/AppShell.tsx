"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AutoRefresh from "@/components/AutoRefresh";
import InProgressBackupTrigger from "@/components/InProgressBackupTrigger";
import NextActionNotifier from "@/components/NextActionNotifier";
import { CanActProvider } from "@/components/CanAct";
import LanToggle from "@/components/LanToggle";
import DemoControls from "@/components/DemoControls";
import MantisIcon from "@/components/MantisIcon";

/** 머리띠 가운데 메뉴. 경로가 바로 키다. */
const NAV = [
  { key: "/", label: "홈" },
  { key: "/orchestration", label: "오케스트레이션" },
  { key: "/data", label: "데이터 분석" },
  { key: "/artifacts", label: "아티팩트" },
  { key: "/releases", label: "릴리즈" },
  { key: "/team-jobs", label: "팀 이슈 현황" },
];

/**
 * 지금 보고 있는 화면이 셋 중 어느 것인가.
 *
 * ⛔ **그 화면 자체일 때만** 켠다. 아래로 들어간 경로(오더 상세 /orchestration/FE1-1787,
 * 그 안의 탭 /orchestration/{키}/artifact)에서는 아무것도 켜지 않는다.
 *
 * 뿌리로 켜 보았는데, 상세로 들어가도 「오케스트레이션」이 계속 눌린 채로 남아 지금 목록에
 * 있는 것처럼 보였다. 머리띠 메뉴는 «지금 어디인가» 가 아니라 «어디로 갈 수 있나» 를
 * 가리키는 자리다 — 상세에서 지금 위치를 말해 주는 것은 그 아래 브레드크럼이다.
 */
function currentNavKey(pathname: string): string[] {
  return NAV.some((n) => n.key === pathname) ? [pathname] : [];
}

export default function AppShell({ children, demo = false }: { children: React.ReactNode; demo?: boolean }) {
  const pathname = usePathname();
  const current = currentNavKey(pathname);
  return (
    <CanActProvider>
    {/* 데모 모드에서는 메타가 fixture라 백업을 두드리지 않는다(서버도 409로 막는다). */}
    {!demo && <InProgressBackupTrigger />}
    <NextActionNotifier />
    <div style={{ minHeight: "100vh" }}>
      {/* 종이톤 반투명 머리띠. sticky + z-index 100 은 예전 antd Header 와 같다 —
          긴 화면에서 메뉴가 남고, antd 화면의 떠 있는 요소에 가려지지 않게. 모양은 ui.css .ui-nav */}
      <header className="ui-nav">
        <Link href="/" className="ui-nav-brand">
          {/* SVG 속성에는 var() 가 안 먹는 브라우저가 있어 currentColor 로 포인트색을 넘긴다. */}
          <span className="ui-card-icon">
            <MantisIcon size={24} color="currentColor" />
          </span>
          Mentis Dashboard
        </Link>
        {/*
          좌우(제목·도구)의 폭이 달라 space-between 으로는 가운데에 오지 않는다.
          머리띠가 position:sticky 라 좌표 기준이 되므로 절대 배치로 화면 가운데에 둔다(.ui-nav-menu).
        */}
        <nav className="ui-nav-menu" aria-label="주 메뉴">
          {NAV.map((n) => (
            <Link
              key={n.key}
              href={n.key}
              className={current.includes(n.key) ? "is-active" : undefined}
              aria-current={current.includes(n.key) ? "page" : undefined}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <span className="ui-nav-tools">
          <LanToggle />
          <AutoRefresh intervalMs={5000} />
        </span>
      </header>
      {demo && <DemoControls />}
      <main style={{ padding: 24, maxWidth: 1440, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        {children}
      </main>
    </div>
    </CanActProvider>
  );
}
