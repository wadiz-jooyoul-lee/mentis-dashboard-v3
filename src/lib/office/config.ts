import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";
import type { Env } from "@/lib/office/core/types";

// 설계서 7장 "설정 파일과 메타 폴더". 서버를 켤 때 읽고 형식이 틀리면 어디가 틀렸는지 알리고 멈춘다
export interface OfficeConfig {
  limits: { internalReview: number; gateFails: number; runsPerTask: number; resubmit: number };
  protectedBranches: string[];
  owner: { github?: string }; // PR 수정 명령을 받을 사용자 계정
  pollSec: number; // PR 리뷰 상태 조회 주기
  reviewAlertMin: number; // PR 리뷰 대기가 이만큼(분) 넘으면 방에 오래 기다림 표시
  reviewStopMin: number; // 리뷰를 기다리는 환경에서 이만큼(분) 리뷰가 없으면 멈추고 사람에게 묻는다
  agentIdleMin: number; // 에이전트가 이만큼(분) 아무 응답이 없으면 멈춘 것으로 보고 끊는다
  askWaitMin: number; // 에이전트가 사람에게 묻고 답을 기다리는 상한(분). 넘으면 질문을 남기고 끝낸다
  deployWaitMin: number; // 머지 뒤 빌드 결과를 기다리는 상한(분)
  tester: { loginId?: string }; // 테스터가 로그인할 계정. 비밀번호는 .env.local 의 TEST_PW
}
export interface RepoConfig {
  name: string;
  path: string;
  github?: string; // owner/name. 없으면 PR 단계 없이 내부 리뷰 통과로 끝난다
  reviewByComment?: boolean; // 연습 저장소용. 사용자 본인의 /approve, /request-changes 코멘트를 리뷰로 받는다
  holdKeywords: string[]; // 머지 보류 요청으로 의심할 낱말. 걸린 코멘트는 개발자가 mergeHold 를 꼭 답한다
  gates: Record<string, string>; // 이름 → 명령. 적은 순서대로 돈다
  // build: 머지 뒤 기다릴 GitHub Actions 작업 이름. 없으면 그 커밋의 작업 전부. review: none 이면 PR 승인을 기다리지 않고 머지한다
  envs: Partial<Record<Env, { branch: string; url?: string; build?: string; review?: "none"; reviewers?: string[] }>>;
  base?: string; // 작업 브랜치를 따는 곳. 없으면 환경 브랜치. 요청에 base=브랜치 를 적으면 그 값
  install?: string; // 작업 폴더를 만든 뒤 한 번 돌리는 설치 명령
  builds?: { path: string; workflow: string; fields?: Record<string, string | boolean> }[]; // 머지 뒤 서버가 거는 빌드. 바뀐 경로의 접두어로 고른다
  buildFields?: Record<string, string | boolean>; // 모든 빌드에 넘기는 값. environment 는 환경 값
  ci?: string; // 머지 push 로 저절로 도는 빌드 작업 파일. 걸지 않고 머지 뒤 시작된 실행을 찾아 기다린다
  argo?: { server: Partial<Record<Env, string>>; app: string }; // 빌드 뒤 argocd 로 동기화해야 배포되는 저장소. app 의 {env} 는 환경 이름
  protectedPaths?: string[]; // 에이전트가 고치면 안 되는 파일(정규식, 저장소 기준 경로)
  rules: { pattern: string; message: string; path?: string; except?: string[] }[]; // 새로 쓴 줄에 있으면 안 되는 코드. path 는 적용할 파일(정규식), except 는 뺄 경로 접두어
  diffExclude: string[];
  redact: string[];
  library?: string; // 기획자가 저장소를 파악할 때 먼저 읽을 문서 경로
  gateAllow?: string[]; // 기획자가 지시서에 적어도 되는 검증 명령(정규식, 전체 일치). gates 의 명령은 늘 허용
  urlAllow?: string[]; // 기획자가 지시서에 적어도 되는 테스트 주소 접두어. envs 의 url 은 늘 허용
}

const DEFAULT_CONFIG = `# 에이전트 오피스 전역 설정
limits:
  internalReview: 5   # 리뷰→기획 판단→개발 고리 상한. 넘으면 몇 번 더 돌지 사람에게 묻는다
  gateFails: 3        # 작업 하나의 게이트 실패 상한. 넘으면 사람 확인
  runsPerTask: 40     # 작업 하나의 에이전트 실행 상한
  resubmit: 3         # 변경 요청으로 새 PR 을 여는 상한. 넘으면 사람 확인
protectedBranches: [master, cloud_live, stage]
owner:
  github:             # PR 수정 명령(/fix)을 받을 본인 GitHub 계정
pollSec: 30           # PR 리뷰 상태 조회 주기(초)
reviewAlertMin: 10    # PR 리뷰 대기가 이만큼(분) 넘으면 방에 오래 기다림 표시
reviewStopMin: 30     # 리뷰를 기다리는 환경에서 이만큼(분) 리뷰가 없으면 멈춘다
agentIdleMin: 15      # 에이전트가 이만큼(분) 아무 응답이 없으면 끊는다
askWaitMin: 30        # 에이전트가 사람에게 묻고 답을 기다리는 상한(분)
deployWaitMin: 30     # 머지 뒤 빌드 결과를 기다리는 상한(분)
`;

// 오피스 설정 폴더. 예전 오피스 DB 옆 자리(~/.agent-office)를 그대로 쓴다
export const officeHome = () => process.env.AGENT_OFFICE_HOME || join(homedir(), ".agent-office");

const expandHome = (p: string) => p.replace(/^~(?=\/|$)/, homedir());

function fail(file: string, msg: string): never {
  throw new Error(`설정 오류(${file}): ${msg}`);
}

function readConfig(): OfficeConfig {
  const file = join(officeHome(), "config.yaml");
  if (!existsSync(file)) writeFileSync(file, DEFAULT_CONFIG);
  const c = (parse(readFileSync(file, "utf8")) ?? {}) as Partial<OfficeConfig>;
  const l = c.limits ?? ({} as OfficeConfig["limits"]);
  l.resubmit ??= 3;
  for (const k of ["internalReview", "gateFails", "runsPerTask", "resubmit"] as const) if (!Number.isInteger(l[k]) || l[k] < 1) fail(file, `limits.${k} 는 1 이상의 정수여야 합니다`);
  if (!Array.isArray(c.protectedBranches)) fail(file, "protectedBranches 는 목록이어야 합니다");
  return { limits: l, protectedBranches: c.protectedBranches, owner: c.owner ?? {}, pollSec: c.pollSec ?? 30, reviewAlertMin: c.reviewAlertMin ?? 10, reviewStopMin: c.reviewStopMin ?? 30, agentIdleMin: c.agentIdleMin ?? 15, askWaitMin: c.askWaitMin ?? 30, deployWaitMin: c.deployWaitMin ?? 30, tester: c.tester ?? {} };
}

function readRepo(file: string): RepoConfig {
  const r = (parse(readFileSync(file, "utf8")) ?? {}) as Partial<RepoConfig>;
  if (!r.name) fail(file, "name 이 없습니다");
  if (!r.path) fail(file, "path 가 없습니다");
  const path = expandHome(r.path);
  if (!existsSync(join(path, ".git"))) fail(file, `path(${path})가 git 저장소가 아닙니다`);
  if (!r.gates || !Object.keys(r.gates).length) fail(file, "gates 에 명령이 하나도 없습니다");
  if (!r.envs || !Object.values(r.envs).some((e) => e?.branch)) fail(file, "envs 에 branch 가 있는 환경이 하나도 없습니다");
  return { name: r.name, path, github: r.github, gates: r.gates, envs: r.envs, reviewByComment: r.reviewByComment, holdKeywords: r.holdKeywords ?? ["머지하지", "머지 금지", "do not merge"], rules: r.rules ?? [], diffExclude: r.diffExclude ?? [], redact: r.redact ?? [], library: r.library ? expandHome(r.library) : undefined, gateAllow: r.gateAllow, urlAllow: r.urlAllow, base: r.base, install: r.install, builds: r.builds, buildFields: r.buildFields, ci: r.ci, argo: r.argo, protectedPaths: r.protectedPaths };
}

const g = globalThis as unknown as { __officeConfig?: { office: OfficeConfig; repos: Map<string, RepoConfig> } };

export function loadConfig() {
  mkdirSync(join(officeHome(), "repos"), { recursive: true });
  const repos = new Map<string, RepoConfig>();
  for (const f of readdirSync(join(officeHome(), "repos")).filter((f) => /\.ya?ml$/.test(f))) {
    const r = readRepo(join(officeHome(), "repos", f));
    repos.set(r.name, r);
  }
  return (g.__officeConfig = { office: readConfig(), repos });
}

export const config = () => g.__officeConfig ?? loadConfig();
