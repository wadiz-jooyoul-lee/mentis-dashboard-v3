"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CloseX } from "@/components/office/CloseX";
import type { DataBadge, DataCmd, DataDetail, DataItem, DataState, DataSummary } from "@/lib/office/data";

const STATE_NAME: Record<DataState, string> = { result: "결과 있음", ready: "수집 전", none: "스펙 없음", na: "측정 불가" };
const BADGE_TONE: Record<DataBadge, string> = { "성과 있음": "good", "수집 확인": "good", 나빠짐: "bad", "수집 이상": "bad", "판단 이르다": "wait", "차이 없음": "flat" };
const BADGE_MEANING: Record<DataBadge, string> = {
  "수집 이상": "기록이 0건인 날이 있거나 두 그룹이 고르게 나뉘지 않았습니다",
  "성과 있음": "우연으로 보기 어려운 차이로 좋아졌습니다",
  나빠짐: "우연으로 보기 어려운 차이로 나빠졌습니다",
  "판단 이르다": "아직 본 기기 수가 적어 판단할 수 없습니다",
  "차이 없음": "충분히 봤지만 차이가 우연과 구별되지 않습니다",
  "수집 확인": "새로 심은 기록이 잘 쌓이고 있습니다",
};
const CMD_NAME: Record<DataCmd, string> = { spec: "스펙을 만드는 중입니다", run: "데이터를 모으는 중입니다" };
const pct = (v: number | null | undefined) => (v == null ? "-" : `${(v * 100).toFixed(2)}%`);
const value = (kind: string, v: number | null | undefined) => (kind === "new_events" ? (v == null ? "-" : `${v.toLocaleString()}건/일`) : pct(v));
const pText = (p: number | null) => (p == null ? "-" : p < 0.01 ? "1% 미만" : `${Math.round(p * 100)}%`);
const hm = (s?: string | null) => (s ? s.slice(5, 16) : "-");

// 이 브라우저에서 이미 본 결과(오더 키 → 마지막 회차). 모니터의 새 결과 점과 목록의 "새 결과" 표시에 쓴다
export const dataSeenKey = (name: string) => `office-seen-data:${name}`;
export function readDataSeen(name: string): Record<string, string> | null {
  try {
    const v = JSON.parse(localStorage.getItem(dataSeenKey(name)) ?? "null");
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
}
export function writeDataSeen(name: string, seen: Record<string, string>) {
  try {
    localStorage.setItem(dataSeenKey(name), JSON.stringify(seen));
  } catch {}
}

function Badge({ badge }: { badge?: DataBadge }) {
  return badge ? <span className={`data-badge ${BADGE_TONE[badge] ?? "flat"}`} title={BADGE_MEANING[badge]}>{badge}</span> : null;
}

// 일별 건수 꺾은선. 가로는 칸 너비에 맞춰 늘어난다
const INK = ["var(--accent)", "var(--rev)", "var(--dev)", "var(--test)", "var(--plan)", "var(--script)"];
function Lines({ daily }: { daily: DataSummary["daily"] }) {
  const { rows, series } = daily;
  if (!rows?.length || !series?.length) return null;
  const W = 1000, H = 120;
  const max = Math.max(1, ...rows.flatMap((r) => series.map((s) => r.values[s] ?? 0)));
  const x = (i: number) => (rows.length === 1 ? W / 2 : (i / (rows.length - 1)) * W);
  const y = (v: number) => H - 3 - (v / max) * (H - 6);
  return (
    <figure className="data-lines">
      <figcaption>
        일별 건수 · {rows[0].date.slice(5)} ~ {rows.at(-1)!.date.slice(5)} · 가장 많은 날 {max.toLocaleString()}건
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`일별 건수 그래프. ${series.join(", ")}`}>
        {series.map((s, k) =>
          rows.length === 1 ? (
            <circle key={s} cx={x(0)} cy={y(rows[0].values[s] ?? 0)} r={4} fill={INK[k % INK.length]} />
          ) : (
            <polyline key={s} points={rows.map((r, i) => `${x(i)},${y(r.values[s] ?? 0)}`).join(" ")} fill="none" stroke={INK[k % INK.length]} strokeWidth={2} vectorEffect="non-scaling-stroke" />
          ),
        )}
      </svg>
      <ul>
        {series.map((s, k) => (
          <li key={s}>
            <i style={{ background: INK[k % INK.length] }} />
            {s}
          </li>
        ))}
      </ul>
    </figure>
  );
}

function Result({ d }: { d: DataDetail }) {
  const s = d.summary!, h = s.headline, dir = d.spec?.metric?.direction ?? "up";
  const rate = h?.changeRate ?? null;
  const better = rate == null || rate === 0 ? "" : (dir === "down" ? rate < 0 : rate > 0) ? " good" : " bad";
  return (
    <>
      <p className="data-one">
        <Badge badge={s.verdict} />
        {s.oneLine || "한 줄 결론이 아직 없습니다."}
      </p>
      {h && (
        <div className="data-nums">
          {h.compare && (
            <div>
              <span>{h.compare.label}</span>
              <strong>{value(s.kind, h.compare.value)}</strong>
              <small>{h.compare.n.toLocaleString()}대</small>
            </div>
          )}
          <div>
            <span>{h.compare ? h.target.label : h.metric}</span>
            <strong>{value(s.kind, h.target.value)}</strong>
            <small>{h.compare ? `${h.target.n.toLocaleString()}대` : h.target.label}</small>
          </div>
          {h.compare && (
            <div>
              <span>차이</span>
              <strong className={better.trim()}>{rate == null ? "-" : `${rate > 0 ? "▲" : rate < 0 ? "▼" : ""} ${(Math.abs(rate) * 100).toFixed(1)}%`}</strong>
              <small>우연일 가능성 {pText(h.p)}</small>
            </div>
          )}
        </div>
      )}
      {h?.compare && <p className="data-note">{h.metric}{h.requiredN ? ` · 판단하려면 약 ${h.requiredN.toLocaleString()}대가 봐야 합니다` : ""}</p>}
      <Lines daily={s.daily} />
      {d.reportMd && (
        <div className="data-md">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{d.reportMd}</ReactMarkdown>
        </div>
      )}
    </>
  );
}

// 오른쪽 모니터 창: 왼쪽에 해결된 오더 목록, 오른쪽에 고른 오더의 데이터 분석 결과 한 장. 스펙 만들기와 수집은 대시보드에 넘긴다
export function DataMonitorCard({ name, tick, onClose }: { name: string; tick?: number; onClose: () => void }) {
  const api = `/api/office/dobby-data`;
  const [items, setItems] = useState<DataItem[] | null>(null);
  const [key, setKey] = useState("");
  const [d, setD] = useState<DataDetail | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [seen, setSeen] = useState<Record<string, string>>({});
  const keyRef = useRef(key);
  keyRef.current = key;

  const loadList = useCallback(
    () =>
      fetch(api, { cache: "no-store" })
        .then((r) => r.json())
        .then((j: { items?: DataItem[] }) => {
          const list = j.items ?? [];
          setItems(list);
          setKey((k) => k || list[0]?.key || "");
          // 처음 열면 지금 있는 결과는 모두 본 것으로 둔다
          setSeen(() => {
            const saved = readDataSeen(name);
            if (saved) return saved;
            const first = Object.fromEntries(list.filter((i) => i.lastRunId).map((i) => [i.key, i.lastRunId!]));
            writeDataSeen(name, first);
            return first;
          });
        })
        .catch(() => setNote("데이터 분석 목록을 읽지 못했습니다.")),
    [api, name],
  );
  const loadOne = useCallback(
    (k: string) =>
      fetch(`${api}?key=${encodeURIComponent(k)}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((j: DataDetail & { error?: string }) => {
          if (keyRef.current !== k) return;
          if (j.error) return setNote(j.error);
          setD(j);
          if (j.lastRunId)
            setSeen((cur) => {
              if (cur[k] === j.lastRunId) return cur;
              const n = { ...cur, [k]: j.lastRunId! };
              writeDataSeen(name, n);
              return n;
            });
        })
        .catch(() => setNote("결과를 읽지 못했습니다.")),
    [api, name],
  );
  useEffect(() => void loadList(), [loadList]);
  useEffect(() => {
    setD(null);
    setNote("");
    if (key) void loadOne(key);
  }, [key, loadOne]);
  // 창을 열어 둔 사이 스펙이 생기거나 새 회차 결과가 나오면(tick 이 바뀌면) 목록과 지금 보는 오더를 다시 읽는다
  const tick0 = useRef(tick);
  useEffect(() => {
    if (tick === tick0.current) return;
    tick0.current = tick;
    void loadList();
    if (keyRef.current) void loadOne(keyRef.current);
  }, [tick, loadList, loadOne]);
  // 작업이 도는 동안 3초마다 다시 읽고, 끝나면 목록도 새로 읽는다
  const running = d?.running ?? null;
  const was = useRef<DataCmd | null>(null);
  useEffect(() => {
    if (was.current && !running) void loadList();
    was.current = running;
    if (!running || !key) return;
    const t = setInterval(() => void loadOne(key), 3000);
    return () => clearInterval(t);
  }, [running, key, loadOne, loadList]);

  async function start(cmd: DataCmd) {
    setBusy(true);
    setNote("");
    const r = await fetch(api, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key, cmd }) }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as { error?: string } | null;
    if (!r?.ok) setNote(j?.error ?? "시작하지 못했습니다.");
    await Promise.all([loadOne(key), loadList()]);
    setBusy(false);
  }
  const btn = (cmd: DataCmd, label: string, primary = false) => (
    <button type="button" className={primary ? "primary" : undefined} disabled={busy || !!running} onClick={() => void start(cmd)}>
      {label}
    </button>
  );

  return (
    <div className="art-card data-card" role="dialog" aria-label="데이터 분석">
      <CloseX onClick={onClose} />
      <div className="data-head">
        <div className="kick">오른쪽 모니터</div>
        <h4>데이터 분석</h4>
      </div>
      <div className="data-body">
        <nav className="data-list" aria-label="해결된 오더">
          {!items ? (
            <p>읽는 중입니다.</p>
          ) : items.length === 0 ? (
            <p>해결된 오더가 아직 없습니다. 오더가 해결되면 여기에 나타납니다.</p>
          ) : (
            items.map((i) => (
              <button key={i.key} type="button" aria-current={i.key === key} onClick={() => setKey(i.key)}>
                <span className="data-key">
                  {i.key}
                  {i.lastRunId && seen[i.key] !== i.lastRunId && <em>새 결과</em>}
                </span>
                <span className="data-title">{i.title}</span>
                <span className="data-state">{i.running ? <span className="data-badge run">{i.running === "spec" ? "스펙 만드는 중" : "수집 중"}</span> : i.verdict ? <Badge badge={i.verdict} /> : STATE_NAME[i.state]}</span>
              </button>
            ))
          )}
        </nav>
        <section className="data-pane" aria-live="polite">
          {!key ? null : !d ? (
            <p>읽는 중입니다.</p>
          ) : (
            <>
              <h5>
                {d.key} <span>{d.title}</span>
              </h5>
              {d.state === "result" ? (
                <Result d={d} />
              ) : d.state === "none" ? (
                <p>아직 무엇을 잴지 정하지 않았습니다. 스펙 만들기를 누르면 이 오더의 코드 변경을 읽어 볼 지표와 기록을 정합니다.</p>
              ) : d.state === "na" ? (
                <>
                  <p>이 오더는 사용자 행동 기록으로 성과를 볼 수 없습니다.</p>
                  {d.spec?.reason && <p className="data-note">{d.spec.reason}</p>}
                </>
              ) : (
                <>
                  <p>무엇을 잴지는 정해졌고, 아직 데이터를 모으지 않았습니다.</p>
                  <dl>
                    {d.spec?.metric && (
                      <>
                        <dt>볼 지표</dt>
                        <dd>{d.spec.metric.name}</dd>
                      </>
                    )}
                    <dt>라이브 배포일</dt>
                    <dd>{d.spec?.liveDate ?? "-"}</dd>
                    <dt>모을 기간</dt>
                    <dd>{d.from ?? "-"} 부터 지금까지</dd>
                    {d.spec?.events?.length ? (
                      <>
                        <dt>볼 기록</dt>
                        <dd>{d.spec.events.map((e) => e.meaning || e.name).join(" · ")}</dd>
                      </>
                    ) : null}
                  </dl>
                </>
              )}
              {d.job && (
                <div className={`data-job ${d.job.state}`} role="status">
                  <b>{d.job.state === "running" ? CMD_NAME[d.job.cmd] : "지난 작업이 실패했습니다"}</b>
                  {d.job.lines.map((l, i) => (
                    <span key={i}>{l}</span>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>
      <div className="row data-foot">
        {d?.summary && (
          <span className="data-note">
            집계 {hm(d.summary.startAt)} ~ {hm(d.summary.coveredUntil)} · {d.summary.runs}회차
          </span>
        )}
        {note && <span role="status">{note}</span>}
        <span className="sp" />
        {d && (
          <a href={d.url} target="_blank" rel="noopener noreferrer">
            대시보드에서 자세히 보기
          </a>
        )}
        {d && (d.state === "none" ? btn("spec", "스펙 만들기", true) : d.state === "na" ? btn("spec", "스펙 다시 만들기") : btn("run", running === "run" ? "수집 중…" : d.state === "result" ? "이어서 수집" : "데이터 수집", true))}
      </div>
    </div>
  );
}
