"use client";

import { forwardRef, useState, type ChangeEvent, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { Search } from "lucide-react";

/*
 * 입력 부품. antd Input·Input.TextArea·Input.Search·Select·Radio.Group·Checkbox·Switch 대체.
 * 전부 네이티브 요소 위에 토큰 모양만 입혔다 — 그래서 5초 폴링으로 부모가 다시 그려져도
 * 같은 DOM 요소가 유지돼 입력 포커스를 잃지 않는다(key 를 바꾸지 않는 한).
 */

type FieldBase = {
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
  style?: CSSProperties;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  onPressEnter?: (e: KeyboardEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  allowClear?: boolean;
  prefix?: ReactNode;
  suffix?: ReactNode;
  type?: string;
  name?: string;
  /** antd 의 status — 빨간(또는 노란) 테두리로 입력 문제를 알린다 */
  status?: "error" | "warning" | "";
  "aria-label"?: string;
};

/** 한 줄 입력(antd Input). prefix/suffix 가 있으면 테두리 안에 붙여 그린다. */
export const Field = forwardRef<HTMLInputElement, FieldBase>(function Field(
  { size = "md", className: cn, style, onPressEnter, onKeyDown, prefix, suffix, allowClear, status, ...rest },
  ref,
) {
  const className = [cn ?? "", status ? `is-${status}` : ""].filter(Boolean).join(" ") || undefined;
  const input = (
    <input
      ref={ref}
      {...rest}
      className={prefix || suffix || allowClear ? "ui-field-bare" : ["ui-field", `size-${size}`, className ?? ""].filter(Boolean).join(" ")}
      style={prefix || suffix || allowClear ? undefined : style}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.key === "Enter" && !e.nativeEvent.isComposing) onPressEnter?.(e);
      }}
    />
  );
  if (!prefix && !suffix && !allowClear) return input;
  return (
    <span className={["ui-field", "has-affix", `size-${size}`, className ?? ""].filter(Boolean).join(" ")} style={style}>
      {prefix && <span className="ui-field-affix">{prefix}</span>}
      {input}
      {allowClear && rest.value && (
        <button
          type="button"
          className="ui-field-clear"
          aria-label="지우기"
          onClick={() =>
            rest.onChange?.({ target: { value: "" }, currentTarget: { value: "" } } as unknown as ChangeEvent<HTMLInputElement>)
          }
        >
          ×
        </button>
      )}
      {suffix && <span className="ui-field-affix">{suffix}</span>}
    </span>
  );
});

/** 검색 입력(antd Input.Search). Enter 나 돋보기(또는 enterButton)를 누르면 onSearch. */
export function SearchField({
  onSearch,
  value,
  onChange,
  enterButton,
  busy = false,
  size = "md",
  style,
  ...rest
}: Omit<FieldBase, "prefix"> & { onSearch?: (v: string) => void; enterButton?: ReactNode; busy?: boolean }) {
  const [inner, setInner] = useState("");
  const cur = value ?? inner;
  const change = (e: ChangeEvent<HTMLInputElement>) => {
    if (value === undefined) setInner(e.target.value);
    onChange?.(e);
  };
  const field = (
    <Field
      {...rest}
      size={size}
      value={cur}
      onChange={change}
      style={enterButton ? { flex: 1 } : style}
      prefix={enterButton ? undefined : <Search size={14} />}
      onPressEnter={() => onSearch?.(cur)}
    />
  );
  if (!enterButton) return field;
  return (
    <span className="ui-compact" style={style}>
      {field}
      <button
        type="button"
        className={`ui-btn variant-solid size-${size === "sm" ? "sm" : "md"}`}
        disabled={busy || rest.disabled}
        onClick={() => onSearch?.(cur)}
      >
        {busy && <span className="ui-spin" aria-hidden />}
        {enterButton}
      </button>
    </span>
  );
}

/** 여러 줄 입력(antd Input.TextArea). autoSize 는 최소·최대 줄 수로 높이를 잡는다(내용 따라 늘이기는 field-sizing). */
export const TextArea = forwardRef<
  HTMLTextAreaElement,
  {
    value?: string;
    defaultValue?: string;
    placeholder?: string;
    disabled?: boolean;
    readOnly?: boolean;
    autoFocus?: boolean;
    rows?: number;
    autoSize?: boolean | { minRows?: number; maxRows?: number };
    maxLength?: number;
    className?: string;
    style?: CSSProperties;
    onChange?: (e: ChangeEvent<HTMLTextAreaElement>) => void;
    onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
    /** Enter(한글 조합 중 제외)를 눌렀을 때. Shift+Enter 구분은 호출부가 e.shiftKey 로 한다 */
    onPressEnter?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  }
>(function TextArea({ autoSize, rows, className, style, onPressEnter, onKeyDown, ...rest }, ref) {
  const as = typeof autoSize === "object" ? autoSize : autoSize ? {} : null;
  const lh = 22;
  const st: CSSProperties = as
    ? {
        fieldSizing: "content",
        minHeight: (as.minRows ?? 2) * lh + 14,
        maxHeight: as.maxRows ? as.maxRows * lh + 14 : undefined,
        ...style,
      } as CSSProperties
    : style ?? {};
  return (
    <textarea
      ref={ref}
      rows={as ? as.minRows ?? 2 : rows ?? 3}
      {...rest}
      className={["ui-field", "ui-textarea", className ?? ""].filter(Boolean).join(" ")}
      style={st}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.key === "Enter" && !e.nativeEvent.isComposing) onPressEnter?.(e);
      }}
    />
  );
});

export type Option<T extends string = string> = { label: ReactNode; value: T; disabled?: boolean };
/** 묶음(optgroup) — antd Select 의 { label, options } 모양 */
export type OptionGroup<T extends string = string> = { label: string; title?: string; options: Option<T>[] };

/** 고르기 상자(antd Select, 단일 선택). label 이 노드면 글자만 option 에 쓴다. */
export function SelectBox<T extends string = string>({
  value,
  options,
  onChange,
  placeholder,
  disabled,
  size = "md",
  style,
  className,
  "aria-label": ariaLabel,
}: {
  value?: T;
  options: (Option<T> | OptionGroup<T>)[];
  onChange?: (v: T) => void;
  placeholder?: string;
  disabled?: boolean;
  size?: "sm" | "md";
  style?: CSSProperties;
  className?: string;
  /** antd 의 검색 고르기. 네이티브 select 는 글자를 치면 그 항목으로 옮겨 가므로 받기만 한다 */
  showSearch?: unknown;
  "aria-label"?: string;
}) {
  const txt = (n: ReactNode) => (typeof n === "string" || typeof n === "number" ? String(n) : "");
  return (
    <select
      className={["ui-field", "ui-select", `size-${size}`, className ?? ""].filter(Boolean).join(" ")}
      value={value ?? ""}
      disabled={disabled}
      style={style}
      aria-label={ariaLabel}
      onChange={(e) => onChange?.(e.target.value as T)}
    >
      {placeholder !== undefined && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((o) =>
        "options" in o ? (
          <optgroup key={`g-${o.label}`} label={o.label}>
            {o.options.map((x) => (
              <option key={x.value} value={x.value} disabled={x.disabled}>
                {txt(x.label) || x.value}
              </option>
            ))}
          </optgroup>
        ) : (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {txt(o.label) || o.value}
          </option>
        ),
      )}
    </select>
  );
}

/** 라디오 묶음(antd Radio.Group). 버튼처럼 보이게 하려면 button. */
export function RadioGroup<T extends string = string>({
  value,
  options,
  onChange,
  name,
  button = false,
  vertical = false,
  disabled,
  style,
}: {
  value?: T;
  options: Option<T>[];
  onChange?: (v: T) => void;
  name: string;
  button?: boolean;
  vertical?: boolean;
  disabled?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      role="radiogroup"
      className={["ui-radios", button ? "is-button" : "", vertical ? "is-vertical" : ""].filter(Boolean).join(" ")}
      style={style}
    >
      {options.map((o) => (
        <label key={o.value} className={["ui-radio", value === o.value ? "is-on" : ""].filter(Boolean).join(" ")}>
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            disabled={disabled || o.disabled}
            onChange={() => onChange?.(o.value)}
          />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  );
}

/** 체크 상자(antd Checkbox). */
export function Checkbox({
  checked,
  onChange,
  disabled,
  style,
  children,
}: {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  return (
    <label className="ui-check" style={style}>
      <input
        type="checkbox"
        className="ui-check-input"
        checked={!!checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      {children && <span>{children}</span>}
    </label>
  );
}

/** 켜고 끄기(antd Switch). */
export function Switch({
  checked,
  onChange,
  disabled,
  size = "md",
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      className={["ui-switch", `size-${size}`, checked ? "is-on" : ""].filter(Boolean).join(" ")}
      onClick={() => onChange?.(!checked)}
    >
      <i aria-hidden />
    </button>
  );
}
