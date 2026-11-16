/**
 * 세션들이 띄운 Chrome for Testing(브라우저 연결 도구용 크롬) 목록·판정·종료. (서버 전용)
 * 일하는 크롬(자동 실행·CPU 1% 이상)은 끄지 않는다 — 화면과 별개로 여기서 거절한다.
 */
import { execFileSync } from "node:child_process";
import type { CardStats } from "@/lib/lifecycle";

export type ChromeState = "auto" | "active" | "idle" | "orphan";

export type ChromeProc = {
  pid: number;
  startedAt: string;
  headless: boolean;
  cpu: number;
  state: ChromeState;
  killable: boolean;
  session: { pid: number; command: string; startedAt: string; cwd: string | null } | null;
  orderKey: string | null;
};

type Row = { pid: number; ppid: number; cpu: number; start: string; cmd: string };

const ACTIVE_CPU = 1;
const CHROME_MAIN = /^\S*\/Google Chrome for Testing\.app\/Contents\/MacOS\/Google Chrome for Testing( |$)/;

function snapshot(): Row[] {
  const out = execFileSync("ps", ["-axww", "-o", "pid=,ppid=,%cpu=,lstart=,command="], {
    encoding: "utf8",
    env: { ...process.env, LC_ALL: "C" },
    maxBuffer: 32 * 1024 * 1024,
  });
  const rows: Row[] = [];
  for (const line of out.split("\n")) {
    const t = line.trim().split(/\s+/);
    if (t.length < 9) continue;
    const start = new Date(t.slice(3, 8).join(" "));
    rows.push({
      pid: Number(t[0]),
      ppid: Number(t[1]),
      cpu: Number(t[2]),
      start: isNaN(start.getTime()) ? "" : start.toISOString(),
      cmd: t.slice(8).join(" "),
    });
  }
  return rows;
}

const isClaude = (cmd: string) => /^claude(\s|$)/.test(cmd);
const isHeadlessClaude = (cmd: string) => cmd.split(/\s+/).some((a) => a === "-p" || a === "--print");

/** 세션 명령을 사람이 읽을 길이로: 자동 실행의 긴 지시문 옵션부터는 뺀다. */
function shortCommand(cmd: string): string {
  const t = cmd.split(/\s+/);
  const cut = t.findIndex((a) => /^--(append-system-prompt|system-prompt|mcp-config|strict-mcp-config)/.test(a));
  return (cut > 0 ? t.slice(0, cut) : t).join(" ").slice(0, 120);
}

function cwds(pids: number[]): Map<number, string> {
  const m = new Map<number, string>();
  if (pids.length === 0) return m;
  try {
    const out = execFileSync("lsof", ["-a", "-d", "cwd", "-Fpn", "-p", pids.join(",")], { encoding: "utf8" });
    let cur = 0;
    for (const l of out.split("\n")) {
      if (l.startsWith("p")) cur = Number(l.slice(1));
      else if (l.startsWith("n") && cur) m.set(cur, l.slice(1));
    }
  } catch (e) {
    // lsof 는 일부 pid 를 못 찾으면 1로 끝나지만 찾은 것은 출력한다.
    const out = (e as { stdout?: string }).stdout ?? "";
    let cur = 0;
    for (const l of out.split("\n")) {
      if (l.startsWith("p")) cur = Number(l.slice(1));
      else if (l.startsWith("n") && cur) m.set(cur, l.slice(1));
    }
  }
  return m;
}

export function listChrome(withCwd = true): ChromeProc[] {
  const rows = snapshot();
  const byPid = new Map(rows.map((r) => [r.pid, r]));
  const kids = new Map<number, number[]>();
  for (const r of rows) kids.set(r.ppid, [...(kids.get(r.ppid) ?? []), r.pid]);
  const cpuTree = (pid: number): number => {
    let sum = byPid.get(pid)?.cpu ?? 0;
    for (const k of kids.get(pid) ?? []) sum += cpuTree(k);
    return sum;
  };

  const list = rows
    .filter((r) => CHROME_MAIN.test(r.cmd) && !/ --type=/.test(r.cmd))
    .map((r): ChromeProc => {
      let owner: Row | undefined;
      let chain = "";
      for (let p = r.ppid, i = 0; p > 1 && i < 10; i++) {
        const pr = byPid.get(p);
        if (!pr) break;
        if (isClaude(pr.cmd)) {
          owner = pr;
          break;
        }
        chain += " " + pr.cmd;
        p = pr.ppid;
      }
      const cpu = Math.round(cpuTree(r.pid) * 10) / 10;
      const state: ChromeState =
        owner && isHeadlessClaude(owner.cmd) ? "auto" : cpu >= ACTIVE_CPU ? "active" : owner ? "idle" : "orphan";
      const key =
        owner?.cmd.match(/\/(?:do|dobby-[a-z]+)\s+([A-Z][A-Z0-9]*-\d+)/)?.[1] ??
        (r.cmd + chain).match(/dobby-chrome\/([A-Z][A-Z0-9]*-\d+)/)?.[1] ??
        null;
      return {
        pid: r.pid,
        startedAt: r.start,
        headless: /\s--headless(=|\s|$)/.test(r.cmd),
        cpu,
        state,
        killable: state === "idle" || state === "orphan",
        session: owner
          ? { pid: owner.pid, command: shortCommand(owner.cmd), startedAt: owner.start, cwd: null }
          : null,
        orderKey: key,
      };
    })
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));

  if (withCwd) {
    const dirs = cwds([...new Set(list.flatMap((c) => (c.session ? [c.session.pid] : [])))]);
    for (const c of list) if (c.session) c.session.cwd = dirs.get(c.session.pid) ?? null;
  }
  return list;
}

export type KillResult = { pid: number; result: "종료됨" | "남음" | "사용 중이라 거절" | "대상 아님" };

/** 쉬는 크롬만 끈다. 번호마다 지금 상태를 다시 판정하고, 2초 뒤 꺼졌는지 확인한다. */
export async function killChrome(pids: number[]): Promise<KillResult[]> {
  const now = new Map(listChrome(false).map((c) => [c.pid, c]));
  const results: KillResult[] = [];
  const sent: number[] = [];
  for (const pid of pids) {
    const c = now.get(pid);
    if (!c) results.push({ pid, result: "대상 아님" });
    else if (!c.killable) results.push({ pid, result: "사용 중이라 거절" });
    else {
      try {
        process.kill(pid, "SIGTERM");
        sent.push(pid);
      } catch {
        results.push({ pid, result: "대상 아님" });
      }
    }
  }
  if (sent.length) await new Promise((r) => setTimeout(r, 2000));
  for (const pid of sent) {
    let alive = true;
    try {
      process.kill(pid, 0);
    } catch {
      alive = false;
    }
    results.push({ pid, result: alive ? "남음" : "종료됨" });
  }
  return results;
}

export function chromeCardStats(): CardStats {
  let list: ChromeProc[] = [];
  try {
    list = listChrome(false);
  } catch {
    return { overall: [], today: [] };
  }
  const busy = list.filter((c) => !c.killable).length;
  return {
    overall: [
      { label: "전체", value: list.length },
      { label: "사용 중", value: busy, color: "blue" },
      { label: "쉬는 중", value: list.length - busy, color: list.length - busy ? "orange" : undefined },
    ],
    today: [],
  };
}
