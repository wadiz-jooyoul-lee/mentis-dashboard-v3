import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { listKeys, readOrder } from "@/lib/office/source";

// /do 오더 회고(retro.json). 숫자는 go-dobby 측정 헬퍼가, 나머지는 회고 세션이 쓴다
export type RetroTotal = { cost: number; time: number };
export interface RetroData {
  basis: { phase: string; lastSession: string; changes: number; testRounds: number; madeAt: string };
  measure: {
    fastPct: number;
    sessions: number;
    medians: { start: number | null; first: number | null; startup: number | null };
    totals: { actual: RetroTotal; allNew: RetroTotal; rule: RetroTotal; best: RetroTotal };
    byStage: { group: string; sessions: number; cost: number }[];
    segments: { when: string; stage: string; mode: string; cost: number; altCost?: number; diffPct?: number; judge: string }[];
  };
  summary?: string;
  sessionFindings?: { title: string; why?: string }[];
  ruleProposals?: { title: string; target: string; value: string; why?: string }[];
  defects?: {
    title: string;
    foundAt: string;
    couldAt?: string;
    judgment?: string;
    what?: string;
    why?: string;
    prevent?: string;
    causes?: string[];
    fixes?: { where: string; target?: string; change: string }[];
  }[];
  proposals?: { type?: string; title: string; target?: string; text?: string }[];
}
// 책장 목록에 보일 한 줄
export interface RetroItem { key: string; title: string; madeAt: string; summary: string; defects: number; actual: number; allNew: number }

const KEY = /^([A-Za-z][A-Za-z0-9]*-[0-9]+|TASK-[A-Za-z0-9-]+)$/;

export function readRetro(meta: string, key: string): RetroData | null {
  if (!KEY.test(key)) return null;
  try {
    const o = JSON.parse(readFileSync(join(meta, key, "retro.json"), "utf8")) as RetroData;
    return o?.basis && o?.measure?.totals ? o : null;
  } catch {
    return null;
  }
}

// 회고록이 있는 오더 전부. 최근에 만든 것부터
export function readRetros(meta: string): RetroItem[] {
  const out: (RetroItem & { at: number })[] = [];
  for (const key of listKeys(meta)) {
    const f = join(meta, key, "retro.json");
    if (!KEY.test(key) || !existsSync(f)) continue;
    const r = readRetro(meta, key);
    if (!r) continue;
    out.push({
      key,
      title: readOrder(meta, key)?.title ?? key,
      madeAt: r.basis.madeAt,
      summary: r.summary ?? "",
      defects: r.defects?.length ?? 0,
      actual: r.measure.totals.actual.cost,
      allNew: r.measure.totals.allNew.cost,
      at: statSync(f).mtimeMs,
    });
  }
  return out.sort((a, b) => b.at - a.at).map(({ at: _, ...r }) => r);
}
