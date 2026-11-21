"use client";

import { useState } from "react";
import { fmtMan, fmtManFine, fmtMin, fmtUsd, sumTokens, toMinutes, type PerfData, type PerfItem, type PerfSession } from "@/lib/perf";
import s from "./PerfReport.module.css";

const GROUP_CLASS: Record<string, string> = {
  구현: s.gImpl,
  리뷰: s.gReview,
  통합: s.gMerge,
  배포: s.gDeploy,
  검증: s.gVerify,
};
const groupClass = (g: string) => GROUP_CLASS[g] ?? s.gEtc;

const signedMin = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${fmtMin(Math.abs(n))}`;

function Headline({ data }: { data: PerfData }) {
  const t = data.totals;
  const diff = Math.abs(t.savedMin);
  const tail = t.savedMin > 0 ? `${fmtMin(diff)} 줄었습니다` : t.savedMin < 0 ? `${fmtMin(diff)} 늘었습니다` : "같습니다";
  const tok = sumTokens(t.tokens);
  const baseTok = sumTokens(t.baselineTokens);
  const tiles: { label: string; value: string; sub?: string; tone?: "good" | "warn" }[] = [
    { label: "자동 실행", value: fmtMin(t.wallMin), sub: "겹친 시간은 한 번만 셈" },
    { label: "개선 전 기준", value: fmtMin(t.baselineMin), sub: "오더 63개 평균으로 계산" },
    { label: "차이", value: signedMin(t.wallMin - t.baselineMin), tone: t.savedMin >= 0 ? "good" : "warn" },
    { label: "토큰", value: fmtMan(tok), sub: `기준 ${fmtMan(baseTok)}`, tone: tok <= baseTok ? "good" : "warn" },
    { label: "사람을 기다린 시간", value: fmtMin(t.humanWaitMin), sub: "합계에 넣지 않음" },
  ];
  if (t.sleepMin > 0) tiles.push({ label: "컴퓨터가 잠든 시간", value: fmtMin(t.sleepMin), sub: "합계에 넣지 않음" });
  if (data.interactive?.sessions)
    tiles.push({ label: "사람과 대화한 세션", value: `${data.interactive.sessions}개`, sub: `${fmtMin(data.interactive.min)} · 합계에 넣지 않음` });

  return (
    <section className={s.hero}>
      <div className={s.heroLine}>
        이 오더 자동 실행 <b>{fmtMin(t.wallMin)}</b>
        <span className={s.heroDash}>—</span>
        개선 전 기준이면 {fmtMin(t.baselineMin)},{" "}
        <b className={t.savedMin > 0 ? s.good : t.savedMin < 0 ? s.warn : undefined}>{tail}</b>
      </div>
      <div className={s.heroMeta}>
        <span>측정 {data.measuredAt}</span>
        <span>플러그인 {data.pluginVersion}</span>
        <span className={data.status === "완성" ? s.pillDone : s.pillLive}>{data.status}</span>
        {data.status !== "완성" && <span>끝나지 않은 단계가 있어 숫자가 바뀔 수 있습니다</span>}
      </div>
      {data.sleepLog ? <div className={s.heroNote}>잠든 시간을 다 빼지 못했습니다: {data.sleepLog}</div> : null}
      <div className={s.tiles}>
        {tiles.map((x) => (
          <div key={x.label} className={s.tile}>
            <div className={s.tileLabel}>{x.label}</div>
            <div className={`${s.tileValue} ${x.tone === "good" ? s.good : x.tone === "warn" ? s.warn : ""}`}>{x.value}</div>
            {x.sub && <div className={s.tileSub}>{x.sub}</div>}
          </div>
        ))}
      </div>
    </section>
  );
}

function StageBars({ data }: { data: PerfData }) {
  const max = Math.max(1, ...data.byStage.map((b) => Math.max(b.min, b.baselineMin)));
  const w = (n: number) => `${Math.max(0.5, (n / max) * 100)}%`;
  return (
    <section className={s.section}>
      <h3 className={s.h3}>단계별 전과 후</h3>
      <p className={s.help}>
        <span className={s.keyBase} /> 개선 전 기준 <span className={s.keyGood} /> 이번 오더(기준보다 짧음){" "}
        <span className={s.keyWarn} /> 이번 오더(기준보다 김)
      </p>
      <div className={s.card}>
        {data.byStage.map((b) => {
          const d = b.min - b.baselineMin;
          const tone = d > 0 ? s.warn : s.good;
          return (
            <div key={b.stage} className={s.barRow}>
              <div className={s.barLabel}>
                <div className={s.barStage}>{b.stage}</div>
                <div className={s.barSessions}>세션 {b.sessions}개</div>
              </div>
              <div className={s.barTrack}>
                <div className={s.barLine}>
                  <div className={s.barBase} style={{ width: w(b.baselineMin) }} />
                  <span className={s.barNum}>{fmtMin(b.baselineMin)}</span>
                </div>
                <div className={s.barLine}>
                  <div className={`${s.barNow} ${d > 0 ? s.barNowWarn : s.barNowGood}`} style={{ width: w(b.min) }} />
                  <span className={`${s.barNum} ${s.barNumStrong}`}>{fmtMin(b.min)}</span>
                </div>
              </div>
              <div className={`${s.barDiff} ${d === 0 ? "" : tone}`}>{d === 0 ? "같음" : signedMin(d)}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ItemCard({ it }: { it: PerfItem }) {
  const state =
    it.applied === true
      ? { text: "적용됨", cls: s.stApplied }
      : it.applied === false
      ? { text: "해당 없음", cls: s.stNone }
      : { text: "측정 못 함", cls: s.stUnknown };
  const estimated = !!it.note?.includes("추정");
  const tok = it.tokenDelta;
  return (
    <div className={`${s.item} ${it.applied === true ? s.itemOn : ""}`}>
      <div className={s.itemHead}>
        <div className={s.itemName}>{it.name}</div>
        <div className={s.itemTags}>
          {estimated && <span className={`${s.chip} ${s.stEstimate}`}>추정</span>}
          <span className={`${s.chip} ${state.cls}`}>{state.text}</span>
        </div>
      </div>
      <div className={s.itemNums}>
        <div>
          <div className={s.itemNumLabel}>줄어든 시간</div>
          <div className={`${s.itemNum} ${it.savedMin != null && it.savedMin > 0 ? s.good : ""}`}>
            {it.savedMin == null ? "계산 안 함" : fmtMin(it.savedMin)}
          </div>
        </div>
        <div>
          <div className={s.itemNumLabel}>토큰 변화</div>
          <div className={`${s.itemNum} ${tok == null || tok === 0 ? "" : tok > 0 ? s.warn : s.good}`}>
            {tok == null ? "-" : `${tok > 0 ? "+" : tok < 0 ? "−" : ""}${fmtMan(Math.abs(tok))}`}
          </div>
        </div>
      </div>
      <div className={s.itemEvidence}>{it.evidence}</div>
      {it.note ? <div className={s.itemNote}>{it.note}</div> : null}
    </div>
  );
}

/** 이 길이(분)보다 긴 빈 구간은 접어서 그린다. 밤새 잠든 구간 때문에 세션이 점처럼 보이지 않게 하려는 것이다. */
const CUT_MIN = 20;
const CUT_WIDTH = 6;

type Seg = { from: number; to: number; x: number; w: number; cut: boolean };

/**
 * 깨어 있는 세션이 하나도 돌지 않고 CUT_MIN 보다 긴 구간만 접는다.
 * 잠든 시간이 긴 세션은 어느 때 잠들었는지 알 수 없어 덮개로 치지 않는다.
 */
function buildAxis(points: number[], awake: [number, number][]): { segs: Seg[]; total: number; x: (t: number) => number } {
  const pts = [...new Set(points)].sort((a, b) => a - b);
  const segs: Seg[] = [];
  let x = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const g = pts[i + 1] - pts[i];
    const cut = g > CUT_MIN && !awake.some(([a, b]) => a < pts[i + 1] && b > pts[i]);
    const prev = segs[segs.length - 1];
    if (cut && prev?.cut) {
      prev.to = pts[i + 1];
      continue;
    }
    const w = cut ? CUT_WIDTH : g;
    segs.push({ from: pts[i], to: pts[i + 1], x, w, cut });
    x += w;
  }
  const total = Math.max(x, 1);
  const map = (t: number) => {
    const sg = segs.find((g) => t >= g.from && t <= g.to);
    if (!sg) return t <= (pts[0] ?? 0) ? 0 : total;
    return sg.x + ((t - sg.from) / (sg.to - sg.from || 1)) * sg.w;
  };
  return { segs, total, x: map };
}

/** 겹치는 세션은 다음 줄로 내린다. */
function toLanes(list: PerfSession[]): PerfSession[][] {
  const lanes: { end: number; items: PerfSession[] }[] = [];
  for (const ss of [...list].sort((a, b) => toMinutes(a.start) - toMinutes(b.start))) {
    const st = toMinutes(ss.start);
    const lane = lanes.find((l) => l.end <= st);
    if (lane) {
      lane.items.push(ss);
      lane.end = toMinutes(ss.end);
    } else lanes.push({ end: toMinutes(ss.end), items: [ss] });
  }
  return lanes.map((l) => l.items);
}

const hhmm = (t: number) => {
  const d = new Date(t * 60000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const dayOf = (t: number) => {
  const d = new Date(t * 60000);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};
const fmtSpan = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}시간 ${Math.round(m % 60)}분` : `${Math.round(m)}분`);

function Timeline({ data }: { data: PerfData }) {
  const sessions = data.sessions.filter((x) => x.start && x.end);
  if (!sessions.length) return null;
  const waits = (data.humanWaits ?? []).filter((w) => w.end > w.start);
  const points = [
    ...sessions.flatMap((x) => [toMinutes(x.start), toMinutes(x.end)]),
    ...waits.flatMap((w) => [toMinutes(w.start), toMinutes(w.end)]),
  ];
  const awake = sessions
    .filter((v) => v.sleepMin < CUT_MIN)
    .map((v) => [toMinutes(v.start), toMinutes(v.end)] as [number, number]);
  const { segs, total, x } = buildAxis(points, awake);
  const pct = (n: number) => `${(n / total) * 100}%`;

  const autoLanes = toLanes(sessions.filter((v) => !v.interactive));
  const talkLanes = toLanes(sessions.filter((v) => v.interactive));

  // 눈금: 접히지 않은 구간 안에서 정해진 간격마다, 서로 너무 붙으면 건너뛴다
  const openMin = segs.filter((g) => !g.cut).reduce((a, g) => a + g.w, 0);
  const step = [5, 10, 15, 30, 60, 120].find((st) => openMin / st <= 12) ?? 240;
  const ticks: { t: number; pos: number }[] = [];
  const firstDay = dayOf(segs[0]?.from ?? 0);
  for (const g of segs) {
    const cands = g.cut ? [g.from, g.to] : [];
    for (let t = Math.ceil(g.from / step) * step; !g.cut && t <= g.to; t += step) cands.push(t);
    for (const t of cands) {
      const pos = (x(t) / total) * 100;
      if (ticks.length && pos - ticks[ticks.length - 1].pos < 6) continue;
      ticks.push({ t, pos });
    }
  }

  const Lane = ({ items, talk }: { items: PerfSession[]; talk?: boolean }) => (
    <div className={s.lane}>
      {items.map((v) => {
        const l = x(toMinutes(v.start));
        const w = Math.max(x(toMinutes(v.end)) - l, total * 0.004);
        const tip = [
          `${v.stage} (${v.start.slice(11, 16)}~${v.end.slice(11, 16)})`,
          `걸린 시간 ${fmtMin(v.min)} · 응답 ${v.calls}번`,
          v.sleepMin > 0 ? `컴퓨터가 잠든 ${fmtMin(v.sleepMin)}은 뺐습니다` : "",
          talk ? "사람과 대화한 세션이라 합계에 넣지 않았습니다" : "",
          v.missing ? "세션 기록을 찾지 못했습니다" : "",
        ]
          .filter(Boolean)
          .join("\n");
        return (
          <div
            key={v.id + v.start}
            className={`${s.span} ${groupClass(v.group)} ${talk ? s.spanTalk : ""}`}
            style={{ left: pct(l), width: pct(w) }}
            title={tip}
          >
            <span className={s.spanText}>{v.stage}</span>
          </div>
        );
      })}
    </div>
  );

  return (
    <section className={s.section}>
      <h3 className={s.h3}>시간 흐름</h3>
      <p className={s.help}>
        세션을 시각 순서로 그렸습니다. 겹친 세션은 줄을 나눠 그립니다. 막대에 마우스를 올리면 자세한 값이 보입니다.
      </p>
      <div className={s.legend}>
        {["구현", "리뷰", "통합", "배포", "검증", "기타"].map((g) => (
          <span key={g} className={s.legendItem}>
            <span className={`${s.legendSwatch} ${groupClass(g)}`} />
            {g}
          </span>
        ))}
        <span className={s.legendItem}>
          <span className={`${s.legendSwatch} ${s.hatchWait}`} />
          사람을 기다린 구간
        </span>
        <span className={s.legendItem}>
          <span className={`${s.legendSwatch} ${s.hatchCut}`} />
          {CUT_MIN}분 넘게 빈 구간(접어서 그림)
        </span>
      </div>
      <div className={`${s.card} ${s.timelineCard}`}>
        <div className={s.timeline}>
          <div className={s.laneGroup}>
            <div className={s.laneTitle}>자동 실행</div>
            <div className={s.laneBody}>
              {autoLanes.map((items, i) => (
                <Lane key={`a${i}`} items={items} />
              ))}
            </div>
          </div>
          {talkLanes.length > 0 && (
            <div className={s.laneGroup}>
              <div className={s.laneTitle}>사람과 대화</div>
              <div className={s.laneBody}>
                {talkLanes.map((items, i) => (
                  <Lane key={`t${i}`} items={items} talk />
                ))}
              </div>
            </div>
          )}
          <div className={s.overlay}>
            {segs
              .filter((g) => g.cut)
              .map((g) => (
                <div key={`c${g.from}`} className={`${s.band} ${s.hatchCut}`} style={{ left: pct(g.x), width: pct(g.w) }}>
                  <span className={s.bandText}>{fmtSpan(g.to - g.from)}</span>
                </div>
              ))}
            {waits.map((w) => {
              const l = x(toMinutes(w.start));
              return (
                <div
                  key={`w${w.start}`}
                  className={`${s.band} ${s.hatchWait}`}
                  style={{ left: pct(l), width: pct(x(toMinutes(w.end)) - l) }}
                  title={`사람을 기다린 ${fmtMin(w.min)} (${w.start.slice(11, 16)}~${w.end.slice(11, 16)})`}
                />
              );
            })}
          </div>
          <div className={s.axis}>
            {ticks.map((k) => (
              <span
                key={k.t}
                className={s.tick}
                style={{ left: `${k.pos}%`, transform: k.pos > 95 ? "translateX(-100%)" : k.pos < 3 ? "none" : undefined }}
              >
                {dayOf(k.t) !== firstDay && <small>{dayOf(k.t)} </small>}
                {hhmm(k.t)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const NUM = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳";
const numOf = (i: number) => NUM[i] ?? `(${i + 1})`;
const fmtPct = (x: number) => `${(x * 100).toFixed(x >= 0.995 || x < 0.1 ? 1 : 0)}%`;

type TokSession = PerfSession & { ctx: NonNullable<PerfSession["ctx"]>; n: number };

/** 세션 흐름: 사람과 대화한 줄과 자동 실행 줄. 세로선은 사람과 대화한 세션이 다음 세션에 일을 넘긴 때다. */
function TokenFlowLanes({ list }: { list: TokSession[] }) {
  const sessions = list.filter((x) => x.start && x.end);
  if (!sessions.length) return null;
  const points = sessions.flatMap((x) => [toMinutes(x.start), toMinutes(x.end)]);
  const awake = sessions.filter((v) => v.sleepMin < CUT_MIN).map((v) => [toMinutes(v.start), toMinutes(v.end)] as [number, number]);
  const { segs, total, x } = buildAxis(points, awake);
  const pct = (n: number) => `${(n / total) * 100}%`;
  const talkLanes = toLanes(sessions.filter((v) => v.interactive)) as TokSession[][];
  const autoLanes = toLanes(sessions.filter((v) => !v.interactive)) as TokSession[][];
  const handoffs = sessions.filter((v, i) => i > 0 && !v.interactive && sessions[i - 1].interactive).map((v) => toMinutes(v.start));
  const openMin = segs.filter((g) => !g.cut).reduce((a, g) => a + g.w, 0);
  const step = [5, 10, 15, 30, 60, 120].find((st) => openMin / st <= 12) ?? 240;
  const ticks: { t: number; pos: number }[] = [];
  for (const g of segs) {
    const cands = g.cut ? [g.from, g.to] : [];
    for (let t = Math.ceil(g.from / step) * step; !g.cut && t <= g.to; t += step) cands.push(t);
    for (const t of cands) {
      const pos = (x(t) / total) * 100;
      if (ticks.length && pos - ticks[ticks.length - 1].pos < 6) continue;
      ticks.push({ t, pos });
    }
  }
  const Lane = ({ items }: { items: TokSession[] }) => (
    <div className={s.lane}>
      {items.map((v, k) => {
        const l = x(toMinutes(v.start));
        const w = Math.max(x(toMinutes(v.end)) - l, total * 0.006);
        const prev = k > 0 && items[k - 1].id === v.id ? items[k - 1] : null;
        const pe = prev ? x(toMinutes(prev.end)) : 0;
        return (
          <span key={v.id + v.start}>
            {prev && l > pe && <span className={s.tkLink} style={{ left: pct(pe), width: pct(l - pe) }} title="같은 세션을 쉬었다 이어 썼습니다" />}
            <span
              className={`${s.span} ${s.tkSpan}`}
              style={{ left: pct(l), width: pct(w) }}
              title={`${numOf(v.n)} ${v.stage}\n${v.start.slice(11, 16)}~${v.end.slice(11, 16)} · 호출 ${v.calls}번\n입력 ${fmtManFine(v.ctx.sum)}`}
            >
              <span className={s.spanText}>{numOf(v.n)}</span>
            </span>
          </span>
        );
      })}
    </div>
  );
  return (
    <div className={`${s.card} ${s.timelineCard}`}>
      <div className={s.timeline}>
        {talkLanes.length > 0 && (
          <div className={s.laneGroup}>
            <div className={s.laneTitle}>사람과 대화</div>
            <div className={s.laneBody}>
              {talkLanes.map((items, i) => (
                <Lane key={`t${i}`} items={items} />
              ))}
            </div>
          </div>
        )}
        {autoLanes.length > 0 && (
          <div className={s.laneGroup}>
            <div className={s.laneTitle}>자동 실행</div>
            <div className={s.laneBody}>
              {autoLanes.map((items, i) => (
                <Lane key={`a${i}`} items={items} />
              ))}
            </div>
          </div>
        )}
        <div className={s.overlay}>
          {segs
            .filter((g) => g.cut)
            .map((g) => (
              <div key={`c${g.from}`} className={`${s.band} ${s.hatchCut}`} style={{ left: pct(g.x), width: pct(g.w) }}>
                <span className={s.bandText}>{fmtSpan(g.to - g.from)}</span>
              </div>
            ))}
          {handoffs.map((t) => (
            <div key={`h${t}`} className={s.tkHandoff} style={{ left: pct(x(t)) }} title={`${hhmm(t)} 다음 세션에 일을 넘김`} />
          ))}
        </div>
        <div className={s.axis}>
          {ticks.map((k) => (
            <span
              key={k.t}
              className={s.tick}
              style={{ left: `${k.pos}%`, transform: k.pos > 95 ? "translateX(-100%)" : k.pos < 3 ? "none" : undefined }}
            >
              {hhmm(k.t)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** 세션 하나의 호출별 컨텍스트 크기. 가로는 호출 순서, 세로는 크기이고 세로 눈금(yMax)은 모든 카드가 같다. */
function CtxCard({ v, yMax }: { v: TokSession; yMax: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const c = v.ctx;
  const W = 260, H = 140, L = 30, R = 6, T = 8, B = 18;
  const n = c.series.length;
  const y = (val: number) => T + (1 - Math.min(val, yMax) / yMax) * (H - T - B);
  const xw = (W - L - R) / Math.max(n, 1);
  const x = (k: number) => L + k * xw;
  const split = c.floor != null;
  const floor = c.floor ?? 0;
  const base = floor + (c.carry ?? 0);
  let top = "";
  c.series.forEach((val, k) => {
    const yy = y(Math.max(val, base)).toFixed(1);
    top += `${k ? "L" : "M"}${x(k).toFixed(1)} ${yy} L${x(k + 1).toFixed(1)} ${yy} `;
  });
  const gridStep = yMax / 3;
  const rewrites = v.cacheRewrites ?? [];
  const compactions = v.compactions ?? [];
  const calc: string[] = [];
  if (split) {
    calc.push(`고정 바닥 ${fmtManFine(c.floor)} × ${n}번 = ${fmtManFine(c.floorSum)}`);
    if ((c.carry ?? 0) > 0) calc.push(`이월된 대화 ${fmtManFine(c.carry)} × ${n}번 = ${fmtManFine(c.carrySum)}`);
    calc.push(`쌓인 대화 ${fmtManFine(c.growthSum)}`);
  }
  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    setHover(Math.max(0, Math.min(n - 1, Math.floor(((e.clientX - b.left) / b.width) * n))));
  };
  return (
    <div className={s.tkCard}>
      <div className={s.tkCardHead}>
        <b>
          {numOf(v.n)} {v.stage}
        </b>
        {v.interactive && <span className={s.tkTag}>사람과 대화</span>}
        {v.resumed && <span className={s.tkTag}>이어 쓴 세션</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${v.stage} 호출별 컨텍스트 크기`} className={s.tkSvg}>
        {[1, 2, 3].map((k) => (
          <g key={k}>
            <line x1={L} x2={W - R} y1={y(gridStep * k)} y2={y(gridStep * k)} className={s.tkGrid} />
            <text x={L - 4} y={y(gridStep * k) + 3.5} fontSize="9" textAnchor="end" className={s.tkAxisText}>
              {Math.round((gridStep * k) / 10000)}만
            </text>
          </g>
        ))}
        {split && <rect x={L} y={y(floor)} width={W - L - R} height={y(0) - y(floor)} className={s.tkFillFloor} />}
        {split && (c.carry ?? 0) > 0 && (
          <rect x={L} y={y(base)} width={W - L - R} height={Math.max(0, y(floor) - y(base) - 1)} className={s.tkFillCarry} />
        )}
        {n > 0 && (
          <path
            d={`${top}L${W - R} ${(y(base) - (split ? 1 : 0)).toFixed(1)} L${L} ${(y(base) - (split ? 1 : 0)).toFixed(1)} Z`}
            className={split ? s.tkFillGrow : s.tkFillPlain}
          />
        )}
        <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} className={s.tkBaseLine} />
        {rewrites.map((k) => (
          <circle key={`r${k}`} cx={x(k - 0.5)} cy={y(c.series[k - 1] ?? 0)} r="4" className={s.tkDotRewrite} />
        ))}
        {compactions.map((k) => (
          <circle key={`c${k}`} cx={x(k - 0.5)} cy={y(c.series[k - 1] ?? 0)} r="3.5" className={s.tkDotCompact} />
        ))}
        <text x={L} y={H - 5} fontSize="9" className={s.tkAxisText}>
          호출 1
        </text>
        <text x={W - R} y={H - 5} fontSize="9" textAnchor="end" className={s.tkAxisText}>
          {n}
        </text>
        {hover != null && <line x1={x(hover + 0.5)} x2={x(hover + 0.5)} y1={T} y2={y(0)} className={s.tkCross} />}
        <rect x={L} y={T} width={W - L - R} height={H - T - B} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
      </svg>
      <div className={s.tkHover}>
        {hover != null
          ? `호출 ${hover + 1}/${n} · 컨텍스트 ${fmtManFine(c.series[hover])}${rewrites.includes(hover + 1) ? " · 캐시를 다시 씀" : ""}${
              compactions.includes(hover + 1) ? " · 압축됨" : ""
            }`
          : "그래프에 마우스를 올리면 호출별 값이 보입니다"}
      </div>
      <dl className={s.tkDl}>
        <dt>시작 → 끝 크기</dt>
        <dd>
          {fmtManFine(c.first)} → {fmtManFine(c.last)}
        </dd>
        <dt>입력 합계</dt>
        <dd>
          <b>{fmtManFine(c.sum)}</b>
        </dd>
        <dt>캐시 적중률</dt>
        <dd>{v.cacheHitRate == null ? "-" : fmtPct(v.cacheHitRate)}</dd>
        <dt>출력</dt>
        <dd>{fmtManFine(v.tokens?.output)}</dd>
        <dt>비용</dt>
        <dd>{fmtUsd(v.costUsd)}</dd>
        {v.subagents && (
          <>
            <dt>서브 에이전트</dt>
            <dd>
              호출 {v.subagents.calls}번 · 입력{" "}
              {fmtManFine(v.subagents.tokens.cacheRead + v.subagents.tokens.cacheWrite + v.subagents.tokens.input)}
            </dd>
          </>
        )}
      </dl>
      <div className={s.tkCalc}>
        {split ? (
          <>
            {calc.flatMap((t, k) => [<span key={t}>{`${k > 0 ? "+ " : ""}${t}`}</span>, " "])}
            <span>= {fmtManFine(c.sum)}</span>
          </>
        ) : (
          `입력 합계 ${fmtManFine(c.sum)} — 이 오더에 새로 시작한 세션이 없어 몫을 나누지 않았습니다`
        )}
      </div>
    </div>
  );
}

/** 토큰 절: 요약 → 세션 흐름 → 세션별 입력 합계 → 세션별 컨텍스트 크기 → 계산 방식. */
function TokenSection({ data }: { data: PerfData }) {
  const tf = data.tokenFlow;
  const list: TokSession[] = data.sessions.flatMap((v, i) => (v.ctx && v.ctx.series?.length ? [{ ...v, ctx: v.ctx, n: i }] : []));
  if (!tf || !list.length) {
    return (
      <section className={s.section}>
        <h3 className={s.h3}>토큰</h3>
        <div className={`${s.card} ${s.tkOld}`}>이 측정에는 토큰 흐름이 들어 있지 않습니다. 다시 측정하면 세션별 토큰이 보입니다.</div>
      </section>
    );
  }
  const calls = list.reduce((a, v) => a + v.ctx.series.length, 0);
  const total = tf.sum || 1;
  const maxSum = Math.max(1, ...list.map((v) => v.ctx.sum));
  const peak = Math.max(1, ...list.map((v) => v.ctx.peak ?? 0));
  const yMax = Math.ceil(peak / 150000) * 150000;
  const subIn = tf.subagents ? tf.subagents.tokens.cacheRead + tf.subagents.tokens.cacheWrite + tf.subagents.tokens.input : 0;
  const tiles = [
    { k: "입력 합계", v: fmtManFine(tf.sum), d: `호출 ${calls.toLocaleString()}번이 읽은 양` },
    { k: "사람과 대화한 세션 몫", v: fmtPct(tf.interactiveSum / total), d: `${fmtManFine(tf.interactiveSum)}` },
    { k: "캐시 적중률", v: fmtPct(tf.cacheRead / total), d: `캐시 쓰기 ${fmtManFine(tf.cacheWrite)}` },
    { k: "출력", v: fmtManFine(tf.output), d: "모델이 쓴 양" },
    { k: "비용", v: fmtUsd(tf.costUsd), d: `세션 ${list.length}개 중 ${tf.costSessions}개만 기록됨` },
  ];
  const seg = (cls: string, val: number | null, name: string, sum: number, stage: string) =>
    val && val > 0 ? <div className={`${s.tkSeg} ${cls}`} style={{ flex: `${val} 0 0` }} title={`${stage} · ${name}\n${fmtManFine(val)} (${fmtPct(val / sum)})`} /> : null;
  const kinds: [string, string, number, string][] = [
    ["무엇 때문에", "고정 바닥", tf.floorSum, "호출마다 다시 읽는 설명서(시스템 프롬프트·도구·스킬 설명). 세션을 새로 띄워도 줄지 않습니다"],
    ["", "이월된 대화", tf.carrySum, "긴 세션을 이어 쓴 값. 새 세션으로 넘기면 0 입니다"],
    ["", "쌓인 대화", tf.growthSum, "이 구간에서 도구 결과와 답변이 쌓인 양. 세션이 길수록 커집니다"],
    ["어떻게 읽었나", "캐시 읽기", tf.cacheRead, "입력 중 캐시에서 읽은 양"],
    ["", "캐시 쓰기", tf.cacheWrite, "입력 중 캐시에 새로 쓴 양"],
    ["", "새 입력", tf.input, "캐시를 거치지 않은 입력"],
  ];
  return (
    <section className={s.section}>
      <h3 className={s.h3}>토큰</h3>
      <p className={s.help}>이 오더의 세션들이 읽은 입력 토큰입니다. 사람과 대화한 세션도 넣었습니다.</p>
      <div className={s.tkTiles}>
        {tiles.map((t) => (
          <div key={t.k} className={s.tile}>
            <div className={s.tileLabel}>{t.k}</div>
            <div className={s.tileValue}>{t.v}</div>
            <div className={s.tileSub}>{t.d}</div>
          </div>
        ))}
      </div>
      {tf.excluded && tf.excluded.calls > 0 && (
        <p className={s.tkNote}>
          이 오더의 어느 구간에도 들지 않아 뺀 호출이 {tf.excluded.calls}번, {fmtManFine(tf.excluded.sum)} 있습니다
          {tf.excluded.note ? ` (${tf.excluded.note})` : ""}.
        </p>
      )}
      {tf.subagents && (
        <p className={s.tkNote}>
          서브 에이전트가 따로 호출 {tf.subagents.calls}번, 입력 {fmtManFine(subIn)}, 출력 {fmtManFine(tf.subagents.tokens.output)}을 썼습니다. 위 합계에는
          넣지 않았습니다.
        </p>
      )}

      <h4 className={s.h4}>세션 흐름</h4>
      <p className={s.help}>
        위 줄은 사람과 대화한 세션, 아래 줄은 자동으로 돈 세션입니다. 세로선은 다음 세션에 일을 넘긴 때이고, 점선은 같은 세션을 쉬었다 이어 쓴
        곳입니다.
      </p>
      <TokenFlowLanes list={list} />
      <ol className={s.tkChips}>
        {list.map((v) => (
          <li key={v.id + v.start} className={s.tkChip}>
            <div className={s.tkChipHead}>
              <span className={s.tkChipNum}>{numOf(v.n)}</span>
              <span className={s.tkChipStage}>{v.stage}</span>
              {v.interactive && <span className={s.tkTag}>사람과 대화</span>}
            </div>
            <div className={s.tkChipMeta}>
              {v.start?.slice(11, 16)}~{v.end?.slice(11, 16)} · 호출 {v.calls}번
            </div>
            <div className={s.tkChipMeta}>
              입력 {fmtManFine(v.ctx.sum)} · {fmtUsd(v.costUsd)}
            </div>
          </li>
        ))}
      </ol>

      <h4 className={s.h4}>세션별 입력 합계</h4>
      <p className={s.help}>막대 길이는 그 세션의 모든 호출이 읽은 입력 토큰의 합입니다. 색은 그 입력이 무엇 때문에 생겼는지를 나눕니다.</p>
      <div className={s.legend}>
        <span className={s.legendItem}>
          <span className={`${s.legendSwatch} ${s.tkFloor}`} />
          고정 바닥
        </span>
        <span className={s.legendItem}>
          <span className={`${s.legendSwatch} ${s.tkCarry}`} />
          이월된 대화
        </span>
        <span className={s.legendItem}>
          <span className={`${s.legendSwatch} ${s.tkGrow}`} />
          쌓인 대화
        </span>
      </div>
      <div className={s.card}>
        <div className={s.tkBars}>
          {list.map((v) => (
            <div key={v.id + v.start} className={s.tkBarRow}>
              <div className={s.tkBarName}>
                <small>{numOf(v.n)}</small>
                {v.stage}
              </div>
              <div className={s.tkTrack}>
                <div className={s.tkTrackIn} style={{ width: `${((v.ctx.sum / maxSum) * 100).toFixed(2)}%` }}>
                  {v.ctx.floorSum == null ? (
                    <div className={`${s.tkSeg} ${s.tkPlain}`} style={{ flex: "1 0 0" }} title={`${v.stage}\n${fmtManFine(v.ctx.sum)} (몫을 나누지 않음)`} />
                  ) : (
                    <>
                      {seg(s.tkFloor, v.ctx.floorSum, "고정 바닥", v.ctx.sum, v.stage)}
                      {seg(s.tkCarry, v.ctx.carrySum, "이월된 대화", v.ctx.sum, v.stage)}
                      {seg(s.tkGrow, v.ctx.growthSum, "쌓인 대화", v.ctx.sum, v.stage)}
                    </>
                  )}
                </div>
              </div>
              <div className={s.tkBarVal}>
                {fmtManFine(v.ctx.sum)} <small>{fmtPct(v.ctx.sum / total)}</small>
              </div>
            </div>
          ))}
          <div className={`${s.tkBarRow} ${s.tkBarTotal}`}>
            <div className={s.tkBarName}>
              <b>합계</b>
            </div>
            <div className={s.tkTrack}>
              <div className={s.tkTrackIn} style={{ width: "100%" }}>
                {seg(s.tkFloor, tf.floorSum, "고정 바닥", total, "합계")}
                {seg(s.tkCarry, tf.carrySum, "이월된 대화", total, "합계")}
                {seg(s.tkGrow, tf.growthSum, "쌓인 대화", total, "합계")}
              </div>
            </div>
            <div className={s.tkBarVal}>
              <b>{fmtManFine(tf.sum)}</b>
            </div>
          </div>
        </div>
      </div>
      <div className={`${s.card} ${s.tkScroll}`}>
        <table className={s.tkTable}>
          <thead>
            <tr>
              <th>나눈 기준</th>
              <th>몫</th>
              <th className={s.tkR}>토큰</th>
              <th className={s.tkR}>입력 대비</th>
              <th>뜻</th>
            </tr>
          </thead>
          <tbody>
            {kinds.map(([grp, name, val, desc]) => (
              <tr key={name}>
                <td>{grp}</td>
                <td>{name}</td>
                <td className={s.tkR}>{fmtManFine(val)}</td>
                <td className={s.tkR}>{fmtPct(val / total)}</td>
                <td>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h4 className={s.h4}>세션별 컨텍스트 크기</h4>
      <p className={s.help}>
        가로는 호출 순서, 세로는 그 호출이 읽은 컨텍스트 크기입니다. 색칠된 넓이가 곧 입력 합계입니다. 세로 눈금은 모든 카드가 같습니다.
      </p>
      <div className={s.tkCards}>
        {list.map((v) => (
          <CtxCard key={v.id + v.start} v={v} yMax={yMax} />
        ))}
      </div>
      <p className={s.tkNote}>
        <span className={`${s.tkKeyDot} ${s.tkCarry}`} /> 캐시가 만료돼 컨텍스트를 다시 쓴 호출 <span className={`${s.tkKeyDot} ${s.tkKeyCompact}`} /> 컨텍스트가
        압축된 호출
      </p>

      <details className={s.method}>
        <summary>토큰 계산 방식</summary>
        <div className={s.tkScroll}>
          <table className={s.tkTable}>
            <thead>
              <tr>
                <th>값</th>
                <th>계산</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>호출의 컨텍스트 크기</td>
                <td>새 입력 + 캐시 쓰기 + 캐시 읽기. 그 호출에서 모델이 읽은 전체 양입니다</td>
              </tr>
              <tr>
                <td>고정 바닥</td>
                <td>
                  새로 시작한 세션의 첫 호출 크기. 이어 쓴 세션에는 이 오더의 새 세션 첫 호출 크기 가운데 값
                  {tf.floorRef != null ? `(${fmtManFine(tf.floorRef)})` : ""}을 씁니다
                </td>
              </tr>
              <tr>
                <td>이월된 대화</td>
                <td>이어 쓴 구간의 첫 호출 크기 − 고정 바닥. 새 세션은 0 입니다</td>
              </tr>
              <tr>
                <td>입력 합계</td>
                <td>호출별 컨텍스트 크기를 모두 더한 값</td>
              </tr>
              <tr>
                <td>세 몫</td>
                <td>고정 바닥 × 호출 수, 이월된 대화 × 호출 수, 나머지가 그 구간에서 쌓인 대화입니다</td>
              </tr>
              <tr>
                <td>캐시 적중률</td>
                <td>캐시 읽기 합 ÷ 입력 합계</td>
              </tr>
              <tr>
                <td>캐시 다시 쓰기</td>
                <td>캐시 읽기가 직전 호출 크기의 절반 아래인 호출</td>
              </tr>
              <tr>
                <td>압축</td>
                <td>컨텍스트 크기가 직전 호출의 70% 아래로 줄어든 호출</td>
              </tr>
              <tr>
                <td>비용</td>
                <td>세션 기록 끝의 누적 비용 줄. 그 줄이 없거나 한 세션이 여러 구간으로 나뉘면 비워 둡니다</td>
              </tr>
              <tr>
                <td>사람과 대화한 세션의 구간</td>
                <td>그 단계를 시작한 사람의 말부터 다음 세션에 일을 넘긴 때까지. 그 밖의 호출은 뺍니다</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

export default function PerfReport({ data }: { data: PerfData }) {
  return (
    <div className={s.report}>
      <Headline data={data} />
      <StageBars data={data} />
      <section className={s.section}>
        <h3 className={s.h3}>개선 항목</h3>
        <p className={s.help}>속도 개선마다 이 오더에 적용됐는지와 그 효과입니다.</p>
        <div className={s.items}>
          {data.items.map((it) => (
            <ItemCard key={it.id} it={it} />
          ))}
        </div>
      </section>
      <Timeline data={data} />
      <TokenSection data={data} />
      {data.summary && (
        <section className={s.section}>
          <h3 className={s.h3}>해석</h3>
          <div className={`${s.card} ${s.summary}`}>{data.summary}</div>
        </section>
      )}
      {data.method && (
        <details className={s.method}>
          <summary>계산 방법</summary>
          <p>{data.method}</p>
        </details>
      )}
    </div>
  );
}
