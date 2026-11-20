import fs from "node:fs";
import path from "node:path";
import { getMetaDir, getWorkspaceDir } from "@/lib/issues";
import { runningJobKeys } from "@/lib/jobs";
import { isOrderKey } from "@/lib/keys";
import { allLiveSessions, autoRunState, qaRun } from "@/lib/presence";
import type { Tier } from "@/lib/goDobbyConfig";

// 위험한 설정을 지금 바꿔도 되는지 판정한다. 화면 잠금과 저장 거절이 같은 판정을 쓴다.

export type Busy = { key: string; what: string };

function unfinishedOrders(): string[] {
  const meta = getMetaDir();
  let names: string[];
  try {
    names = fs.readdirSync(meta).filter(isOrderKey);
  } catch {
    return [];
  }
  return names.filter((k) => {
    try {
      const md = fs.readFileSync(path.join(meta, k, "status.md"), "utf8");
      const stage = md.match(/^- \*\*단계\*\*:[ \t]*(.+)$/m)?.[1] ?? "";
      return !/해결|종료|폐기|취소/.test(stage);
    } catch {
      return false;
    }
  });
}

/** 지금 돌고 있는 일. 대시보드가 띄운 실행, /do 세션, 자동 실행, QA 감시를 모은다. */
export function busyWork(): Busy[] {
  const out = new Map<string, Busy>();
  const add = (key: string, what: string) => out.set(`${key}|${what}`, { key, what });
  for (const k of runningJobKeys()) add(k, "대시보드가 띄운 실행");
  for (const s of allLiveSessions()) for (const k of s.keys.length ? s.keys : ["(오더 없음)"]) add(k, `/do 세션(${s.slug})`);
  const meta = getMetaDir();
  for (const k of unfinishedOrders()) {
    try {
      const md = fs.readFileSync(path.join(meta, k, "status.md"), "utf8");
      if (autoRunState(md.match(/^- \*\*자동 실행\*\*:[ \t]*(.+)$/m)?.[1].trim() ?? null)?.running) add(k, "자동 실행");
    } catch {
      /* 상태 문서가 없으면 건너뛴다 */
    }
    if (qaRun(k) === "active") add(k, "QA 감시");
  }
  return [...out.values()];
}

/** 진행 중인 오더의 작업 폴더 가운데 지금 작업 폴더의 subtree 에 있는 것. */
export function unfinishedWorktrees(): { key: string; folder: string }[] {
  const subtree = path.join(getWorkspaceDir(), "subtree");
  let folders: string[];
  try {
    folders = fs.readdirSync(subtree);
  } catch {
    return [];
  }
  return unfinishedOrders().flatMap((key) =>
    folders.filter((f) => new RegExp(`^.+-${key}(?:-.*)?$`).test(f)).map((folder) => ({ key, folder: path.join(subtree, folder) })),
  );
}

export type Lock = { locked: boolean; reasons: string[] };

/** 등급별 잠금. 위험·주의는 돌고 있는 일이 있으면 잠그고, 작업 폴더는 진행 중 오더의 작업 폴더가 남아 있어도 잠근다. */
export function lockFor(key: string, tier: Tier, busy: Busy[], worktrees: { key: string; folder: string }[]): Lock {
  if (tier === "normal") return { locked: false, reasons: [] };
  const reasons = busy.map((b) => `${b.key} ${b.what} 중`);
  if (key === "ORCHESTRATION_WORKSPACE") reasons.push(...worktrees.map((w) => `${w.key} 작업 폴더가 남아 있음: ${w.folder}`));
  return { locked: reasons.length > 0, reasons };
}
