import type { CSSProperties, ReactNode } from "react";

/*
 * 24칸 격자. antd Row/Col 대체 — 화면 폭에 따라 칸 수가 바뀌는 배치(xs·sm·md·lg·xl)를 CSS grid 로 옮겼다.
 * 칸 수는 CSS 변수(--xs 등)로 넘기고, ui.css 의 미디어 쿼리가 큰 화면일수록 앞 단계 값을 이어받아 쓴다.
 */
export function Row({
  gutter = 0,
  align,
  style,
  className,
  children,
}: {
  gutter?: number | [number, number];
  align?: "top" | "middle" | "bottom" | "stretch";
  style?: CSSProperties;
  className?: string;
  children?: ReactNode;
}) {
  const [gx, gy] = Array.isArray(gutter) ? gutter : [gutter, 0];
  const al = align === "middle" ? "center" : align === "bottom" ? "end" : align === "top" ? "start" : undefined;
  return (
    <div className={["ui-row24", className ?? ""].filter(Boolean).join(" ")} style={{ columnGap: gx, rowGap: gy, alignItems: al, ...style }}>
      {children}
    </div>
  );
}

type Span = number | undefined;

export function Col({
  span,
  xs,
  sm,
  md,
  lg,
  xl,
  style,
  className,
  children,
}: {
  span?: number;
  xs?: Span;
  sm?: Span;
  md?: Span;
  lg?: Span;
  xl?: Span;
  style?: CSSProperties;
  className?: string;
  children?: ReactNode;
}) {
  const vars: Record<string, number> = {};
  const base = xs ?? span;
  if (base !== undefined) vars["--xs"] = base;
  if (sm !== undefined) vars["--sm"] = sm;
  if (md !== undefined) vars["--md"] = md;
  if (lg !== undefined) vars["--lg"] = lg;
  if (xl !== undefined) vars["--xl"] = xl;
  return (
    <div className={["ui-col24", className ?? ""].filter(Boolean).join(" ")} style={{ ...(vars as CSSProperties), ...style }}>
      {children}
    </div>
  );
}
