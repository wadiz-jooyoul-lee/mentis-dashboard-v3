/** /do 오더 성능 측정 결과(perf.json). 숫자는 go-dobby 측정 헬퍼가, summary 만 측정 세션이 쓴다. */

export type PerfTokens = { cacheRead: number; input: number; output: number };

export type PerfStage = {
  stage: string;
  sessions: number;
  min: number;
  baselineMin: number;
  modelMin?: number;
  toolMin?: number;
  tokens?: PerfTokens;
};

export type PerfItem = {
  id: string;
  name: string;
  /** true 적용됨, false 해당 없음, null 측정 못 함 */
  applied: boolean | null;
  evidence: string;
  savedMin: number | null;
  tokenDelta: number | null;
  note?: string;
};

/**
 * 한 구간의 컨텍스트 크기. 호출 하나의 컨텍스트 크기는 새 입력 + 캐시 쓰기 + 캐시 읽기다.
 * 이어 쓴 구간인데 이 오더에 새로 시작한 세션이 없으면 floor·carry·floorSum·carrySum·growthSum 이 null 이다.
 */
export type PerfCtx = {
  /** 고정 바닥: 새 세션은 첫 호출 크기, 이어 쓴 구간은 이 오더 새 세션 첫 호출 크기의 가운데 값 */
  floor: number | null;
  /** 이월된 대화: 이어 쓴 구간의 첫 호출 크기 − 고정 바닥 */
  carry: number | null;
  first: number | null;
  last: number | null;
  peak: number | null;
  /** 입력 합계: 호출별 컨텍스트 크기의 합 */
  sum: number;
  floorSum: number | null;
  carrySum: number | null;
  growthSum: number | null;
  /** 호출별 컨텍스트 크기 */
  series: number[];
};

export type PerfSubagents = {
  calls: number;
  tokens: { cacheRead: number; cacheWrite: number; input: number; output: number };
};

export type PerfTokenFlow = {
  /** 이 오더 새 세션 첫 호출 크기의 가운데 값. 새 세션이 없으면 null */
  floorRef: number | null;
  sum: number;
  floorSum: number;
  carrySum: number;
  growthSum: number;
  cacheRead: number;
  cacheWrite: number;
  /** 캐시를 거치지 않은 입력만이다. PerfTokens.input(캐시 안 쓴 입력 + 캐시 쓰기)과 다르다 */
  input: number;
  output: number;
  /** 비용이 기록된 세션의 합. 하나도 없으면 null */
  costUsd: number | null;
  costSessions: number;
  /** 사람과 대화한 세션의 입력 합계 */
  interactiveSum: number;
  /** 사람과 대화한 세션에서 이 오더의 어느 구간에도 들지 않아 뺀 호출 */
  excluded?: { calls: number; sum: number; note?: string };
  /** 서브 에이전트 몫. 위 합계에는 들어 있지 않다 */
  subagents?: PerfSubagents | null;
};

export type PerfSession = {
  id: string;
  stage: string;
  group: string;
  interactive: boolean;
  missing?: boolean;
  start: string;
  end: string;
  min: number;
  sleepMin: number;
  calls: number;
  tokens?: PerfTokens;
  parallelWith?: string | null;
  /** 아래는 토큰 흐름 칸. 옛 perf.json 에는 없다 */
  resumed?: boolean;
  ctx?: PerfCtx;
  cacheWrite?: number;
  cacheHitRate?: number | null;
  /** 캐시를 다시 쓴 호출의 순번(1부터) */
  cacheRewrites?: number[];
  /** 컨텍스트가 압축된 호출의 순번(1부터) */
  compactions?: number[];
  costUsd?: number | null;
  subagents?: PerfSubagents;
};

export type PerfData = {
  key: string;
  measuredAt: string;
  pluginVersion: string;
  status: string;
  totals: {
    wallMin: number;
    baselineMin: number;
    savedMin: number;
    humanWaitMin: number;
    sleepMin: number;
    tokens: PerfTokens;
    baselineTokens: PerfTokens;
  };
  sleepLog?: string;
  interactive?: { sessions: number; min: number; tokens?: PerfTokens };
  byStage: PerfStage[];
  tokenFlow?: PerfTokenFlow;
  items: PerfItem[];
  sessions: PerfSession[];
  humanWaits?: { start: string; end: string; min: number }[];
  method?: string;
  summary?: string;
};

export function parsePerfJson(raw: string | null): PerfData | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as PerfData;
    return o?.totals && Array.isArray(o.byStage) && Array.isArray(o.items) && Array.isArray(o.sessions) ? o : null;
  } catch {
    return null;
  }
}

/** 분은 소수 첫째 자리까지. */
export const fmtMin = (n: number | null | undefined) => (n == null ? "-" : `${(Math.round(n * 10) / 10).toFixed(1)}분`);

/** 토큰은 "만" 단위. */
export const fmtMan = (n: number | null | undefined) => (n == null ? "-" : `${Math.round(n / 10000).toLocaleString()}만`);

/** 토큰을 "만" 단위로, 작은 값은 소수 자리까지(5.27만, 58.0만, 2,222만). 천 미만은 그대로 적는다. */
export function fmtManFine(n: number | null | undefined): string {
  if (n == null) return "-";
  if (Math.abs(n) < 1000) return Math.round(n).toLocaleString();
  const v = n / 10000;
  if (Math.abs(v) >= 100) return `${Math.round(v).toLocaleString()}만`;
  if (Math.abs(v) >= 10) return `${v.toFixed(1)}만`;
  return `${v.toFixed(2).replace(/0$/, "")}만`;
}

export const fmtUsd = (n: number | null | undefined) => (n == null ? "기록 없음" : `$${n.toFixed(2)}`);

export const sumTokens = (t: PerfTokens | undefined) => (t ? t.cacheRead + t.input + t.output : 0);

/** "2026-11-16 08:32:19" 같은 지역 시각을 분 단위 숫자로. */
export function toMinutes(s: string): number {
  return new Date(s.replace(" ", "T")).getTime() / 60000;
}
