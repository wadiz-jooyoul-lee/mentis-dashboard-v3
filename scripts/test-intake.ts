/**
 * 접수 규칙 시험: npx tsx scripts/test-intake.ts
 * 오피스 agent-office/scripts/test/intake.ts 와 같은 경우표를 쓴다(두 저장소 규칙이 어긋나지 않게).
 * 실행 API 는 부르지 않는다. 작업 키 잡기와 request.md 쓰기는 임시 폴더에서 시험한다.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkIntake, intakeCommand, jiraKeyOf, type Intake } from "../src/lib/intake";
import { allocateTaskKey, prepareIntake } from "../src/lib/jobs";

let fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : `\n     got  ${JSON.stringify(got)}\n     want ${JSON.stringify(want)}`}`);
};
const cmd = (i: Intake) => {
  const c = checkIntake(i);
  return c.ok ? intakeCommand(c) : `ERR ${c.error}`;
};

// 같은 경우표 — 오피스 시험과 같아야 한다
const CASES: [string, Intake, string][] = [
  ["개발 + 이슈", { kind: "dev", target: "FE1-1234" }, "/do FE1-1234 auto 종류=개발"],
  ["개발 + 이슈 주소 + 환경 + 브랜치", { kind: "dev", target: "https://wadiz.atlassian.net/browse/FE1-1234", env: "rc4", base: "rc4" }, "/do FE1-1234 auto 종류=개발 base=rc4 env=rc4"],
  ["개발 + 이슈 없음 + 내용", { kind: "dev", note: "버튼 색 바꾸기" }, "/do TASK-… auto 종류=개발"],
  ["개발 + 이슈 없음 + 환경", { kind: "dev", env: "dev", note: "x" }, "ERR Jira 이슈가 없는 작업은 배포하지 않습니다. 통합에서 기준 브랜치로 PR 까지 만듭니다."],
  ["개발 + 이슈 없음 + 내용 없음", { kind: "dev" }, "ERR Jira 이슈가 없으면 내용(만들 내용)을 적어 주세요."],
  ["문서 + 이슈 없음", { kind: "doc", note: "가이드", base: "main" }, "/do TASK-… auto 종류=문서 base=main"],
  ["문서 + 환경", { kind: "doc", target: "FE1-1", env: "dev" }, "ERR 이 종류는 배포·검증을 하지 않습니다."],
  ["조사 + 이슈 없음", { kind: "research", note: "결제 실패 원인" }, "/do TASK-… auto 종류=조사"],
  ["조사 + 이슈 + 덧붙일 말", { kind: "research", target: "FE1-9", note: "로그 위주로" }, "/do FE1-9 auto 종류=조사"],
  ["조사 + 브랜치", { kind: "research", note: "x", base: "main" }, "ERR 이 종류는 기준 브랜치를 받지 않습니다."],
  ["조사 + 내용 없음", { kind: "research" }, "ERR Jira 이슈가 없으면 내용(조사 의뢰)을 적어 주세요."],
  ["Jira 아닌 글", { kind: "research", target: "결제 조사", note: "x" }, "ERR Jira 이슈 키(FE1-1234)나 이슈 주소가 아닙니다. 이슈가 없으면 비워 두세요."],
  ["TASK 키 직접", { kind: "research", target: "TASK-123", note: "x" }, "ERR Jira 이슈 키(FE1-1234)나 이슈 주소가 아닙니다. 이슈가 없으면 비워 두세요."],
  ["가벼운 수정", { kind: "light", target: "FE1-7", env: "rc1", note: "Cart.tsx 고침" }, "/do FE1-7 light auto env=rc1 Cart.tsx 고침"],
  ["가벼운 수정 + 이슈 없음", { kind: "light", note: "x" }, "ERR 가벼운 수정은 Jira 이슈 키나 주소가 있어야 합니다."],
  ["가벼운 수정 2001자", { kind: "light", target: "FE1-7", note: "a".repeat(2001) }, "ERR 미리 분석한 내용은 2,000자까지입니다."],
  ["조사 10000자", { kind: "research", note: "a".repeat(10000) }, "/do TASK-… auto 종류=조사"],
  ["조사 10001자", { kind: "research", note: "a".repeat(10001) }, "ERR 내용은 10,000자까지입니다."],
  ["나쁜 브랜치", { kind: "dev", target: "FE1-1", base: "a..b" }, "ERR 기준 브랜치 이름이 올바르지 않습니다(영문·숫자·. _ / - 만)."],
  ["조사 + 빈 양식만", { kind: "research", note: "## 알고 싶은 것\n- \n\n## 볼 범위\n- 볼 곳: \n" }, "ERR Jira 이슈가 없으면 내용(조사 의뢰)을 적어 주세요."],
  ["조사 + 양식에 한 줄", { kind: "research", note: "## 알고 싶은 것\n- 결제 실패 원인\n" }, "/do TASK-… auto 종류=조사"],
  ["가벼운 수정 + 빈 양식", { kind: "light", target: "FE1-7", note: "고칠 파일: \n원인: \n고칠 방법: \n" }, "ERR 미리 분석한 내용(고칠 파일, 원인, 고칠 방법)을 적어 주세요."],
  ["가벼운 수정 + 칸 채움", { kind: "light", target: "FE1-7", note: "고칠 파일: a.ts" }, "/do FE1-7 light auto 고칠 파일: a.ts"],
];
for (const [name, i, want] of CASES) eq(name, cmd(i), want);

eq("jiraKeyOf 주소 뒤 경로", jiraKeyOf("https://x.atlassian.net/browse/QA-22647?focused=1"), "QA-22647");
eq("jiraKeyOf 소문자", jiraKeyOf("fe1-1"), "");

// 작업 키 잡기와 request.md
const root = fs.mkdtempSync(path.join(os.tmpdir(), "intake-"));
try {
  const at = new Date(2026, 10, 15, 14, 5);
  fs.mkdirSync(path.join(root, "TASK-261115a"));
  fs.mkdirSync(path.join(root, "TASK-payment-api"));
  eq("첫 키는 1(옛 키는 번호로 치지 않음)", allocateTaskKey(root), "TASK-1");
  eq("둘째 키", allocateTaskKey(root), "TASK-2");
  fs.mkdirSync(path.join(root, ".mentis-jobs", "TASK-3"), { recursive: true });
  fs.mkdirSync(path.join(root, ".mentis-jobs", "quips-TASK-90"), { recursive: true });
  fs.mkdirSync(path.join(root, ".discarded", "TASK-4--20261115-1200"), { recursive: true });
  eq("잡 기록·휴지통 번호 다음", allocateTaskKey(root), "TASK-5");
  fs.rmSync(path.join(root, "TASK-2"), { recursive: true });
  eq("지운 번호는 다시 쓰지 않음", allocateTaskKey(root), "TASK-6");
  eq("두 자리로 이어짐", (() => { fs.mkdirSync(path.join(root, "TASK-9")); return allocateTaskKey(root); })(), "TASK-10");

  const p = prepareIntake("", "", { kind: "research", note: "결제 실패 원인을 알아봐 줘" }, root, at);
  eq("접수 키", "key" in p ? p.key : p.reason, "TASK-11");
  eq("접수 명령", "prompt" in p ? p.prompt : "", "/do TASK-11 auto 종류=조사");
  const req = fs.readFileSync(path.join(root, "TASK-11", "request.md"), "utf8");
  eq("request.md 내용", req.includes("## 조사 의뢰\n\n결제 실패 원인을 알아봐 줘") && req.includes("- **Jira**: 없음"), true);
  if ("release" in p) p.release?.();
  eq("되돌리면 폴더 지움", fs.existsSync(path.join(root, "TASK-11")), false);

  const j = prepareIntake("FE1-55", "", { kind: "doc", note: "덧붙임" }, root, at);
  eq("이슈 + 덧붙일 말 키", "key" in j ? j.key : j.reason, "FE1-55");
  eq("이슈 + 덧붙일 말 request.md", fs.existsSync(path.join(root, "FE1-55", "request.md")), true);
  fs.writeFileSync(path.join(root, "FE1-55", "status.md"), "# x");
  const again = prepareIntake("FE1-55", "", { kind: "doc", note: "또" }, root, at);
  eq("시작한 오더에 덧붙이기 거절", "reason" in again, true);
  const noNote = prepareIntake("FE1-55", "", { kind: "doc" }, root, at);
  eq("시작한 오더 다시 띄우기(내용 없음)", "key" in noNote ? noNote.prompt : noNote.reason, "/do FE1-55 auto 종류=문서");
  const blank = prepareIntake("FE1-56", "", { kind: "doc", note: "## 무엇을 쓸지\n- \n" }, root, at);
  eq("이슈 + 빈 양식은 request.md 안 씀", "key" in blank && !fs.existsSync(path.join(root, "FE1-56")), true);
  const lite = prepareIntake("FE1-77", "", { kind: "light", note: "고칠 곳" }, root, at);
  eq("가벼운 수정은 request.md 안 씀", fs.existsSync(path.join(root, "FE1-77")), false);
  eq("가벼운 수정 명령", "prompt" in lite ? lite.prompt : "", "/do FE1-77 light auto 고칠 곳");
  eq("되돌린 번호는 다시 씀", allocateTaskKey(root), "TASK-11");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

console.log(fail ? `\n${fail}개 실패` : "\n모두 통과");
process.exit(fail ? 1 : 0);
