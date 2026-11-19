import type { CSSProperties, ReactNode } from "react";

export type ChipTone = "ok" | "warn" | "danger" | "info" | "neutral" | "accent";

/**
 * 작은 상태 표시 칩.
 * - tone: 토큰 의미색(--{tone}-bg / --{tone}-fg) 조합.
 * - outline + color: 배경 투명에 지정 색을 글자·테두리로 — 에이전트 고유색처럼 색 자체가 정보일 때.
 *   색은 tone 으로 뭉개지 않고 CSS 변수(--chip-color)로 그대로 넘긴다.
 */
export default function Chip({
  tone = "neutral",
  outline = false,
  color,
  className,
  style,
  children,
}: {
  tone?: ChipTone;
  outline?: boolean;
  color?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const cls = ["ui-chip", outline ? "is-outline" : `tone-${tone}`, className ?? ""].filter(Boolean).join(" ");
  const st = (outline && color ? { ...style, ["--chip-color" as string]: color } : style) as CSSProperties | undefined;
  return (
    <span className={cls} style={st}>
      {children}
    </span>
  );
}
