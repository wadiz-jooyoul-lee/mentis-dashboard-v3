"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

/*
 * 그림 크게 보기. antd Image + Image.PreviewGroup 대체.
 * <Gallery> 안의 <Zoomable> 그림들은 한 묶음이 된다 — 하나를 누르면 화면 가득 열리고,
 * ←/→ 로 같은 묶음의 다음 그림으로 넘긴다. 그림 아래에는 설명(alt)을 띄워 무엇을 보라는 그림인지 알린다.
 * 묶음 밖의 <Zoomable> 은 저 혼자 연다.
 */
type Pic = { id: number; src: string; alt?: string };
type Ctx = { add: (p: Pic) => void; remove: (id: number) => void; open: (id: number) => void };
const GalleryCtx = createContext<Ctx | null>(null);
let seq = 0;

function Viewer({ pics, at, onClose, onMove }: { pics: Pic[]; at: number; onClose: () => void; onMove: (n: number) => void }) {
  const p = pics[at];
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onMove(Math.min(pics.length - 1, at + 1));
      if (e.key === "ArrowLeft") onMove(Math.max(0, at - 1));
    };
    document.addEventListener("keydown", key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = prev;
    };
  }, [at, pics.length, onClose, onMove]);
  if (!p) return null;
  return createPortal(
    <div className="ui-lightbox" role="dialog" aria-modal onClick={onClose}>
      <button type="button" className="ui-lightbox-x" aria-label="닫기" onClick={onClose}>
        <X size={20} />
      </button>
      {at > 0 && (
        <button
          type="button"
          className="ui-lightbox-nav is-prev"
          aria-label="이전 그림"
          onClick={(e) => {
            e.stopPropagation();
            onMove(at - 1);
          }}
        >
          <ChevronLeft size={26} />
        </button>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={p.src} alt={p.alt ?? ""} onClick={(e) => e.stopPropagation()} />
      <div className="ui-lightbox-cap" onClick={(e) => e.stopPropagation()}>
        {p.alt && <span>{p.alt}</span>}
        {pics.length > 1 && <span className="ui-lightbox-num">{at + 1} / {pics.length}</span>}
      </div>
      {at < pics.length - 1 && (
        <button
          type="button"
          className="ui-lightbox-nav is-next"
          aria-label="다음 그림"
          onClick={(e) => {
            e.stopPropagation();
            onMove(at + 1);
          }}
        >
          <ChevronRight size={26} />
        </button>
      )}
    </div>,
    document.body,
  );
}

export function Gallery({ children }: { children: ReactNode }) {
  // 등록 순서 = 화면에 그려진 순서(마크다운·표 행 순서). 그 순서로 넘긴다.
  const list = useRef<Pic[]>([]);
  const [view, setView] = useState<{ pics: Pic[]; at: number } | null>(null);
  const ctx = useMemo<Ctx>(
    () => ({
      add: (p) => {
        list.current = [...list.current.filter((x) => x.id !== p.id), p];
      },
      remove: (id) => {
        list.current = list.current.filter((x) => x.id !== id);
      },
      open: (id) => {
        const pics = [...list.current].sort((a, b) => a.id - b.id);
        setView({ pics, at: Math.max(0, pics.findIndex((x) => x.id === id)) });
      },
    }),
    [],
  );
  const close = useCallback(() => setView(null), []);
  const move = useCallback((n: number) => setView((v) => (v ? { ...v, at: n } : v)), []);
  return (
    <GalleryCtx.Provider value={ctx}>
      {children}
      {view && <Viewer pics={view.pics} at={view.at} onClose={close} onMove={move} />}
    </GalleryCtx.Provider>
  );
}

export function Zoomable({
  src,
  alt,
  height,
  width,
  style,
}: {
  src: string;
  alt?: string;
  height?: number;
  width?: number | string;
  style?: CSSProperties;
}) {
  const ctx = useContext(GalleryCtx);
  const id = useRef(0);
  if (id.current === 0) id.current = ++seq;
  const [solo, setSolo] = useState(false);
  useEffect(() => {
    if (!ctx) return;
    const me = id.current;
    ctx.add({ id: me, src, alt });
    return () => ctx.remove(me);
  }, [ctx, src, alt]);
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt ?? ""}
        height={height}
        width={typeof width === "number" ? width : undefined}
        className="ui-zoomable"
        style={{ width: typeof width === "string" ? width : undefined, ...style }}
        onClick={() => (ctx ? ctx.open(id.current) : setSolo(true))}
      />
      {solo && <Viewer pics={[{ id: id.current, src, alt }]} at={0} onClose={() => setSolo(false)} onMove={() => {}} />}
    </>
  );
}
