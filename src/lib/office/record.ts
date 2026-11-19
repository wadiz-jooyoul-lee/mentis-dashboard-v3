import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { git, patch } from "@/lib/office/git";
import type { DobbyBookExtra, TaskRecord, Verdict, VerifyData } from "@/lib/office/core/record";
import { parseReport } from "@/lib/office/test/parseReport";
import { readTestPlan } from "@/lib/office/test/testPlan";
import { summarizeRuns } from "@/lib/office/test/testSummary";
import { dashboardUrl } from "@/lib/office/office";
import { readRetro } from "@/lib/office/retro";
import { metaDir, readCrew, readOrder, readQaBugs } from "@/lib/office/source";

const read = (f: string) => {
  try {
    return readFileSync(f, "utf8").trim();
  } catch {
    return "";
  }
};
// "## 이름" 으로 시작하는 절의 본문. 없으면 ""
const section = (text: string, name: string) => text.split(/^## /m).find((s) => s.startsWith(name))?.replace(/^[^\n]*\n?/, "").trim() ?? "";
const field = (text: string, name: string) => text.match(new RegExp(`\\*\\*${name}\\*\\*[ \\t]*[:：][ \\t]*([^\\n]*)`))?.[1].trim() ?? "";
// 마크다운 표를 머리줄 이름으로 읽는다. 구분줄은 뺀다
function table(text: string) {
  const rows = text.split("\n").filter((l) => l.startsWith("|")).map((l) => l.split("|").slice(1, -1).map((c) => c.replace(/`/g, "").trim())).filter((r) => !r.every((c) => /^:?-*:?$/.test(c)));
  const head = rows[0] ?? [];
  return rows.slice(1).map((r) => (n: string) => r[head.indexOf(n)] ?? "");
}

// 저장소마다 [이름, diff]. 작업 폴더가 있으면 기준 브랜치와 갈라진 지점 대비 작업 폴더, 없으면 code-changes 기록
// 작업 폴더의 색인을 건드리지 않으므로 git add 하지 않은 새 파일은 빠진다
function changes(dir: string, status: string): [string, string][] {
  const bases = new Map(field(status, "기준 브랜치").split(",").map((x) => x.trim().split("=") as [string, string]));
  const out: [string, string][] = [];
  for (const row of table(section(status, "워크트리 / 브랜치"))) {
    const [repo, wt] = [row("repo"), row("경로")];
    const base = bases.get(repo);
    if (!repo || !wt || !base) continue;
    try {
      let ref = base;
      try {
        git(wt, "rev-parse", "--verify", "-q", `origin/${base}`);
        ref = `origin/${base}`;
      } catch {}
      const d = patch(wt, git(wt, "merge-base", ref, "HEAD"), [], true);
      if (d) out.push([repo, d]); // 이미 머지돼 차이가 없으면 기록으로 넘어간다
    } catch {} // 작업 폴더가 지워졌거나 git 이 실패하면 기록으로 넘어간다
  }
  if (out.length) return out;
  let files: string[] = [];
  try {
    files = readdirSync(join(dir, "code-changes")).filter((f) => f.endsWith(".diff")).sort();
  } catch {}
  return files.map((f): [string, string] => [f.replace(/\.diff$/, ""), read(join(dir, "code-changes", f))]).filter(([, d]) => d);
}

// 산출 기록: produce.md(옛 자리 deliverables/produce.md 포함)와, 산출물이 여럿일 때의 produce-{이름}.md
function produceDocs(dir: string): [string, string][] {
  const out: [string, string][] = [];
  const one = read(join(dir, "produce.md")) || read(join(dir, "deliverables", "produce.md"));
  if (one) out.push(["", one]);
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter((f) => /^produce-.+\.md$/i.test(f)).sort();
  } catch {}
  for (const f of files) out.push([f.replace(/^produce-|\.md$/gi, ""), read(join(dir, f))]);
  return out;
}

// deliverables/ 아래 산출물(하위 폴더까지). 글 파일은 본문을 싣고(길면 앞 200줄), 그 밖의 파일은 이름만 싣는다. 산출 기록은 뺀다
function products(dir: string): [string, string][] {
  const root = join(dir, "deliverables"), out: [string, string][] = [];
  const walk = (d: string) => {
    let names: string[] = [];
    try {
      names = readdirSync(d).sort();
    } catch {}
    for (const n of names) {
      if (n.startsWith(".")) continue;
      const f = join(d, n);
      let sub = false;
      try {
        sub = statSync(f).isDirectory();
      } catch {}
      if (sub) walk(f);
      else if (relative(root, f) !== "produce.md") {
        const lines = /\.(md|txt)$/i.test(n) ? read(f).split("\n") : [];
        out.push([relative(root, f), lines.length > 200 ? `${lines.slice(0, 200).join("\n")}\n\n(뒤는 줄였습니다. 모두 ${lines.length}줄)` : lines.join("\n")]);
      }
    }
  };
  walk(root);
  return out;
}

// 문서 안에서 머리줄에 "판정" 칸이 있는 표의 줄을 모두 읽는다
function judgedRows(text: string) {
  const blocks: string[][] = [];
  let cur: string[] = [];
  for (const l of text.split("\n")) {
    if (l.startsWith("|")) cur.push(l);
    else if (cur.length) blocks.push(cur), (cur = []);
  }
  if (cur.length) blocks.push(cur);
  return blocks.filter((b) => b[0].includes("판정")).flatMap((b) => table(b.join("\n")));
}
const verdictOf = (v: string): Verdict | "" => (!v ? "" : /FAIL|실패|❌/i.test(v) ? "fail" : /PASS|통과|✅/i.test(v) ? "pass" : "hold");
const SHOT = /\.(png|jpe?g|webp)$/i;
const SHOT_MAX = 8;

// 검증 회차 요약과 화면 갈무리. 갈무리 설명은 그 파일 이름이 적힌 시나리오 줄에서 가져온다
function testRuns(dir: string) {
  let names: string[] = [];
  try {
    names = readdirSync(join(dir, "test-runs")).filter((n) => !n.startsWith(".")).sort().reverse();
  } catch {}
  const runs: DobbyBookExtra["runs"] = [], shots: DobbyBookExtra["shots"] = [];
  for (const run of names) {
    const d = join(dir, "test-runs", run), text = read(join(d, "result.md"));
    const env = field(text, "환경").split(/[\s(]/)[0];
    const rows = judgedRows(text);
    const judged = rows.map((r) => verdictOf(r("판정"))).filter(Boolean);
    const m = run.match(/^\d{4}(\d\d)(\d\d)-(\d\d)(\d\d)/);
    if (text) runs.push({ run, at: m ? `${m[1]}-${m[2]} ${m[3]}:${m[4]}` : run, env, pass: judged.filter((v) => v === "pass").length, fail: judged.filter((v) => v === "fail").length, hold: judged.filter((v) => v === "hold").length });
    let files: string[] = [];
    try {
      files = readdirSync(d).filter((f) => SHOT.test(f)).sort();
    } catch {}
    for (const file of files) {
      const id = text.split("\n").find((l) => l.startsWith("|") && l.includes(file))?.split("|")[1]?.replace(/`/g, "").trim();
      const side = /before|이전|asis/i.test(file) ? "before" : /after|이후|tobe/i.test(file) ? "after" : "";
      const alt = text.match(new RegExp(`!\\[([^\\]]+)\\]\\(${file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)`))?.[1];
      // 줄을 못 찾으면 그림 설명이나 파일 이름 앞의 시나리오 번호(S10 등)로 찾는다
      const no = (alt ?? file).match(/^(s|tc-?)\d+/i)?.[0].toLowerCase();
      const r = (id ? rows.find((x) => x("#") === id) : undefined) ?? (no ? rows.find((x) => x("#").toLowerCase() === no) : undefined);
      shots.push({ run, env, file, caption: alt || (r && (r("확인 항목") || r("시나리오"))) || file.replace(SHOT, "").replace(/[-_]/g, " "), verdict: r ? verdictOf(r("판정")) : "", side });
    }
  }
  // 이전·이후로 이름 붙인 갈무리를 앞에 두고, 나머지는 최근 회차부터
  const ordered = [...shots.filter((s) => s.side), ...shots.filter((s) => !s.side)];
  return { runs, shots: ordered.slice(0, SHOT_MAX), shotTotal: shots.length };
}

// 검증 장 자료. 회차 결과 문서는 집계(summarizeRuns)와 같은 규칙으로 고른다: 이름에 result 가 든 md, 없으면 첫 md
function verifyOf(dir: string): VerifyData {
  const summary = summarizeRuns(dir);
  const runs = (summary?.runs ?? []).map((r) => {
    const d = join(dir, "test-runs", r.id);
    let mds: string[] = [];
    try {
      mds = readdirSync(d).filter((f) => f.toLowerCase().endsWith(".md"));
    } catch {}
    const file = mds.find((f) => /result/i.test(f)) ?? mds[0];
    const rep = file ? parseReport(read(join(d, file))) : null;
    return { ...r, items: rep?.scenarios ?? [], rest: rep?.restMarkdown ?? "" };
  });
  return { summary, plan: readTestPlan(dir)?.scenarios ?? [], runs: runs.reverse() };
}

// 성능 측정(perf.json)에서 책에 보일 값만 고른다
type Tok = { cacheRead?: number; input?: number; output?: number };
const tok = (t?: Tok) => (t ? (t.cacheRead ?? 0) + (t.input ?? 0) + (t.output ?? 0) : 0);
function perfOf(dir: string): DobbyBookExtra["perf"] {
  try {
    const p = JSON.parse(readFileSync(join(dir, "perf.json"), "utf8"));
    const t = p.totals ?? {};
    return {
      measuredAt: p.measuredAt ?? "",
      wallMin: t.wallMin ?? 0,
      baselineMin: t.baselineMin ?? 0,
      humanWaitMin: t.humanWaitMin ?? 0,
      talk: { sessions: p.interactive?.sessions ?? 0, min: p.interactive?.min ?? 0 },
      stages: (p.byStage ?? []).map((s: { stage: string; sessions: number; min: number; baselineMin: number }) => ({ stage: s.stage, sessions: s.sessions, min: s.min, baselineMin: s.baselineMin })),
      tokens: tok(t.tokens),
      baselineTokens: tok(t.baselineTokens),
      summary: p.summary ?? "",
    };
  } catch {
    return undefined;
  }
}

// 저장소마다 환경별 배포 단계와 릴리즈 노트 배포일
function shipOf(status: string): DobbyBookExtra["ship"] {
  const out: DobbyBookExtra["ship"] = [];
  const repo = (name: string) => out.find((x) => x.repo === name) ?? (out.push({ repo: name, envs: [] }), out[out.length - 1]);
  for (const r of table(section(status, "배포"))) if (r("저장소")) repo(r("저장소")).envs.push({ env: r("환경"), stage: r("단계"), pr: r("PR") });
  for (const r of table(section(status, "릴리즈 노트"))) if (r("저장소") && /^\d{4}-\d\d-\d\d$/.test(r("배포일"))) repo(r("저장소")).release = { date: r("배포일"), merged: r("머지").includes("머지됨") };
  return out;
}

const localDay = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// 도비 사무실의 펼친 책. 메타 문서로 만들고, 원본이 없는 칸은 비운다(화면이 "문서가 없습니다"로 보인다)
export function dobbyRecord(key: string): TaskRecord | null {
  const meta = metaDir();
  const order = meta ? readOrder(meta, key) : null;
  if (!meta || !order) return null;
  const dir = join(meta, key);
  const status = read(join(dir, "status.md"));
  const design = read(join(dir, "design.md"));

  const impl = read(join(dir, "implementation.md")).split(/^## /m).slice(1).map((s): [string, string] => [s.split("\n")[0].trim(), s.replace(/^[^\n]*\n?/, "").trim()]);
  const past = table(section(status, "지난 세션")).map((r): [string, string] => [r("단계"), `${r("시각")} · ${r("세션 아이디")}`]);

  const ship = table(section(status, "배포")).map((r) => `${r("저장소")} ${r("환경")} ${r("PR")} (${r("단계")})`.replace(/\s+/g, " ").trim());
  const diffs = changes(dir, status);
  const all = diffs.flatMap(([, d]) => d.split("\n"));
  const added = all.filter((l) => l.startsWith("+") && !l.startsWith("+++")).length;
  const removed = all.filter((l) => l.startsWith("-") && !l.startsWith("---")).length;
  const files = all.filter((l) => l.startsWith("diff --git")).length;
  const outcome = read(join(dir, "outcome.md"));

  let run = "";
  try {
    run = readdirSync(join(dir, "test-runs")).sort().reverse().map((d) => read(join(dir, "test-runs", d, "result.md"))).find(Boolean) ?? "";
  } catch {}
  const conds = table(section(status, "닫히는 조건 항목")).map((r): [string, string] => [r("#"), r("조건")]);
  // 산출 기록과 산출물. 산출 기록의 `## 올린 곳` 절에서 `- {종류}: {주소}` 줄을 읽는다
  const produced = produceDocs(dir);
  const uploads = produced.flatMap(([, text]) =>
    section(text, "올린 곳").split("\n").flatMap((l): [string, string][] => {
      const m = l.match(/^\s*[-*]\s+(.+?)\s*[:：]\s*(\S.*)$/), url = m?.[2].match(/https?:\/\/[^\s)>\]]+/)?.[0];
      return m && url ? [[m[1].replace(/\*/g, "").trim(), url]] : [];
    }),
  );
  // 검증이 없는 오더: 담당자 줄이 있고 테스터를 켜지 않았거나, 테스터가 "할 일 없음"으로 끝났다. 담당자 줄이 없는 옛 오더는 지금까지처럼 테스트 장이 있다
  const crew = readCrew(meta, key);
  const retro = readRetro(meta, key);
  const noTest = !!order.roles &&(!order.roles.includes("tester") || crew.some((c) => c.slug === "test-agent" && c.state === "완료" && c.desc.startsWith("할 일 없음")));

  return {
    key,
    title: order.title,
    doneAt: "",
    mins: 0,
    pr: 0,
    lines: added + removed,
    completeness: `닫히는 조건 ${conds.length}개 · 단계 ${order.phase}`,
    crew: [...new Set(crew.map((c) => c.name))],
    request: { text: read(join(dir, "jira-issue.md")) || section(design, "한 장 요약") || section(design, "무엇을 만드나"), criteria: [] },
    design,
    process: [...impl, ...produced.map(([name, text]): [string, string] => [name ? `산출 기록 — ${name}` : "산출 기록", text]), ...past],
    ...(order.roles && !order.roles.includes("developer") ? { procName: "산출 과정" } : {}),
    output: {
      pr: ship.join(", ") || field(section(status, "현재 단계"), "PR"),
      stat: diffs.length ? `파일 ${files}개 · +${added} −${removed}` : "",
      summary: outcome,
      ...(order.roles?.includes("producer") ? { products: products(dir), uploads } : {}),
      patch: [
        ...diffs.flatMap(([repo, d]) => [
          { kind: "" as const, line: `── ${repo} ──` },
          ...d
            .split("\n")
            .filter((l) => !/^(diff --git|index |--- |\+\+\+ )/.test(l))
            .slice(0, 80)
            .map((line) => ({ kind: line.startsWith("+") ? ("add" as const) : line.startsWith("-") ? ("del" as const) : ("" as const), line })),
        ]),
      ],
    },
    tests: {
      env: field(run, "환경"),
      rows: table(section(run, "시나리오별 결과")).map((r): [string, string, string, string] => [r("#"), r("확인 항목"), r("판정"), r("근거")]),
    },
    done: conds,
    qa: readQaBugs(meta, key),
    ...(noTest ? { noTest } : {}),
    dobby: {
      phase: order.phase,
      explainer: read(join(dir, "explainer.md")) || outcome,
      ...testRuns(dir),
      verify: verifyOf(dir),
      ship: shipOf(status),
      today: localDay(),
      ...(retro ? { retro: { data: retro, url: `${dashboardUrl(key)}/retro` } } : {}),
      perf: perfOf(dir),
    },
  };
}
