"use client";

import type { ReactNode } from "react";

/**
 * 버튼. variant 로 강조 정도를 고른다(solid=포인트 채움, soft=옅은 포인트, ghost=테두리만).
 * busy 면 스피너를 앞에 붙이고 누를 수 없게 한다(antd Button 의 loading 대체).
 */
export default function Button({
  variant = "ghost",
  size = "md",
  busy = false,
  disabled = false,
  type = "button",
  onClick,
  className,
  children,
}: {
  variant?: "solid" | "soft" | "ghost";
  size?: "sm" | "md";
  busy?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
  className?: string;
  children?: ReactNode;
}) {
  const cls = ["ui-btn", `variant-${variant}`, `size-${size}`, className ?? ""].filter(Boolean).join(" ");
  return (
    <button type={type} className={cls} disabled={disabled || busy} aria-busy={busy || undefined} onClick={onClick}>
      {busy && <span className="ui-spin" aria-hidden />}
      {children}
    </button>
  );
}
