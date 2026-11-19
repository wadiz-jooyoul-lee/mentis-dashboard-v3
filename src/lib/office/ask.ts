import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pidAlive } from "@/lib/office/source";

// 질문: /do 세션이나 자동 실행이 사람의 답을 받으려고 오더 폴더에 남긴 파일. 여기서는 읽기만 한다
// 쓰는 쪽은 go-dobby 의 질문 헬퍼, 답을 적는 쪽은 mentis 대시보드다. 모양과 기본값은 대시보드의 질문 읽기와 같다
// 새 형식(v 2)은 일곱 칸을 갖고, 옛 형식(v 없음)은 제목, 이유, 할 일, 선택지만 갖는다

// 답하는 방식: 예/아니오, 하나 고르기, 글로 적기, 직접 해 주기
export type AskKind = "yesno" | "choice" | "input" | "action";
// 방법 하나. label 이 답으로 저장되는 이름이다
export interface AskOption { label: string; does: string; effect: string; recommended: boolean; reason: string }
export interface AskInfo {
  v: 1 | 2; // 2 는 일곱 칸을 가진 새 형식, 1 은 옛 형식
  kind: AskKind;
  title: string; // 질문 한 줄
  what: string; // 무슨 일이 있었나(새 형식)
  why: string; // 왜 스스로 정하지 못했나
  tried: string[]; // 지금까지 해 본 것(새 형식)
  options: AskOption[]; // 방법들(새 형식)
  choices: string[]; // 고를 수 있는 이름들. 새 형식은 방법 이름과 같다
  todo: string; // 글로 적기면 무엇을 적을지와 예시, 직접 해 주기면 할 일과 명령
  after: string; // 답한 뒤 이어지는 일(새 형식)
  note: string; // 했다고 답했는데 확인이 안 됐을 때 남는 메모
  created: string; // 질문을 남긴 시각 "YYYY-MM-DD HH:MM"
  hasCheck: boolean; // 직접 해 주기에 확인 명령이 있다(통과해야 이어 간다)
  from: string; // 묻는 쪽의 표시 이름. 자동 실행 장치가 남긴 질문이면 "자동 실행"
  waiting: boolean; // 자동 실행이 살아서 이 답을 기다리는 중인가. 아니면 답한 뒤 자동 실행을 다시 띄운다
}

const KINDS: readonly AskKind[] = ["yesno", "choice", "input", "action"];
const ROLE_NAME: Record<string, string> = { "analysis-agent": "기획자", "review-agent": "리뷰어", "deploy-agent": "배포담당", "test-agent": "테스터", "produce-agent": "산출자", shell: "자동 실행" };
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
const read = (f: string) => {
  try {
    return readFileSync(f, "utf8");
  } catch {
    return null;
  }
};

// 자동 실행이 살아서 답을 기다리는가. 판정 문구(플러그인이 프로세스를 보고 고른다)와 상태 문서의 자동 실행 줄 가운데 하나라도 그렇다고 하면 살아 있다
export function askWaiting(meta: string, key: string, text: string): boolean {
  if (text.startsWith("자동 실행이 ")) return true;
  const line = read(join(meta, key, "status.md"))?.match(/^- \*\*자동 실행\*\*:[ \t]*(.+)$/m)?.[1].trim() ?? "";
  return line.startsWith("실행 중") && pidAlive(Number(line.match(/pid\s+(\d+)/)?.[1] ?? 0));
}

// 아직 답을 받지 못한 질문을 화면이 쓰는 모양으로 읽는다. 파일이 없거나 깨졌거나 이미 답했으면 null
// text: 사람 차례 판정 도구가 준 할 일 문구(자동 실행이 기다리는 중인지 가리는 데 쓴다)
export function readOpenAsk(meta: string, key: string, text = ""): AskInfo | null {
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(read(join(meta, key, "ask.json")) ?? "null");
  } catch {
    return null;
  }
  if (!j || typeof j !== "object" || Array.isArray(j)) return null;
  if (str((j.answer as { value?: unknown } | null | undefined)?.value)) return null;
  const options: AskOption[] = Array.isArray(j.options)
    ? j.options
        .filter((o): o is Record<string, unknown> => !!o && typeof o === "object")
        .map((o) => ({ label: str(o.label), does: str(o.does), effect: str(o.effect), recommended: o.recommended === true, reason: str(o.reason) }))
        .filter((o) => o.label)
    : [];
  const choices = strs(j.choices);
  // 모르는 방식이 와도 답할 길이 남게 글로 적기로 받는다
  const kind = (KINDS as readonly string[]).includes(str(j.kind)) ? (str(j.kind) as AskKind) : "input";
  const role = str((j.from as { role?: unknown } | undefined)?.role);
  return {
    v: Number(j.v) >= 2 ? 2 : 1,
    kind,
    title: str(j.title),
    what: str(j.what),
    why: str(j.why),
    tried: strs(j.tried),
    options,
    choices: choices.length ? choices : kind === "yesno" ? ["예", "아니오"] : options.map((o) => o.label),
    todo: str(j.todo),
    after: str(j.after),
    note: str(j.note),
    created: str(j.created),
    hasCheck: !!str(j.check),
    from: role ? (ROLE_NAME[role] ?? "개발자") : "자동 실행",
    waiting: askWaiting(meta, key, text),
  };
}

// 옛 오더의 판단 요청(단계가 보류): 설계 문서에 적힌 "확인이 필요했던 것" 절의 본문. 없으면 ""
export function decisionDetail(meta: string, key: string): string {
  return read(join(meta, key, "design.md"))?.match(/(?:^|\n)##\s*확인이 필요했던 것[^\n]*\n([\s\S]*?)(?=\n##\s|$)/)?.[1]?.trim() ?? "";
}

// 스스로 정한 결정의 수: 설계 문서 "결정과 근거" 절의 표에서 둘째 칸부터 `자동 결정 —` 으로 시작하는 칸이 있는 줄(대시보드와 같은 규칙)
const AUTO_DECISION_RE = /^\*{0,2}\s*자동 결정\s*\*{0,2}\s*[—–-]\s*/;
const cells = (line: string) => line.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map((c) => c.trim());
export function autoDecisionCount(meta: string, key: string): number {
  const md = read(join(meta, key, "design.md"));
  if (!md || !md.includes("자동 결정")) return 0;
  const lines = md.split("\n");
  let fence = false, inSec = false, inTable = false, n = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s*(```|~~~)/.test(l)) fence = !fence;
    if (fence) continue;
    if (/^##? /.test(l)) {
      inSec = /^## 결정과 근거/.test(l);
      inTable = false;
      continue;
    }
    if (!inSec) continue;
    if (!/^\s*\|/.test(l)) {
      inTable = false;
      continue;
    }
    if (!inTable) {
      // 머리줄과 그 아래 구분줄이 있어야 표다. 둘은 세지 않는다
      if (/^\s*\|?\s*:?-{3,}/.test(lines[i + 1] ?? "")) {
        inTable = true;
        i++;
      }
      continue;
    }
    if (cells(l).some((c, at) => at > 0 && AUTO_DECISION_RE.test(c))) n++;
  }
  return n;
}
