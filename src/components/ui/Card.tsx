import type { CSSProperties, ReactNode } from "react";

/**
 * 종이톤 카드. 모양은 ui.css 의 .ui-card 가 정하고, 여기는 구조만 갖는다.
 * (2차에서 title·extra·size·bodyStyle 을 더했다 — antd Card 의 머리줄을 그대로 옮기기 위해서다.
 *  title 이 없으면 1차와 똑같이 그린다.)
 */
export default function Card({
  hover = false,
  title,
  extra,
  size,
  type,
  className,
  style,
  bodyStyle,
  onClick,
  id,
  onMouseEnter,
  onMouseLeave,
  children,
}: {
  hover?: boolean;
  title?: ReactNode;
  extra?: ReactNode;
  size?: "small" | "default";
  /** antd 의 type="inner"(안쪽 카드). 바탕을 한 단계 낮춘다 */
  type?: "inner";
  className?: string;
  style?: CSSProperties;
  bodyStyle?: CSSProperties;
  onClick?: () => void;
  id?: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  children?: ReactNode;
}) {
  const cls = [
    "ui-card",
    hover ? "is-hover" : "",
    size === "small" ? "is-small" : "",
    type === "inner" ? "is-inner" : "",
    title || extra ? "has-head" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  if (!title && !extra) {
    return (
      <div id={id} className={cls} style={{ ...style, ...bodyStyle }} onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
        {children}
      </div>
    );
  }
  return (
    <div id={id} className={cls} style={style} onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <div className="ui-card-head">
        <div className="ui-card-title">{title}</div>
        {extra && <div className="ui-card-extra">{extra}</div>}
      </div>
      <div className="ui-card-body" style={bodyStyle}>
        {children}
      </div>
    </div>
  );
}
