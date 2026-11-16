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
  parallelWith?: string | null;
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

export const sumTokens = (t: PerfTokens | undefined) => (t ? t.cacheRead + t.input + t.output : 0);

/** "2026-11-16 08:32:19" 같은 지역 시각을 분 단위 숫자로. */
export function toMinutes(s: string): number {
  return new Date(s.replace(" ", "T")).getTime() / 60000;
}
