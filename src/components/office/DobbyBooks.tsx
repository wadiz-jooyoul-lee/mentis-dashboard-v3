"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Verdict as TestVerdict } from "@/lib/office/test/parseReport";
import type { DobbyBookExtra, TaskRecord, Verdict, VerifyData } from "@/lib/office/core/record";
import type { Artifact, Book } from "@/lib/office/core/types";
import { AGENT_NOTE, ArtifactForm, CHAPTERS, Md, RetroForm, blank, type Chapter, type LiveInfo } from "@/components/office/OpenBook";
import { BinderBook, blocksOf, type Block, type BookNav } from "@/components/office/RetroShelf";

const PATCH_LINES = 30; // 코드 변경 내용을 이만큼씩 끊어 쪽에 싣는다

// 마크다운을 빈 줄마다 끊는다. 소제목 줄은 혼자, 표는 표끼리 끊는다. 코드 블록 안은 끊지 않고, 들여 쓴 이어지는 문단은 앞 덩어리에 붙인다
const isRow = (l: string) => l.trim().startsWith("|");
function mdChunks(text: string): string[] {
  const out: string[] = [];
  let cur: string[] = [], fence = false;
  const push = () => {
    if (!cur.length) return;
    if (/^[ \t]/.test(cur[0]) && out.length) out[out.length - 1] += "\n\n" + cur.join("\n");
    else out.push(cur.join("\n"));
    cur = [];
  };
  for (const line of text.split("\n")) {
    const mark = /^\s*(```|~~~)/.test(line);
    if (mark) fence = !fence;
    if (mark && !fence) cur.push(line), push(); // 코드 블록이 닫히면 뒤에 빈 줄이 없어도 끊는다
    else if (!fence && !line.trim()) push();
    else if (!fence && /^#{1,6} /.test(line)) push(), cur.push(line), push();
    else {
      if (!fence && cur.length && isRow(line) !== isRow(cur[cur.length - 1])) push();
      cur.push(line);
    }
  }
  push();
  return out;
}

// 흐름 그림 도식(```mermaid)의 본문. 도식 덩어리가 아니면 undefined
const FLOW = /^```mermaid[^\n]*\n([\s\S]*?)\n```\s*$/;
const flowOf = (chunk: string) => chunk.match(FLOW)?.[1];

// 마크다운을 쪽에 담을 덩어리로 바꿔 out 에 붙인다. 표는 줄마다 끊고, 이어지는 줄은 머리 줄을 숨긴 표로 그린다.
// flows 를 주면 흐름 그림 도식을 미리 그려 둔 그림으로 싣는다
function pushMd(out: Block[], k: string, text: string, flows?: Flows) {
  mdChunks(text).forEach((c, i) => {
    const ls = c.split("\n"), code = flowOf(c), svg = code !== undefined ? flows?.[code] : undefined;
    if (svg) out.push({ id: `${k}-${i}`, node: <figure className="rb-flow" dangerouslySetInnerHTML={{ __html: svg }} /> });
    else if (ls.length > 3 && /^\|?\s*:?-{3,}/.test(ls[1]) && ls.every(isRow)) {
      const empty = ls[0].replace(/[^|]+/g, " ");
      out.push({ id: `${k}-${i}-0`, node: <Md text={ls.slice(0, 3).join("\n")} /> });
      ls.slice(3).forEach((l, j) => out.push({ id: `${k}-${i}-${j + 1}`, node: <div className="rb-cont"><Md text={[empty, ls[1], l].join("\n")} /></div> }));
    } else out.push({ id: `${k}-${i}`, head: /^#{1,6} [^\n]*$/.test(c), node: <Md text={c} /> });
  });
}

// 표 한 줄을 덩어리 하나로 싣는다. 머리 줄이 없는 표는 첫 칸을 머리 칸으로 그린다. 칸 너비(%)를 주면 조각마다 같은 너비로 그린다
const row = (cells: readonly string[], kind: "head" | "side" | "plain", widths?: number[]) => (
  <table className="rb-tbl">
    {widths && (
      <colgroup>
        {widths.map((w, j) => (
          <col key={j} style={{ width: `${w}%` }} />
        ))}
      </colgroup>
    )}
    <tbody>
      <tr>{cells.map((c, j) => (kind === "head" || (kind === "side" && !j) ? <th key={j}>{c}</th> : <td key={j}><Md text={c} inline /></td>))}</tr>
    </tbody>
  </table>
);

// 한 장의 본문을 쪽에 나눠 담을 덩어리로 만든다. 그리는 내용은 펼친 책(OpenBook)의 장 본문과 같다
function chapterBlocks(id: Chapter, rec: TaskRecord): Block[] {
  const out: Block[] = [];
  const sub = (k: string, text: string) => out.push({ id: k, head: true, node: <h6>{text}</h6> });
  const md = (k: string, text: string) => pushMd(out, k, text);
  const rows = (k: string, rs: readonly (readonly string[])[], head?: string[], widths?: number[]) => {
    const w = widths ?? (rs[0]?.length === 2 ? [22, 78] : undefined);
    if (head) out.push({ id: `${k}-h`, head: true, node: row(head, "head", w) });
    rs.forEach((r, i) => out.push({ id: `${k}-${i}`, node: row(r, head ? "plain" : "side", w) }));
  };
  if (blank(id, rec)) return [{ id: `${id}-none`, node: <p>문서가 없습니다.</p> }];
  if (id === "req") {
    sub("req-h", "요청 원문");
    md("req", rec.request.text.replace(AGENT_NOTE, ""));
    if (rec.request.criteria.length) {
      sub("crit-h", "인수조건");
      rows("crit", rec.request.criteria);
    }
  } else if (id === "design") md("design", rec.design ?? "설계가 없습니다.");
  else if (id === "proc")
    rec.process.forEach(([k, v], i) => {
      sub(`proc-${i}-h`, k);
      md(`proc-${i}`, v);
    });
  else if (id === "out") {
    rows("out", [
      ["PR", rec.output.pr],
      ["변경", rec.output.stat],
    ]);
    if (rec.output.summary) md("out-sum", rec.output.summary);
    if (rec.output.uploads?.length) {
      sub("up-h", "올린 곳");
      rows("up", rec.output.uploads.map(([kind, url]) => [kind, `[${url}](${url})`]));
    }
    rec.output.products?.forEach(([n, text], i) => {
      sub(`prod-${i}-h`, `산출물 — ${n}`);
      if (text) md(`prod-${i}`, text);
      else out.push({ id: `prod-${i}`, node: <p>글이 아닌 파일이라 이름만 싣습니다.</p> });
    });
    for (let i = 0; i < rec.output.patch.length; i += PATCH_LINES)
      out.push({
        id: `patch-${i}`,
        node: (
          <pre className="rb-patch">
            {rec.output.patch.slice(i, i + PATCH_LINES).map((p, j) => (
              <span key={j} className={p.kind}>
                {p.line + "\n"}
              </span>
            ))}
          </pre>
        ),
      });
  } else if (id === "test") {
    out.push({ id: "test-env", node: <p>마지막 회차 · 검증 환경 {rec.tests.env}</p> });
    rows("test", rec.tests.rows.map(([a, b, c, d]) => [a, b, c, d ?? ""]), ["항목", "내용", "판정", "근거"], [10, 30, 12, 48]);
  } else if (id === "qa") rows("qa", rec.qa ?? [], ["버그", "제목", "결과", "수정 내용"], [15, 30, 15, 40]);
  else rows("done", rec.done);
  return out;
}

// ── 앞쪽 장: 무엇을 만들었나 · 화면 · 검증(배포 상태 포함) · 회고 · 성능 ──

type Flows = Record<string, string | null>; // 도식 본문 → 그린 그림(SVG). 그리지 못하면 null

// 쉬운 구현 설명 속 흐름 그림 도식을 책 종이색에 맞춰 그림으로 바꾼다. 다 그릴 때까지 null
const NO_FLOWS: Flows = {};
function useFlows(text: string): Flows | null {
  const codes = useMemo(() => mdChunks(text).map(flowOf).filter((c): c is string => c !== undefined), [text]);
  const [got, setGot] = useState<{ codes: string[]; flows: Flows } | null>(null); // 어느 도식 묶음으로 그린 그림인지 함께 둔다
  useEffect(() => {
    let alive = true;
    if (!codes.length) return;
    import("mermaid")
      .then(async ({ default: mermaid }) => {
        // 오피스 변수(--f-body)는 문서 뿌리가 아니라 .office-root 에만 있다
        const font = getComputedStyle(document.querySelector(".office-root") ?? document.documentElement).getPropertyValue("--f-body").trim() || "sans-serif";
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
          fontFamily: font,
          flowchart: { htmlLabels: false, curve: "basis" },
          themeVariables: {
            fontFamily: font,
            background: "transparent",
            primaryColor: "#f4ead0",
            primaryBorderColor: "#b9a57a",
            primaryTextColor: "#3b2f1e",
            secondaryColor: "#ede4ff",
            secondaryBorderColor: "#b9a2e8",
            tertiaryColor: "#faf4e4",
            lineColor: "#7a6a50",
            textColor: "#3b2f1e",
            clusterBkg: "rgba(59,47,30,0.04)",
            clusterBorder: "#cdbd96",
            edgeLabelBackground: "#f6efdc",
            actorBkg: "#f4ead0",
            actorBorder: "#b9a57a",
            noteBkgColor: "#fbf3d6",
            noteBorderColor: "#cdbd96",
          },
        });
        const out: Flows = {};
        for (const [i, code] of codes.entries()) {
          try {
            out[code] = (await mermaid.render(`book-flow-${Date.now()}-${i}`, code)).svg;
          } catch {
            out[code] = null; // 도식이 틀리면 글 그대로 싣는다
          }
        }
        if (alive) setGot({ codes, flows: out });
      })
      .catch(() => alive && setGot({ codes, flows: Object.fromEntries(codes.map((c) => [c, null])) }));
    return () => {
      alive = false;
    };
  }, [codes]);
  // 설명 글이 바뀌면 옛 그림을 돌려주지 않는다. 옛 그림으로 책을 한 번 더 짜는 낭비를 막는다
  return !codes.length ? NO_FLOWS : got?.codes === codes ? got.flows : null;
}

const VERDICT: Record<Verdict, string> = { pass: "통과", fail: "실패", hold: "보류" };
const Stamp = ({ v }: { v: Verdict | "" }) => (v ? <span className={`rb-stamp ${v}`}>{VERDICT[v]}</span> : null);
const minutes = (n: number) => `${Math.round(n)}분`;
const man = (n: number) => `${Math.round(n / 10000).toLocaleString()}만`;
const ENV_ORDER = ["dev", "rc1", "rc2", "rc3", "rc4", "stage"];

// 배포 단계 글을 점 색으로: 검증까지 끝남 · 하는 중 · 막힘
const stepOf = (stage: string) => (/검증 완료/.test(stage) ? "done" : /실패|막힘|중단/.test(stage) ? "fail" : stage ? "doing" : "");

// 라이브 칸: 릴리즈 노트 배포일이 지났으면 반영된 것으로 본다
function liveOf(rel: { date: string; merged: boolean } | undefined, today: string) {
  if (!rel) return { step: "", text: "등록 전" };
  const d = rel.date.slice(5);
  if (rel.date < today) return { step: "done", text: `${d} 반영` };
  if (rel.date === today) return { step: "doing", text: "오늘 배포" };
  return { step: "plan", text: `${d} 예정` };
}

// 표지에 한 줄로 보일 배포 진행: 가장 멀리 간 환경과 그 단계
function shipLine(x: DobbyBookExtra): string {
  if (x.ship.some((r) => r.release && r.release.date < x.today)) return "라이브 반영";
  let best = { i: -1, text: "" };
  for (const r of x.ship)
    for (const e of r.envs) {
      const i = ENV_ORDER.indexOf(e.env);
      if (i > best.i) best = { i, text: `${e.env} ${e.stage}` };
    }
  return best.text || "배포 전";
}

function frontBlocks(rec: TaskRecord, x: DobbyBookExtra, flows: Flows, name: string, live: boolean): Block[] {
  const out: Block[] = [];
  let n = 0;
  const chapter = (id: string, label: string) => out.push({ id: `c-${id}`, head: true, chapter: label, node: <div className="rb-chap"><span>{++n}</span>{label}</div> });
  const add = (id: string, node: ReactNode, head = false) => out.push({ id, head, node });

  chapter("what", "무엇을 만들었나");
  if (x.explainer) pushMd(out, "what", x.explainer.replace(/^# [^\n]*\n+/, ""), flows);
  else add("what-none", <p className="rb-note">아직 쉬운 구현 설명이 없습니다. 구현이 끝나면 채워집니다.</p>);

  chapter("shot", "화면");
  if (!x.shots.length) add("shot-none", <p className="rb-note">검증하며 찍은 화면이 없습니다.</p>);
  else {
    add("shot-note", <p className="rb-note">검증하며 실제 환경에서 찍은 화면입니다. 그림을 누르면 크게 봅니다.</p>);
    const src = (s: DobbyBookExtra["shots"][number]) => `/api/office/dobby/${encodeURIComponent(rec.key)}/shot?run=${encodeURIComponent(s.run)}&f=${encodeURIComponent(s.file)}`;
    const photo = (s: DobbyBookExtra["shots"][number], i: number) => (
      <figure className={`rb-shot${i % 2 ? " tilt-r" : ""}`}>
        <a href={src(s)} target="_blank" rel="noopener noreferrer">
          <img src={src(s)} alt={s.caption} />
        </a>
        <figcaption>
          <span className={`rb-tag ${s.side || "after"}`}>{s.side === "before" ? "이전" : "바뀐 뒤"}</span>
          {s.caption}
          <small>
            {s.env} <Stamp v={s.verdict} />
          </small>
        </figcaption>
      </figure>
    );
    const before = x.shots.filter((s) => s.side === "before"), after = x.shots.filter((s) => s.side === "after");
    // 이전·이후 갈무리가 같은 수만큼 있으면 나란히 붙인다
    if (before.length && before.length === after.length)
      before.forEach((b, i) => add(`pair-${i}`, <div className="rb-pair">{photo(b, 0)}{photo(after[i], 1)}</div>));
    x.shots.filter((s) => !(before.length && before.length === after.length && s.side)).forEach((s, i) => add(`shot-${i}`, photo(s, i)));
    if (x.shotTotal > x.shots.length) add("shot-more", <p className="rb-note">갈무리 {x.shotTotal}장 가운데 {x.shots.length}장을 실었습니다.</p>);
  }

  chapter("test", "검증");
  verifyBlocks(out, rec, x, name);

  chapter("retro", "회고");
  if (x.retro) out.push(...blocksOf(x.retro.data, x.retro.url).map((b) => ({ ...b, id: `retro-${b.id}` })));
  else add("retro-none", <p className="rb-note">{live ? "작업이 끝나면 회고할 수 있습니다." : "아직 회고하지 않았습니다. 표지의 「회고하기」로 시작합니다."}</p>);

  chapter("perf", "성능");
  const p = x.perf;
  if (!p) add("perf-none", <p className="rb-note">아직 시간과 토큰을 재지 않았습니다.</p>);
  else {
    const bar = (id: string, label: string, v: number, max: number, text: ReactNode, now = false, base?: number) =>
      add(id, (
        <div className={`rb-bar-row${now ? " now" : ""}`}>
          <span>{label}</span>
          <span className="rb-track">
            <span className={base !== undefined && v > base ? "over" : ""} style={{ width: `${(v / (max || 1)) * 100}%` }} />
            {base !== undefined && <i style={{ left: `${(base / (max || 1)) * 100}%` }} />}
          </span>
          <b>{text}</b>
        </div>
      ));
    add("perf-h1", <h6>자동 실행에 걸린 시간</h6>, true);
    const tmax = Math.max(p.wallMin, p.baselineMin);
    bar("perf-wall", "이번 작업", p.wallMin, tmax, minutes(p.wallMin), true);
    bar("perf-base", "평소 기준", p.baselineMin, tmax, minutes(p.baselineMin));
    add("perf-talk", <p className="rb-note">이 밖에 사람과 대화한 세션 {p.talk.sessions}개에 {minutes(p.talk.min)}, 사람의 답을 기다린 시간 {minutes(p.humanWaitMin)}.</p>);
    if (p.stages.length) {
      add("perf-h2", <h6>단계별 시간</h6>, true);
      add("perf-legend", <p className="rb-note">막대는 이번 시간, 세로 눈금은 평소 기준입니다. 기준보다 길면 주황색입니다.</p>);
      const smax = Math.max(...p.stages.flatMap((s) => [s.min, s.baselineMin]));
      p.stages.forEach((s, i) => bar(`perf-st-${i}`, s.stage, s.min, smax, <>{minutes(s.min)} <small>기준 {minutes(s.baselineMin)}</small></>, false, s.baselineMin));
    }
    add("perf-h3", <h6>토큰 사용량</h6>, true);
    const kmax = Math.max(p.tokens, p.baselineTokens);
    bar("perf-tok", "이번 작업", p.tokens, kmax, man(p.tokens), true);
    bar("perf-tokb", "평소 기준", p.baselineTokens, kmax, man(p.baselineTokens));
    if (p.summary) {
      add("perf-h4", <h6>정리</h6>, true);
      p.summary.split(/(?<=[.!?])\s+/).forEach((line, i) => add(`perf-sum-${i}`, <p>{line}</p>));
    }
    if (p.measuredAt) add("perf-at", <p className="rb-note">{p.measuredAt}에 잰 값입니다.</p>);
  }
  return out;
}

// ── 검증 장: 배포 상태 · 한눈에 · 차례 · 닫히는 조건 · 전체 확인 항목 · 회차 기록 ──

const SEC = ["닫히는 조건", "전체 확인 항목", "회차 기록"] as const;
// 집계의 판정(통과·실패·건너뜀·주의·못 읽음)을 책 도장으로. 건너뜀과 주의는 보류, 못 읽음은 도장 없음
const stampOf = (v: TestVerdict): Verdict | "" => (v === "pass" ? "pass" : v === "fail" ? "fail" : v === "skip" || v === "warn" ? "hold" : "");
const envName = (env: string) => env || "환경 미상";
const blankish = (t: string) => !t.trim() || /^[-—–]$/.test(t.trim()); // 회차 문서는 빈 칸을 「-」로 적는다
const nos = (ns: number[]) => (ns.length ? `${ns.join("·")}회차` : "");
// 회차 문서 속 그림은 회차 폴더 기준 이름이라 갈무리 주소로 바꾼다
const imgFix = (md: string, src: (file: string) => string) => md.replace(/(!\[[^\]]*\]\()([^)\s/:]+\.(?:png|jpe?g|webp))(\))/gi, (_, a, f, b) => a + src(f) + b);
// 표 줄을 덩어리로 싣는다. 머리 줄이 없으면 첫 칸을 머리 칸으로 그린다
function pushRows(out: Block[], k: string, rs: readonly (readonly string[])[], head?: string[], widths?: number[]) {
  const w = widths ?? (rs[0]?.length === 2 ? [22, 78] : undefined);
  if (head) out.push({ id: `${k}-h`, head: true, node: row(head, "head", w) });
  rs.forEach((r, i) => out.push({ id: `${k}-${i}`, node: row(r, head ? "plain" : "side", w) }));
}
type EnvSum = NonNullable<VerifyData["summary"]>["envs"][number];

function verifyBlocks(out: Block[], rec: TaskRecord, x: DobbyBookExtra, name: string) {
  const add = (id: string, node: Block["node"], more: Partial<Block> = {}) => out.push({ id, node, ...more });
  const sub = (id: string, text: string, more: Partial<Block> = {}) => add(id, <h5>{text}</h5>, { head: true, ...more });
  const v = x.verify, s = v.summary;

  sub("ship-h", "배포 상태");
  if (!x.ship.length) add("ship-none", <p className="rb-note">아직 배포하지 않았습니다.</p>);
  x.ship.forEach((r, i) => {
    const envs = [...r.envs].sort((a, b) => ENV_ORDER.indexOf(a.env) - ENV_ORDER.indexOf(b.env));
    const lv = liveOf(r.release, x.today);
    add(`ship-${i}`, (
      <div className="rb-item">
        <b>{r.repo}</b>
        <div className="rb-stages rb-ship">
          {envs.map((e) => (
            <span key={e.env} className={stepOf(e.stage)}>
              <i />
              {e.env}
              <small>{e.stage || "-"}</small>
            </span>
          ))}
          <span className={lv.step}>
            <i />
            라이브
            <small>{lv.text}</small>
          </span>
        </div>
      </div>
    ));
  });
  if (x.ship.length) add("ship-note", <p className="rb-note">초록 점은 그 환경에서 검증까지 끝난 곳입니다. 라이브는 릴리즈 노트의 배포일이 지나면 반영된 것으로 봅니다.</p>);
  const pr = ([["PR", rec.output.pr], ["변경", rec.output.stat]] as const).filter(([, t]) => t);
  if (pr.length) pushRows(out, "ship-pr", pr);

  if (rec.noTest) {
    add("test-none", <p className="rb-note">이 작업은 화면 검증을 하지 않습니다.</p>);
    return;
  }
  if (!s && !v.plan.length) {
    add("test-empty", <p className="rb-note">아직 검증하지 않았고 테스트 계획도 없습니다.</p>);
    return;
  }

  if (s) {
    sub("sum-h", "한눈에");
    add("sum-note", <p className="rb-note">환경마다 따로 셉니다. 같은 항목을 여러 회차에서 봤으면 가장 최근 판정 하나로 셉니다.</p>, { head: true });
    pushRows(out, "sum-t", s.envs.map((e) => [envName(e.env), nos(e.runs.map((r) => r.no)), String(e.pass), String(e.fail), String(e.skip)]), ["환경", "회차", "통과", "실패", "보류"], [16, 36, 16, 16, 16]);
    if (s.closing) add("closing", <p className="rb-note">닫히는 조건: {s.closing}</p>);
  }
  add("toc", (nav: BookNav) => (
    <nav className="rb-toc" aria-label="검증 차례">
      <div className="kick">검증 차례</div>
      {SEC.map((n) => (
        <button key={n} type="button" onClick={() => nav.go(n)}>
          <span>{n}</span>
          <i />
          <b>{nav.pageOf(n) ?? ""}</b>
        </button>
      ))}
    </nav>
  ));

  // 판정을 환경마다 한 줄씩: 환경 · 도장 · 확인한 회차(조건은 확인한 시나리오) · 판정 흐름
  type Hit = { verdict: TestVerdict; runs: number[]; changed?: TestVerdict[] | null; items?: string[] };
  const envLines = (id: string, find: (e: EnvSum) => Hit | undefined) =>
    s?.envs.map((e) => {
      const it = find(e);
      return (
        <p key={`${id}-${e.env}`} className="rb-envv">
          <span>{envName(e.env)}</span>
          {it && stampOf(it.verdict) ? <Stamp v={stampOf(it.verdict)} /> : <span className="rb-none">{it ? "미확인" : "안 함"}</span>}
          <small>
            {it?.items ? (it.items.length ? `${it.items.join("·")} 확인` : "확인한 항목 없음") : nos(it?.runs ?? [])}
            {it?.changed && ` · ${it.changed.map((c) => VERDICT[stampOf(c) || "hold"]).join(" → ")}`}
          </small>
        </p>
      );
    });

  sub("cond-h", "닫히는 조건", { page: true, section: SEC[0] });
  const conds = s?.envs.find((e) => e.conditions.length)?.conditions ?? [];
  if (!conds.length) add("cond-none", <p className="rb-note">닫히는 조건을 항목으로 나눠 적지 않은 작업입니다. 아래 확인 항목과 대조해 판단합니다.</p>);
  conds.forEach((c) =>
    add(`cond-${c.id}`, (
      <div className="rb-item">
        <div className="rb-cond">
          <b>{c.id}</b>
          <span>
            <Md text={c.text} inline />
          </span>
        </div>
        {envLines(`cond-${c.id}`, (e) => {
          const m = e.conditions.find((k) => k.id === c.id);
          return m && { verdict: m.verdict, runs: [], items: m.items };
        })}
      </div>
    )),
  );

  sub("plan-h", "전체 확인 항목", { page: true, section: SEC[1] });
  add("plan-note", <p className="rb-note">테스트 계획의 시나리오 전부입니다. 환경마다 가장 최근 판정과 그 항목을 확인한 회차를 적었습니다. 한 번도 돌리지 않은 환경은 「안 함」입니다.</p>);
  if (!v.plan.length) add("plan-none", <p className="rb-note">테스트 계획 문서가 없습니다. 회차에서 확인한 항목만 아래에 싣습니다.</p>);
  const item = (e: EnvSum, num: string, title: string) => e.items.find((i) => (num ? i.num === num : i.name === title));
  const verdictsOf = (k: string, num: string, title: string) => (
    <div className="rb-verdicts">
      {envLines(k, (e) => item(e, num, title))}
      {s?.envs.map((e) => {
        const it = item(e, num, title);
        return it?.note ? (
          <p key={`${k}-n-${e.env}`} className="rb-line rb-why">
            <span>{envName(e.env)}</span>
            {it.note}
          </p>
        ) : null;
      })}
    </div>
  );
  v.plan.forEach((sc, i) => {
    const k = `plan-${i}`;
    add(`${k}-h`, (
      <div className="rb-scn">
        <div className="rb-tc">
          <span>{sc.id}</span>
          <span>{sc.title}</span>
          <small>{[...sc.conds, ...sc.bundles].join(" · ")}</small>
        </div>
        {verdictsOf(k, sc.id, sc.title)}
      </div>
    ), { head: true, page: i > 0 }); // 확인 항목마다 새 쪽에서 시작한다
    if (sc.extra) pushMd(out, `${k}-x`, sc.extra);
    sc.fields.forEach((f, j) => pushMd(out, `${k}-f${j}`, `###### ${f.label}\n\n${f.body}`));
  });
  const planned = new Set(v.plan.map((p) => p.id));
  const titleOf = new Map(v.plan.map((p) => [p.id, p.title]));
  const extra = new Map<string, { num: string; name: string }>();
  s?.envs.forEach((e) => e.items.forEach((it) => !(it.num && planned.has(it.num)) && !extra.has(it.num || it.name) && extra.set(it.num || it.name, { num: it.num, name: it.name })));
  if (extra.size) {
    add("extra-h", <h6>계획에 없는 항목</h6>, { head: true });
    add("extra-note", <p className="rb-note">회차에서 확인했지만 테스트 계획에 같은 번호가 없는 항목입니다.</p>);
    [...extra.values()].forEach((it, i) =>
      add(`extra-${i}`, (
        <div className="rb-scn">
          <div className="rb-tc">
            <span>{it.num || "-"}</span>
            <span>
              <Md text={it.name} inline />
            </span>
          </div>
          {verdictsOf(`extra-${i}`, it.num, it.name)}
        </div>
      )),
    );
  }

  const shot = (run: string) => (f: string) => `/api/office/dobby/${encodeURIComponent(rec.key)}/shot?run=${encodeURIComponent(run)}&f=${encodeURIComponent(f)}`;
  if (!v.runs.length) {
    sub("runs-h", "회차 기록", { page: true, section: SEC[2] });
    add("runs-none", <p className="rb-note">아직 검증하지 않았습니다.</p>);
  }
  v.runs.forEach((r, i) => {
    const k = `run-${r.id}`, all = r.pass + r.fail + r.skip || 1;
    add(`${k}-h`, (
      <div className="rb-runhead">
        {i === 0 && <h5>회차 기록</h5>}
        <div className="rb-run">
          <span className="at">{r.no}회차</span>
          <span className="env">{envName(r.env)}</span>
          <span className="rb-meter">
            <span className="pass" style={{ width: `${(r.pass / all) * 100}%` }} />
            <span className="fail" style={{ width: `${(r.fail / all) * 100}%` }} />
            <span className="hold" style={{ width: `${(r.skip / all) * 100}%` }} />
          </span>
          <small>
            통과 {r.pass}
            {r.fail > 0 && ` · 실패 ${r.fail}`}
            {r.skip > 0 && ` · 보류 ${r.skip}`}
          </small>
        </div>
        <p className="rb-note">
          {r.label}
          {r.baseline && " · 대조 회차(고치기 전 코드를 확인하려고 돌린 회차)"}
        </p>
      </div>
    ), { head: true, page: true, ...(i === 0 ? { section: SEC[2] } : {}) });
    r.items.forEach((it, j) => {
      add(`${k}-i${j}`, (
        <div className="rb-tc rb-ritem">
          <span>{it.num || "-"}</span>
          <span>
            <Md text={[it.check, titleOf.get(it.num) ?? "", it.page].find((t) => !blankish(t)) ?? "이름 없음"} inline />
          </span>
          <Stamp v={stampOf(it.verdict)} />
        </div>
      ), { head: true });
      const detail = ([["화면", it.page], ["조건", it.cond], ["기대", it.expected], ["실제", it.actual], ["근거", it.evidence]] as const).filter(([, t]) => !blankish(t) && t !== it.check);
      if (detail.length) pushRows(out, `${k}-i${j}-d`, detail.map(([a, t]) => [a, imgFix(t, shot(r.id))]));
    });
    if (r.rest) {
      add(`${k}-rest-h`, <h6>회차 기록 본문</h6>, { head: true });
      pushMd(out, `${k}-rest`, imgFix(r.rest, shot(r.id)));
    }
  });
}

const Row = ({ k, v }: { k: string; v: ReactNode }) => (
  <p className="rb-row">
    <span>{k}</span>
    <b>{v}</b>
  </p>
);

// 도비 사무실의 작업 책. 앞쪽은 읽기 쉬운 장(무엇을 만들었나 · 화면 · 검증(배포 상태 포함) · 회고 · 성능), 뒤쪽 부록은 원문 장이다.
// live 면 진행 중 상태로 열고 단계가 바뀔 때마다 기록을 다시 읽는다
export function DobbyWorkBook({ name, book, artifacts, live, onClose, onOpenArtifact, onRetro }: { name: string; book: Book; artifacts: Artifact[]; live?: LiveInfo; onClose: () => void; onOpenArtifact: (a: Artifact) => void; onRetro?: (key: string) => void }) {
  const [rec, setRec] = useState<TaskRecord | null>(null);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!live) setRec(null);
    setErr("");
    fetch(`/api/office/tasks/${encodeURIComponent(book.key)}/record`, { cache: "no-store" })
      .then(async (r) => (r.ok ? r.json() : Promise.reject((await r.json()).error)))
      .then((x: TaskRecord) => alive && setRec(x))
      .catch((e) => alive && setErr(typeof e === "string" ? e : "기록을 불러오지 못했습니다."));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, book.key, live?.phase]);

  const x = rec?.dobby;
  const flows = useFlows(x?.explainer ?? "");
  const mine = artifacts.filter((a) => a.taskKey === book.key);
  const logs = live?.logs ?? [];
  const logSeq = logs.map((l) => l.seq).join();
  const blocks = useMemo(() => {
    const out: Block[] = [];
    if (live) {
      out.push({ id: "log-h", head: true, chapter: "최근 기록", node: <div className="rb-chap">최근 기록</div> });
      if (!logs.length) out.push({ id: "log-none", node: <p>기록이 없습니다.</p> });
      logs.forEach((l) => out.push({ id: `log-${l.seq}`, node: <p className="rb-line"><span>{new Date(l.at).toTimeString().slice(0, 5)}</span>{l.text}</p> }));
    }
    if (err) out.push({ id: "err", node: <p>{err}</p> });
    else if (!rec || (x && !flows)) out.push({ id: "loading", node: <p>기록을 불러오는 중입니다.</p> });
    else {
      if (x && flows) {
        out.push(...frontBlocks(rec, x, flows, name, !!live));
        out.push({ id: "appendix", head: true, chapter: "부록", node: <div className="rb-chap appendix">부록<small>원문 문서를 그대로 옮긴 장입니다</small></div> });
      }
      for (const [id, label] of CHAPTERS) {
        if (id === "cover" || id === "log" || id === "rel" || id === "talk" || (id === "qa" && !rec.qa?.length) || (id === "test" && (rec.noTest || x))) continue;
        out.push({ id: `${id}-title`, head: true, node: <h5>{id === "proc" && rec.procName ? rec.procName : label}</h5> });
        out.push(...chapterBlocks(id, rec));
      }
    }
    if (mine.length) {
      out.push({ id: "art-h", head: true, node: <h5>아티팩트</h5> });
      mine.forEach((a) =>
        out.push({
          id: `art-${a.id}`,
          node: (
            <p className="rb-line">
              <button type="button" className="rb-link" onClick={() => onOpenArtifact(a)}>
                {a.title}
              </button>
              <small>
                {a.kind} · {a.at}
              </small>
            </p>
          ),
        }),
      );
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec, err, flows, !!live, logSeq, mine.map((a) => a.id).join()]);

  const last = x?.runs[0];
  return (
    <BinderBook
      head={book.key}
      kind="작업 책"
      onClose={onClose}
      blocks={blocks}
      bottom={
        <>
          {live ? live.phase : book.doneAt}
          <br />
          {live ? "진행 중" : "완료"}
        </>
      }
      title={
        <>
          <div className="kick">작업 책</div>
          <h4>{book.title}</h4>
          {live ? (
            <>
              <Row k="지금 단계" v={live.phase} />
              <Row k="상태" v={live.flag} />
              <Row k="작업방 일꾼" v={live.crew} />
            </>
          ) : (
            <>
              <Row k="완료한 때" v={book.doneAt} />
              {x?.phase && <Row k="단계" v={x.phase} />}
            </>
          )}
          {x && <Row k="배포" v={shipLine(x)} />}
          {last && <Row k="검증" v={`${last.env} 통과 ${last.pass}${last.fail ? ` · 실패 ${last.fail}` : ""}${last.hold ? ` · 보류 ${last.hold}` : ""}`} />}
          {x?.perf && <Row k="걸린 시간" v={`자동 실행 ${minutes(x.perf.wallMin)}`} />}
          <Row k="참여한 에이전트" v={rec ? rec.crew.join(", ") || "없음" : "…"} />
        </>
      }
      actions={
        <>
          {!live && onRetro && <RetroForm name={name} taskKey={book.key} onOpen={onRetro} />}
          <button type="button" className="pbtn" aria-expanded={adding} onClick={() => setAdding(true)}>
            아티팩트 꽂기
          </button>
        </>
      }
      overlay={
        adding && (
          <>
            <div className="kick">아티팩트 꽂기</div>
            <ArtifactForm name={name} taskKey={book.key} artifacts={artifacts} onDone={() => setAdding(false)} />
          </>
        )
      }
    />
  );
}

// 도비 사무실의 아티팩트 책. 표지에 제목과 꽂은 날, 쪽에 설명과 연결된 작업 키
export function DobbyArtifactBook({ artifact: a, onOpenWork, onClose }: { artifact: Artifact; onOpenWork?: () => void; onClose: () => void }) {
  const blocks = useMemo<Block[]>(
    () => [
      { id: "desc-h", head: true, node: <h5>설명</h5> },
      { id: "kind", node: <p className="rb-row"><span>종류</span><b>{a.kind}</b></p> },
      { id: "url", node: <p className="rb-url"><a href={a.url} target="_blank" rel="noopener noreferrer">{a.url}</a></p> },
      { id: "task-h", head: true, node: <h5>연결된 작업</h5> },
      { id: "task", node: <p>{a.taskKey || "이슈와 상관없이 꽂은 아티팩트입니다."}</p> },
    ],
    [a],
  );
  return (
    <BinderBook
      head={a.taskKey || "아티팩트"}
      kind="아티팩트"
      onClose={onClose}
      blocks={blocks}
      bottom={
        <>
          {a.at}
          <br />
          {a.kind}
        </>
      }
      title={
        <>
          <div className="kick">아티팩트</div>
          <h4>{a.title}</h4>
          <Row k="꽂은 날" v={a.at} />
        </>
      }
      actions={
        <>
          <a className="pbtn" href={a.url} target="_blank" rel="noopener noreferrer">
            아티팩트 열기
          </a>
          {onOpenWork && (
            <button type="button" className="pbtn" onClick={onOpenWork}>
              작업 책 보기
            </button>
          )}
        </>
      }
    />
  );
}
