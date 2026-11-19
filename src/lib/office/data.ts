import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DONE } from "@/lib/office/floor";
import { listKeys, readOrder } from "@/lib/office/source";
import { selfUrl as MENTIS } from "@/lib/office/self";

// 해결된 오더의 데이터 분석(go-dobby dobby-data 가 {메타}/{키}/data/ 에 남긴 파일). 여기서는 읽기만 하고, 실행은 대시보드에 맡긴다
export type DataBadge = "수집 이상" | "성과 있음" | "나빠짐" | "판단 이르다" | "차이 없음" | "수집 확인";
export type DataSide = { label: string; x?: number; n: number; value: number | null };
export type DataHeadline = { metric: string; target: DataSide; compare: DataSide | null; changeRate: number | null; p: number | null; requiredN: number | null };
export interface DataSpec {
  kind: string;
  title?: string;
  liveDate?: string;
  startAt?: string;
  reason?: string;
  notes?: string;
  events?: { name: string; category: string; action?: string; label?: string; meaning?: string }[];
  metric?: { name: string; direction: "up" | "down" };
}
export interface DataSummary {
  kind: string;
  title: string | null;
  startAt: string;
  coveredUntil: string;
  runs: number;
  lastRunId: string;
  verdict: DataBadge;
  headline: DataHeadline | null;
  daily: { series: string[]; rows: { date: string; values: Record<string, number> }[] };
  oneLine: string;
}
export type DataCmd = "spec" | "run";
// none: 스펙 없음, na: 측정 불가, ready: 스펙은 있고 아직 모으지 않음, result: 결과 있음
export type DataState = "none" | "na" | "ready" | "result";
export interface DataItem { key: string; title: string; state: DataState; verdict?: DataBadge; oneLine?: string; lastRunId?: string; running: DataCmd | null }
export interface DataJob { cmd: DataCmd; state: "running" | "done" | "failed"; lines: string[] }
export interface DataDetail extends DataItem {
  spec: DataSpec | null;
  summary: DataSummary | null;
  reportMd: string | null;
  from: string | null; // 다음 회차가 모으기 시작할 시각
  job: DataJob | null;
  url: string;
}

const KEY_RE = /^[A-Z][A-Z0-9]+-\d+$/;
export const isDataKey = (key: string) => KEY_RE.test(key) && !key.startsWith("TASK-");
export const dataJobId = (cmd: DataCmd, key: string) => (cmd === "spec" ? `data-spec-${key}` : `data-${key}`);

function json<T>(f: string): T | null {
  try {
    return JSON.parse(readFileSync(f, "utf8")) as T;
  } catch {
    return null;
  }
}

function item(meta: string, key: string): Omit<DataItem, "running"> & { spec: DataSpec | null; summary: DataSummary | null } {
  const dir = join(meta, key, "data");
  const spec = json<DataSpec>(join(dir, "spec.json"));
  const summary = json<DataSummary>(join(dir, "summary.json"));
  const state: DataState = summary ? "result" : !spec ? "none" : spec.kind === "not_measurable" ? "na" : "ready";
  const title = readOrder(meta, key)?.title ?? summary?.title ?? spec?.title ?? key;
  return { key, title, state, verdict: summary?.verdict, oneLine: summary?.oneLine, lastRunId: summary?.lastRunId, spec, summary };
}

// 바뀜을 알아채는 데 쓰는 짧은 값과, 바뀌었을 때 이벤트 줄에 적을 글. 동기화 틱이 5초마다 부른다
export function dataMark(meta: string, key: string): { sig: string; text: (before: string) => string } {
  const { state, summary } = item(meta, key);
  const sig = `${state}:${summary?.lastRunId ?? ""}`;
  const text = (before: string) =>
    state === "result" ? `${key} 데이터 분석 ${summary!.runs}회차 결과: ${summary!.verdict}` : state === "ready" && before.startsWith("none") ? `${key} 데이터 분석: 무엇을 잴지 정했습니다(스펙 완성)` : state === "na" ? `${key} 데이터 분석: 측정할 수 없는 오더로 정리했습니다` : "";
  return { sig, text };
}

// 대상: Jira 키이고, 해결됐거나 정리가 끝난 /do 오더. 이미 data/ 가 있는 오더도 넣는다(예전 방식으로 진행한 오더)
export function listData(meta: string): Omit<DataItem, "running">[] {
  const rank: Record<DataState, number> = { result: 0, ready: 1, none: 2, na: 3 };
  return listKeys(meta)
    .filter(isDataKey)
    .filter((key) => {
      if (existsSync(join(meta, key, "data"))) return true;
      const o = readOrder(meta, key);
      return !!o && (o.ended || DONE.includes(o.phase));
    })
    .map((key) => {
      const { spec: _s, summary: _m, ...rest } = item(meta, key);
      return rest;
    })
    .sort((a, b) => rank[a.state] - rank[b.state] || (b.lastRunId ?? "").localeCompare(a.lastRunId ?? "") || b.key.localeCompare(a.key, undefined, { numeric: true }));
}

export function readData(meta: string, key: string): Omit<DataDetail, "running" | "job" | "url"> {
  const it = item(meta, key);
  let reportMd: string | null = null;
  try {
    reportMd = readFileSync(join(meta, key, "data", "report.md"), "utf8");
  } catch {}
  // 끝난 회차(stats.json 이 있는 것) 중 마지막의 끝 시각부터 다음 회차가 시작한다
  let from = it.spec && it.state !== "na" ? (it.spec.startAt ?? null) : null;
  try {
    const runs = join(meta, key, "data", "runs");
    for (const id of readdirSync(runs).sort()) {
      const w = existsSync(join(runs, id, "stats.json")) ? json<{ to?: string }>(join(runs, id, "window.json")) : null;
      if (w?.to) from = w.to;
    }
  } catch {}
  return { ...it, reportMd, from };
}


// 대시보드에 그 오더의 데이터 작업 상태를 묻는다. 대시보드가 꺼져 있으면 null
export async function dataJob(key: string, cmd: DataCmd): Promise<DataJob | null> {
  try {
    const r = await fetch(`${MENTIS()}/api/orders?key=${encodeURIComponent(dataJobId(cmd, key))}`, { cache: "no-store", signal: AbortSignal.timeout(2000) });
    const j = (await r.json()) as { state?: string; feed?: { kind: string; text: string }[] };
    if (!j.state || j.state === "none") return null;
    const lines = (j.feed ?? []).filter((f) => f.kind !== "system" && f.text.trim()).slice(-4).map((f) => f.text.trim().slice(0, 200));
    return { cmd, state: j.state === "running" ? "running" : j.state === "done" ? "done" : "failed", lines };
  } catch {
    return null;
  }
}

// 지금 도는 작업. 스펙 만들기와 수집은 한 오더에서 함께 돌지 않는다
export async function runningOf(key: string): Promise<DataCmd | null> {
  const [s, r] = await Promise.all([dataJob(key, "spec"), dataJob(key, "run")]);
  return s?.state === "running" ? "spec" : r?.state === "running" ? "run" : null;
}
