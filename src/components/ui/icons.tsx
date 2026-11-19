import type { ReactNode } from "react";
import type { Section } from "@/lib/sections";

/*
 * 1.5px 선 아이콘 12종(24×24, currentColor). 외부 의존 없이 직접 그린다 —
 * 옛 antd 아이콘 모양을 복제하지 않고 아티팩트풍 얇은 선으로 새로 그렸다.
 */
type IconProps = { size?: number; className?: string };

function Svg({ size = 20, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      focusable={false}
    >
      {children}
    </svg>
  );
}

export function IconFlask(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M9 3h6M10 3v6.2L4.8 18.1A2 2 0 0 0 6.5 21h11a2 2 0 0 0 1.7-2.9L14 9.2V3" />
      <path d="M7.2 15h9.6" />
    </Svg>
  );
}

export function IconRocket(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 15l-3-3c1.4-4.6 4.6-7.8 10-8.5-.7 5.4-3.9 8.6-8.5 10" />
      <path d="M9 12H5.5l2.5-3.5h4M12 15v3.5l3.5-2.5v-4" />
      <path d="M6.5 16.5C5 17 4.5 19.5 4.5 19.5S7 19 7.5 17.5" />
      <circle cx="15" cy="9" r="1.2" />
    </Svg>
  );
}

export function IconCheckSquare(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="4" y="4" width="16" height="16" rx="3.5" />
      <path d="M8.5 12.2l2.4 2.4 4.6-5" />
    </Svg>
  );
}

export function IconNodes(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="5.5" r="2.3" />
      <circle cx="5.5" cy="18" r="2.3" />
      <circle cx="18.5" cy="18" r="2.3" />
      <path d="M11 7.6L6.6 16M13 7.6l4.4 8.4M7.8 18h8.4" />
    </Svg>
  );
}

export function IconCluster(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="9" y="3.5" width="6" height="5" rx="1.5" />
      <rect x="3.5" y="15.5" width="6" height="5" rx="1.5" />
      <rect x="14.5" y="15.5" width="6" height="5" rx="1.5" />
      <path d="M12 8.5v3.5M6.5 15.5V12h11v3.5" />
    </Svg>
  );
}

export function IconShare(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="17.5" cy="6" r="2.5" />
      <circle cx="6.5" cy="12" r="2.5" />
      <circle cx="17.5" cy="18" r="2.5" />
      <path d="M8.7 10.8l6.6-3.6M8.7 13.2l6.6 3.6" />
    </Svg>
  );
}

export function IconBarChart(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 20h16" />
      <path d="M7 16.5V11M12 16.5V6.5M17 16.5V9" />
    </Svg>
  );
}

export function IconBrowser(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3" y="4.5" width="18" height="15" rx="3" />
      <path d="M3 9h18" />
      <path d="M6.5 6.8h.01M9 6.8h.01" />
    </Svg>
  );
}

export function IconCloudUpload(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M7 18.5H6.5a4 4 0 0 1-.6-7.95A6 6 0 0 1 17.6 9a4.5 4.5 0 0 1-.1 9.5H17" />
      <path d="M12 20.5v-8M9 15.2l3-3 3 3" />
    </Svg>
  );
}

export function IconSave(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 4h11l3 3v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" />
      <path d="M8 4v4.5h7V4" />
      <rect x="8" y="13" width="8" height="7" rx="1" />
    </Svg>
  );
}

export function IconCheckCircle(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.3 12.3l2.5 2.5 4.9-5.2" />
    </Svg>
  );
}

export function IconChevronRight(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M9.5 6l6 6-6 6" />
    </Svg>
  );
}

/**
 * 허브 카드 아이콘 매핑. 키는 src/lib/sections.ts 의 icon 값(옛 antd 아이콘 이름) 그대로 —
 * sections.ts 를 고치지 않고 흡수한다. Record 타입이라 키가 하나라도 빠지면 typecheck 가 잡는다.
 */
export const ICONS: Record<Section["icon"], (p: IconProps) => ReactNode> = {
  ExperimentOutlined: IconFlask,
  RocketOutlined: IconRocket,
  CheckSquareOutlined: IconCheckSquare,
  DeploymentUnitOutlined: IconNodes,
  ClusterOutlined: IconCluster,
  ShareAltOutlined: IconShare,
  BarChartOutlined: IconBarChart,
  ChromeOutlined: IconBrowser,
};
