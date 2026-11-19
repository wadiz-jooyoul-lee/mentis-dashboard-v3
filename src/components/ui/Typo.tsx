"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";

/*
 * 글자 프리미티브. antd Typography(Title·Text·Paragraph)를 대체한다.
 * 화면마다 수백 군데라 치환 비용을 줄이려고 prop 이름은 antd 와 같게 받되(type·strong·code·level),
 * 모양은 ui.css 의 .ui-* 클래스와 토큰만 쓴다.
 */
type Tone = "secondary" | "success" | "warning" | "danger";

type TextProps = {
  type?: Tone;
  strong?: boolean;
  code?: boolean;
  delete?: boolean;
  italic?: boolean;
  /** 한 줄 말줄임. antd 의 ellipsis 와 같게 true 또는 { tooltip } 을 받는다(툴팁은 title 속성으로) */
  ellipsis?: boolean | { tooltip?: ReactNode };
  /** 복사 버튼. true 면 children 문자열, { text } 면 그 값을 복사한다 */
  copyable?: boolean | { text?: string };
  title?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

function cls(base: string, p: TextProps) {
  return [
    base,
    p.type ? `tone-${p.type}` : "",
    p.strong ? "is-strong" : "",
    p.delete ? "is-del" : "",
    p.italic ? "is-italic" : "",
    p.ellipsis ? "is-ellipsis" : "",
    p.className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="ui-copy"
      aria-label="복사"
      title={done ? "복사했습니다" : "복사"}
      onClick={(e) => {
        e.stopPropagation();
        void navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        });
      }}
    >
      {done ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  return "";
}

function inner(p: TextProps) {
  const body = p.code ? <code className="ui-code">{p.children}</code> : p.children;
  const copyText = p.copyable ? (typeof p.copyable === "object" && p.copyable.text) || textOf(p.children) : "";
  return (
    <>
      {body}
      {p.copyable && <CopyBtn text={copyText} />}
    </>
  );
}

function tipOf(p: TextProps): string | undefined {
  if (p.title) return p.title;
  if (p.ellipsis && typeof p.ellipsis === "object" && typeof p.ellipsis.tooltip === "string") return p.ellipsis.tooltip;
  if (p.ellipsis) return textOf(p.children) || undefined;
  return undefined;
}

export function Text(p: TextProps) {
  return (
    <span className={cls("ui-text", p)} style={p.style} title={tipOf(p)}>
      {inner(p)}
    </span>
  );
}

export function Paragraph(p: TextProps) {
  return (
    <div className={cls("ui-para", p)} style={p.style} title={tipOf(p)}>
      {inner(p)}
    </div>
  );
}

/** 제목. level 1~5 를 ui.css 의 .ui-t{n} 크기로 그린다(문서 구조상 태그도 h1~h5). */
export function Title({
  level = 1,
  className,
  style,
  children,
}: {
  level?: 1 | 2 | 3 | 4 | 5;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const Tag = `h${level}` as "h1";
  return (
    <Tag className={["ui-title", `ui-t${level}`, className ?? ""].filter(Boolean).join(" ")} style={style}>
      {children}
    </Tag>
  );
}
