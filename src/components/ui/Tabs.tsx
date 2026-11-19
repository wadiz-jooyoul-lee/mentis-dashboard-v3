"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

/*
 * 탭. antd Tabs 대체 — 밑줄 표시줄. variant="seg" 면 알약 모양 묶음 버튼(antd Segmented).
 * items 모양은 antd 와 같게 { key, label, children? }. children 이 있으면 활성 탭 내용을 아래에 그린다.
 * activeKey 를 주면 호출부가 쥐는 제어 모드, 아니면 defaultActiveKey 로 시작해 스스로 쥔다.
 */
export type TabItem = { key: string; label: ReactNode; children?: ReactNode; disabled?: boolean };

export default function Tabs({
  items,
  activeKey,
  defaultActiveKey,
  onChange,
  variant = "line",
  size = "md",
  extra,
  tabBarExtraContent,
  tabBarStyle,
  className,
  style,
}: {
  items: TabItem[];
  activeKey?: string;
  defaultActiveKey?: string;
  onChange?: (key: string) => void;
  variant?: "line" | "seg";
  size?: "sm" | "md";
  extra?: ReactNode;
  /** antd 이름 그대로 받는다 — tabBarExtraContent 는 extra 와 같다, type 은 받기만 한다 */
  tabBarExtraContent?: ReactNode;
  tabBarStyle?: CSSProperties;
  type?: string;
  className?: string;
  style?: CSSProperties;
}) {
  extra = extra ?? tabBarExtraContent;
  const [inner, setInner] = useState(defaultActiveKey ?? items[0]?.key);
  const cur = activeKey ?? inner;
  const pick = (k: string) => {
    if (activeKey === undefined) setInner(k);
    onChange?.(k);
  };
  const active = items.find((i) => i.key === cur);
  return (
    <div className={["ui-tabs", className ?? ""].filter(Boolean).join(" ")} style={style}>
      <div className={`ui-tabbar variant-${variant} size-${size}`} role="tablist" style={tabBarStyle}>
        <div className="ui-tabbar-items">
          {items.map((it) => (
            <button
              key={it.key}
              type="button"
              role="tab"
              aria-selected={it.key === cur}
              disabled={it.disabled}
              className={it.key === cur ? "is-active" : undefined}
              onClick={() => pick(it.key)}
            >
              {it.label}
            </button>
          ))}
        </div>
        {extra && <div className="ui-tabbar-extra">{extra}</div>}
      </div>
      {active?.children !== undefined && (
        <div className="ui-tabpanel" role="tabpanel">
          {active.children}
        </div>
      )}
    </div>
  );
}

/** antd Segmented 와 같은 모양으로 쓰는 단축형. options 는 문자열이나 { label, value }. */
export function Seg<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  disabled = false,
  style,
}: {
  options: (T | { label: ReactNode; value: T; disabled?: boolean })[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
  disabled?: boolean;
  style?: CSSProperties;
}) {
  const items = options.map((o) =>
    typeof o === "string"
      ? { key: o, label: o, disabled }
      : { key: o.value, label: o.label, disabled: disabled || o.disabled },
  );
  return <Tabs items={items} activeKey={value} onChange={(k) => onChange(k as T)} variant="seg" size={size} style={style} />;
}
