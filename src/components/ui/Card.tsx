import type { CSSProperties, ReactNode } from "react";

/** 종이톤 카드. 모양은 ui.css 의 .ui-card 가 정하고, 여기는 구조만 갖는다. */
export default function Card({
  hover = false,
  className,
  style,
  children,
}: {
  hover?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const cls = ["ui-card", hover ? "is-hover" : "", className ?? ""].filter(Boolean).join(" ");
  return (
    <div className={cls} style={style}>
      {children}
    </div>
  );
}
