"use client";

import { useRef, useState, type ReactNode } from "react";
import { FloatLayer, toPlacement, useFloatingPos } from "./floating";

/**
 * 툴팁. antd Tooltip 대체. 감싼 요소에 마우스를 올리고 200ms 뒤에 뜬다(스쳐 지나갈 때 깜빡이지 않게).
 * 감싸는 껍데기는 inline-flex span 이라 안쪽 요소가 disabled 버튼이어도 호버를 받는다.
 * title 이 비면 아무것도 띄우지 않고 children 만 그린다.
 */
export default function Tip({
  title,
  placement,
  block = false,
  children,
}: {
  title?: ReactNode;
  placement?: string;
  block?: boolean;
  children: ReactNode;
}) {
  const anchor = useRef<HTMLSpanElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pos = useFloatingPos(anchor, layer, open, toPlacement(placement));
  const empty = title == null || title === "" || title === false;

  const show = () => {
    if (empty) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), 200);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
  };

  return (
    <>
      <span
        ref={anchor}
        className="ui-tip-anchor"
        style={{ display: block ? "flex" : "inline-flex", maxWidth: "100%" }}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </span>
      {!empty && (
        <FloatLayer open={open} layerRef={layer} pos={pos} className="ui-tip" role="tooltip">
          {title}
        </FloatLayer>
      )}
    </>
  );
}
