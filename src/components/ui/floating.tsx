"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { autoUpdate, computePosition, flip, offset, shift, type Placement } from "@floating-ui/dom";

/*
 * 떠 있는 요소(Tip·Pop·Confirm·Menu)의 공통 바닥.
 * 위치 계산은 @floating-ui/dom 에 맡긴다 — 가장자리에서 뒤집기(flip)·밀어 넣기(shift)를 손으로 짜면 벌레가 난다.
 * 본체는 body 포털로 그려 부모의 overflow·z-index 에 갇히지 않게 한다(z-index 는 머리띠 100 보다 위).
 */
export type { Placement };

/** antd placement 이름(topLeft 등)을 floating-ui 이름으로 */
export function toPlacement(p?: string): Placement {
  if (!p) return "top";
  const m: Record<string, Placement> = {
    topLeft: "top-start",
    topRight: "top-end",
    bottomLeft: "bottom-start",
    bottomRight: "bottom-end",
    leftTop: "left-start",
    leftBottom: "left-end",
    rightTop: "right-start",
    rightBottom: "right-end",
  };
  return m[p] ?? (p as Placement);
}

export function useFloatingPos(
  anchor: RefObject<HTMLElement | null>,
  floating: RefObject<HTMLElement | null>,
  open: boolean,
  placement: Placement,
) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const a = anchor.current;
    const f = floating.current;
    if (!a || !f) return;
    return autoUpdate(a, f, () => {
      void computePosition(a, f, {
        placement,
        strategy: "fixed",
        middleware: [offset(8), flip(), shift({ padding: 8 })],
      }).then(({ x, y }) => setPos({ x, y }));
    });
  }, [open, placement, anchor, floating]);
  return pos;
}

/** 바깥 클릭·Esc 로 닫기 */
export function useDismiss(
  open: boolean,
  refs: RefObject<HTMLElement | null>[],
  onClose: () => void,
) {
  const cb = useRef(onClose);
  cb.current = onClose;
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (refs.some((r) => r.current?.contains(t))) return;
      cb.current();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") cb.current();
    };
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("keydown", key);
    };
    // refs 배열은 호출부에서 매번 새로 만들어도 안의 ref 객체는 같다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}

export function FloatLayer({
  open,
  layerRef,
  pos,
  className,
  style,
  onMouseEnter,
  onMouseLeave,
  role,
  children,
}: {
  open: boolean;
  layerRef: RefObject<HTMLDivElement | null>;
  pos: { x: number; y: number } | null;
  className: string;
  style?: CSSProperties;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  role?: string;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !open) return null;
  return createPortal(
    <div
      ref={layerRef}
      role={role}
      className={className}
      style={{
        position: "fixed",
        left: pos?.x ?? 0,
        top: pos?.y ?? 0,
        visibility: pos ? "visible" : "hidden",
        ...style,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>,
    document.body,
  );
}
