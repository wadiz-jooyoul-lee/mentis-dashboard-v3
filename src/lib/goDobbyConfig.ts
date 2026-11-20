import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

// 스킬 설정 파일(config.env)을 설정 창에서 고친다. 규칙은 /dobby-init 과 같다:
// 바뀐 줄만 고치고 다른 줄·주석·순서는 그대로 두며, 확인 없이 줄을 지우지 않고, 쓰기 전에 백업한다.

export type Tier = "danger" | "caution" | "normal";
type Kind = "path" | "url" | "envmap" | "int" | "branch" | "text";

export type Spec = {
  key: string;
  label: string;
  group: string;
  tier: Tier;
  kind: Kind;
  secret?: boolean;
  def: string | null;
  applies: string;
  cautions: string[];
  before?: string[];
  after: string[];
  /** 바꾸면 대시보드를 다시 켜야 다 반영된다 */
  restart?: boolean;
};

const TEST_FAIL = "틀리면 로그인이 필요한 시험이 실패하거나 보류됩니다.";

export const SPECS: Spec[] = [
  {
    key: "ORCHESTRATION_META_PATH",
    label: "메타 폴더",
    group: "경로",
    tier: "danger",
    kind: "path",
    def: "작업 폴더/meta",
    applies: "대시보드 화면은 저장 즉시, 사무실 화면은 대시보드를 다시 켠 뒤, 스킬은 다음 실행부터",
    cautions: [
      "경로만 바꿉니다. 파일을 옮겨 주지 않습니다.",
      "메타 폴더 안에는 오더 기록 말고도 대시보드 자료가 함께 있습니다. 실행 기록(.mentis-jobs), 세션 표시(.presence), 고정한 오더(.dashboard-pins.json), 아바타 소감(.mentis-quips)입니다. 새 폴더로 바꾸면 이것들도 비어 보입니다.",
      "사무실 동기화와 진행 소식 수신은 서버를 켤 때 한 번만 폴더를 정합니다. 그래서 대시보드를 다시 켜기 전까지는 옛 폴더를 봅니다.",
      "그 사이에 실행을 시작하면 기록이 두 폴더로 나뉩니다. 자동 실행 스크립트는 시작할 때 읽은 값을 끝까지 쓰고, 단계마다 새로 뜨는 세션은 새 값을 쓰기 때문입니다.",
    ],
    before: ["기존 기록을 이어 쓰려면 옛 폴더 내용을 새 폴더로 먼저 복사합니다. 입력칸 아래에 새 폴더 안 오더 개수가 보입니다."],
    after: [
      "대시보드를 다시 켭니다(pnpm serve).",
      "오더 목록의 개수가 바꾸기 전과 같은지 확인합니다.",
      "사무실 화면에 오더 탁자가 다시 나오는지 확인합니다.",
      "옛 메타 폴더는 며칠 써 보고 문제가 없을 때 지웁니다.",
    ],
    restart: true,
  },
  {
    key: "ORCHESTRATION_WORKSPACE",
    label: "작업 폴더",
    group: "경로",
    tier: "danger",
    kind: "path",
    def: "$HOME/work/dobby-workspace",
    applies: "대시보드 화면은 저장 즉시, 스킬은 다음 실행부터",
    cautions: [
      "이미 만든 작업 폴더(git 워크트리, 저장소 하나에서 브랜치를 따로 꺼내 둔 폴더)는 옛 자리에 남습니다.",
      "대시보드의 작업 폴더 표시와 워크트리 정리 스킬(/dobby-end)은 새 자리의 subtree 폴더만 봅니다. 옛 폴더들은 화면에서 사라지고 스킬로 정리할 수도 없게 됩니다.",
      "메타 폴더를 따로 적지 않았다면 메타 위치도 함께 바뀝니다. 그때는 메타 폴더의 주의사항도 모두 해당합니다.",
    ],
    before: [
      "해결된 오더의 작업 폴더는 /dobby-end 로 먼저 정리합니다. 바꾼 뒤에는 이 스킬이 옛 폴더를 찾지 못합니다.",
      "진행 중인 오더의 작업 폴더가 옛 자리에 남아 있으면 바꿀 수 없습니다.",
    ],
    after: [
      "새 작업 폴더 아래에 subtree 폴더가 있는지 확인합니다.",
      "옛 자리에 남은 작업 폴더는 원본 저장소에서 git worktree remove {폴더} 로 지웁니다.",
    ],
  },
  {
    key: "ORCHESTRATION_REPOS_ROOT",
    label: "원본 저장소 위치",
    group: "경로",
    tier: "caution",
    kind: "path",
    def: "$HOME/work/repos",
    applies: "대시보드는 저장 즉시, 스킬은 다음 실행부터",
    cautions: [
      "착수 단계가 이 폴더 아래 {저장소 이름} 폴더에서 원본 소스를 찾습니다. 없으면 소스를 찾지 못합니다.",
      "팀 이슈 조사도 이 폴더의 저장소를 읽습니다.",
      "도서관 위치를 따로 적지 않았다면 도서관 위치도 함께 바뀝니다.",
    ],
    after: ["팀 이슈 현황 화면에서 조사를 다시 돌립니다."],
  },
  {
    key: "ORCHESTRATION_DOCS_ROOT",
    label: "도서관 위치",
    group: "경로",
    tier: "caution",
    kind: "path",
    def: "$HOME/work/repos/docs",
    applies: "대시보드는 저장 즉시, 스킬은 다음 실행부터",
    cautions: [
      "틀리면 설계 단계가 문서 없이 코드만 보고 진행합니다.",
      "팀 이슈 현황 기록(_dobby-jobs/latest.json)이 이 폴더 안에 있습니다. 바꾸면 팀 이슈 현황 화면이 비어 보입니다.",
    ],
    after: ["팀 이슈 현황 화면에서 조사를 다시 돌립니다."],
  },
  {
    key: "ORCHESTRATION_DEFAULT_BASE",
    label: "기본 베이스 브랜치",
    group: "브랜치와 환경",
    tier: "caution",
    kind: "branch",
    def: "master",
    applies: "대시보드는 저장 즉시, 스킬은 다음 오더부터",
    cautions: [
      "새 오더의 작업 브랜치를 따는 출발점이 바뀝니다.",
      "대시보드는 모든 오더의 변경 파일 비교에 이 값 하나를 씁니다. 그래서 진행 중인 오더의 변경 파일 목록도 바로 달라집니다.",
    ],
    after: ["진행 중이던 오더 화면에서 변경 파일 목록이 맞는지 확인합니다."],
  },
  {
    key: "ORCHESTRATION_ENV_MAP",
    label: "시험 환경 주소",
    group: "브랜치와 환경",
    tier: "caution",
    kind: "envmap",
    def: "dev=dev.wadiz.io,rc=rc.wadiz.kr,rc2=rc2.wadiz.kr,rc4=rc4.wadiz.io",
    applies: "다음 시험부터",
    cautions: [
      "형식은 이름=주소 를 쉼표로 잇는 것입니다. 예: dev=dev.wadiz.io,rc4=rc4.wadiz.io",
      "형식이 깨지면 시험 스킬이 환경 주소를 찾지 못합니다.",
      "지금 있는 환경 이름을 지우면 그 환경에 배포한 뒤 검증이 실패합니다.",
    ],
    after: ["다음 시험 회차에서 주소가 맞게 열리는지 확인합니다."],
  },
  {
    key: "JIRA_BASE_URL",
    label: "Jira 주소",
    group: "연결",
    tier: "normal",
    kind: "url",
    def: "https://wadiz.atlassian.net",
    applies: "대시보드는 저장 즉시, 스킬은 다음 실행부터",
    cautions: ["틀리면 이슈 조회와 링크가 모두 실패합니다."],
    after: ["오더 화면의 Jira 링크가 열리는지 확인합니다."],
  },
  {
    key: "ORCHESTRATION_DASHBOARD_URL",
    label: "대시보드 주소",
    group: "연결",
    tier: "caution",
    kind: "url",
    def: "http://localhost:7253",
    applies: "다음 설계 확정부터",
    cautions: [
      "설계를 확정한 뒤 자동 실행을 이 주소의 대시보드에 맡깁니다. 틀리면 넘기기가 실패합니다.",
      "저장하기 전에 그 주소로 대시보드가 응답하는지 확인합니다.",
    ],
    after: ["다음 설계 확정 때 자동 실행이 대시보드에 뜨는지 확인합니다."],
  },
  {
    key: "ORCHESTRATION_BACKUP_DIR",
    label: "메타 백업 위치",
    group: "백업",
    tier: "caution",
    kind: "path",
    def: "$HOME/claude-projects-backup/orchestration",
    applies: "대시보드 백업 화면은 저장 즉시, 해결 처리는 다음 실행부터",
    cautions: [
      "해결 처리와 대시보드 백업이 이 폴더에 메타 백업을 씁니다.",
      "옛 폴더의 백업은 옮겨지지 않습니다. 백업 화면 목록은 새 폴더 기준으로 보입니다.",
    ],
    after: ["백업 화면에서 새 폴더가 보이는지 확인합니다.", "옛 폴더의 백업이 필요하면 직접 옮깁니다."],
  },
  {
    key: "ORCHESTRATION_BACKUP_KEEP_DAYS",
    label: "진행 중 백업 보관 일수",
    group: "백업",
    tier: "caution",
    kind: "int",
    def: "14",
    applies: "다음 백업 정리부터",
    cautions: ["1 이상 정수입니다.", "줄이면 기간을 넘은 백업이 다음 정리 때 지워집니다. 지워진 백업은 되살릴 수 없습니다."],
    after: ["백업 화면의 보관 기간 표시가 바뀌었는지 확인합니다."],
  },
  {
    key: "TEST_LOGIN_ID",
    label: "서포터 시험 계정",
    group: "시험 계정",
    tier: "normal",
    kind: "text",
    def: null,
    applies: "다음 시험부터",
    cautions: [`서포터로 로그인하는 시험에 씁니다. ${TEST_FAIL}`, "비우면 로그인이 필요한 시험을 건너뜁니다."],
    after: [],
  },
  {
    key: "TEST_LOGIN_PW",
    label: "서포터 시험 비밀번호",
    group: "시험 계정",
    tier: "normal",
    kind: "text",
    secret: true,
    def: null,
    applies: "다음 시험부터",
    cautions: ["값은 화면에 보이지 않습니다. 새 값을 적으면 바뀝니다.", "메이커와 관리자 비밀번호가 없으면 이 값을 같이 씁니다."],
    after: [],
  },
  {
    key: "TEST_MAKER_LOGIN_ID",
    label: "메이커 시험 계정",
    group: "시험 계정",
    tier: "normal",
    kind: "text",
    def: null,
    applies: "다음 시험부터",
    cautions: [`메이커로 로그인하는 시험에 씁니다. ${TEST_FAIL}`, "비우면 시험 시작 전에 아이디를 묻습니다. 자동 실행은 그 자리에서 멈춥니다."],
    after: [],
  },
  {
    key: "TEST_MAKER_LOGIN_PW",
    label: "메이커 시험 비밀번호",
    group: "시험 계정",
    tier: "normal",
    kind: "text",
    secret: true,
    def: "서포터 비밀번호",
    applies: "다음 시험부터",
    cautions: ["값은 화면에 보이지 않습니다.", "비우면 서포터 비밀번호(TEST_LOGIN_PW)를 씁니다."],
    after: [],
  },
  {
    key: "TEST_ADMIN_LOGIN_ID",
    label: "관리자 시험 계정",
    group: "시험 계정",
    tier: "normal",
    kind: "text",
    def: null,
    applies: "다음 시험부터",
    cautions: [`관리자로 로그인하는 시험에 씁니다. ${TEST_FAIL}`, "비우면 시험 시작 전에 아이디를 묻습니다. 자동 실행은 그 자리에서 멈춥니다."],
    after: [],
  },
  {
    key: "TEST_ADMIN_LOGIN_PW",
    label: "관리자 시험 비밀번호",
    group: "시험 계정",
    tier: "normal",
    kind: "text",
    secret: true,
    def: "서포터 비밀번호",
    applies: "다음 시험부터",
    cautions: ["값은 화면에 보이지 않습니다.", "비우면 서포터 비밀번호(TEST_LOGIN_PW)를 씁니다."],
    after: [],
  },
];

export const specOf = (key: string) => SPECS.find((s) => s.key === key);

// ── 파일 읽기 ──
export const configFile = () => path.join(os.homedir(), ".config", "go-dobby", "config.env");

const LINE = /^(\s*)(export\s+)?([A-Z_][A-Z0-9_]*)=(.*)$/;

type Entry = { index: number; indent: string; exp: string; quote: string; value: string };

function parse(text: string): { lines: string[]; entries: Map<string, Entry> } {
  const lines = text.split("\n");
  const entries = new Map<string, Entry>();
  lines.forEach((line, index) => {
    const m = line.match(LINE);
    if (!m) return;
    const raw = m[4].trim();
    const q = raw[0] === '"' || raw[0] === "'" ? raw[0] : "";
    const value = q && raw.endsWith(q) && raw.length >= 2 ? raw.slice(1, -1) : raw;
    entries.set(m[3], { index, indent: m[1], exp: m[2] ?? "", quote: q, value });
  });
  return { lines, entries };
}

export function readConfig(): { exists: boolean; values: Map<string, string> } {
  try {
    const { entries } = parse(fs.readFileSync(configFile(), "utf8"));
    return { exists: true, values: new Map([...entries].map(([k, e]) => [k, e.value])) };
  } catch {
    return { exists: false, values: new Map() };
  }
}

export function expandHome(v: string): string {
  let s = v.trim().replace(/\$\{?HOME\}?/g, os.homedir());
  if (s.startsWith("~")) s = path.join(os.homedir(), s.slice(1));
  return s;
}

// ── 값 검사 ──
export type Check = { errors: string[]; info: string[] };

const isDir = (p: string) => {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
};
const subdirs = (p: string) => {
  try {
    return fs.readdirSync(p, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith("."));
  } catch {
    return [];
  }
};

async function reachable(url: string): Promise<boolean> {
  try {
    const r = await fetch(`${url.replace(/\/$/, "")}/api/lan`, { signal: AbortSignal.timeout(2500), cache: "no-store" });
    return r.ok;
  } catch {
    return false;
  }
}

/** value 가 빈 문자열이면 그 줄을 지워 기본값으로 돌아간다는 뜻이다. */
export async function checkValue(key: string, value: string, current: Map<string, string>): Promise<Check> {
  const s = specOf(key);
  const errors: string[] = [];
  const info: string[] = [];
  if (!s) return { errors: ["모르는 항목입니다."], info };
  if (value === "") {
    info.push(s.def ? `비우면 줄을 지우고 기본값(${s.def})을 씁니다.` : "비우면 줄을 지웁니다.");
    return { errors, info };
  }
  if (/[\n\r]/.test(value)) errors.push("줄바꿈은 넣을 수 없습니다.");
  if (s.secret ? value.includes("'") : /["`\\]/.test(value))
    errors.push(s.secret ? "작은따옴표(')는 넣을 수 없습니다." : '큰따옴표("), 백틱(`), 역슬래시(\\)는 넣을 수 없습니다.');
  if (errors.length) return { errors, info };

  if (s.kind === "path") {
    const p = expandHome(value);
    if (!path.isAbsolute(p)) errors.push("절대 경로나 $HOME, ~ 로 시작하는 경로를 적어 주세요.");
    else if (isDir(p)) {
      if (key === "ORCHESTRATION_META_PATH") {
        const n = subdirs(p).filter((d) => fs.existsSync(path.join(p, d.name, "status.md"))).length;
        info.push(`폴더가 있습니다. 오더 폴더 ${n}개가 들어 있습니다.`);
      } else if (key === "ORCHESTRATION_REPOS_ROOT") {
        const n = subdirs(p).filter((d) => fs.existsSync(path.join(p, d.name, ".git"))).length;
        info.push(`폴더가 있습니다. git 저장소 ${n}개가 들어 있습니다.`);
        if (n === 0) errors.push("git 저장소가 하나도 없습니다.");
      } else info.push("폴더가 있습니다.");
    } else if (key === "ORCHESTRATION_BACKUP_DIR") info.push("폴더가 아직 없습니다. 첫 백업 때 만들어집니다.");
    else errors.push(`폴더가 없습니다: ${p}`);
  }
  if (s.kind === "url") {
    if (!/^https?:\/\/[^\s]+$/.test(value)) errors.push("http:// 또는 https:// 로 시작하는 주소를 적어 주세요.");
    else if (key === "ORCHESTRATION_DASHBOARD_URL") {
      if (await reachable(value)) info.push("그 주소에서 대시보드가 응답합니다.");
      else errors.push("그 주소에서 대시보드가 응답하지 않습니다.");
    }
  }
  if (s.kind === "envmap") {
    const pairs = value.split(",").map((x) => x.trim());
    if (!pairs.every((x) => /^[a-z0-9]+=[^=\s]+$/i.test(x))) errors.push("이름=주소 를 쉼표로 이어 적어 주세요.");
    else {
      const names = new Set(pairs.map((x) => x.split("=")[0]));
      const was = (current.get(key) ?? "").split(",").map((x) => x.split("=")[0].trim()).filter(Boolean);
      const gone = was.filter((n) => !names.has(n));
      if (gone.length) info.push(`빠지는 환경: ${gone.join(", ")}. 이 환경에 배포한 뒤 검증이 실패합니다.`);
    }
  }
  if (s.kind === "int" && !/^[1-9]\d*$/.test(value)) errors.push("1 이상 정수를 적어 주세요.");
  if (s.kind === "branch") {
    if (!/^[A-Za-z0-9._/-]+$/.test(value)) errors.push("브랜치 이름에 쓸 수 없는 글자가 있습니다.");
    else {
      const root = expandHome(current.get("ORCHESTRATION_REPOS_ROOT") ?? "$HOME/work/repos");
      const repos = subdirs(root).filter((d) => fs.existsSync(path.join(root, d.name, ".git")));
      const has = repos.filter((d) => {
        try {
          execFileSync("git", ["-C", path.join(root, d.name), "rev-parse", "--verify", "--quiet", `refs/remotes/origin/${value}`], { stdio: "ignore" });
          return true;
        } catch {
          return false;
        }
      });
      info.push(`원본 저장소 ${repos.length}개 중 ${has.length}개에 origin/${value} 가 있습니다${has.length ? `: ${has.map((d) => d.name).join(", ")}` : ""}.`);
    }
  }
  return { errors, info };
}

// ── 쓰기 ──
const stamp = (d = new Date()) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};

/** changes: 키 → 새 값(빈 문자열이면 그 줄을 지운다). 백업 파일 경로를 돌려준다. */
export function applyChanges(changes: Record<string, string>): string {
  const file = configFile();
  const text = fs.readFileSync(file, "utf8");
  const { lines, entries } = parse(text);
  const drop = new Set<number>();
  const append: string[] = [];
  for (const [key, value] of Object.entries(changes)) {
    const s = specOf(key)!;
    const e = entries.get(key);
    if (value === "") {
      if (e) drop.add(e.index);
      continue;
    }
    // 비밀번호는 $ 가 풀리지 않게 작은따옴표, 나머지는 $HOME 이 풀리게 큰따옴표
    const q = s.secret ? "'" : e?.quote || '"';
    if (e) lines[e.index] = `${e.indent}${e.exp}${key}=${q}${value}${q}`;
    else append.push(`export ${key}=${q}${value}${q}`);
  }
  let out = lines.filter((_, i) => !drop.has(i));
  if (append.length) {
    while (out.length && out[out.length - 1] === "") out.pop();
    out = [...out, ...append, ""];
  }
  const backup = `${file}.bak-${stamp()}`;
  const mode = fs.statSync(file).mode & 0o777;
  fs.copyFileSync(file, backup);
  fs.chmodSync(backup, mode);
  fs.writeFileSync(`${file}.tmp`, out.join("\n"), { mode });
  fs.chmodSync(`${file}.tmp`, mode);
  fs.renameSync(`${file}.tmp`, file);
  return backup;
}
