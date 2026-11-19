"use client";

import type { CSSProperties, MouseEvent, ReactNode } from "react";

/**
 * 버튼. variant 로 강조 정도를 고른다(solid=포인트 채움, soft=옅은 포인트, ghost=테두리만,
 * text=테두리 없이 글자만, link=포인트색 글자 링크 모양).
 * busy 면 스피너를 앞에 붙이고 누를 수 없게 한다(antd Button 의 loading 대체).
 * danger 는 위험한 동작(삭제·초기화)의 색. href 를 주면 같은 모양의 <a> 로 그린다.
 * (2차에서 icon·danger·title·text/link·href·style 을 더했다 — 1차 호출부는 그대로 동작한다)
 */
export default function Button({
  variant = "ghost",
  size = "md",
  busy = false,
  disabled = false,
  danger = false,
  block = false,
  icon,
  title,
  href,
  target,
  rel,
  type = "button",
  onClick,
  className,
  style,
  children,
}: {
  variant?: "solid" | "soft" | "ghost" | "text" | "link";
  size?: "xs" | "sm" | "md";
  busy?: boolean;
  disabled?: boolean;
  danger?: boolean;
  block?: boolean;
  icon?: ReactNode;
  title?: string;
  href?: string;
  target?: string;
  rel?: string;
  type?: "button" | "submit";
  onClick?: (e: MouseEvent<HTMLElement>) => void;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const cls = [
    "ui-btn",
    `variant-${variant}`,
    `size-${size}`,
    danger ? "is-danger" : "",
    block ? "is-block" : "",
    !children && icon ? "is-icon" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  const body = (
    <>
      {busy ? <span className="ui-spin" aria-hidden /> : icon}
      {children}
    </>
  );
  if (href && !disabled) {
    return (
      <a
        className={cls}
        href={href}
        target={target}
        rel={rel ?? (target === "_blank" ? "noreferrer" : undefined)}
        title={title}
        style={style}
        onClick={onClick}
      >
        {body}
      </a>
    );
  }
  return (
    <button
      type={type}
      className={cls}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      title={title}
      style={style}
      onClick={onClick}
    >
      {body}
    </button>
  );
}
