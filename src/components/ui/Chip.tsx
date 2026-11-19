import type { CSSProperties, ReactNode } from "react";

export type ChipTone = "ok" | "warn" | "danger" | "info" | "neutral" | "accent";

/**
 * 작은 상태 표시 칩.
 * - tone: 토큰 의미색(--{tone}-bg / --{tone}-fg) 조합.
 * - outline + color: 배경 투명에 지정 색을 글자·테두리로 — 에이전트 고유색처럼 색 자체가 정보일 때.
 *   색은 tone 으로 뭉개지 않고 CSS 변수(--chip-color)로 그대로 넘긴다.
 * (2차 — antd Badge 대체) dot: 칩 대신 작은 점 + 글자(상태 표시). count: 숫자 배지.
 */
export default function Chip({
  tone = "neutral",
  outline = false,
  color,
  dot = false,
  count,
  title,
  className,
  style,
  children,
}: {
  tone?: ChipTone;
  outline?: boolean;
  color?: string;
  dot?: boolean;
  count?: number | string;
  title?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  if (dot) {
    const st = (color ? { ...style, ["--chip-color" as string]: color } : style) as CSSProperties | undefined;
    return (
      <span className={["ui-dot", `tone-${tone}`, className ?? ""].filter(Boolean).join(" ")} style={st} title={title}>
        <i aria-hidden />
        {children}
      </span>
    );
  }
  if (count !== undefined) {
    return (
      <span
        className={["ui-count", `tone-${tone}`, className ?? ""].filter(Boolean).join(" ")}
        style={color ? { background: color, color: "#fff", ...style } : style}
        title={title}
      >
        {count}
      </span>
    );
  }
  const cls = ["ui-chip", outline ? "is-outline" : `tone-${tone}`, className ?? ""].filter(Boolean).join(" ");
  const st = (outline && color ? { ...style, ["--chip-color" as string]: color } : style) as CSSProperties | undefined;
  return (
    <span className={cls} style={st} title={title}>
      {children}
    </span>
  );
}
