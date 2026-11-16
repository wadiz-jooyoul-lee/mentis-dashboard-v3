"use client";

import { fmtMan, fmtMin, sumTokens, toMinutes, type PerfData, type PerfItem, type PerfSession } from "@/lib/perf";
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
