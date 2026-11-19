import type { Book } from "@/lib/office/core/types";
import type { RetroData } from "@/lib/office/retro";
import type { Scenario } from "@/lib/office/test/parseReport";
import type { PlanScenario } from "@/lib/office/test/testPlan";
import type { RunLine, TestSummary } from "@/lib/office/test/testSummary";

// 펼친 책 한 권의 내용. 4단계(RecordBuilder)가 생기기 전까지는 책 정보로 만든 목업이다
export interface TaskRecord {
  key: string;
  title: string;
  doneAt: string;
  mins: number;
  pr: number;
  lines: number;
  completeness: string;
  crew: string[];
  request: { text: string; criteria: [string, string][] };
  process: [string, string][];
  // summary: 결과 요약 마크다운. products: 코드가 아닌 산출물(이름 · 본문 마크다운, 글이 아닌 파일은 본문이 빈 값). uploads: 산출물을 올린 곳(종류 · 주소)
  output: { pr: string; stat: string; summary?: string; patch: { kind: "" | "add" | "del"; line: string }[]; products?: [string, string][]; uploads?: [string, string][] };
  tests: { env: string; rows: [string, string, string, string?][] }; // 번호 · 내용 · 판정 · 근거
  noTest?: boolean; // 검증이 없는 오더(테스터를 켜지 않은 도비 오더). 테스트 장을 싣지 않는다
  procName?: string; // 과정 장의 이름. 없으면 "구현 과정"
  done: [string, string][];
  design?: string; // 구현 지시서 전문. 진행 중이면 가장 최근 판
  qa?: [string, string, string, string][]; // QA 로 가져온 버그: 버그키 · 제목 · 결과 · 수정 요약
  dobby?: DobbyBookExtra; // 도비 사무실 작업 책에만 있는 장
}

export type Verdict = "pass" | "fail" | "hold";
// 검증 장 자료: 회차 통합 집계, 테스트 계획의 시나리오 전체, 회차마다 항목과 본문 전체(최신 회차부터)
export interface VerifyData {
  summary: TestSummary | null;
  plan: PlanScenario[];
  runs: (RunLine & { items: Scenario[]; rest: string })[]; // rest: 시나리오 표를 뺀 회차 문서 본문
}
// 도비 작업 책의 앞쪽 장(무엇을 만들었나 · 화면 · 검증(배포 상태 포함) · 회고 · 성능) 자료
export interface DobbyBookExtra {
  phase: string;
  explainer: string; // 쉬운 구현 설명(explainer.md). 없으면 결과 요약
  shots: { run: string; env: string; file: string; caption: string; verdict: Verdict | ""; side: "before" | "after" | "" }[];
  shotTotal: number; // 갈무리 전체 장 수(책에는 앞쪽 몇 장만 싣는다)
  runs: { run: string; at: string; env: string; pass: number; fail: number; hold: number }[];
  verify: VerifyData;
  ship: { repo: string; envs: { env: string; stage: string; pr: string }[]; release?: { date: string; merged: boolean } }[];
  today: string; // 라이브 반영 판정 기준일(YYYY-MM-DD)
  retro?: { data: RetroData; url: string };
  perf?: {
    measuredAt: string;
    wallMin: number;
    baselineMin: number;
    humanWaitMin: number;
    talk: { sessions: number; min: number };
    stages: { stage: string; sessions: number; min: number; baselineMin: number }[];
    tokens: number;
    baselineTokens: number;
    summary: string;
  };
}

export function mockRecord(b: Book): TaskRecord {
  return {
    key: b.key,
    title: b.title,
    doneAt: b.doneAt,
    mins: b.mins,
    pr: b.pr,
    lines: b.lines,
    completeness: "인수조건 2/2",
    design: "목업 작업이라 설계가 없습니다.",
    crew: ["기획 1", "개발 2", "리뷰 1", "테스트 1"],
    request: {
      text: `${b.key} · ${b.title}. 리워드 카드에서 남은 수량이 0인데 품절 표시가 나오지 않습니다.`,
      criteria: [
        ["AC-1", "남은 수량 0이면 품절 표시"],
        ["AC-2", "수량 정보가 없으면 판매 중 표시"],
      ],
    },
    process: [
      ["기획", `실행 경로 6곳 확인. 구현 지시서 최종 v${b.rounds > 1 ? 2 : 1}`],
      ["구현", "파일 2개 수정, 단위 테스트 3개 추가"],
      ["내부 리뷰", `${b.rounds}회. major 1건 반영`],
      ["PR 리뷰", "승인 1. 코멘트 2건 중 1건 반영, 1건 근거와 함께 미반영"],
      ["사람 확인", b.human ? "1회: 품절 기준 확정" : "없음"],
      ["실패와 처리", "게이트 타입 오류 1회, 개발자 수정 뒤 통과"],
      ["모델과 토큰", "기획 opus 42k · 개발 sonnet 61k · 리뷰 sonnet 18k · 테스트 haiku 9k"],
    ],
    output: {
      pr: `#${b.pr} (dev 머지)`,
      stat: `파일 2개 · +${Math.round(b.lines * 0.7)} −${Math.round(b.lines * 0.3)}`,
      patch: [
        { kind: "", line: "@@ RewardCard.tsx:84 @@" },
        { kind: "del", line: "-  const soldOut = stock?.remain < 1;" },
        { kind: "add", line: "+  const soldOut = (stock?.remain ?? 0) <= 0;" },
        { kind: "", line: "   return <Badge soldOut={soldOut} />;" },
      ],
    },
    tests: {
      env: "dev",
      rows: [
        ["TC-1", "남은 수량 0 → 품절 표시", "통과"],
        ["TC-2", "수량 정보 없음 → 판매 중", "통과"],
        ["단위 테스트", "3개", "통과"],
      ],
    },
    done: [
      ["인수조건", "2 / 2 충족"],
      ["남은 리뷰 지적", "minor 1 (미반영 사유 기록)"],
      ["확인 못 한 것", "없음"],
      ["판정", "완성"],
    ],
  };
}
