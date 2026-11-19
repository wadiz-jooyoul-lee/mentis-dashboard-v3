"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Artifact, Book } from "@/lib/office/core/types";
import type { RetroItem } from "@/lib/office/retro";

const COVERS = [["#c8553d", "#fff3e2"], ["#e0a83a", "#3a2a12"], ["#d96f4f", "#fff3e2"], ["#f0c04a", "#3a2a12"], ["#3f7f5a", "#f3f7ee"], ["#8aa56b", "#22301a"], ["#6e5f73", "#f6eef8"], ["#4a86a8", "#f0f7fb"], ["#7ab0bf", "#12303a"], ["#3d6f8f", "#eef6fb"], ["#2f6e4f", "#eef7f1"], ["#a65a6b", "#fbeef1"]];
const ART_COVERS = [["#25324a", "#e9eef8"], ["#4b2f5c", "#f3eaf8"], ["#1f4f4f", "#e6f4f2"], ["#5a2e2e", "#f8eaea"], ["#2e3b2a", "#edf3e6"]];
export const hash = (s: string) => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
};
// 다시 진행한 회차({키}-2)도 원래 키의 색과 높이를 써서 책장을 오가도 같은 책으로 보이게 한다
const rootKey = (key: string) => key.match(/^([A-Z][A-Z0-9]*-\d+)-\d+$/)?.[1] ?? key;
export const coverOf = (key: string) => COVERS[hash(rootKey(key)) % COVERS.length];

const X0 = 34;
type Kind = "task" | "art" | "retro";
export interface ActiveBook {
  key: string;
  title: string;
  phase: string;
  appendix: boolean;
}
// 작업 칸에서 작업 중 책과 완료 책 사이에 세우는 책받침
type Bookend = { bookend: true };
const BOOKEND: Bookend = { bookend: true };
const END_W = 14;
type Item = Book | Artifact | ActiveBook | RetroItem | Bookend;
const isEnd = (b: Item): b is Bookend => "bookend" in b;
const isActive = (b: Item): b is ActiveBook => "phase" in b;
const BOOK_W = (b: Book) => Math.round(24 + Math.min(18, Math.log2(1 + b.lines) * 1.8));
const appW = (w: number) => Math.ceil(w / 2); // 부록책은 책의 반 두께
interface Spec {
  floors: number[];
  H: number;
  vbH: number;
  w: (b: Item) => number;
}
const hasApp = (kind: Kind, b: Item) => kind !== "art" && !isEnd(b) && !!(b as Book | ActiveBook).appendix;
const bookW = (kind: Kind, b: Item) => (kind === "task" ? (isActive(b) ? 30 : BOOK_W(b as Book)) : kind === "retro" ? 30 : 40);
// 책장마다 3단. 한 쪽이 차면 다음 쪽으로 넘긴다
const FLOORS = [292, 604, 916];
const SPEC: Record<Kind, Spec> = {
  task: { floors: FLOORS, H: 262, vbH: 936, w: (b) => (isEnd(b) ? END_W : bookW("task", b) + (hasApp("task", b) ? 2 + appW(bookW("task", b)) : 0)) },
  art: { floors: FLOORS, H: 262, vbH: 936, w: () => 40 },
  retro: { floors: FLOORS, H: 262, vbH: 936, w: () => 30 },
};
const keyOf = (kind: Kind, b: Item) => (kind === "art" ? (b as Artifact).id : isEnd(b) ? "bookend" : (b as Book | ActiveBook | RetroItem).key);
const reduceMotion = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

interface Placed {
  b: Item;
  tier: number;
  x: number;
  w: number;
}
function paginate(S: Spec, W: number, list: Item[]): Placed[][] {
  const pages: Placed[][] = [[]];
  let tier = 0, x = X0;
  const X1 = W - X0;
  for (const b of list) {
    const w = S.w(b) + 3;
    if (x + w > X1) {
      tier++;
      x = X0;
      if (tier >= S.floors.length) {
        pages.push([]);
        tier = 0;
      }
    }
    pages[pages.length - 1].push({ b, tier, x, w: w - 3 });
    x += w;
  }
  return pages;
}

export interface Tip {
  head: string;
  text: string;
  x: number;
  y: number;
}

// 한 단 구역. 쪽 폭은 구역의 가로세로 비율에 맞춰 정하고, 좌우로 밀어 쪽을 넘긴다(화살표·스크롤 막대 없음)
function Strip({
  kind,
  list,
  dim,
  hit,
  newKey,
  fresh,
  jump,
  page,
  onOpen,
  onAppendix,
  onTip,
  onDots,
}: {
  kind: Kind;
  list: Item[];
  dim: Set<string> | null;
  hit: string | null;
  newKey: string | null;
  fresh?: Set<string>;
  jump: { key: string; n: number } | null;
  /** 쪽 표시 점을 눌러 고른 쪽. n 은 같은 쪽을 다시 눌러도 바뀌게 하는 번호 */
  page: { i: number; n: number } | null;
  onOpen: (b: Item) => void;
  onAppendix?: (key: string) => void;
  onTip: (t: Tip | null) => void;
  onDots: (n: number, cur: number) => void;
}) {
  const S = SPEC[kind];
  const el = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(600);
  // 새로 꽂은 책이 첫 쪽 맨 앞에 오도록 최신 순으로 놓는다
  const pages = useMemo(() => paginate(S, W, [...list].reverse()), [S, W, list]);
  const pageOfKey = (key: string) => Math.max(0, pages.findIndex((pg) => pg.some((it) => keyOf(kind, it.b) === key)));
  const cur = () => (el.current ? Math.round(el.current.scrollLeft / Math.max(1, el.current.clientWidth)) : 0);
  const go = (i: number, instant?: boolean) => el.current?.scrollTo({ left: i * el.current.clientWidth, behavior: instant || reduceMotion() ? "auto" : "smooth" });
  const anchor = useRef<Item | null>(null);

  // 구역 크기가 바뀌면 보던 쪽의 첫 책이 그대로 보이게 다시 나눈다
  useEffect(() => {
    const node = el.current!;
    let lastW = 0, lastH = 0, t: ReturnType<typeof setTimeout> | undefined;
    const ro = new ResizeObserver(() => {
      const w = node.clientWidth, h = node.clientHeight;
      if (!w || !h || (Math.abs(w - lastW) < 2 && Math.abs(h - lastH) < 2)) return;
      lastW = w;
      lastH = h;
      clearTimeout(t);
      t = setTimeout(() => setW(Math.max(300, Math.round((w / h) * S.vbH))), 60);
    });
    ro.observe(node);
    return () => {
      ro.disconnect();
      clearTimeout(t);
    };
  }, [S]);
  useLayoutEffect(() => {
    if (anchor.current) go(pageOfKey(keyOf(kind, anchor.current)), true);
    onDots(pages.length, cur());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages]);

  // 새 책이 꽂히면 첫 쪽으로, 검색 결과를 고르면 그 책이 있는 쪽으로 넘긴다
  useEffect(() => {
    if (newKey) go(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newKey]);
  useEffect(() => {
    if (!jump) return;
    go(pageOfKey(jump.key));
    const g = el.current?.querySelector<SVGGElement>(`.book[data-key="${CSS.escape(jump.key)}"]`);
    if (g) setTimeout(() => g.focus({ preventScroll: true }), reduceMotion() ? 0 : 350);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jump]);
  useEffect(() => {
    if (page) go(page.i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // 마우스로 끌어 넘기기. 터치·트랙패드는 기본 가로 스크롤을 쓴다
  const drag = useRef<{ x: number; s: number; moved: boolean } | null>(null);
  const moved = useRef(false);
  useEffect(() => {
    const node = el.current!;
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.x;
      if (!d.moved && Math.abs(dx) > 6) {
        d.moved = moved.current = true;
        node.classList.add("dragging");
        onTip(null);
      }
      if (d.moved) node.scrollLeft = d.s - dx;
    };
    const up = (e: PointerEvent) => {
      const d = drag.current;
      drag.current = null;
      if (!d?.moved) return;
      node.classList.remove("dragging");
      const dx = e.clientX - d.x, c = node.scrollLeft / node.clientWidth;
      go(Math.max(0, Math.min(pages.length - 1, dx < 0 ? Math.ceil(c - 0.15) : Math.floor(c + 0.15))));
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages.length, onTip]);

  const tipFor = (b: Item, e: { currentTarget: Element }): Tip => {
    const r = e.currentTarget.getBoundingClientRect();
    const pane = el.current!.closest(".drawer")!.getBoundingClientRect();
    const pos = { x: r.left + r.width / 2 - pane.left, y: r.top - pane.top };
    if (kind === "art") {
      const a = b as Artifact;
      return { head: `아티팩트 · ${a.kind} · ${a.at}`, text: `${a.title} · ${a.taskKey || "이슈 없음"}`, ...pos };
    }
    if (kind === "retro") {
      const r = b as RetroItem;
      return { head: `${r.key} · 회고 ${r.madeAt}`, text: `${r.title} · 잘못한 판단 ${r.defects}건`, ...pos };
    }
    if (isActive(b)) return { head: `${b.key} · 작업 중`, text: `${b.title} · ${b.phase}`, ...pos };
    const k = b as Book;
    return { head: `${k.key} · 완료 ${k.doneAt}`, text: `${k.title}${k.pr ? ` · PR #${k.pr}` : ""} · 리뷰 ${k.rounds}회`, ...pos };
  };

  return (
    <div
      ref={el}
      className="shelf-strip"
      id={`${kind}Strip`}
      role="group"
      aria-label={kind === "task" ? "작업 중인 책과 완료된 책. 좌우로 밀어 넘깁니다." : kind === "retro" ? "회고록. 좌우로 밀어 넘깁니다." : "게시한 아티팩트 책. 좌우로 밀어 넘깁니다."}
      onPointerDown={(e) => {
        if (e.pointerType !== "mouse" || e.button !== 0) return;
        drag.current = { x: e.clientX, s: el.current!.scrollLeft, moved: false };
        moved.current = false;
      }}
      onClickCapture={(e) => {
        if (moved.current) {
          e.stopPropagation();
          moved.current = false;
        }
      }}
      onScroll={() => {
        anchor.current = pages[cur()]?.[0]?.b ?? null;
        onDots(pages.length, cur());
      }}
    >
      {pages.map((pg, pi) => (
        <svg key={pi} viewBox={`0 0 ${W} ${S.vbH}`} className="shelf-page">
          <rect x={0} y={0} width={W} height={S.vbH} style={{ fill: "#7d5b3e" }} />
          {S.floors.map((f, i) => (
            <g key={i}>
              <rect x={0} y={f - S.H - 6} width={W} height={6} style={{ fill: "#6a4c33", opacity: 0.6 }} />
              <rect x={0} y={f} width={W} height={14} style={{ fill: "#c9955f" }} />
            </g>
          ))}
          {pg.map((it) => {
            if (isEnd(it.b)) {
              const f = S.floors[it.tier];
              return (
                <g key="bookend" className="bookend" aria-hidden="true">
                  <rect x={it.x + 3} y={f - 120} width={it.w - 6} height={120} rx={2} />
                  <rect x={it.x - 2} y={f - 5} width={it.w + 4} height={5} rx={1} />
                </g>
              );
            }
            const live = kind === "task" && isActive(it.b);
            const key = keyOf(kind, it.b), h = hash(kind === "art" ? key : rootKey(key)), covers = kind === "art" ? ART_COVERS : COVERS, [col, ink] = covers[h % covers.length];
            const bw = bookW(kind, it.b), aw = hasApp(kind, it.b) ? appW(bw) : 0;
            const bh = S.H - 26 - ((h >>> 8) % 34), y = S.floors[it.tier] - bh, x = it.x, cx = x + bw / 2, cy = y + bh / 2;
            const ah = bh - 34, ax = x + bw + 2, ay = S.floors[it.tier] - ah;
            const open = () => onOpen(it.b);
            const isNew = !!fresh?.has(key);
            const cls = `book${live ? " live" : ""}${dim && !dim.has(key) ? " dim" : ""}${hit === key ? " hit" : ""}${isNew ? " fresh" : ""}`;
            return (
              <g key={key}>
              <g
                className={cls}
                tabIndex={0}
                role="button"
                data-key={key}
                aria-label={kind === "art" ? `아티팩트 ${(it.b as Artifact).title} 보기` : `${key} ${(it.b as Book).title} ${live ? "진행 상황" : kind === "retro" ? "회고록" : "상세"} 보기`}
                onMouseEnter={(e) => onTip(tipFor(it.b, e))}
                onMouseLeave={() => onTip(null)}
                onFocus={(e) => {
                  onTip(tipFor(it.b, e));
                  go(pi, true);
                }}
                onBlur={() => onTip(null)}
                onClick={open}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    open();
                  }
                }}
              >
                <g className="lift">
                  <g className={key === newKey ? "drop" : ""}>
                    <rect x={x} y={y} width={bw} height={bh} rx={2.5} className="spine" style={{ fill: col, stroke: live ? "#22c55e" : "rgba(0,0,0,.25)" }} />
                    <rect x={x + 2} y={y + 9} width={bw - 4} height={2.5} style={{ fill: "#e7cf86" }} />
                    <rect x={x + 2} y={y + bh - 13} width={bw - 4} height={2.5} style={{ fill: "#e7cf86" }} />
                    {live && <circle cx={cx} cy={y + 22} r={4.5} className="book-live" />}
                    {isNew && (
                      <g className="book-new">
                        <rect x={cx - 15} y={y - 15} width={30} height={13} rx={3} />
                        <text x={cx} y={y - 5.5} textAnchor="middle">NEW</text>
                      </g>
                    )}
                    {kind !== "art" ? (
                      <>
                        {kind === "task" && !live &&
                          Array.from({ length: Math.min(3, (it.b as Book).rounds) }, (_, i) => (
                            <rect key={i} x={x + 2} y={y + 15 + i * 5} width={bw - 4} height={2} style={{ fill: "#e7cf86", opacity: 0.8 }} />
                          ))}
                        {kind === "task" && !live && (it.b as Book).human && <path d={`M${x + bw - 7},${y} v15 l3,-3 l3,3 v-15 Z`} style={{ fill: "#c53030" }} />}
                        <text x={cx + 4} y={cy + 4} className="book-key" textAnchor="middle" transform={`rotate(-90 ${cx} ${cy})`} style={{ fill: ink }}>
                          {key}
                        </text>
                      </>
                    ) : (
                      <>
                        <rect x={x + 5} y={y + 20} width={bw - 10} height={16} rx={2} style={{ fill: "#e7cf86" }} />
                        <text x={cx} y={y + 32} textAnchor="middle" style={{ fontSize: 9, fontWeight: 700, fill: "#3a2a12" }}>
                          ART
                        </text>
                        <text x={cx + 4} y={cy + 14} className="art-title" textAnchor="middle" transform={`rotate(-90 ${cx} ${cy + 10})`} style={{ fill: ink }}>
                          {(() => {
                            const t = (it.b as Artifact).title;
                            return t.length > 12 ? t.slice(0, 12) + "…" : t;
                          })()}
                        </text>
                      </>
                    )}
                  </g>
                </g>
              </g>
                {aw > 0 && (
                  // 부록책: 기획서, 요청 원문, 참고 링크. 책과 따로 들리고 따로 고른다
                  <g
                    className={`book appendix${dim && !dim.has(key) ? " dim" : ""}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`${key} 부록(기획서와 참고 링크) 보기`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAppendix?.(key);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        onAppendix?.(key);
                      }
                    }}
                    onMouseEnter={(e) => onTip({ ...tipFor(it.b, e), head: `${key} · 부록`, text: "기획서, 요청 원문, 참고 링크" })}
                    onMouseLeave={() => onTip(null)}
                    onFocus={(e) => {
                      onTip({ ...tipFor(it.b, e), head: `${key} · 부록`, text: "기획서, 요청 원문, 참고 링크" });
                      go(pi, true);
                    }}
                    onBlur={() => onTip(null)}
                  >
                    <g className="lift">
                      <rect x={ax} y={ay} width={aw} height={ah} rx={2} className="spine" style={{ fill: "#efe3c4", stroke: "rgba(0,0,0,.3)" }} />
                      <rect x={ax} y={ay + 8} width={aw} height={4} style={{ fill: col }} />
                      <rect x={ax} y={ay + ah - 12} width={aw} height={4} style={{ fill: col }} />
                      <text x={ax + aw / 2 + 4} y={ay + ah / 2 + 4} className="appendix-key" textAnchor="middle" transform={`rotate(-90 ${ax + aw / 2} ${ay + ah / 2})`}>
                        부록
                      </text>
                    </g>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      ))}
    </div>
  );
}

function Dots({ n, cur, onGo }: { n: number; cur: number; onGo: (i: number) => void }) {
  return (
    <span className="dots">
      {Array.from({ length: n }, (_, i) => (
        <button key={i} type="button" className={i === cur ? "on" : ""} aria-label={`${i + 1}쪽으로 넘기기`} aria-current={i === cur ? "page" : undefined} onClick={() => onGo(i)} />
      ))}
    </span>
  );
}

// 책장 칸: 작업(작업 중인 책, 책받침, 완료된 책), 아티팩트 책, 회고록(회고가 있는 사무실만). 작업 책마다 옆에 부록책이 붙는다
export function Bookshelf({
  active,
  books,
  artifacts,
  retros,
  focusRetro,
  epoch,
  fresh,
  onOpenBook,
  onOpenActive,
  onOpenAppendix,
  onOpenArtifact,
  onAddArtifact,
  onOpenRetro,
  onTip,
}: {
  active: ActiveBook[];
  books: Book[];
  artifacts: Artifact[];
  /** 회고 칸에 꽂을 회고록. 없으면(undefined) 회고 칸을 그리지 않는다. null 은 읽는 중, 글은 읽지 못한 까닭 */
  retros?: RetroItem[] | string | null;
  /** 바닥 회고 책꽂이로 열었을 때 바뀌는 값. 바뀌면 회고 칸으로 넘어간다 */
  focusRetro?: number;
  epoch: number;
  fresh: Set<string>; // 새로 꽂혀 아직 펼쳐 보지 않은 완료 책
  onOpenBook: (b: Book) => void;
  onOpenActive: (key: string) => void;
  onOpenAppendix: (key: string) => void;
  onOpenArtifact: (a: Artifact) => void;
  onAddArtifact: () => void;
  onOpenRetro?: (key: string) => void;
  onTip: (t: Tip | null) => void;
}) {
  const [searchKind, setSearchKind] = useState<"task" | "art">("task");
  const [q, setQ] = useState("");
  const [showRes, setShowRes] = useState(false);
  const [hit, setHit] = useState<string | null>(null);
  const [jump, setJump] = useState<{ kind: Kind; key: string; n: number } | null>(null);
  const [page, setPage] = useState<{ kind: Kind; i: number; n: number } | null>(null);
  const goPage = (kind: Kind) => (i: number) => setPage({ kind, i, n: Date.now() });
  const [dots, setDots] = useState<Record<Kind, [number, number]>>({ task: [0, 0], art: [0, 0], retro: [0, 0] });
  const qRef = useRef<HTMLInputElement>(null);
  const resRef = useRef<HTMLDivElement>(null);
  const retroRef = useRef<HTMLDivElement>(null);
  const [spot, setSpot] = useState(false);

  // 칸은 받은 목록을 뒤집어 놓으므로, 완료 → 책받침 → 작업 중 순으로 넘기면 작업 중 책이 맨 앞에 온다
  const taskList = useMemo<Item[]>(() => (active.length && books.length ? [...books, BOOKEND, ...active] : [...books, ...active]), [active, books]);
  // 회고 목록은 최근 것이 앞이라, 맨 앞에 놓이도록 뒤집어 넘긴다
  const retroList = useMemo(() => (Array.isArray(retros) ? [...retros].reverse() : []), [retros]);

  useEffect(() => {
    if (!focusRetro || !retroRef.current) return;
    retroRef.current.focus({ preventScroll: true });
    setSpot(true);
    const t = setTimeout(() => setSpot(false), 1800);
    return () => clearTimeout(t);
  }, [focusRetro]);

  // 새로 꽂힌 책만 떨어지는 동작을 보여 준다. 스냅샷으로 덮어쓴 경우(epoch 변경)는 제외
  const seen = useRef({ epoch, active: active.length, task: books.length, art: artifacts.length });
  const [newKey, setNewKey] = useState<Record<"task" | "art", string | null>>({ task: null, art: null });
  useEffect(() => {
    const s = seen.current;
    if (s.epoch !== epoch) {
      seen.current = { epoch, active: active.length, task: books.length, art: artifacts.length };
      return;
    }
    if (active.length > s.active) setNewKey((k) => ({ ...k, task: active[active.length - 1].key }));
    if (books.length > s.task) setNewKey((k) => ({ ...k, task: books[books.length - 1].key }));
    if (artifacts.length > s.art) setNewKey((k) => ({ ...k, art: artifacts[artifacts.length - 1].id }));
    s.active = active.length;
    s.task = books.length;
    s.art = artifacts.length;
  }, [active, books, artifacts, epoch]);

  // "책" 검색은 작업 중인 책과 완료된 책을 함께 찾는다
  const t = q.trim().toLowerCase();
  const bookHits = t && searchKind === "task" ? [...active, ...books].filter((b) => `${b.key} ${b.title}`.toLowerCase().includes(t)) : null;
  const artHits = t && searchKind === "art" ? artifacts.filter((a) => `${a.title} ${a.taskKey} ${a.kind}`.toLowerCase().includes(t)) : null;
  const m: Item[] | null = searchKind === "art" ? artHits : bookHits;

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!(e.target as Element).closest(".shelf-search")) setShowRes(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const pick = (b: Item) => {
    const kind: Kind = searchKind;
    const key = keyOf(kind, b);
    setShowRes(false);
    setJump({ kind, key, n: Date.now() });
    setHit(key);
    setTimeout(() => setHit((h) => (h === key ? null : h)), 1800);
  };

  return (
    <>
      <div className="shelf-search">
        <div className="seg" role="group" aria-label="검색 대상">
          {(["task", "art"] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={searchKind === k}
              onClick={() => {
                setSearchKind(k);
                setShowRes(!!q.trim());
                qRef.current?.focus();
              }}
            >
              {k === "task" ? "책" : "아티팩트"}
            </button>
          ))}
        </div>
        <input
          ref={qRef}
          type="search"
          autoComplete="off"
          value={q}
          placeholder={searchKind === "task" ? "이슈 번호나 제목으로 책 찾기" : "아티팩트 제목이나 이슈 번호로 찾기"}
          aria-label="책장 검색"
          onChange={(e) => {
            setQ(e.target.value);
            setShowRes(!!e.target.value.trim());
          }}
          onFocus={() => setShowRes(!!q.trim())}
          onKeyDown={(e) => {
            const first = resRef.current?.querySelector("button");
            if (e.key === "Enter" && m?.length) pick(m[0]);
            if (e.key === "Escape") {
              setQ("");
              setShowRes(false);
            }
            if (e.key === "ArrowDown" && first) {
              e.preventDefault();
              first.focus();
            }
          }}
        />
        <div
          ref={resRef}
          className="shelf-results"
          role="listbox"
          hidden={!showRes || !m}
          onKeyDown={(e) => {
            const bs = [...(resRef.current?.querySelectorAll("button") ?? [])], i = bs.indexOf(document.activeElement as HTMLButtonElement);
            if (e.key === "ArrowDown" && i < bs.length - 1) {
              e.preventDefault();
              bs[i + 1].focus();
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              (i > 0 ? bs[i - 1] : qRef.current)?.focus();
            }
          }}
        >
          {m && !m.length && <div className="none">찾는 책이 없습니다.</div>}
          {m?.slice(0, 8).map((b) => (
            <button key={searchKind === "art" ? (b as Artifact).id : (b as Book).key} type="button" role="option" aria-selected={false} onClick={() => pick(b)}>
              {searchKind === "art" ? (b as Artifact).title : `${(b as Book).key} · ${(b as Book).title}`}
              <small>{searchKind === "art" ? `${(b as Artifact).taskKey || "이슈 없음"} · ${(b as Artifact).kind}` : "phase" in b ? `작업 중 · ${b.phase}` : `완료 ${(b as Book).doneAt}`}</small>
            </button>
          ))}
          {m && m.length > 8 && <div className="none">외 {m.length - 8}권은 책장에서 진하게 보입니다.</div>}
        </div>
      </div>
      <div className="shelf-cases">
        <div className="shelf-case">
          <div className="shelf-label">
            <span>
              작업{fresh.size > 0 && <b className="shelf-new"> · 새 책 {fresh.size}권</b>}
            </span>
            <Dots n={dots.task[0]} cur={dots.task[1]} onGo={goPage("task")} />
          </div>
          <Strip
            kind="task"
            list={taskList}
            dim={bookHits ? new Set(bookHits.map((b) => b.key)) : null}
            hit={hit}
            newKey={newKey.task}
            fresh={fresh}
            jump={jump?.kind === "task" ? jump : null}
            page={page?.kind === "task" ? page : null}
            onOpen={(b) => (isActive(b) ? onOpenActive(b.key) : onOpenBook(b as Book))}
            onAppendix={onOpenAppendix}
            onTip={onTip}
            onDots={(n, c) => setDots((d) => (d.task[0] === n && d.task[1] === c ? d : { ...d, task: [n, c] }))}
          />
        </div>
        <div className="shelf-case">
          <div className="shelf-label">
            <span>
              아티팩트{" "}
              <button type="button" className="shelf-add" onClick={onAddArtifact}>
                + 꽂기
              </button>
            </span>
            <Dots n={dots.art[0]} cur={dots.art[1]} onGo={goPage("art")} />
          </div>
          <Strip
            kind="art"
            list={artifacts}
            dim={artHits ? new Set(artHits.map((a) => a.id)) : null}
            hit={hit}
            newKey={newKey.art}
            jump={jump?.kind === "art" ? jump : null}
            page={page?.kind === "art" ? page : null}
            onOpen={(a) => onOpenArtifact(a as Artifact)}
            onTip={onTip}
            onDots={(n, c) => setDots((d) => (d.art[0] === n && d.art[1] === c ? d : { ...d, art: [n, c] }))}
          />
        </div>
        {retros !== undefined && (
          <div ref={retroRef} className={`shelf-case${spot ? " spot" : ""}`} tabIndex={-1} aria-label="회고 칸">
            <div className="shelf-label">
              <span>회고</span>
              <Dots n={dots.retro[0]} cur={dots.retro[1]} onGo={goPage("retro")} />
            </div>
            {retroList.length ? (
              <Strip
                kind="retro"
                list={retroList}
                dim={null}
                hit={null}
                newKey={null}
                jump={null}
                page={page?.kind === "retro" ? page : null}
                onOpen={(b) => onOpenRetro?.((b as RetroItem).key)}
                onTip={onTip}
                onDots={(n, c) => setDots((d) => (d.retro[0] === n && d.retro[1] === c ? d : { ...d, retro: [n, c] }))}
              />
            ) : (
              <p className="shelf-empty">{retros === null ? "회고록을 읽는 중입니다." : typeof retros === "string" ? retros : "아직 회고록이 없습니다. 대시보드 회고 탭에서 멈춘 오더의 회고를 만들면 여기에 꽂힙니다."}</p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
