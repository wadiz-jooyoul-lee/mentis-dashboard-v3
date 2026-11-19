import type { CSSProperties, ReactNode } from "react";
import Chip, { type ChipTone } from "./Chip";

/*
 * antd Tag 의 color 값(의미 이름·팔레트 이름·hex)을 Chip 으로 옮기는 얇은 껍데기.
 * 화면 코드가 "success"·"blue"·"#d4380d" 같은 값을 데이터로 들고 있는 곳이 많아,
 * 호출부를 고치지 않고 색 의미만 토큰 tone 으로 접는다. hex 는 Chip outline 으로 색을 그대로 보존한다.
 */
const NAME_TONE: Record<string, ChipTone> = {
  success: "ok",
  green: "ok",
  lime: "ok",
  cyan: "ok",
  processing: "info",
  blue: "info",
  geekblue: "info",
  purple: "accent",
  magenta: "accent",
  warning: "warn",
  gold: "warn",
  orange: "warn",
  yellow: "warn",
  error: "danger",
  red: "danger",
  volcano: "danger",
  default: "neutral",
};

export function toneOf(color?: string): ChipTone {
  if (!color) return "neutral";
  return NAME_TONE[color] ?? "neutral";
}

export default function Tag({
  color,
  icon,
  title,
  className,
  style,
  onClick,
  closable,
  onClose,
  children,
}: {
  color?: string;
  icon?: ReactNode;
  title?: string;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  /** antd 의 variant·bordered 는 받기만 한다(칩 모양은 하나) */
  variant?: string;
  bordered?: boolean;
  /** 닫기(×) 단추. 누르면 onClose */
  closable?: boolean;
  onClose?: () => void;
  children?: ReactNode;
}) {
  const isHex = !!color && /^(#|rgb|hsl|var\(|color-mix)/.test(color);
  const body = (
    <>
      {icon}
      {children}
      {closable && (
        <button
          type="button"
          className="ui-chip-x"
          aria-label="닫기"
          onClick={(e) => {
            e.stopPropagation();
            onClose?.();
          }}
        >
          ×
        </button>
      )}
    </>
  );
  const chip = isHex ? (
    <Chip outline color={color} className={className} style={style}>
      {body}
    </Chip>
  ) : (
    <Chip tone={toneOf(color)} className={className} style={style}>
      {body}
    </Chip>
  );
  if (!title && !onClick) return chip;
  return (
    <span title={title} onClick={onClick} style={{ display: "inline-flex", cursor: onClick ? "pointer" : undefined }}>
      {chip}
    </span>
  );
}

const STATUS_TONE: Record<string, ChipTone> = {
  success: "ok",
  processing: "info",
  error: "danger",
  warning: "warn",
  default: "neutral",
};

/** 점 + 글자 상태 표시. antd Badge 의 status/text 모양을 Chip dot 으로 옮긴다. color 를 주면 그 색 점. */
export function StatusDot({
  status = "default",
  text,
  color,
  title,
  style,
}: {
  status?: "success" | "processing" | "error" | "warning" | "default";
  text?: ReactNode;
  color?: string;
  title?: string;
  style?: CSSProperties;
}) {
  return (
    <Chip dot tone={STATUS_TONE[status] ?? "neutral"} color={color} title={title} style={style}>
      {text}
    </Chip>
  );
}
