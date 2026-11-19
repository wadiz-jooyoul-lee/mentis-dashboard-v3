import { execFile } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { getMetaDir } from "@/lib/issues";
import { goDobbyLib } from "@/lib/jobs";
import type { Progress, SeatRole, TableRole } from "@/lib/office/core/types";

// roles: 상태 문서의 담당자 줄에 켜진 자리(정해진 순서). 줄이 없는 옛 오더는 null 이고 지금까지처럼 다섯 자리로 그린다
// product: 리뷰와 수정, 통합이 지금 산출물을 다루는 중이다(리뷰 대상 줄)
// light: 한 세션 실행(진행 방식 줄이 light 로 시작하고 중단되지 않음). 깃발에 light 를 붙인다
export interface Order { key: string; title: string; phase: string; mtime: number; sessions: Map<string, string>; ended: boolean; roles: TableRole[] | null; product: boolean; light: boolean; docs: boolean }
export interface CrewRow { slug: string; name: string; state: string; round: number; at: string; desc: string } // at: 갱신 칸(YYYY-MM-DD HH:MM), desc: 설명 칸
export interface Judge { key: string; group: string; text: string; cmd: string; action: string; env: string; link: string; kind: string }

const read = (f: string) => {
  try {
    return readFileSync(f, "utf8");
  } catch {
    return null;
  }
};
const shq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
const CFG = join(homedir(), ".config/go-dobby/config.env");

// 메타 경로. DOBBY_META 가 있으면 그것(시험용 복사본), 없으면 대시보드와 같은 규칙(getMetaDir)으로 정한다.
// 같은 서버에서 두 화면이 같은 오더를 그리도록 대시보드의 데모 메타(ORCHESTRATION_META_PATH)도 그대로 따른다
export function metaDir(): string | null {
  return process.env.DOBBY_META || getMetaDir();
}

// 오피스가 데모 메타(.demo-meta)를 보고 있는지. 데모 바와 데모 연출(작업 테이블만 펴기)이 이것으로 켜진다
export const isDemoMeta = () => basename(metaDir() ?? "") === ".demo-meta";

// 설치된 go-dobby 중 가장 높은 판의 dobby-lib.sh. 대시보드의 것 하나로 통일했다(GO_DOBBY_LIB 규칙 포함)
export const dobbyLib = goDobbyLib;

// 상태 파일들의 수정 시각 중 늦은 것. 없으면 0. 질문 파일도 본다(질문이 생기거나 답이 달리면 다시 맞춘다)
export function mtimeOf(meta: string, key: string): number {
  let m = 0;
  for (const f of ["status.md", "orchestration.md", "qa-watch.md", "qa/work-result.md", "ask.json"]) {
    try {
      m = Math.max(m, statSync(join(meta, key, f)).mtimeMs);
    } catch {}
  }
  return m;
}

// 담당자 줄의 표시 이름 → 테이블 자리. 순서는 go-dobby 의 담당자 순서와 같다
const ROLE_OF_NAME: [string, TableRole][] = [["기획자", "planner"], ["개발자", "developer"], ["산출자", "producer"], ["리뷰어", "reviewer"], ["배포담당", "deployer"], ["테스터", "tester"]];
// 상태 문서의 `- **담당자**: 기획자, 산출자, 리뷰어` 줄. 줄이 없으면 null(이 줄이 생기기 전의 오더)
// 줄은 있는데 아는 담당자가 하나도 없으면(설계 세션이 담당자를 정하기 전에 빈 줄을 먼저 쓴다) 아직 정하지 않은 것으로 보고 null.
// 빈 배열을 돌려주면 사무실이 "담당자 0명"으로 읽어 접수 때 앉힌 사람들을 모두 쉬러 보낸다
export function parseRoles(status: string): TableRole[] | null {
  const line = status.match(/^[ \t]*-[ \t]*\*\*담당자\*\*:[ \t]*(.*)$/m)?.[1];
  if (line == null) return null;
  const on = line.split(",").map((r) => r.trim());
  const roles = ROLE_OF_NAME.filter(([n]) => on.includes(n)).map(([, r]) => r);
  return roles.length ? roles : null;
}

// /do 오더 하나(## 지난 세션 표가 있는 것). 아니거나 없으면 null
export function readOrder(meta: string, key: string): Order | null {
  const text = read(join(meta, key, "status.md"));
  if (!text || !/^## 지난 세션/m.test(text)) return null;
  const field = (n: string) => text.match(new RegExp(`\\*\\*${n}\\*\\*[ \\t]*[:：][ \\t]*([^\\n]*)`))?.[1].replace(/\*/g, "").trim() ?? "";
  const sessions = new Map<string, string>();
  const past = text.split(/^## /m).find((s) => s.startsWith("지난 세션")) ?? "";
  for (const l of past.split("\n")) {
    const c = l.split("|").map((x) => x.replace(/`/g, "").trim());
    if (c.length > 4 && /^[0-9a-f-]{36}$/.test(c[3])) sessions.set(c[3], c[2]);
  }
  return { key, title: field("제목") || key, phase: field("단계"), mtime: mtimeOf(meta, key), sessions, ended: worktreesGone(text), roles: parseRoles(text), product: field("리뷰 대상") === "산출물", light: /^light(?! \(중단)/.test(field("진행 방식")), docs: /^(대기|작성 중)/.test(field("결과 문서")) };
}

// status.md 워크트리 표의 경로들(~ 는 집 폴더로 푼다)
function worktreePaths(text: string): string[] {
  const sec = text.split(/^## /m).find((s) => s.startsWith("워크트리")) ?? "";
  const rows = sec.split("\n").filter((l) => l.startsWith("|")).map((l) => l.split("|").slice(1, -1).map((c) => c.replace(/`/g, "").trim()));
  const at = (rows[0] ?? []).indexOf("경로");
  return at >= 0 ? rows.slice(1).map((r) => r[at]).filter((p) => p && !/^-+$/.test(p)).map((p) => p.replace(/^~/, homedir())) : [];
}

// 워크트리 표의 경로가 하나 이상 있고 모두 지워졌으면 정리가 끝난 오더다(대시보드의 종료 판정과 같다)
function worktreesGone(text: string): boolean {
  const paths = worktreePaths(text);
  return paths.length > 0 && paths.every((p) => !existsSync(p));
}

export function listKeys(meta: string): string[] {
  try {
    return readdirSync(meta, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith(".")).map((d) => d.name);
  } catch {
    return [];
  }
}

// orchestration.md 의 에이전트 상태표. 머리줄의 칸 이름으로 위치를 찾는다
export function readCrew(meta: string, key: string): CrewRow[] {
  const text = read(join(meta, key, "orchestration.md"));
  if (!text) return [];
  const sec = text.split(/^## /m).find((s) => s.startsWith("에이전트 상태표"));
  if (!sec) return [];
  const rows = sec.split("\n").filter((l) => l.startsWith("|")).map((l) => l.split("|").slice(1, -1).map((c) => c.replace(/\*/g, "").trim()));
  const head = rows[0] ?? [];
  const at = (n: string) => head.indexOf(n);
  const [s, nm, st, rd, up, ds] = [at("슬러그") >= 0 ? at("슬러그") : at("에이전트"), at("이름"), at("상태"), at("라운드"), at("갱신"), at("설명")];
  if (s < 0 || st < 0) return [];
  return rows
    .slice(1)
    .filter((r) => !r.every((c) => /^-*$/.test(c)) && r[s])
    .map((r) => ({ slug: r[s], name: nm >= 0 ? r[nm] : r[s], state: r[st], round: Number(r[rd]) || 0, at: up >= 0 ? r[up] : "", desc: ds >= 0 ? r[ds] : "" }));
}

// 아직 답을 받지 못한 질문(ask.json)이 있는가. 자동 실행이나 세션이 사람의 답을 기다리는 중이다
export function openAsk(meta: string, key: string): boolean {
  try {
    const j = JSON.parse(read(join(meta, key, "ask.json")) ?? "null") as { answer?: { value?: unknown } | null } | null;
    return !!j && typeof j === "object" && !Array.isArray(j) && !String(j.answer?.value ?? "").trim();
  } catch {
    return false;
  }
}

// 판정 도구(dobby_v2_next_all)로 사람 차례를 받는다. 대시보드와 같은 판정이다
export function judge(lib: string, meta: string): Promise<Judge[]> {
  const script =
    `source ${shq(CFG)} 2>/dev/null; source ${shq(lib)} >/dev/null 2>&1 || exit 4; dobby_load_config >/dev/null 2>&1 || exit 3; ` +
    `export ORCHESTRATION_META=${shq(meta)}; dobby_v2_next_all`;
  return new Promise((resolve, reject) => {
    execFile("bash", ["-c", script], { encoding: "utf8", timeout: 60_000, maxBuffer: 8 << 20 }, (err, stdout) => {
      if (err) return reject(err);
      const out: Judge[] = [];
      for (const line of stdout.split("\n")) {
        if (!line.startsWith("{")) continue;
        try {
          const j = JSON.parse(line) as Judge;
          out.push({ key: j.key, group: j.group, text: j.text, cmd: j.cmd ?? "", action: j.action ?? "", env: j.env ?? "", link: j.link ?? "", kind: j.kind ?? "" });
        } catch {}
      }
      resolve(out);
    });
  });
}

// status.md 테스트 실행 이력의 마지막 회차. 상태가 "완료"(이슈 없음)이고 실패가 0이면 통과
export function readLastTest(meta: string, key: string): { round: number; ok: boolean } | null {
  const text = read(join(meta, key, "status.md"));
  const sec = text?.split(/^## /m).find((s) => s.startsWith("테스트 실행 이력"));
  if (!sec) return null;
  const rows = sec.split("\n").filter((l) => l.startsWith("|")).map((l) => l.split("|").slice(1, -1).map((c) => c.trim()));
  const head = rows[0] ?? [];
  const last = rows.slice(1).filter((r) => !r.every((c) => /^:?-*:?$/.test(c))).at(-1);
  if (!last) return null;
  const at = (n: string) => last[head.findIndex((h) => h.startsWith(n))] ?? "";
  const fail = Number(at("성공").split("/")[1]);
  return { round: Number(at("회차")) || 0, ok: at("상태") === "완료" && fail === 0 };
}

// 글 답을 실행할 폴더: status.md 워크트리 표의 첫 경로. 없으면 메타 폴더의 위(작업 공간)
export function orderDir(meta: string, key: string): string {
  const sec = read(join(meta, key, "status.md"))?.split(/^## /m).find((s) => s.startsWith("워크트리"));
  const rows = sec?.split("\n").filter((l) => l.startsWith("|")).map((l) => l.split("|").slice(1, -1).map((c) => c.trim())) ?? [];
  const at = rows[0]?.indexOf("경로") ?? -1;
  const dir = at >= 0 ? rows.slice(1).map((r) => r[at]).find((p) => p && existsSync(p)) : undefined;
  return dir ?? join(meta, "..");
}

// ── 진행 정도: 대시보드의 테스터·개발자 막대와 같은 규칙으로 이미 있는 파일과 git 만 읽는다 ──

const verdictOf = (v: string) =>
  /❌|FAIL|실패/i.test(v) ? "fail" : /⏭️|⏭|SKIP|건너뜀|미실행|미검증/i.test(v) ? "skip" : /⚠️|⚠|주의|WARN/i.test(v) ? "pass" : /✅|PASS|통과|성공/i.test(v) ? "pass" : "";

// 최신 검증 회차(status.md 테스트 실행 이력의 마지막 줄) result.md 시나리오 표의 판정 칸을 센다. 주의는 통과로 센다
export function readTestProgress(meta: string, key: string): Progress | null {
  const sec = read(join(meta, key, "status.md"))?.split(/^## /m).find((s) => s.startsWith("테스트 실행 이력"));
  const rows = sec?.split("\n").filter((l) => l.startsWith("|")).map((l) => l.split("|").slice(1, -1).map((c) => c.trim())) ?? [];
  const head = rows[0] ?? [];
  const last = rows.slice(1).filter((r) => !r.every((c) => /^:?-*:?$/.test(c))).at(-1);
  if (!last) return null;
  const at = (n: string) => last[head.findIndex((h) => h.startsWith(n))] ?? "";
  const folder = at("폴더").replace(/`/g, "");
  const dir = folder.startsWith("/") ? folder : join(meta, key, "test-runs", folder.split("/").pop() ?? "");
  let md = read(join(dir, "result.md"));
  if (!md) return null;
  if (md.includes("<!-- dobby:scenarios -->")) md = md.split("<!-- dobby:scenarios -->")[1];
  // 판정 칸이 있는 첫 표. 회차 요약처럼 건수를 적은 표는 건너뛴다
  const tables = md.split(/\n(?!\|)/).map((b) => b.split("\n").filter((l) => l.startsWith("|")));
  const t = tables.find((r) => r.length > 2 && r[0].includes("판정") && !r[0].includes("건수"));
  if (!t) return null;
  const cells = (l: string) => l.split("|").slice(1, -1).map((c) => c.trim());
  const vi = cells(t[0]).findIndex((h) => h.includes("판정"));
  const vs = t.slice(2).map((l) => verdictOf(cells(l)[vi] ?? ""));
  const n = (v: string) => vs.filter((x) => x === v).length;
  return { kind: "test", round: Number(at("회차")) || 0, total: vs.length, pass: n("pass"), fail: n("fail"), skip: n("skip") };
}

// 설계 문서에서 이번에 고칠 파일. `구현 대기` 인 변경 절이 있으면 그 절들의 고칠 코드만 본다(대시보드 plannedFiles 와 같다)
function plannedFiles(design: string): { files: string[]; change: boolean } {
  const lines = design.split("\n"), ranges: [number, number][] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/^##\s+변경\s/.test(lines[i])) continue;
    let end = i + 1;
    while (end < lines.length && !/^##\s/.test(lines[end])) end++;
    if (!lines.slice(i + 1, Math.min(end, i + 8)).some((l) => /^-\s*\*\*상태\*\*\s*[:：]\s*구현 대기/.test(l))) continue;
    const s = lines.findIndex((l, j) => j > i && j < end && /^###\s+고칠 코드/.test(l));
    if (s < 0) continue;
    let e = s + 1;
    while (e < end && !/^#{2,3}\s/.test(lines[e])) e++;
    ranges.push([s, e]);
  }
  const change = ranges.length > 0;
  if (!change) {
    const s = lines.findIndex((l) => /^##\s+고칠 코드/.test(l));
    if (s >= 0) {
      let e = s + 1;
      while (e < lines.length && !/^##\s/.test(lines[e])) e++;
      ranges.push([s, e]);
    }
  }
  const files = new Set<string>();
  for (const [s, e] of ranges)
    for (const l of lines.slice(s + 1, e)) {
      if (!/^#{3,4}\s/.test(l)) continue;
      const h = l.replace(/^#+\s+/, "").replace(/^[\d~-]+\.\s*/, "");
      const p = h.match(/`([^`\s]+)`/)?.[1] ?? h.split(/\s/)[0];
      if (p && /\/|\.\w+$/.test(p)) files.add(p);
    }
  return { files: [...files], change };
}

// 티커가 부르므로 비동기로 돈다. 대시보드와 한 프로세스에 살게 되어, 동기 호출로 이벤트 루프를 최대 5초 멈추던 자리를 없앴다
const git = (wt: string, args: string[]) =>
  new Promise<string>((resolve) => execFile("git", ["-C", wt, ...args], { encoding: "utf8", timeout: 5000 }, (err, out) => resolve(err ? "" : out)));

// 브랜치를 만든 시점(reflog), 없으면 기본 브랜치와 갈라진 시점
async function branchStart(wt: string): Promise<string> {
  const br = (await git(wt, ["rev-parse", "--abbrev-ref", "HEAD"])).trim();
  if (br && br !== "HEAD") {
    const first = (await git(wt, ["reflog", "show", "--format=%H %gs", br])).trim().split("\n").at(-1) ?? "";
    const m = first.match(/^([0-9a-f]{40}) branch: Created from /);
    if (m) return m[1];
  }
  const base = read(CFG)?.match(/^\s*(?:export\s+)?ORCHESTRATION_DEFAULT_BASE="?([^"\n]*)"?/m)?.[1] || "master";
  for (const ref of [`origin/${base}`, base]) {
    const sha = (await git(wt, ["merge-base", ref, "HEAD"])).trim();
    if (sha) return sha;
  }
  return "";
}

// 개발자 진행: 설계의 고칠 파일 중 워크트리에서 바뀐 수. 마지막 세션이 fix-(리뷰 지적 수정)면 비율이 없어 null
export async function readDevProgress(meta: string, key: string, slug: string): Promise<Progress | null> {
  const dir = join(meta, key);
  let logs: Record<string, Record<string, unknown>> = {};
  try {
    logs = JSON.parse(read(join(dir, "agent-logs.json")) ?? "{}");
  } catch {}
  if (/^fix-/.test(Object.keys(logs[slug] ?? {}).at(-1) ?? "")) return null;
  const design = read(join(dir, "design.md"));
  if (!design) return null;
  const { files, change } = plannedFiles(design);
  if (!files.length) return null;
  const per = await Promise.all(
    worktreePaths(read(join(dir, "status.md")) ?? "")
      .filter((p) => existsSync(p))
      .map(async (wt) => {
        const base = change ? "HEAD" : await branchStart(wt);
        if (!base) return [];
        const [diff, others] = await Promise.all([git(wt, ["diff", "--name-only", base]), git(wt, ["ls-files", "--others", "--exclude-standard"])]);
        return [...diff.split("\n"), ...others.split("\n")].filter(Boolean);
      }),
  );
  const changed = per.flat();
  const touched = (p: string) => (p.endsWith("/") ? changed.some((c) => c.startsWith(p)) : p.includes("/") ? changed.includes(p) : changed.some((c) => c === p || c.endsWith(`/${p}`)));
  return { kind: "impl", done: files.filter(touched).length, total: files.length };
}

// 산출자 진행: 설계 문서 `## 산출물` 표에서 이번에 만들 산출물 가운데 산출 기록 파일이 생긴 수(대시보드의 산출자 막대와 같은 규칙)
// 표가 없으면 산출물 하나로 본다. 개발자도 일하는 오더는 구현이 끝나기 전에는 앞의 것만, 끝난 뒤에는 뒤의 것만 센다. 지적을 고치는 중에는 비율이 없어 null
export function readProduceProgress(meta: string, key: string): Progress | null {
  const dir = join(meta, key);
  if (readOrder(meta, key)?.phase === "수정") return null;
  const sec = (read(join(dir, "design.md")) ?? "").split(/^## /m).find((s) => /^산출물[ \t]*\n/.test(s)) ?? "";
  const rows = sec.split("\n").filter((l) => l.startsWith("|")).map((l) => l.split("|").slice(1, -1).map((c) => c.replace(/[`*]/g, "").trim()));
  const [ni, wi] = [(rows[0] ?? []).indexOf("이름"), (rows[0] ?? []).indexOf("언제")];
  const planned = ni < 0 ? [] : rows.slice(1).filter((r) => r[ni] && !/^:?-*:?$/.test(r[ni])).map((r) => ({ name: r[ni], late: wi >= 0 && /뒤/.test(r[wi] ?? "") }));
  const all = planned.length ? planned : [{ name: "산출물", late: false }];
  const dev = readCrew(meta, key).find((r) => !KNOWN_SLUG.includes(r.slug));
  const devWorks = !!dev && !(dev.state === "완료" && dev.desc.startsWith("할 일 없음"));
  const now = devWorks ? all.filter((d) => d.late === (dev.state === "완료")) : all;
  if (!now.length) return null;
  const rec = (name: string) => join(dir, all.length <= 1 ? "produce.md" : `produce-${name}.md`);
  return { kind: "step", role: "producer", done: now.filter((d) => existsSync(rec(d.name))).length, total: now.length };
}
// 개발자가 아닌 담당자의 상태표 식별 이름. 그 밖의 행은 모두 개발자다
const KNOWN_SLUG = ["analysis-agent", "produce-agent", "review-agent", "deploy-agent", "test-agent"];

// 리뷰·수정 세션이 dobby_progress 로 남긴 진행. 지금 단계와 최신 리뷰 차수가 기록과 같을 때만 쓴다
export function readStepProgress(meta: string, key: string, role: SeatRole): Progress | null {
  const stage = role === "reviewer" ? "리뷰" : "수정";
  let p: { stage?: string; round?: number; done?: number; total?: number } = {};
  try {
    p = JSON.parse(read(join(meta, key, "progress.json")) ?? "{}");
  } catch {}
  if (p.stage !== stage || !p.total || readOrder(meta, key)?.phase !== stage) return null;
  let rounds: number[] = [];
  try {
    rounds = readdirSync(join(meta, key, "reviews")).map((d) => Number(d.match(/^round-(\d+)$/)?.[1] ?? 0));
  } catch {}
  if (p.round !== Math.max(0, ...rounds)) return null;
  return { kind: "step", role, done: Math.min(p.done ?? 0, p.total), total: p.total };
}

// 배포 표 단계 칸을 여섯 칸으로 센다. 가장 최근에 고친 줄의 환경이 지금 배포 중인 환경이고, 그 환경의 저장소 줄을 모두 더한다
const SHIP_STEP: [RegExp, number][] = [[/^PR 생성/, 1], [/^리뷰/, 2], [/^머지/, 3], [/^빌드/, 4], [/^배포 대기/, 5], [/^(배포 확인|검증)/, 6]];
export function readShipProgress(meta: string, key: string): Progress | null {
  const sec = read(join(meta, key, "status.md"))?.split(/^## /m).find((s) => /^배포\s*\n/.test(s));
  const rows = sec?.split("\n").filter((l) => l.startsWith("|")).map((l) => l.split("|").slice(1, -1).map((c) => c.trim())) ?? [];
  const head = rows[0] ?? [];
  const col = (n: string) => head.findIndex((h) => h === n);
  const [env, stage, at] = [col("환경"), col("단계"), col("갱신")];
  const body = rows.slice(1).filter((r) => !r.every((c) => /^:?-*:?$/.test(c)));
  if (env < 0 || stage < 0 || !body.length) return null;
  const now = body.reduce((a, r) => ((r[at] ?? "") > (a[at] ?? "") ? r : a))[env];
  const steps = body.filter((r) => r[env] === now).map((r) => SHIP_STEP.find(([re]) => re.test(r[stage].replace(/⚠/g, "").trim()))?.[1] ?? 0);
  return { kind: "step", role: "deployer", done: steps.reduce((a, b) => a + b, 0), total: steps.length * 6 };
}

export const pidAlive = (pid: number) => {
  if (!pid || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
};

// QA 감시 진행: qa-watch.md 상태 줄이 '감시 중'이고 작업 세션(qa/work.pid)이나 QA 표시가 붙은 세션이 살아 있으면 참(대시보드 qaRun 과 같다)
export function readQaActive(meta: string, key: string): boolean {
  if (!/^- \*\*상태\*\*:[ \t]*감시 중/m.test(read(join(meta, key, "qa-watch.md")) ?? "")) return false;
  if (pidAlive(Number(read(join(meta, key, "qa", "work.pid")) ?? 0))) return true;
  let files: string[] = [];
  try {
    files = readdirSync(join(meta, ".presence")).filter((f) => f.endsWith(".json"));
  } catch {}
  return files.some((f) => {
    try {
      const p = JSON.parse(read(join(meta, ".presence", f)) ?? "{}");
      return p.qa === true && p.state !== "done" && Array.isArray(p.keys) && p.keys.includes(key) && pidAlive(p.pid);
    } catch {
      return false;
    }
  });
}

// QA 작업 세션이 dobby_qa_progress 로 남긴 수정·리뷰 진행
export function readQaProgress(meta: string, key: string, role: SeatRole): Progress | null {
  let p: { stage?: string; done?: number; total?: number } = {};
  try {
    p = JSON.parse(read(join(meta, key, "progress.json")) ?? "{}");
  } catch {}
  if (p.stage !== (role === "reviewer" ? "QA 리뷰" : "QA 수정") || !p.total) return null;
  return { kind: "step", role, done: Math.min(p.done ?? 0, p.total), total: p.total };
}

// QA 로 가져온 버그: 버그키 · 제목 · 결과 · 수정 요약(qa/{버그키}/implementation.md 첫 줄). 무관으로 판정한 버그는 뺀다
export function readQaBugs(meta: string, key: string): [string, string, string, string][] {
  const sec = read(join(meta, key, "qa-watch.md"))?.split(/^## /m).find((s) => s.startsWith("트리아지"));
  const rows = sec?.split("\n").filter((l) => l.startsWith("|")).map((l) => l.split("|").slice(1, -1).map((c) => c.trim())) ?? [];
  const head = rows[0] ?? [];
  const col = (r: string[], n: string) => r[head.indexOf(n)] ?? "";
  return rows
    .slice(1)
    .filter((r) => !r.every((c) => /^:?-*:?$/.test(c)) && col(r, "판정") && col(r, "판정") !== "무관")
    .map((r) => {
      const bug = col(r, "버그키");
      const fix = (read(join(meta, key, "qa", bug, "implementation.md")) ?? "").split("\n").map((l) => l.replace(/^#+\s*/, "").trim()).find(Boolean) ?? "";
      return [bug, col(r, "제목"), col(r, "판정"), fix];
    });
}
