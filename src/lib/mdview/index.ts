/*
 * md 가공 레이어 — 메타 문서(md)를 원문 그대로 그리지 않고, 화면이 쓸 구조로 바꾼다.
 *
 * 규칙
 * - 전부 순수 함수다(입력 글 → 출력 값). 파일·네트워크를 만지지 않는다.
 * - 모양을 못 알아보면 **null** 을 돌려준다. 뷰는 null 을 받으면 기존 문서 렌더(MarkdownDoc)로 조용히 떨어진다.
 *   md 형식이 조금 바뀌어도 화면이 깨지거나 비지 않게 하려는 것이다.
 * - 이미 있는 파서(parseOrchestration·reviewCards·parseReport)를 고치지 않고 감싸서 쓴다.
 */
import { parseOrchestration, type AgentRow, type EventRow } from "@/lib/parseOrchestration";
import { isBlocking, parseReview, type ReviewDoc, type Severity } from "@/lib/reviewCards";
import { parseReport, type Verdict } from "@/lib/parseReport";

function safe<T>(fn: () => T | null): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}

/* ── 좌석 보드: orchestration.md 의 에이전트 상태표 ── */
export type Seat = { slug: string; name: string; state: string; round: string; row: AgentRow };

export function seatsOf(orchestrationMd: string): Seat[] | null {
  return safe(() => {
    const o = parseOrchestration(orchestrationMd);
    if (!o.agents.length) return null;
    return o.agents.map((a) => ({ slug: a.agent, name: a.name || a.agent, state: a.state, round: a.round, row: a }));
  });
}

/* ── 단계: status.md 의 "## 현재 단계" 절 ── */
export type StageBasis = { label: string; value: string };
export type Stage = { stage: string; at: string | null; basis: StageBasis[] };

export function stageOf(statusMd: string): Stage | null {
  return safe(() => {
    const lines = statusMd.split("\n");
    const start = lines.findIndex((l) => /^##\s*현재 단계\s*$/.test(l.trim()));
    if (start < 0) return null;
    const basis: StageBasis[] = [];
    for (let i = start + 1; i < lines.length && !/^##\s/.test(lines[i]); i++) {
      const m = lines[i].match(/^\s*[-*]\s*\*\*(.+?)\*\*\s*[:：]\s*(.*)$/);
      if (m) basis.push({ label: m[1].trim(), value: m[2].trim() });
    }
    const st = basis.find((b) => b.label === "단계");
    if (!st || !st.value) return null;
    const at = basis.find((b) => b.label === "갱신")?.value ?? null;
    return { stage: st.value, at, basis: basis.filter((b) => b !== st) };
  });
}

/* ── 타임라인: orchestration.md 의 이벤트 로그 ── */
export type Tick = {
  ts: string;
  text: string;
  /** 바로 위(더 최근) 항목과의 간격(분). 시각을 못 읽으면 null */
  gapMin: number | null;
};

function toMs(ts: string): number | null {
  const m = ts.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime();
}

/** 이벤트 목록(최신 먼저) 또는 orchestration.md 원문을 받아 간격이 붙은 항목으로. 항목이 없으면 null */
export function timelineOf(src: EventRow[] | string): Tick[] | null {
  return safe(() => {
    const events = typeof src === "string" ? parseOrchestration(src).events : src;
    if (!events.length) return null;
    return events.map((e, i) => {
      const cur = toMs(e.time);
      const prev = i > 0 ? toMs(events[i - 1].time) : null;
      return {
        ts: e.time,
        text: e.text,
        gapMin: cur !== null && prev !== null ? Math.round(Math.abs(prev - cur) / 60000) : null,
      };
    });
  });
}

/* ── 리뷰 카드: reviews/round-N/*.md ── */
export type Finding = {
  severity: Severity;
  blocking: boolean;
  /** 지적이 가리키는 첫 파일 경로(`path:줄` 꼴). 없으면 빈 문자열 */
  file: string;
  claim: string;
  fit: "same" | "diff" | null;
  fitText: string;
  body: string;
};
export type Review = { doc: ReviewDoc; findings: Finding[] };

const FILE_RE = /`?((?:src|app|lib|scripts|components|docs|packages)\/[\w./\-[\]()@]+?(?::\d+(?:-\d+)?)?)`?(?=[\s,)·]|$)/;

export function reviewOf(md: string): Review | null {
  return safe(() => {
    const doc = parseReview(md);
    if (!doc || !doc.findings.length) return null;
    return {
      doc,
      findings: doc.findings.map((f) => ({
        severity: f.severity,
        blocking: isBlocking(f.severity),
        file: (f.title.match(FILE_RE) ?? f.body.match(FILE_RE))?.[1] ?? "",
        claim: f.title,
        fit: f.fit,
        fitText: f.fitText,
        body: f.body,
      })),
    };
  });
}

/* ── 판정 그리드: test-runs/{회차}/result.md 의 시나리오 표 ── */
export type VerdictCell = { tc: string; verdict: Verdict; basis: string; check: string };

export function verdictsOf(resultMd: string): VerdictCell[] | null {
  return safe(() => {
    const r = parseReport(resultMd);
    if (!r.scenarios.length) return null;
    return r.scenarios.map((s, i) => ({
      tc: s.num || `#${i + 1}`,
      verdict: s.verdict,
      basis: s.evidence || s.actual || "",
      check: s.check || s.page || "",
    }));
  });
}
