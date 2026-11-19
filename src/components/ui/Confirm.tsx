"use client";

import { useState, type ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import Pop from "./Pop";
import Button from "./Button";

/**
 * 확인 말풍선. antd Popconfirm 대체 — 감싼 요소를 누르면 "정말 할까요?" 를 띄우고,
 * 확인을 눌러야 onConfirm 을 부른다. onConfirm 이 Promise 면 끝날 때까지 확인 버튼이 돈다.
 */
export default function Confirm({
  title,
  description,
  okText = "확인",
  cancelText = "취소",
  danger = false,
  disabled = false,
  placement = "top",
  onConfirm,
  onCancel,
  okButtonProps,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  okText?: ReactNode;
  cancelText?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  placement?: string;
  onConfirm?: () => unknown;
  onCancel?: () => void;
  /** antd 이름 그대로 — { danger: true } 면 확인 버튼을 위험 색으로 */
  okButtonProps?: { danger?: boolean };
  children: ReactNode;
}) {
  const isDanger = danger || !!okButtonProps?.danger;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ok = async () => {
    try {
      setBusy(true);
      await onConfirm?.();
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };
  return (
    <Pop
      open={open}
      onOpenChange={(v) => !disabled && setOpen(v)}
      disabled={disabled}
      placement={placement}
      content={
        <div className="ui-confirm">
          <div className="ui-confirm-head">
            <CircleAlert size={16} className="ui-confirm-icon" />
            <div>
              <div className="ui-confirm-title">{title}</div>
              {description && <div className="ui-confirm-desc">{description}</div>}
            </div>
          </div>
          <div className="ui-confirm-actions">
            <Button
              size="sm"
              onClick={() => {
                setOpen(false);
                onCancel?.();
              }}
            >
              {cancelText}
            </Button>
            <Button size="sm" variant="solid" danger={isDanger} busy={busy} onClick={ok}>
              {okText}
            </Button>
          </div>
        </div>
      }
    >
      {children}
    </Pop>
  );
}
