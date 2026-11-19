"use client";

import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { FloatLayer, toPlacement, useDismiss, useFloatingPos } from "./floating";

/**
 * 말풍선 패널. antd Popover 대체. 기본은 클릭으로 열고 바깥 클릭·Esc 로 닫는다.
 * trigger="hover" 면 마우스를 올렸을 때 열고, 패널로 마우스를 옮기는 동안은 닫지 않는다.
 * open/onOpenChange 를 주면 열림을 호출부가 쥔다(제어 모드).
 */
export default function Pop({
  content,
  title,
  trigger = "click",
  placement = "bottom",
  open: openProp,
  onOpenChange,
  disabled = false,
  style,
  children,
}: {
  content: ReactNode | (() => ReactNode);
  title?: ReactNode;
  trigger?: "click" | "hover";
  placement?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const anchor = useRef<HTMLSpanElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const [inner, setInner] = useState(false);
  const open = openProp ?? inner;
  const set = (v: boolean) => {
    if (openProp === undefined) setInner(v);
    onOpenChange?.(v);
  };
  const pos = useFloatingPos(anchor, layer, open, toPlacement(placement));
  useDismiss(open, [anchor, layer], () => set(false));

  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverIn = () => {
    if (trigger !== "hover" || disabled) return;
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    set(true);
  };
  const hoverOut = () => {
    if (trigger !== "hover") return;
    leaveTimer.current = setTimeout(() => set(false), 150);
  };

  return (
    <>
      <span
        ref={anchor}
        style={{ display: "inline-flex", maxWidth: "100%" }}
        onClick={trigger === "click" && !disabled ? () => set(!open) : undefined}
        onMouseEnter={hoverIn}
        onMouseLeave={hoverOut}
      >
        {children}
      </span>
      <FloatLayer
        open={open && !disabled}
        layerRef={layer}
        pos={pos}
        className="ui-pop"
        role="dialog"
        style={style}
        onMouseEnter={hoverIn}
        onMouseLeave={hoverOut}
      >
        {title && <div className="ui-pop-title">{title}</div>}
        {typeof content === "function" ? (content as () => ReactNode)() : content}
      </FloatLayer>
    </>
  );
}
