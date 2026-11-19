"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type CSSProperties } from "react";
import type { RetroData } from "@/lib/office/retro";

const man = (n: number | null | undefined) => (n == null ? "-" : `${Math.round(n / 10000).toLocaleString()}만`);
const pct = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 1000) / 10 : 0);
const signed = (n: number) => `${n > 0 ? "+" : ""}${n}%`;

// chapter: 이 덩어리에서 시작하는 장 이름(차례에 싣는다). page: 새 쪽에서 시작한다. section: 장 안 소단원 이름(BookNav 로 쪽 번호를 찾는다)
export type Block = { id: string; head?: boolean; chapter?: string; page?: boolean; section?: string; node: ReactNode | ((nav: BookNav) => ReactNode) };
// 장 안 차례가 쓰는 길잡이: 소단원이 시작하는 쪽 번호와 그 쪽으로 넘기기
export type BookNav = { pageOf: (section: string) => number | undefined; go: (section: string) => void };

const ALL_STAGES = ["설계", "구현", "리뷰", "통합", "배포", "검증", "사람 확인"];

// 단계 띠: 잡을 수 있었던 곳은 노란 점, 실제로 잡힌 곳은 빨간 점
// 산출(문서·조사) 단계에서 잡혔거나 잡을 수 있었던 판단이면 구현 다음에 산출 칸을 더한다(대시보드의 회고 띠와 같다). 그 밖에는 일곱 칸 그대로다
function StageDots({ could, found }: { could?: string; found: string }) {
  const STAGES = found === "산출" || could === "산출" ? ALL_STAGES.flatMap((s) => (s === "구현" ? [s, "산출"] : [s])) : ALL_STAGES;
  const fi = STAGES.indexOf(found), ci = could ? STAGES.indexOf(could) : -1;
  if (fi < 0) return <p className="rb-note">실제로 잡힌 곳: {found}</p>;
  return (
    <div className="rb-stages">
      {STAGES.map((st, i) => (
        <span key={st} className={i === fi ? "found" : i === ci ? "could" : ci >= 0 && i > ci && i < fi ? "late" : ""}>
          <i />
          {st}
        </span>
      ))}
    </div>
  );
}

// 회고록 본문을 쪽에 나눠 담을 작은 덩어리로 만든다. 제목 덩어리는 다음 덩어리와 같은 쪽에 둔다
export function blocksOf(r: RetroData, url: string): Block[] {
  const t = r.measure.totals;
  const out: Block[] = [];
  const head = (id: string, text: string) => out.push({ id, head: true, node: <h5>{text}</h5> });
  const add = (id: string, node: ReactNode) => out.push({ id, node });
  if (r.summary) {
    head("h-sum", "한눈에");
    r.summary.split(/(?<=[.!?])\s+/).forEach((line, i) => add(`sum-${i}`, <p className="rb-sum">{line}</p>));
  }
  const defects = r.defects ?? [];
  head("h-def", `잘못한 판단 ${defects.length}건`);
  if (!defects.length) add("def-none", <p>잘못한 판단은 찾지 못했습니다.</p>);
  defects.forEach((d, i) => {
    add(`def-${i}`, (
      <div className="rb-item">
        <b>{i + 1}. {d.title}</b>
        <StageDots could={d.couldAt} found={d.foundAt} />
      </div>
    ));
    if (d.what) {
      add(`def-${i}-what`, <p className="rb-line"><span>❌</span>{d.what}</p>);
      if (d.why) add(`def-${i}-why`, <p className="rb-line"><span>🔍</span>{d.why}</p>);
      if (d.prevent) add(`def-${i}-prev`, <p className="rb-line"><span>🛡️</span>{d.prevent}</p>);
    } else if (d.judgment) add(`def-${i}-what`, <p className="rb-line"><span>❌</span>{d.judgment}</p>);
    d.fixes?.forEach((f, k) => add(`def-${i}-fix-${k}`, <p className="rb-line"><span>🔧</span><em className="rb-where">{f.where}</em>{f.change}</p>));
  });
  const where: Record<string, string> = { 스킬: "스킬", "진행 방법": "스킬", 서버: "서버", "사용자 입력": "사람" };
  if (r.proposals?.length) {
    head("h-fix", "고칠 곳");
    r.proposals.forEach((p, i) => add(`fix-${i}`, <p className="rb-line"><em className="rb-where">{where[p.type ?? ""] ?? "스킬"}</em>{p.title}</p>));
  }
  head("h-tok", "토큰 사용");
  add("tok-note", <p className="rb-note">막대가 짧을수록 쌉니다.</p>);
  const max = Math.max(t.actual.cost, t.allNew.cost, t.rule.cost, t.best.cost, 1);
  for (const [id, label, v] of [
    ["a", "실제로 한 대로", t.actual],
    ["n", "매번 새 세션", t.allNew],
    ["r", "지금 규칙대로", t.rule],
    ["b", "가장 좋은 경우", t.best],
  ] as const)
    add(`tok-${id}`, (
      <div className={`rb-bar-row${id === "a" ? " now" : ""}`}>
        <span>{label}</span>
        <span className="rb-track"><span style={{ width: `${(v.cost / max) * 100}%` }} /></span>
        <b>
          {man(v.cost)}
          {id !== "a" && <small> {signed(pct(v.cost, t.actual.cost))}</small>}
        </b>
      </div>
    ));
  r.sessionFindings?.forEach((f, i) => add(`tf-${i}`, <p className="rb-line"><span>💡</span>{f.title}</p>));
  add("link", (
    <p className="rb-note">
      자세한 숫자와 근거는{" "}
      <a href={url} target="_blank" rel="noopener noreferrer">
        대시보드 회고 탭
      </a>
      에서 볼 수 있습니다.
    </p>
  ));
  return out;
}

// 쪽에 싣는 덩어리 한 조각. top 은 덩어리 안에서 이 쪽이 보여 주기 시작하는 높이, end 는 다음 쪽으로 넘기는 높이다(한 쪽보다 긴 덩어리만 있다)
type Slice = { i: number; top: number; end?: number };

// 덩어리 안에서 글 줄을 가르지 않고 자를 수 있는 높이들. 어느 줄·그림도 걸쳐 있지 않은 줄 아래 끝만 고른다
function cutsOf(el: Element): number[] {
  const base = el.getBoundingClientRect().top, spans: [number, number][] = [];
  const add = (rs: DOMRectList) => [...rs].forEach((b) => b.height && spans.push([b.top - base, b.bottom - base]));
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), r = document.createRange();
  for (let n = walk.nextNode(); n; n = walk.nextNode()) r.selectNodeContents(n), add(r.getClientRects());
  el.querySelectorAll("code, img, svg").forEach((e) => add(e.getClientRects()));
  return [...new Set(spans.map(([, b]) => Math.ceil(b)))].filter((y) => !spans.some(([t, b]) => t < y - 0.5 && b > y + 0.5)).sort((a, b) => a - b);
}
const LINE = 1.45; // .rb-page 의 줄 높이(글씨 크기의 배수)
const BIG_MIN = 0.2; // 한 쪽보다 긴 덩어리는 남은 자리가 쪽 높이의 이만큼 이상이면 그 자리부터 싣는다

// 잰 높이로 덩어리를 쪽에 채운다. 제목은 다음 덩어리와 함께 넘기고, 한 쪽보다 긴 덩어리는 줄 사이(cuts)에서 잘라 다음 쪽으로 잇는다
// 장(chapter)은 새 펼침의 왼쪽 쪽에서 시작한다. 앞 장이 오른쪽 쪽을 쓰지 않았으면 빈 쪽으로 둔다(per 는 한 펼침의 쪽 수)
function paginate(heights: number[], cuts: number[][], blocks: Block[], pageH: number, line: number, per: number): Slice[][] {
  const pages: Slice[][] = [];
  let cur: Slice[] = [], used = 0;
  const flush = () => {
    if (cur.length) pages.push(cur);
    cur = [];
    used = 0;
  };
  for (let i = 0; i < blocks.length; i++) {
    const h = heights[i], next = i + 1 < blocks.length ? heights[i + 1] : 0;
    if (blocks[i].chapter) {
      flush();
      while (pages.length % per) pages.push([]);
    } else if (blocks[i].page) flush();
    const need = h + (blocks[i].head ? (next > pageH ? pageH * BIG_MIN : next) : 0);
    if (cur.length && (h > pageH ? pageH - used < pageH * BIG_MIN : used + need > pageH)) flush();
    let top = 0;
    while (h - top > pageH - used) {
      const room = pageH - used;
      const end = cuts[i].filter((c) => c > top && c - top <= room).pop() ?? top + Math.max(line, Math.floor(room / line) * line);
      cur.push({ i, top, end });
      top = end;
      flush();
    }
    cur.push({ i, top });
    used += h - top;
  }
  flush();
  return pages;
}

const FRAME_MS = 110; // 넘기는 그림 한 장을 보여 주는 시간
// 다음 장으로 넘길 때 차례로 보이는 그림: 오른쪽 장 모서리가 들리고(lift1), 더 들리고(lift2), 왼쪽으로 넘어간(over) 뒤 평평한 펼침이 된다. 이전 장은 거꾸로다
const FLIP = ["lift1", "lift2", "over"] as const;
type Frame = (typeof FLIP)[number];
const BOOK = ["title", "flat", ...FLIP].map((n) => `/sprites/retro-book4-${n}.webp`);
// 넘기는 장면에서 오른쪽 글에 덧입히는 모양. lift1: 장이 안으로 휜 만큼 가로로 조금 줄이고, 말려 올라간 오른쪽 아래 모서리를 잘라낸다.
// lift2: 장이 서면서 좁아 보이는 만큼 가로로 줄이고 말린 아래쪽을 잘라낸다. under: 들린 장 옆으로 드러난 아랫장의 오른쪽 띠만 보인다
const SHEET: Record<"lift1" | "lift2" | "under" | "over" | "overUnder", CSSProperties> = {
  lift1: { transform: "scaleX(0.92)", transformOrigin: "0 50%", clipPath: "polygon(0 0, 100% 0, 100% 55%, 95% 62%, 62% 84%, 66% 100%, 0 100%)" },
  lift2: { transform: "scaleX(0.83) skewY(-2deg)", transformOrigin: "0 60%", clipPath: "polygon(0 0, 100% 0, 100% 45%, 96% 60%, 62% 82%, 68% 100%, 0 100%)", opacity: 0.85 },
  under: { clipPath: "inset(0 0 25% 90%)" },
  // over: 왼쪽으로 넘어온 장의 뒷면(뒤 펼침의 왼쪽 쪽)이다. 장이 책등에 붙은 채 바깥 끝이 들려 있어 좁히고 기울인다. overUnder: 그 장 왼쪽으로 드러난 아랫장의 띠
  over: { transform: "scaleX(0.72) skewY(15deg)", transformOrigin: "100% 55%", clipPath: "polygon(0 0, 100% 0, 100% 100%, 10% 100%, 0 85%)", opacity: 0.85 },
  overUnder: { clipPath: "inset(0 86% 0 0)" },
};
// 표지 안쪽 그림 위에 넘기는 그림을 얹을 때 보일 부분. RIGHT: 책등부터 오른쪽 절반. OVER: 거기에 왼쪽으로 넘어온 장 모양을 더한 것
const CLIP_RIGHT = "polygon(48.5% 0, 100% 0, 100% 100%, 48.5% 100%)";
const CLIP_OVER = "polygon(16.4% 1%, 27.8% 7.6%, 38.9% 13%, 48.5% 18.1%, 48.5% 0, 100% 0, 100% 100%, 48.5% 100%, 48.5% 93.5%, 33.3% 89.7%, 24.4% 85%, 19.4% 79.2%, 15.6% 57.3%, 13.3% 28.6%, 14.2% 11.5%)";
const BAR_H = 44; // 책 위에 띄운 제목줄 높이
const BODY_H = 918; // 그림 안에서 책 몸통의 높이. 그 위 여백(넘기는 장이 솟는 자리)은 화면 밖으로 나가도 된다
const TAB_TOP = 84, TAB_REST = 98, TAB_BOTTOM = 172; // 책갈피 꼬리(그림 세로 px): 지금 장의 위 끝, 나머지의 위 끝, 종이 위 가장자리
const TABS_H = 1048 - TAB_TOP + 6;
const TAB_COLORS = 6; // 책갈피 종이색 가짓수(globals.css 의 .rb-tab.tab-N) // 책갈피가 있으면 꼬리까지 화면 안에 들도록 이 높이에 맞춘다
// 그림 크기. 책은 아래에 붙여 그리고, 위 여백은 넘기는 장이 책 위로 솟는 자리다
const IMG_W = 1800, IMG_H = 1048;
// 그림 안에서 글을 놓을 자리. 퍼센트
const PAGE_L = { left: 7.8, top: 19.6, width: 37.8, height: 64.4 };
const PAGE_R = { left: 55.7, top: 19.6, width: 36.8, height: 64.4 }; // 왼쪽 끝은 바인더 고리에서 조금 띄운다
const TITLE_R = { left: 55, top: 20.5, width: 35.6, height: 68.7 };
const LABEL_TOP = { left: 16.7, top: 18.7, width: 12.8, height: 4.6 }; // 클립 오른쪽, 이름표 가운데 선 위
const LABEL_BOTTOM = { left: 8, top: 75, width: 20, height: 15 };
const ACTIONS = { left: 8, top: 30, width: 34, height: 40 }; // 두 이름표 사이 빈 안쪽 표지
// 종이 아래 바깥 모서리. 누르면 넘긴다(왼쪽은 이전, 오른쪽은 다음)
const CORNER_L = { left: 5.4, top: 83.6, width: 5, height: 8.6 };
const CORNER_R = { left: 89.6, top: 83.6, width: 5, height: 8.6 };
const PGNO_L = { left: 8, top: 84.6, width: 12, height: 3.6 }; // 쪽 번호: 아래 바깥 모서리(넘김 단추) 바로 안쪽
const PGNO_R = { left: 80.4, top: 84.6, width: 12, height: 3.6 };
const box = (b: { left: number; top: number; width: number; height: number }) => ({ left: `${b.left}%`, top: `${b.top}%`, width: `${b.width}%`, height: `${b.height}%` });

type BinderProps = {
  head: string; // 제목줄과 위 이름표에 쓰는 키
  kind: string; // 제목줄에 키 다음으로 쓰는 책 종류
  bottom: ReactNode; // 아래 이름표(날짜·종류)
  title: ReactNode | null; // 첫 펼침 오른쪽 제목 쪽. null 이면 아직 읽는 중이다
  blocks: Block[];
  actions?: ReactNode; // 안쪽 표지에 둘 단추
  overlay?: ReactNode; // 오른쪽 쪽 위에 띄울 양식
  error?: string;
  onClose: () => void;
};

// 바인더 책 한 권. 첫 펼침은 표지 안쪽 이름표와 제목 쪽, 넘기면 양쪽에 덩어리가 이어진다. ←/→ 로 넘기고 Esc 로 닫는다
export function BinderBook({ head, kind, bottom, title, blocks, actions, overlay, error, onClose }: BinderProps) {
  const [W, setW] = useState(960);
  const [single, setSingle] = useState(false);
  const [spread, setSpread] = useState(0);
  const [turn, setTurn] = useState<Frame | null>(null);
  const [dest, setDest] = useState(0); // 넘기는 동안 가고 있는 펼침
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [pages, setPages] = useState<Slice[][]>([]);
  const wrap = useRef<HTMLDivElement>(null);
  const meas = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(0); // 덩어리 속 그림이 늦게 불러와지면 높이를 다시 잰다

  const hasTabs = blocks.some((b) => b.chapter);
  useEffect(() => {
    const fit = () => {
      const el = wrap.current;
      if (!el) return;
      // 좁으면 한 쪽씩 본다. 그림을 두 배로 키워 절반만 보이므로 그림 크기는 화면 너비 그대로, 높이 한도는 절반
      const one = el.clientWidth < 640;
      // 넓은 화면은 책 몸통이 제목줄 아래 높이를 다 쓰도록 키운다. 제목줄은 책 위 여백에 겹쳐 띄우고, 여백은 화면 위로 넘쳐도 둔다
      setSingle(one);
      setW(Math.floor(one ? Math.min(el.clientWidth, ((el.clientHeight - BAR_H) * IMG_W) / IMG_H / 2) : Math.min(el.clientWidth, ((el.clientHeight - BAR_H) * IMG_W) / (hasTabs ? TABS_H : BODY_H), 1800)));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [hasTabs]);

  const H = (W * IMG_H) / IMG_W;
  const font = single ? Math.max(7, W / 74) : Math.max(10, W / 94); // 넓은 화면은 글씨를 줄여 한 쪽에 더 많이 담는다
  const pageW = (W * PAGE_R.width) / 100, pageH = (H * PAGE_R.height) / 100;

  // 숨겨 둔 같은 너비의 상자에 덩어리를 그려 높이를 잰다
  useLayoutEffect(() => {
    const el = meas.current;
    if (!el || !blocks.length) return;
    const hs = [...el.children].map((c) => {
      const s = getComputedStyle(c);
      return (c as HTMLElement).offsetHeight + parseFloat(s.marginTop) + parseFloat(s.marginBottom);
    });
    const cuts = [...el.children].map((c, i) => (hs[i] > pageH ? cutsOf(c) : [])); // 한 쪽보다 긴 덩어리만 나뉜다
    setPages(paginate(hs, cuts, blocks, pageH, font * LINE, single ? 1 : 2));
  }, [blocks, pageW, pageH, font, single, loaded]);

  const per = single ? 1 : 2;
  const last = Math.ceil(pages.length / per); // 0 = 제목 펼침
  const at = Math.min(spread, last); // 진행 중인 책은 기록이 다시 읽혀 쪽 수가 줄 수 있다
  const go = useCallback(
    (to: number) => {
      if (turn || to < 0 || to > last || to === at) return;
      const seq = to > at ? FLIP : [...FLIP].reverse();
      setDest(to);
      setTurn(seq[0]);
      timers.current = [
        ...seq.slice(1).map((f, i) => setTimeout(() => setTurn(f), FRAME_MS * (i + 1))),
        setTimeout(() => {
          setSpread(to);
          setTurn(null);
        }, FRAME_MS * seq.length),
      ];
    },
    [turn, last, at],
  );
  // 소단원 이름 → 시작하는 쪽(0부터)
  const sections = new Map<string, number>();
  pages.forEach((sl, p) => sl.forEach((x) => !x.top && blocks[x.i]?.section && !sections.has(blocks[x.i].section!) && sections.set(blocks[x.i].section!, p)));
  const nav: BookNav = {
    pageOf: (n) => (sections.has(n) ? sections.get(n)! + 1 : undefined),
    go: (n) => sections.has(n) && go(Math.floor(sections.get(n)! / per) + 1),
  };
  const draw = (b: Block) => (typeof b.node === "function" ? b.node(nav) : b.node);
  // 넘기는 그림을 미리 받아 두어 첫 넘김에서 깜빡이지 않게 한다. 닫으면 남은 넘김을 멈춘다
  useEffect(() => {
    BOOK.forEach((src) => (new Image().src = src));
    return () => timers.current.forEach(clearTimeout);
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.("input,textarea,select")) return; // 양식에 글을 쓰는 중에는 넘기지 않는다
      if (e.key === "ArrowRight") go(at + 1);
      else if (e.key === "ArrowLeft") go(at - 1);
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [go, at, onClose]);

  // 평소에는 표지 안쪽 또는 평평하게 펼친 그림, 넘기는 동안만 장이 들린 그림
  const img = turn ?? (at === 0 ? "title" : "flat");
  const shown = at === 0 ? [] : pages.slice((at - 1) * per, (at - 1) * per + per);
  // 좁은 화면은 한 쪽씩: 그림을 두 배로 키워 왼쪽 또는 오른쪽 절반만 보인다
  const half = single && at > 0 ? ((at - 1) % 2 === 0 ? "left" : "right") : single ? "right" : null;
  const page = (sl: Slice[], b: typeof PAGE_L, st?: CSSProperties) => (
    <div className="rb-page" style={{ ...box(b), ...st }}>
      {sl.filter(({ i }) => blocks[i]).map(({ i, top, end }) =>
        end === undefined ? (
          <div key={`${blocks[i].id}@${top}`} style={top ? { marginTop: -top } : undefined}>
            {draw(blocks[i])}
          </div>
        ) : (
          // 다음 쪽으로 넘기는 줄부터는 가려서, 잘린 줄이 이 쪽 아래에 비치지 않게 한다
          <div key={`${blocks[i].id}@${top}`} style={{ height: end - top, overflow: "hidden" }}>
            <div style={{ display: "flow-root", marginTop: -top }}>{draw(blocks[i])}</div>
          </div>
        ),
      )}
    </div>
  );

  // 장이 시작하는 쪽. 차례에서 누르면 그 쪽이 있는 펼침으로 넘긴다
  const toc = pages.flatMap((sl, p) => sl.filter((x) => !x.top && blocks[x.i]?.chapter).map((x) => ({ name: blocks[x.i].chapter!, page: p + 1, spread: Math.floor(p / per) + 1 })));
  // 책갈피: 장마다 오른쪽 종이 위로 나온 꼬리. 지금 읽는 장의 꼬리를 더 솟게 그리고, 누르면 그 장으로 넘긴다
  const marks = toc.length ? [{ name: "표지", spread: 0, page: 0 }, ...toc] : [];
  const readPage = at === 0 ? 0 : (at - 1) * per + 1; // 지금 읽는 쪽(펼침의 왼쪽 쪽) 번호
  const curMark = marks.reduce((k, m, i) => (m.page <= readPage ? i : k), 0);
  const slot = PAGE_R.width / Math.max(1, marks.length);
  const tabs = marks.map((m, i) => {
    const now = i === curMark, x = PAGE_R.left + i * slot;
    const top = now ? TAB_TOP : TAB_REST;
    return (
      <button
        key={m.name}
        type="button"
        className={`rb-tab tab-${i % TAB_COLORS}${now ? " now" : ""}`}
        style={{ left: `${x + 0.2}%`, width: `${slot - 0.4}%`, top: `${(top / IMG_H) * 100}%`, height: `${((TAB_BOTTOM - top) / IMG_H) * 100}%` }}
        onClick={() => go(m.spread)}
        aria-current={now ? "page" : undefined}
        title={m.name}
      >
        {m.name.split(" ")[0]}
      </button>
    );
  });
  const titlePage = (st?: CSSProperties) => (
    <div className="rb-page rb-title" style={{ ...box(TITLE_R), ...st }}>
      {title}
      {toc.length > 0 && (
        <nav className="rb-toc" aria-label="차례">
          <div className="kick">차례</div>
          {toc.map((c) => (
            <button key={c.name} type="button" onClick={() => go(c.spread)}>
              <span>{c.name}</span>
              <i />
              <b>{c.page}</b>
            </button>
          ))}
        </nav>
      )}
      <p className="rb-hint">다음 › 또는 → 키로 넘깁니다</p>
    </div>
  );
  // 넘기는 동안에도 글을 보여 준다. 앞 펼침(e)과 뒤 펼침(l) 사이를 오가는 세 장면마다, 움직이지 않는 쪽은 그대로 두고
  // 들린 장에 실린 글은 장 모양에 맞춰 잘라내거나 좁힌다. 왼쪽으로 넘어온 장에는 뒤 펼침의 왼쪽 글이 실린다. 다음으로 넘기든 이전으로 넘기든 같은 장면을 쓴다
  const pagesOf = (sp: number) => pages.slice((sp - 1) * per, (sp - 1) * per + per);
  const leftOf = (sp: number, st?: CSSProperties) => (sp === 0 ? null : page(pagesOf(sp)[0] ?? [], PAGE_L, st));
  const rightOf = (sp: number, st?: CSSProperties) => (sp === 0 ? titlePage(st) : page(pagesOf(sp)[1] ?? [], PAGE_R, st));
  const e = Math.min(at, dest), l = Math.max(at, dest);
  const fromTitle = !!turn && e === 0;
  const flipText =
    turn === "lift1" ? (
      <>
        {leftOf(e)}
        {rightOf(e, SHEET.lift1)}
      </>
    ) : turn === "lift2" ? (
      <>
        {leftOf(e)}
        {rightOf(l, SHEET.under)}
        {rightOf(e, SHEET.lift2)}
      </>
    ) : turn === "over" ? (
      <>
        {leftOf(e, SHEET.overUnder)}
        {leftOf(l, SHEET.over)}
        {rightOf(l)}
      </>
    ) : null;

  return (
    <div className={`retro-book${single ? "" : " wide"}`} ref={wrap} role="dialog" aria-label={`${head} ${kind}`}>
      <div className="rb-bar">
        <span>
          <b>{head}</b> {kind} {at > 0 && pages.length > 0 && `· ${at} / ${last}`}
        </span>
        <span className="rb-btns">
          <button type="button" onClick={() => go(at - 1)} disabled={at === 0 || !!turn} aria-label="이전 쪽">
            ‹ 이전
          </button>
          <button type="button" onClick={() => go(at + 1)} disabled={at >= last || !!turn} aria-label="다음 쪽">
            다음 ›
          </button>
          <button type="button" onClick={onClose}>
            닫기
          </button>
        </span>
      </div>
      {error && <p className="rb-error">{error}</p>}
      {/* 좁은 화면은 첫 펼침에서 오른쪽 절반만 보이므로 표지 단추를 제목줄 아래에 둔다 */}
      {title != null && single && actions && <div className="rb-actions narrow">{actions}</div>}
      {title != null && (
        <div className="rb-viewport" style={{ width: W, height: half ? H * 2 : H }}>
          <div className="rb-stage" style={{ width: W, height: H, fontSize: font, transform: half ? `scale(2) translateX(${half === "right" ? "-50%" : "0"})` : undefined }}>
            {/* 표지 안쪽에서 넘기거나 그리로 돌아올 때는 표지 그림을 밑에 깔고, 넘기는 그림은 오른쪽 절반과 넘어가는 장만 얹는다. 왼쪽이 갑자기 종이로 바뀌지 않는다 */}
            {fromTitle && <img src="/sprites/retro-book4-title.webp" alt="" className="rb-img" />}
            <img src={`/sprites/retro-book4-${img}.webp`} alt="" className="rb-img" style={fromTitle ? { clipPath: turn === "over" ? CLIP_OVER : CLIP_RIGHT } : undefined} />
            {((!turn && at === 0) || (fromTitle && turn !== "over")) && (
              <>
                <div className="rb-label" style={box(LABEL_TOP)}>
                  {head}
                </div>
                <div className="rb-label small" style={box(LABEL_BOTTOM)}>
                  {bottom}
                </div>
              </>
            )}
            {!turn && at === 0 && !single && actions && (
              <div className="rb-actions" style={box(ACTIONS)}>
                {actions}
              </div>
            )}
            {tabs}
            {!turn && at > 0 && (!single || half === "left") && (
              <button type="button" className="rb-corner prev" style={box(CORNER_L)} onClick={() => go(at - 1)} aria-label="이전 쪽" title="이전 쪽" />
            )}
            {!turn && at < last && (!single || half !== "left") && (
              <button type="button" className="rb-corner next" style={box(CORNER_R)} onClick={() => go(at + 1)} aria-label="다음 쪽" title="다음 쪽" />
            )}
            {!turn && at > 0 && (!single || half === "left") && (at - 1) * per < pages.length && (
              <span className="rb-pgno" style={box(PGNO_L)}>
                {(at - 1) * per + 1}
              </span>
            )}
            {!turn && at > 0 && (!single ? (at - 1) * per + 1 < pages.length : half === "right" && (at - 1) < pages.length) && (
              <span className="rb-pgno r" style={box(PGNO_R)}>
                {single ? at : (at - 1) * per + 2}
              </span>
            )}
            {!turn && at === 0 && titlePage()}
            {turn && !single && flipText}
            {!turn && at > 0 && (single ? page(shown[0] ?? [], half === "left" ? PAGE_L : PAGE_R) : (
              <>
                {shown[0] && page(shown[0], PAGE_L)}
                {shown[1] && page(shown[1], PAGE_R)}
              </>
            ))}
            {overlay && !turn && (
              <div className="rb-page rb-overlay" style={box(half === "left" ? PAGE_L : PAGE_R)}>
                {overlay}
              </div>
            )}
          </div>
        </div>
      )}
      {/* 쪽 나누기용으로 같은 너비·글씨 크기에서 덩어리 높이를 잰다 */}
      <div ref={meas} className="rb-page rb-measure" aria-hidden="true" style={{ width: pageW, fontSize: font }} onLoadCapture={() => setLoaded((n) => n + 1)}>
        {blocks.map((b) => (
          <div key={b.id}>{draw(b)}</div>
        ))}
      </div>
    </div>
  );
}

// 회고록 한 권
export function RetroBook({ name, retroKey, onClose }: { name: string; retroKey: string; onClose: () => void }) {
  const [data, setData] = useState<{ title: string; retro: RetroData; url: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/office/dobby/retros/${encodeURIComponent(retroKey)}`)
      .then((r) => r.json())
      .then((j) => (j.retro ? setData(j) : setError(j.error ?? "회고록을 읽지 못했습니다.")))
      .catch(() => setError("회고록을 읽지 못했습니다."));
  }, [name, retroKey]);

  const blocks = useMemo(() => (data ? blocksOf(data.retro, data.url) : []), [data]);
  const r = data?.retro;
  return (
    <BinderBook
      head={retroKey}
      kind="회고록"
      error={error}
      onClose={onClose}
      blocks={blocks}
      bottom={
        <>
          {r?.basis.madeAt}
          <br />
          회고
        </>
      }
      title={
        r ? (
          <>
            <div className="kick">회고록</div>
            <h4>{data.title}</h4>
            <p className="rb-row">
              <span>회고한 때</span>
              <b>{r.basis.madeAt}</b>
            </p>
            <p className="rb-row">
              <span>잘못한 판단</span>
              <b>{r.defects?.length ?? 0}건</b>
            </p>
            <p className="rb-row">
              <span>설계를 바꾼 횟수</span>
              <b>{r.basis.changes}번</b>
            </p>
            <p className="rb-row">
              <span>검증한 횟수</span>
              <b>{r.basis.testRounds}번</b>
            </p>
          </>
        ) : null
      }
    />
  );
}
