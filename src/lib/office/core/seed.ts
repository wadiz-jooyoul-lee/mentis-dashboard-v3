import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { MODELS, type AgentState, type Artifact, type Book, type Model, type TableRole, type TaskState } from "@/lib/office/core/types";
import { CREW } from "@/lib/office/core/avatars";

export const DEFAULT_MODEL: Model = "claude-opus-5-5";
export const MODEL_DEFAULTS: Record<TableRole, Model> = { planner: DEFAULT_MODEL, developer: DEFAULT_MODEL, reviewer: DEFAULT_MODEL, intern: DEFAULT_MODEL, deployer: DEFAULT_MODEL, tester: DEFAULT_MODEL, producer: DEFAULT_MODEL };
const DOBBIES = 1; // 돌아다니는 도비 하나. 작업에는 앉지 않는다(canWork). 카페 도비와 프론트 도비는 화면에만 있고 인원에 들지 않는다
const HAIR = ["#3a2a22", "#1f1f26", "#6b3f2a", "#2c2440", "#4a3326"];


// 사무실 사람. 부서 없이 늘 같은 40명이다(아바타 39명과 도비 하나)
// 작업 테이블에 앉을 수 있는 사람. 도비는 작업에 참여하지 않는다
export const canWork = (a: AgentState) => a.persona !== "elf";
export function agentsOf(): AgentState[] {
  const base = { status: "rest" as const, location: { kind: "desk" as const }, ctx: 0 };
  return [
    ...CREW.map((avatar, i): AgentState => ({ ...base, id: `${avatar.group}-${avatar.member}`, avatar, name: avatar.name, persona: avatar.persona, hair: HAIR[(i * 3) % HAIR.length] })),
    ...Array.from({ length: DOBBIES }, (_, i): AgentState => ({ ...base, id: `dobby-${i + 1}`, name: DOBBIES > 1 ? `도비 ${i + 1}` : "도비", persona: "elf", hair: "" })),
  ];
}

// 버스의 첫 상태. 예전에는 오피스 DB 에서 읽었다. 작업 테이블과 서류철은 sync 티커가 메타 파일에서 다시 만든다.
// 역할별 모델만은 모델 창이 go-dobby 자동 실행용으로 써 둔 파일(role-models.json)에서 읽어, 재시작해도 고른 모델이 보이게 한다
export function emptyOffice(): { models: Record<TableRole, Model>; tasks: TaskState[]; books: Book[]; artifacts: Artifact[] } {
  const models = { ...MODEL_DEFAULTS };
  try {
    const saved = JSON.parse(readFileSync(roleModelsFile(), "utf8")) as Record<string, string>;
    for (const [r, m] of Object.entries(saved)) if (r in models && MODELS.some((x) => x.id === m)) models[r as TableRole] = m as Model;
  } catch {
    /* 파일이 없거나 깨졌으면 기본값 */
  }
  return { models, tasks: [], books: [], artifacts: [] };
}

// go-dobby 자동 실행(run.sh)이 읽는 역할별 모델 파일. 시험 서버는 GO_DOBBY_CONFIG_DIR 로 다른 곳을 쓴다
export const roleModelsFile = () => join(process.env.GO_DOBBY_CONFIG_DIR || join(homedir(), ".config", "go-dobby"), "role-models.json");
