"use client";

import { useMemo, useState, type CSSProperties, type HTMLAttributes, type Key, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronRight, ChevronsUpDown, Filter } from "lucide-react";

/*
 * 표. antd Table(+Pagination) 대체.
 * 컬럼 정의는 antd 와 같은 모양({ title, dataIndex, key, render(value,row,index), width, align, sorter, … })으로
 * 받아 화면 코드의 컬럼 배열을 거의 그대로 옮길 수 있게 했다. 행 데이터는 rows(또는 antd 이름 dataSource).
 * 정렬은 화면에 보이는 행만 정렬된 사본으로 그리고(원본 배열 불변), 페이저는 pageSize 를 넘을 때만 나온다.
 */
export type Column<T> = {
  title?: ReactNode;
  key?: Key;
  /** 행 객체의 필드 이름. 컬럼 배열을 타입 없이 선언한 화면이 많아 문자열로 넓게 받는다 */
  dataIndex?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  render?: (value: any, row: T, index: number) => ReactNode;
  width?: number | string;
  align?: "left" | "center" | "right" | (string & {});
  ellipsis?: boolean;
  className?: string;
  /** 비교 함수, 또는 true 면 dataIndex 값으로 문자열·숫자 비교 */
  sorter?: boolean | ((a: T, b: T) => number);
  defaultSortOrder?: "ascend" | "descend";
  /** 단순 값 거르기(머리 칸 드롭다운) */
  filters?: { text: ReactNode; value: string }[];
  onFilter?: (value: string, row: T) => boolean;
  onCell?: (row: T, index?: number) => HTMLAttributes<HTMLTableCellElement>;
};

export type Pager = false | { pageSize?: number; hideOnSinglePage?: boolean; showSizeChanger?: boolean };

function keyOf<T>(row: T, rowKey: (keyof T & string) | ((r: T) => Key), i: number): Key {
  const k = typeof rowKey === "function" ? rowKey(row) : (row[rowKey] as unknown as Key);
  return k ?? i;
}

function field<T>(row: T, k: string): unknown {
  return (row as Record<string, unknown>)[k];
}

const ta = (a?: string) => a as CSSProperties["textAlign"];

function colKey<T>(c: Column<T>, i: number) {
  return String(c.key ?? c.dataIndex ?? i);
}

export default function DataTable<T>({
  columns,
  rows,
  dataSource,
  rowKey,
  pagination = false,
  size = "md",
  scroll,
  rowClassName,
  onRow,
  emptyText = "데이터가 없습니다",
  locale,
  rowSelection,
  expandable,
  style,
  className,
}: {
  columns: Column<T>[];
  rows?: readonly T[];
  dataSource?: readonly T[];
  rowKey: (keyof T & string) | ((r: T) => Key);
  pagination?: Pager;
  size?: "sm" | "md" | "small" | "middle";
  scroll?: { x?: number | string | true };
  rowClassName?: (r: T, i: number) => string;
  onRow?: (r: T, i: number) => HTMLAttributes<HTMLTableRowElement>;
  emptyText?: ReactNode;
  locale?: { emptyText?: ReactNode };
  rowSelection?: {
    selectedRowKeys: Key[];
    onChange: (keys: Key[]) => void;
    getCheckboxProps?: (r: T) => { disabled?: boolean };
  };
  /** 행 아래에 펼치는 칸(antd expandable). rowExpandable 이 거짓인 행은 펼침 단추가 없다 */
  expandable?: {
    rowExpandable?: (r: T) => boolean;
    expandedRowRender: (r: T) => ReactNode;
  };
  style?: CSSProperties;
  className?: string;
}) {
  const [opened, setOpened] = useState<Set<Key>>(new Set());
  const ex = expandable;
  const data = rows ?? dataSource ?? [];
  const initial = columns.findIndex((c) => c.defaultSortOrder);
  const [sort, setSort] = useState<{ col: string; dir: "ascend" | "descend" } | null>(
    initial >= 0 ? { col: colKey(columns[initial], initial), dir: columns[initial].defaultSortOrder! } : null,
  );
  const [filter, setFilter] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);

  const view = useMemo(() => {
    let out = [...data];
    columns.forEach((c, i) => {
      const f = filter[colKey(c, i)];
      if (f && c.onFilter) out = out.filter((r) => c.onFilter!(f, r));
    });
    if (sort) {
      const ci = columns.findIndex((c, i) => colKey(c, i) === sort.col);
      const c = columns[ci];
      if (c?.sorter) {
        const cmp =
          typeof c.sorter === "function"
            ? c.sorter
            : (a: T, b: T) => {
                const av = c.dataIndex ? field(a, c.dataIndex) : undefined;
                const bv = c.dataIndex ? field(b, c.dataIndex) : undefined;
                if (typeof av === "number" && typeof bv === "number") return av - bv;
                return String(av ?? "").localeCompare(String(bv ?? ""), "ko");
              };
        out.sort((a, b) => (sort.dir === "ascend" ? cmp(a, b) : -cmp(a, b)));
      }
    }
    return out;
  }, [data, columns, sort, filter]);

  const pageSize = pagination ? pagination.pageSize ?? 10 : Infinity;
  const pages = Math.max(1, Math.ceil(view.length / pageSize));
  const cur = Math.min(page, pages);
  const shown = pagination ? view.slice((cur - 1) * pageSize, cur * pageSize) : view;
  const showPager = !!pagination && !(pages <= 1 && (pagination.hideOnSinglePage ?? true));

  const toggleSort = (k: string) =>
    setSort((s) =>
      !s || s.col !== k ? { col: k, dir: "ascend" } : s.dir === "ascend" ? { col: k, dir: "descend" } : null,
    );

  const sel = rowSelection;
  const selectable = sel ? shown.filter((r) => !sel.getCheckboxProps?.(r).disabled) : [];
  const allOn = sel && selectable.length > 0 && selectable.every((r, i) => sel.selectedRowKeys.includes(keyOf(r, rowKey, i)));
  const sizeCls = size === "sm" || size === "small" ? "size-sm" : "size-md";
  const empty = locale?.emptyText ?? emptyText;

  return (
    <div className={["ui-table-wrap", className ?? ""].filter(Boolean).join(" ")} style={style}>
      <div className="ui-table-scroll">
        <table className={`ui-table ${sizeCls}`} style={scroll?.x && scroll.x !== true ? { minWidth: scroll.x } : undefined}>
          <colgroup>
            {ex && <col style={{ width: 32 }} />}
            {sel && <col style={{ width: 40 }} />}
            {columns.map((c, i) => (
              <col key={colKey(c, i)} style={c.width ? { width: c.width } : undefined} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {ex && <th aria-label="펼치기" />}
              {sel && (
                <th>
                  <input
                    type="checkbox"
                    className="ui-check-input"
                    aria-label="모두 고르기"
                    checked={!!allOn}
                    onChange={() =>
                      sel.onChange(allOn ? [] : selectable.map((r) => keyOf(r, rowKey, data.indexOf(r))))
                    }
                  />
                </th>
              )}
              {columns.map((c, i) => {
                const k = colKey(c, i);
                const on = sort?.col === k ? sort.dir : null;
                return (
                  <th key={k} style={{ textAlign: ta(c.align) }} className={c.className}>
                    <span className="ui-th">
                      {c.sorter ? (
                        <button type="button" className="ui-th-sort" onClick={() => toggleSort(k)}>
                          {c.title}
                          {on === "ascend" ? <ArrowUp size={12} /> : on === "descend" ? <ArrowDown size={12} /> : <ChevronsUpDown size={12} className="is-idle" />}
                        </button>
                      ) : (
                        c.title
                      )}
                      {c.filters && (
                        <label className={`ui-th-filter${filter[k] ? " is-on" : ""}`} title="거르기">
                          <Filter size={12} />
                          <select
                            value={filter[k] ?? ""}
                            onChange={(e) => {
                              setFilter((f) => ({ ...f, [k]: e.target.value }));
                              setPage(1);
                            }}
                          >
                            <option value="">전체</option>
                            {c.filters.map((f) => (
                              <option key={f.value} value={f.value}>
                                {typeof f.text === "string" ? f.text : f.value}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (sel ? 1 : 0) + (ex ? 1 : 0)} className="ui-table-empty">
                  {empty}
                </td>
              </tr>
            ) : (
              shown.map((r, i) => {
                const idx = data.indexOf(r);
                const k = keyOf(r, rowKey, idx);
                const rowProps = onRow?.(r, i) ?? {};
                const canOpen = !!ex && (ex.rowExpandable?.(r) ?? true);
                const isOpen = canOpen && opened.has(k);
                return [
                  <tr key={k} {...rowProps} className={[rowClassName?.(r, i) ?? "", rowProps.className ?? ""].filter(Boolean).join(" ") || undefined}>
                    {ex && (
                      <td className="ui-expand-cell">
                        {canOpen && (
                          <button
                            type="button"
                            className={`ui-expand-btn${isOpen ? " is-open" : ""}`}
                            aria-label={isOpen ? "접기" : "펼치기"}
                            aria-expanded={isOpen}
                            onClick={() =>
                              setOpened((o) => {
                                const n = new Set(o);
                                if (n.has(k)) n.delete(k);
                                else n.add(k);
                                return n;
                              })
                            }
                          >
                            <ChevronRight size={14} />
                          </button>
                        )}
                      </td>
                    )}
                    {sel && (
                      <td>
                        <input
                          type="checkbox"
                          className="ui-check-input"
                          aria-label="고르기"
                          disabled={sel.getCheckboxProps?.(r).disabled}
                          checked={sel.selectedRowKeys.includes(k)}
                          onChange={(e) =>
                            sel.onChange(e.target.checked ? [...sel.selectedRowKeys, k] : sel.selectedRowKeys.filter((x) => x !== k))
                          }
                        />
                      </td>
                    )}
                    {columns.map((c, ci) => {
                      const v = c.dataIndex ? field(r, c.dataIndex) : undefined;
                      const cell = c.onCell?.(r, i) ?? {};
                      return (
                        <td
                          key={colKey(c, ci)}
                          {...cell}
                          className={[c.ellipsis ? "is-ellipsis" : "", c.className ?? "", cell.className ?? ""].filter(Boolean).join(" ") || undefined}
                          style={{ textAlign: ta(c.align), ...cell.style }}
                        >
                          {c.render ? c.render(v, r, i) : (v as ReactNode)}
                        </td>
                      );
                    })}
                  </tr>,
                  isOpen ? (
                    <tr key={`${String(k)}-ex`} className="ui-expanded-row">
                      <td colSpan={columns.length + (sel ? 1 : 0) + 1}>{ex!.expandedRowRender(r)}</td>
                    </tr>
                  ) : null,
                ];
              })
            )}
          </tbody>
        </table>
      </div>
      {showPager && (
        <div className="ui-pager">
          <button type="button" disabled={cur <= 1} onClick={() => setPage(cur - 1)} aria-label="이전 쪽">
            ‹
          </button>
          {Array.from({ length: pages }, (_, n) => n + 1)
            .filter((n) => n === 1 || n === pages || Math.abs(n - cur) <= 2)
            .map((n, i, arr) => (
              <span key={n} style={{ display: "inline-flex", gap: 4 }}>
                {i > 0 && n - arr[i - 1] > 1 && <span className="ui-sub">…</span>}
                <button type="button" className={n === cur ? "is-active" : undefined} onClick={() => setPage(n)}>
                  {n}
                </button>
              </span>
            ))}
          <button type="button" disabled={cur >= pages} onClick={() => setPage(cur + 1)} aria-label="다음 쪽">
            ›
          </button>
        </div>
      )}
    </div>
  );
}
