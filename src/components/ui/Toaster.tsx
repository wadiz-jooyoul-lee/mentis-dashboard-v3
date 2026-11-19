"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";

/*
 * 전역 알림. antd message·notification 대체.
 * - toast.success/error/info/warning(내용) : 잠깐 떴다 사라지는 한 줄 알림(antd message).
 * - toast.sticky({ key, title, description, actions }) : 사람이 닫을 때까지 남는 카드(antd notification, duration 0).
 *   같은 key 로 다시 부르면 내용을 바꾼다. toast.close(key) 로 닫는다.
 *   onClose 는 사람이 닫기 단추를 눌렀을 때만 불린다(antd notification 과 같게). 코드가 닫는 toast.close 는 부르지 않는다.
 * 포털은 루트 레이아웃의 <Toaster /> 하나. 층 순서(ui.css): 한 줄 알림 2200 > 떠 있는 요소 2100 > 고정 알림 카드 2000 > 머리띠 100.
 */
type Kind = "success" | "error" | "info" | "warning";
type Item = {
  key: string;
  kind: Kind;
  content?: ReactNode;
  sticky?: boolean;
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  onClose?: () => void;
};

let items: Item[] = [];
const subs = new Set<(i: Item[]) => void>();
let seq = 0;
const emit = () => subs.forEach((s) => s(items));

// 코드가 닫을 때 — onClose 를 부르지 않는다(antd api.destroy 와 같게).
function close(key: string) {
  items = items.filter((i) => i.key !== key);
  emit();
}

// 사람이 닫기 단추를 눌렀을 때만 onClose 를 부른다.
function dismiss(key: string) {
  const it = items.find((i) => i.key === key);
  close(key);
  it?.onClose?.();
}

function push(kind: Kind, content: ReactNode, duration = 3) {
  const key = `t${++seq}`;
  items = [...items, { key, kind, content }];
  emit();
  if (duration > 0) setTimeout(() => close(key), duration * 1000);
  return key;
}

export const toast = {
  success: (c: ReactNode, d?: number) => push("success", c, d),
  error: (c: ReactNode, d?: number) => push("error", c, d),
  info: (c: ReactNode, d?: number) => push("info", c, d),
  warning: (c: ReactNode, d?: number) => push("warning", c, d),
  sticky(it: Omit<Item, "sticky" | "kind"> & { kind?: Kind }) {
    const next: Item = { kind: "info", ...it, sticky: true };
    const at = items.findIndex((i) => i.key === it.key);
    items = at >= 0 ? items.map((i, n) => (n === at ? next : i)) : [...items, next];
    emit();
    return it.key;
  },
  close,
};

const ICON: Record<Kind, ReactNode> = {
  success: <CircleCheck size={16} />,
  error: <CircleAlert size={16} />,
  info: <Info size={16} />,
  warning: <TriangleAlert size={16} />,
};

export default function Toaster() {
  const [list, setList] = useState<Item[]>(items);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    subs.add(setList);
    return () => {
      subs.delete(setList);
    };
  }, []);
  if (!mounted) return null;
  const brief = list.filter((i) => !i.sticky);
  const sticky = list.filter((i) => i.sticky);
  return createPortal(
    <>
      <div className="ui-toasts" aria-live="polite">
        {brief.map((i) => (
          <div key={i.key} className={`ui-toast tone-${i.kind}`}>
            <span className="ui-toast-icon">{ICON[i.kind]}</span>
            <span>{i.content}</span>
          </div>
        ))}
      </div>
      <div className="ui-notices" aria-live="polite">
        {sticky.map((i) => (
          <div key={i.key} className={`ui-notice tone-${i.kind}`}>
            <button type="button" className="ui-notice-x" aria-label="닫기" onClick={() => dismiss(i.key)}>
              <X size={14} />
            </button>
            {i.title && <div className="ui-notice-title">{i.title}</div>}
            {i.description && <div className="ui-notice-desc">{i.description}</div>}
            {i.actions && <div className="ui-notice-actions">{i.actions}</div>}
          </div>
        ))}
      </div>
    </>,
    document.body,
  );
}
