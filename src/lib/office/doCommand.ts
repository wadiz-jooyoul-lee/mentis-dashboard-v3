/**
 * 업무 맡기기(접수) 규칙 — 오피스 업무 맡기기 창과 대시보드 실행 탭이 같은 규칙을 쓴다. (클라이언트/서버 공용, node 의존 없음)
 * mentis-dashboard-v3 `src/lib/intake.ts` 와 본문이 같아야 한다. 고치면 두 곳을 함께 고치고 각 저장소의 접수 시험을 돌린다.
 * 오피스는 미리 보기와 1차 검사만 한다. 작업 키를 잡고 request.md 를 쓰는 것은 대시보드다.
 *
 * 사람은 일의 종류를 고르고, Jira 이슈가 있으면 이슈를 넣고, 없으면 내용만 적는다.
 * Jira 이슈가 없으면 대시보드가 작업 키(TASK-1, TASK-2, …)를 만든다. 사람이 TASK- 키를 칠 일은 없다.
 * 내용은 명령 글에 넣지 않고 오더 폴더의 request.md 로 넘긴다(가벼운 수정만 지금처럼 명령 뒤에 붙인다).
 */
export type IntakeKind = "dev" | "doc" | "research" | "light";
export type IntakeEnv = "" | "dev" | "rc1" | "rc4";
export interface Intake {
  kind: IntakeKind;
  /** Jira 이슈 키나 주소. 비우면 작업 키를 새로 만든다(가벼운 수정은 필수). */
  target?: string;
  env?: IntakeEnv;
  base?: string;
  /** 내용. Jira 이슈가 없으면 필수, 있으면 덧붙일 말. 가벼운 수정은 미리 분석한 내용(필수). */
  note?: string;
}

export const INTAKE_ENVS: IntakeEnv[] = ["", "dev", "rc1", "rc4"];
export const KIND_ORDER: IntakeKind[] = ["dev", "doc", "research", "light"];
/** 명령 인자에 그대로 들어가므로 좁게 받는다: 영숫자·점·밑줄·빗금·하이픈, ".." 과 앞 하이픈 금지 */
export const BRANCH_RE = /^(?!-)(?!.*\.\.)[A-Za-z0-9._/-]{1,100}$/;
/** 내용 칸 상한. 파일(request.md)로 넘기므로 넉넉히 받는다 */
export const NOTE_MAX = 10000;
/** 가벼운 수정의 분석 내용은 명령 뒤에 붙으므로 짧게 받는다 */
export const LIGHT_NOTE_MAX = 2000;
/** 미리 보기에서 아직 정해지지 않은 작업 키 자리 */
export const TASK_KEY_PLACEHOLDER = "TASK-…";
const KIND_ARG: Record<Exclude<IntakeKind, "light">, string> = { dev: "개발", doc: "문서", research: "조사" };

const JIRA_KEY_RE = /^[A-Z][A-Z0-9]+-\d+$/;
/** Jira 이슈 키나 Jira 이슈 주소에서 키를 꺼낸다. 아니면 빈 값. TASK- 는 Jira 키가 아니다 */
export function jiraKeyOf(target: string | undefined): string {
  const t = (target ?? "").trim();
  const k = JIRA_KEY_RE.test(t) ? t : (t.match(/\/browse\/([A-Z][A-Z0-9]+-\d+)(?:[/?#]|$)/)?.[1] ?? "");
  return /^TASK-/.test(k) ? "" : k;
}

/** 종류마다 받는 칸. 배포 환경은 Jira 이슈가 있을 때만 고른다(작업 키는 통합에서 PR 까지만 만든다) */
export const FIELDS: Record<IntakeKind, { env: boolean; base: boolean; issueRequired: boolean }> = {
  dev: { env: true, base: true, issueRequired: false },
  doc: { env: false, base: true, issueRequired: false },
  research: { env: false, base: false, issueRequired: false },
  light: { env: true, base: false, issueRequired: true },
};

/**
 * 채운 내용이 있는가. 제목 줄(#…), 빈 글머리(- ), 칸 이름만 있는 줄("볼 곳:", "고칠 파일: ")은 내용으로 치지 않는다.
 * [양식 넣기] 만 누르고 보낸 것을 막는다
 */
export function hasContent(note: string): boolean {
  return note.split("\n").some((line) => !/^\s*(#.*|[-*]?\s*([^:：]{1,24}[:：])?\s*)$/.test(line));
}

export type IntakeCheck =
  | { ok: true; kind: IntakeKind; jiraKey: string; env: IntakeEnv; base: string; note: string }
  | { ok: false; error: string };

/** 입력을 검사하고 다듬는다. 화면은 미리 보기·버튼에, 서버는 받기 전 검사에 쓴다 */
export function checkIntake(i: Intake): IntakeCheck {
  const f = FIELDS[i.kind];
  if (!f) return { ok: false, error: "작업 종류를 골라 주세요." };
  const target = (i.target ?? "").trim();
  const jiraKey = jiraKeyOf(target);
  if (target && !jiraKey) return { ok: false, error: "Jira 이슈 키(FE1-1234)나 이슈 주소가 아닙니다. 이슈가 없으면 비워 두세요." };
  if (f.issueRequired && !jiraKey) return { ok: false, error: "가벼운 수정은 Jira 이슈 키나 주소가 있어야 합니다." };
  const env = i.env ?? "";
  if (!INTAKE_ENVS.includes(env)) return { ok: false, error: "배포·검증 환경은 dev, rc1, rc4 중 하나입니다." };
  if (env && !f.env) return { ok: false, error: "이 종류는 배포·검증을 하지 않습니다." };
  if (env && !jiraKey) return { ok: false, error: "Jira 이슈가 없는 작업은 배포하지 않습니다. 통합에서 기준 브랜치로 PR 까지 만듭니다." };
  const base = (i.base ?? "").trim();
  if (base && !f.base) return { ok: false, error: "이 종류는 기준 브랜치를 받지 않습니다." };
  if (base && !BRANCH_RE.test(base)) return { ok: false, error: "기준 브랜치 이름이 올바르지 않습니다(영문·숫자·. _ / - 만)." };
  // 양식만 넣고 채우지 않은 내용은 빈 것으로 본다(request.md 에 빈 양식을 넘기지 않는다)
  const note = hasContent(i.note ?? "") ? (i.note ?? "").trim() : "";
  if (i.kind === "light") {
    if (!note) return { ok: false, error: "미리 분석한 내용(고칠 파일, 원인, 고칠 방법)을 적어 주세요." };
    if (note.length > LIGHT_NOTE_MAX) return { ok: false, error: `미리 분석한 내용은 ${LIGHT_NOTE_MAX.toLocaleString()}자까지입니다.` };
  } else {
    if (!jiraKey && !note) return { ok: false, error: `Jira 이슈가 없으면 내용(${KINDS[i.kind].noteLabel})을 적어 주세요.` };
    if (note.length > NOTE_MAX) return { ok: false, error: `내용은 ${NOTE_MAX.toLocaleString()}자까지입니다.` };
  }
  return { ok: true, kind: i.kind, jiraKey, env, base, note };
}

/** 검사를 통과한 입력과 오더 키로 /do 명령을 만든다. 키가 아직 없으면(미리 보기) 자리표시를 쓴다 */
export function intakeCommand(c: Extract<IntakeCheck, { ok: true }>, key?: string): string {
  const k = key || c.jiraKey || TASK_KEY_PLACEHOLDER;
  if (c.kind === "light") return `/do ${k} light auto${c.env ? ` env=${c.env}` : ""} ${c.note}`;
  return [`/do ${k} auto 종류=${KIND_ARG[c.kind]}`, c.base && `base=${c.base}`, c.env && `env=${c.env}`].filter(Boolean).join(" ");
}

/** 내용을 request.md 로 넘기는가(가벼운 수정은 명령 뒤에 붙인다) */
export const usesRequestFile = (c: Extract<IntakeCheck, { ok: true }>) => c.kind !== "light" && !!c.note;

/** 종류마다 화면 문구. issue 는 Jira 이슈가 있는가 */
export interface KindCopy {
  name: string;
  line: string;
  end: string;
  noteLabel: string;
  notePlaceholder: string;
  /** [양식 넣기] 로 채우는 틀 */
  template: string;
  steps: (env: IntakeEnv, issue: boolean) => { text: string; off?: boolean }[];
  note?: string;
  agree: (env: IntakeEnv, issue: boolean) => string;
  done: (env: IntakeEnv, issue: boolean) => string;
}

const envName = (env: IntakeEnv) => (env ? `${env} 배포·검증까지` : "통합(커밋·푸시)까지");
const readWhat = (issue: boolean) => (issue ? "이슈와 적어 주신 내용을" : "적어 주신 내용을");

export const KINDS: Record<IntakeKind, KindCopy> = {
  dev: {
    name: "개발",
    line: "코드를 고쳐 동작을 바꿉니다",
    end: "통합 또는 배포·검증까지",
    noteLabel: "만들 내용",
    notePlaceholder: "바꿀 동작, 지금 동작과 기대 동작, 대상 화면과 저장소\nJira 이슈가 있으면 덧붙일 말만 적어도 됩니다",
    template: "## 바꿀 동작\n- \n\n## 지금 동작과 기대 동작\n- 지금: \n- 기대: \n\n## 대상 화면과 저장소\n- \n\n## 참고 자료 (링크·디자인·기획서)\n- \n",
    steps: (env, issue) => [
      { text: `설계: ${readWhat(issue)} 읽고 담당자를 정한 뒤 설계를 스스로 쓰고 확정합니다.` },
      { text: "구현과 리뷰: 코드를 고치고 리뷰 지적이 없어질 때까지 고칩니다." },
      { text: issue ? "통합: 작업 브랜치에 커밋하고 푸시합니다." : "통합: 작업 브랜치에 커밋·푸시하고 기준 브랜치로 PR 을 만듭니다. 머지는 직접 해 주세요." },
      { text: "배포: 고른 환경으로 PR을 머지하고 빌드해 반영합니다.", off: !env },
      { text: "검증: 브라우저로 시험하고, 실패하면 고쳐 다시 배포·검증합니다(2번까지).", off: !env },
    ],
    agree: (env, issue) =>
      env ? `${env}으로 머지·배포·검증까지 자동으로 진행되는 것을 확인했습니다` : issue ? "작업 브랜치 커밋·푸시까지 자동으로 진행되는 것을 확인했습니다" : "작업 브랜치 커밋·푸시와 PR 만들기까지 자동으로 진행되는 것을 확인했습니다",
    done: (env, issue) => (issue ? `${envName(env)} 사람에게 묻지 않고 진행합니다` : "PR 만들기까지 사람에게 묻지 않고 진행합니다. 배포·검증은 하지 않습니다"),
  },
  doc: {
    name: "문서",
    line: "남길 글을 쓰고 올립니다",
    end: "통합(문서 올리기)까지",
    noteLabel: "쓸 내용",
    notePlaceholder: "무엇을 쓸지, 읽을 사람, 올릴 곳(저장소 경로·Confluence 위치), 근거 자료\nJira 이슈가 있으면 덧붙일 말만 적어도 됩니다",
    template: "## 무엇을 쓸지\n- \n\n## 읽을 사람\n- \n\n## 올릴 곳 (저장소 경로, Confluence 위치)\n- \n\n## 근거 자료 (링크·코드·문서)\n- \n",
    steps: (_env, issue) => [
      { text: `설계: ${readWhat(issue)} 읽고 무엇을 어디에 쓸지 정합니다.` },
      { text: "산출과 리뷰: 글을 쓰고 리뷰 지적이 없어질 때까지 고칩니다." },
      { text: "통합: 저장소 문서면 커밋·푸시하고, 위키 등 올릴 곳이 있으면 올립니다." },
      { text: "끝: 결과를 확인하고 해결 처리해 주세요." },
    ],
    note: "코드를 고쳐야만 풀리는 일이면 개발자를 켜지 않고 \"개발로 다시 접수할까요\" 질문을 남깁니다.",
    agree: () => "글을 쓰고 커밋·푸시하거나 올릴 곳에 올리는 것까지 자동으로 진행되는 것을 확인했습니다",
    done: () => "글을 쓰고 올리기까지 사람에게 묻지 않고 진행합니다. 배포·검증은 하지 않습니다",
  },
  research: {
    name: "조사",
    line: "알아보고 보고서를 남깁니다",
    end: "보고서까지 · 저장소 변경 없음",
    noteLabel: "조사 의뢰",
    notePlaceholder: "알고 싶은 것, 왜 알아야 하나(무엇을 정하려고), 볼 범위와 안 볼 범위, 결과를 받을 사람과 형태, 참고 자료\nJira 이슈가 있으면 덧붙일 말만 적어도 됩니다",
    template:
      "## 알고 싶은 것\n- \n\n## 왜 알아야 하나 (무엇을 정하려고)\n- \n\n## 볼 범위와 보지 않을 범위\n- 볼 곳: \n- 보지 않을 곳: \n\n## 결과를 받을 사람과 형태\n- \n\n## 참고 자료 (링크·저장소·데이터)\n- \n",
    steps: (_env, issue) => [
      { text: `설계: ${readWhat(issue)} 읽고 무엇을 알아볼지와 결과를 판단할 기준을 정합니다.` },
      { text: "조사: 코드·문서·데이터를 읽고 보고서를 씁니다. 남이 볼 결과면 리뷰를 거칩니다." },
      { text: "끝: 보고서가 완료 쪽지에 실립니다. 저장소는 바뀌지 않습니다." },
    ],
    note: "고쳐야 한다는 결론이 나면 개발자를 켜지 않고 \"개발로 다시 접수할까요\" 질문을 남깁니다.",
    agree: () => "읽기와 보고서 작성만 하고 저장소는 바꾸지 않는 것을 확인했습니다",
    done: () => "보고서까지 사람에게 묻지 않고 진행합니다. 저장소는 바꾸지 않습니다",
  },
  light: {
    name: "가벼운 수정",
    line: "이미 분석한 작은 변경을 한 세션에",
    end: "리뷰는 별도 세션 · 통합 또는 배포·검증까지",
    noteLabel: "미리 분석한 내용",
    notePlaceholder: "고칠 파일, 원인, 고칠 방법\n예: src/order/Cart.tsx 합계가 쿠폰을 두 번 뺌 → applyCoupon 을 한 번만 부르게",
    template: "고칠 파일: \n원인: \n고칠 방법: \n",
    steps: (env) => [
      { text: "설계: 적어 주신 분석과 Jira 내용을 근거로 설계 문서와 테스트 계획을 씁니다. 원인을 새로 파고들지 않습니다. 분석 문서는 그동안 따로 씁니다." },
      { text: "스스로 확인: 분석이 코드와 맞는지 보고, 정할 수 있는 것은 정해 기록합니다. 사람만 정할 수 있는 것이 있을 때만 질문을 남깁니다." },
      { text: "구현과 리뷰: 고친 뒤 별도 세션이 리뷰하고, 지적이 있으면 고칩니다." },
      { text: "통합: 작업 브랜치에 커밋·푸시합니다." },
      { text: "배포: 고른 환경으로 PR을 만들고 리뷰봇 지적 반영, 머지, 빌드까지 합니다. 결과 문서는 그동안 따로 씁니다.", off: !env },
      { text: "검증: 이번 변경 시나리오와 회귀 확인 하나만 브라우저로 시험합니다.", off: !env },
    ],
    note: "세션 하나로 이어 갑니다. 리뷰만 별도 세션이 합니다. 문맥이 30만 넘게 늘면 새 세션이 light 로 이어 가고, PR에 변경요청이 달리면 일반 실행으로 넘어갑니다.",
    agree: (env) => (env ? `별도 세션 리뷰를 거쳐 ${env}으로 머지·배포·검증까지 자동으로 진행되는 것을 확인했습니다` : "별도 세션 리뷰를 거쳐 작업 브랜치 커밋·푸시까지 자동으로 진행되는 것을 확인했습니다"),
    done: (env) => `${envName(env)} 한 세션으로 진행합니다. 리뷰는 별도 세션이 합니다`,
  },
};

/** request.md 본문. 설계 세션이 Jira 이슈 본문 대신(또는 덧붙여) 읽는다 */
export function requestMarkdown(c: Extract<IntakeCheck, { ok: true }>, key: string, at: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const when = `${at.getFullYear()}-${p(at.getMonth() + 1)}-${p(at.getDate())} ${p(at.getHours())}:${p(at.getMinutes())}`;
  return [
    "# 접수 내용",
    "",
    `- **키**: ${key}`,
    `- **종류**: ${KINDS[c.kind].name}`,
    `- **Jira**: ${c.jiraKey || "없음"}`,
    `- **접수 시각**: ${when}`,
    "",
    `## ${KINDS[c.kind].noteLabel}`,
    "",
    c.note,
    "",
  ].join("\n");
}
