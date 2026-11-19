"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import Pop from "./Pop";

/** 진행 막대. antd Progress 대체. percent 0~100, tone 으로 의미색. */
export function Meter({
  percent,
  tone = "accent",
  showInfo = true,
  style,
}: {
  percent: number;
  tone?: "accent" | "ok" | "warn" | "danger" | "info";
  showInfo?: boolean;
  /** antd 이름 그대로 받기만 한다 */
  size?: string;
  style?: CSSProperties;
}) {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className="ui-meter" style={style} role="meter" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100}>
      <div className="ui-meter-track">
        <div className={`ui-meter-bar tone-${tone}`} style={{ width: `${p}%` }} />
      </div>
      {showInfo && <span className="ui-meter-num">{p}%</span>}
    </div>
  );
}

/** 자리 표시 줄(antd Skeleton). 은은히 반짝이는 회색 줄. */
/** 버튼 모양 자리 표시(antd Skeleton.Button) */
export function SkeletonButton({ style }: { active?: boolean; size?: string; style?: CSSProperties }) {
  return <span className="ui-skel" style={{ display: "inline-block", width: 64, height: 22, verticalAlign: "middle", ...style }} aria-hidden />;
}

export function Skeleton({ lines = 1, width, style }: { lines?: number; width?: number | string; style?: CSSProperties }) {
  return (
    <span className="ui-skel-group" style={style} aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="ui-skel" style={{ width: i === lines - 1 && lines > 1 ? "60%" : width ?? "100%" }} />
      ))}
    </span>
  );
}

/** 가는 구분선(antd Divider). children 이 있으면 선 가운데(또는 왼쪽)에 글자를 둔다. */
export function Hr({ style, children }: { style?: CSSProperties; plain?: boolean; orientation?: string; children?: ReactNode }) {
  if (!children) return <hr className="ui-hr" style={style} />;
  return (
    <div className="ui-hr-text" style={style} role="separator">
      <span>{children}</span>
    </div>
  );
}

/** 펼침 메뉴(antd Dropdown). Pop 위에 항목 목록을 그린다. */
export type MenuItem = { key: string; label: ReactNode; icon?: ReactNode; danger?: boolean; disabled?: boolean };

export function Menu({
  items,
  onPick,
  placement = "bottomRight",
  children,
}: {
  items: MenuItem[];
  onPick: (key: string) => void;
  placement?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Pop
      open={open}
      onOpenChange={setOpen}
      placement={placement}
      style={{ padding: 4 }}
      content={
        <div className="ui-menu" role="menu">
          {items.map((it) => (
            <button
              key={it.key}
              type="button"
              role="menuitem"
              disabled={it.disabled}
              className={it.danger ? "is-danger" : undefined}
              onClick={() => {
                setOpen(false);
                onPick(it.key);
              }}
            >
              {it.icon}
              {it.label}
            </button>
          ))}
        </div>
      }
    >
      {children}
    </Pop>
  );
}

/** 숫자 하나를 크게(antd Statistic). 작은 제목 + 값 + 뒤 단위. */
export function Stat({
  title,
  value,
  suffix,
  prefix,
  valueStyle,
  style,
}: {
  title: ReactNode;
  value: ReactNode;
  suffix?: ReactNode;
  prefix?: ReactNode;
  valueStyle?: CSSProperties;
  style?: CSSProperties;
}) {
  return (
    <div className="ui-stat" style={style}>
      <div className="ui-stat-title">{title}</div>
      <div className="ui-stat-value" style={valueStyle}>
        {prefix}
        {value}
        {suffix && <span className="ui-stat-suffix">{suffix}</span>}
      </div>
    </div>
  );
}

/** 쪽 넘김(antd Pagination). 쪽 크기 고르기와 "전체 몇 개" 문구를 함께 그린다. */
export function Pager({
  current,
  pageSize,
  total,
  onChange,
  pageSizeOptions,
  showTotal,
}: {
  current: number;
  pageSize: number;
  total: number;
  onChange: (page: number, pageSize: number) => void;
  pageSizeOptions?: number[];
  showTotal?: (total: number, range: [number, number]) => ReactNode;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const a = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const b = Math.min(total, current * pageSize);
  const nums = Array.from({ length: pages }, (_, n) => n + 1).filter(
    (n) => n === 1 || n === pages || Math.abs(n - current) <= 2,
  );
  return (
    <div className="ui-pager" style={{ border: 0, padding: 0 }}>
      {showTotal && <span className="ui-sm" style={{ marginRight: 8 }}>{showTotal(total, [a, b])}</span>}
      <button type="button" disabled={current <= 1} onClick={() => onChange(current - 1, pageSize)} aria-label="이전 쪽">
        ‹
      </button>
      {nums.map((n, i) => (
        <span key={n} style={{ display: "inline-flex", gap: 4 }}>
          {i > 0 && n - nums[i - 1] > 1 && <span className="ui-sub">…</span>}
          <button type="button" className={n === current ? "is-active" : undefined} onClick={() => onChange(n, pageSize)}>
            {n}
          </button>
        </span>
      ))}
      <button type="button" disabled={current >= pages} onClick={() => onChange(current + 1, pageSize)} aria-label="다음 쪽">
        ›
      </button>
      {pageSizeOptions && (
        <select
          className="ui-field ui-select size-sm"
          style={{ marginLeft: 8 }}
          value={pageSize}
          aria-label="쪽 크기"
          onChange={(e) => onChange(1, Number(e.target.value))}
        >
          {pageSizeOptions.map((o) => (
            <option key={o} value={o}>
              {o} / 쪽
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
