import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { TableRole } from "@/lib/office/core/types";
import { roleOfSlug } from "@/lib/office/floor";
import { summarizeRuns } from "@/lib/office/test/testSummary";

// 탁자 확대 창의 카드 보기가 쓰는 오더 상세. 메타를 읽기만 한다
export interface CrewDetailRow { slug: string; role: TableRole; name: string; desc: string; state: string; round: string; start: string; at: string; todo: string }
export interface ShipRow { repo: string; env: string; stage: string; pr: string; build: string; at: string; note: string }
export interface CrewDetail {
  auto: string; // 상태 문서 「자동 실행」 줄
  events: string[]; // 이벤트 로그 마지막 세 줄
  rows: CrewDetailRow[];
  planner: { changes: number; ack: boolean };
  review: { round: number; counts: Record<string, number>; titles: { sev: string; title: string }[] } | null;
  ship: ShipRow[];
  test: { label: string; env: string; pass: number; fail: number; skip: number; bad: { num: string; name: string; verdict: string; note: string }[] } | null;
}

const read = (f: string) => {
  try {
    return readFileSync(f, "utf8");
  } catch {
    return null;
  }
};
const section = (text: string | null, head: RegExp) => text?.split(/^## /m).find((s) => head.test(s)) ?? "";
// 마크다운 표를 머리 칸 이름으로 읽는다
const table = (sec: string) => {
  const rows = sec.split("\n").filter((l) => l.startsWith("|")).map((l) => l.split("|").slice(1, -1).map((c) => c.replace(/\*\*/g, "").trim()));
  const head = rows[0] ?? [];
  const body = rows.slice(1).filter((r) => !r.every((c) => /^:?-*:?$/.test(c)));
  return body.map((r) => (n: string) => r[head.indexOf(n)] ?? "");
};
const SEV = ["blocker", "major", "minor", "nit"];

export function readCrewDetail(meta: string, key: string): CrewDetail {
  const dir = join(meta, key);
  const status = read(join(dir, "status.md")), orch = read(join(dir, "orchestration.md"));
  const auto = status?.match(/^- \*\*자동 실행\*\*:\s*(.*)$/m)?.[1]?.trim() ?? "";
  const events = section(orch, /^이벤트 로그/).split("\n").filter((l) => l.startsWith("- ")).slice(-3).map((l) => l.slice(2)).reverse();
  const rows = table(section(orch, /^에이전트 상태표/)).map((c) => {
    const slug = c("슬러그") || c("에이전트");
    return { slug, role: roleOfSlug(slug), name: c("이름"), desc: c("설명"), state: c("상태"), round: c("라운드"), start: c("착수"), at: c("갱신"), todo: c("사람 할 일") };
  }).filter((r) => r.slug);
  // 기획자: 변경 접수 수(지난 세션 표에서 변경 번호를 센다)와 사람의 설계 확인
  const changes = new Set(table(section(status, /^지난 세션/)).map((c) => c("단계").match(/^변경 (\d+) 접수/)?.[1]).filter(Boolean)).size;
  let ack = false;
  try {
    ack = "사용자" in JSON.parse(read(join(dir, "design-ack.json")) ?? "{}");
  } catch {}
  return { auto, events, rows, planner: { changes, ack }, review: readReview(dir), ship: readShip(status), test: readTest(dir) };
}

// 가장 최근 리뷰 회차의 지적 제목과 심각도별 수
function readReview(dir: string): CrewDetail["review"] {
  let rounds: number[];
  try {
    rounds = readdirSync(join(dir, "reviews")).map((d) => Number(d.match(/^round-(\d+)$/)?.[1])).filter((n) => n > 0);
  } catch {
    return null;
  }
  if (!rounds.length) return null;
  const round = Math.max(...rounds), rd = join(dir, "reviews", `round-${round}`);
  const counts: Record<string, number> = {}, titles: { sev: string; title: string }[] = [];
  for (const f of readdirSync(rd).filter((f) => f.endsWith(".md"))) {
    for (const m of (read(join(rd, f)) ?? "").matchAll(/^#{2,4}\s*\[(blocker|major|minor|nit)\]\s*(.+)$/gm)) {
      counts[m[1]] = (counts[m[1]] ?? 0) + 1;
      titles.push({ sev: m[1], title: m[2].replace(/`/g, "").trim() });
    }
  }
  titles.sort((a, b) => SEV.indexOf(a.sev) - SEV.indexOf(b.sev));
  return { round, counts, titles };
}

function readShip(status: string | null): ShipRow[] {
  return table(section(status, /^배포\s*\n/)).map((c) => ({ repo: c("저장소"), env: c("환경"), stage: c("단계"), pr: c("PR"), build: c("빌드"), at: c("갱신"), note: c("비고") }));
}

// 가장 최근 검증 회차의 판정 수와 실패·보류 항목
function readTest(dir: string): CrewDetail["test"] {
  const s = summarizeRuns(dir);
  const last = s?.runs.at(-1);
  if (!s || !last) return null;
  const items = s.envs.find((e) => e.env === last.env)?.items ?? [];
  const bad = items.filter((i) => i.runs.includes(last.no) && (i.verdict === "fail" || i.verdict === "skip")).map((i) => ({ num: i.num, name: i.name, verdict: i.verdict, note: i.note }));
  return { label: last.label, env: last.env, pass: last.pass, fail: last.fail, skip: last.skip, bad };
}
