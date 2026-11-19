import { execFileSync } from "node:child_process";

// 작업 책의 코드 변경 장을 만들 때만 부른다(API 요청 한 번에 한 번). 티커 경로가 아니라 동기 호출을 그대로 둔다
export const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

const pathspec = (exclude: string[]) => ["--", ".", ...exclude.map((e) => `:(exclude)${e}`)];

// 기준 대비 작업 공간의 변경. look: index 를 건드리지 않는다(아직 추가하지 않은 새 파일은 빠진다)
export function patch(wt: string, base: string, exclude: string[] = [], look = false) {
  if (!look) git(wt, "add", "-A", "-N");
  return git(wt, "diff", base, ...pathspec(exclude));
}
