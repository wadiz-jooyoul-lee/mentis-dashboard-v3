"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

/*
 * 접었다 펴는 칸. antd Collapse 대체 — 네이티브 details/summary 위에 얹었다.
 * 단일 칸은 <Disclosure title=…>, 여러 칸은 antd 와 같은 모양의 items 로 <Collapse items=… />.
 * 펼침 높이 전환은 ui.css 의 ::details-content 전환(지원 브라우저만 — 없으면 즉시 펼침).
 */
export function Disclosure({
  title,
  extra,
  open: openProp,
  defaultOpen = false,
  onToggle,
  ghost = false,
  className,
  style,
  children,
}: {
  title: ReactNode;
  extra?: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onToggle?: (open: boolean) => void;
  ghost?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const [inner, setInner] = useState(defaultOpen);
  const open = openProp ?? inner;
  return (
    <details
      className={["ui-disc", ghost ? "is-ghost" : "", className ?? ""].filter(Boolean).join(" ")}
      style={style}
      open={open}
      onToggle={(e) => {
        const v = (e.currentTarget as HTMLDetailsElement).open;
        if (v === open) return;
        if (openProp === undefined) setInner(v);
        onToggle?.(v);
      }}
    >
      <summary>
        <ChevronRight size={14} className="ui-disc-arrow" />
        <span className="ui-disc-title">{title}</span>
        {extra && (
          // 덧붙임을 눌러도 칸이 접히지 않게 한다. 안쪽이 stopPropagation 을 걸어도 막히도록 잡기 단계에서 걸고,
          // 링크는 이동해야 하므로 건드리지 않는다.
          <span
            className="ui-disc-extra"
            onClickCapture={(e) => {
              if (!(e.target as Element).closest("a")) e.preventDefault();
            }}
          >
            {extra}
          </span>
        )}
      </summary>
      {/* 닫혀 있을 때는 내용을 그리지 않는다 — antd Collapse 의 지연 렌더와 같게(무거운 표·마크다운) */}
      <div className="ui-disc-body">{open ? children : null}</div>
    </details>
  );
}

export type CollapseItem = { key: string; label: ReactNode; children?: ReactNode; extra?: ReactNode };

export default function Collapse({
  items,
  defaultActiveKey,
  activeKey,
  onChange,
  ghost = false,
  className,
  style,
}: {
  /** antd 와 같은 이름으로 받기만 한다(크기는 하나뿐, 닫힌 칸은 늘 그리지 않는다) */
  size?: "sm" | "md";
  destroyOnHidden?: boolean;
  items: CollapseItem[];
  defaultActiveKey?: string | string[];
  activeKey?: string | string[];
  onChange?: (keys: string[]) => void;
  ghost?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const arr = (v?: string | string[]) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
  const [inner, setInner] = useState<string[]>(arr(defaultActiveKey));
  const open = activeKey !== undefined ? arr(activeKey) : inner;
  return (
    <div className={["ui-collapse", ghost ? "is-ghost" : "", className ?? ""].filter(Boolean).join(" ")} style={style}>
      {items.map((it) => (
        <Disclosure
          key={it.key}
          title={it.label}
          extra={it.extra}
          ghost={ghost}
          open={open.includes(it.key)}
          onToggle={(v) => {
            const next = v ? [...open, it.key] : open.filter((k) => k !== it.key);
            if (activeKey === undefined) setInner(next);
            onChange?.(next);
          }}
        >
          {it.children}
        </Disclosure>
      ))}
    </div>
  );
}
