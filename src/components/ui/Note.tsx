"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";

/**
 * 안내 상자. antd Alert 대체 — 의미색 옅은 바탕 + 아이콘 + 제목/설명.
 * type 이름은 antd 와 같게 받는다(success·info·warning·error).
 */
type Kind = "success" | "info" | "warning" | "error";
const ICON: Record<Kind, ReactNode> = {
  success: <CircleCheck size={16} />,
  info: <Info size={16} />,
  warning: <TriangleAlert size={16} />,
  error: <CircleAlert size={16} />,
};

export default function Note({
  type = "info",
  title,
  message,
  description,
  action,
  showIcon = true,
  icon,
  closable,
  onClose,
  className,
  style,
  children,
}: {
  type?: Kind;
  title?: ReactNode;
  /** antd Alert 의 message(제목) 이름도 그대로 받는다 */
  message?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  showIcon?: boolean;
  /** 기본 아이콘 대신 쓸 아이콘 */
  icon?: ReactNode;
  /** 닫기 단추. antd 처럼 { onClose } 로도 받는다 */
  closable?: boolean | { onClose?: () => void };
  onClose?: () => void;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const head = title ?? message;
  const [gone, setGone] = useState(false);
  if (gone) return null;
  const close = () => {
    setGone(true);
    onClose?.();
    if (typeof closable === "object") closable.onClose?.();
  };
  return (
    <div className={["ui-note-box", `tone-${type}`, className ?? ""].filter(Boolean).join(" ")} style={style} role="note">
      {showIcon && <span className="ui-note-icon">{icon ?? ICON[type]}</span>}
      <div className="ui-note-main">
        {head && <div className={description || children ? "ui-note-title" : undefined}>{head}</div>}
        {description && <div className="ui-note-desc">{description}</div>}
        {children}
      </div>
      {action && <div className="ui-note-action">{action}</div>}
      {closable && (
        <button type="button" className="ui-note-x" aria-label="닫기" onClick={close}>
          <X size={14} />
        </button>
      )}
    </div>
  );
}
