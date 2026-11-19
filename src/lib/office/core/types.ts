import type { AvatarMember } from "@/lib/office/core/avatars";

export type Model = "claude-opus-5-5" | "claude-sonnet-5-5" | "claude-haiku-5-5";
// 테이블 자리의 역할. 일반 사무실은 인턴, 도비 사무실은 배포담당을 쓴다
export type SeatRole = "planner" | "developer" | "reviewer" | "intern" | "deployer" | "tester";
// 도비 사무실의 산출자 자리까지 더한 자리 종류. 일반 사무실의 역할 표(lib/agent/roles.ts)가 SeatRole 에서 만들어지므로 산출자는 SeatRole 에 넣지 않는다
export type TableRole = SeatRole | "producer";
export type Env = "dev" | "rc1" | "rc4";
export type Persona = "calm" | "sunny" | "cool" | "perfect" | "elf";
export type AgentStatus = "rest" | "think" | "work" | "review" | "rush" | "happy";

export type AgentLocation = { kind: "desk" };

// 서류철이 지금 있는 곳: 프론트 데스크(쪽지), 일꾼 책상, 보고서 캐비닛
export type FolderAt = { kind: "board" } | { kind: "agent"; agentId: string } | { kind: "cabinet" };
// 마지막 작업 단위가 어떻게 끝났는지. 보고서 캐비닛에 보인다
export interface Report {
  by: string;
  result: string;
  at: number;
}

export interface QuipCtx {
  situation: string;
  vars: Record<string, string | number>;
  at: number;
}

export interface AgentState {
  id: string;
  avatar?: AvatarMember; // 없으면 그리던 캐릭터(도비)
  name: string;
  persona: Persona;
  hair: string;
  status: AgentStatus;
  location: AgentLocation;
  ctx: number; // 대화 크기 게이지 0~1
  quipCtx?: QuipCtx;
  doing?: string; // 지금 하는 일 한 줄
  doingTask?: string; // 지금 하는 일이 어느 작업의 것인지. 말풍선 머리에 이슈 번호와 제목을 붙인다
  asking?: boolean; // 사람에게 묻고 답을 기다림(머리 위에 물음표)
}

// 테이블 자리의 일하는 정도. work 전구 켜짐, wait 모래시계, idle 꺼짐
export type SeatWork = "work" | "wait" | "idle";
// 작업 테이블. 깃발 붙은 테이블 중심(x, y)과 역할마다 앉은 사람. 해산 전까지 사람이 바뀌지 않는다
export interface WorkTable {
  x: number;
  y: number;
  crew: Partial<Record<TableRole, string>>;
  roles?: TableRole[]; // 이 오더에 켜진 자리(도비 사무실). 없으면 사무실의 기본 다섯
  work?: Partial<Record<TableRole, SeatWork>>; // 메타에서 다시 읽으므로 저장하지 않는다
  stage?: string; // 깃발 둘째 줄의 큰 글자. 없으면 phase
  band?: number; // 깃발 아래 띠에서 칠할 칸(cells 의 순번). 음수면 띠를 그리지 않는다(회고)
  also?: number; // band 와 함께 칠할 칸. 결과 문서를 배포와 함께 쓰는 동안의 통합 칸. 없거나 음수면 없음
  cells?: string[]; // 띠의 칸 이름. 도비 사무실은 켜진 담당자 칸 뒤에 "완성" 칸을 붙여 보낸다. 없으면(일반 사무실) 여섯 칸 그대로
  prog?: Progress; // 역할 이름표 밑 진행 막대. 테스터, 개발자, 산출자, 리뷰어, 배포담당이 일할 때만 있다
  place?: string; // 모일 곳 id(floorPlan 의 WORK_PLACES). 없으면 빈 바닥에 편 작업 테이블. 있으면 x, y 는 그 곳의 가운데
  seats?: Partial<Record<TableRole, number>>; // 모일 곳에서 역할마다 앉은 자리(RESTS 번호)
  flag?: { x: number; y: number; pole?: number; side?: "r" | "l" }; // 깃대 밑동과 길이, 천을 다는 쪽. 없으면 테이블 왼쪽 위 모서리
  closing?: TableClosing; // 완성되어 도비가 책을 가지러 오는 중. 도비가 책을 집으면 해산한다(도비 사무실)
}
export interface TableClosing {
  at: number;
  note: DoneNote; // 해산할 때 붙일 완료 쪽지
}
// 진행 정도. 검증은 최신 회차 시나리오 판정 수, 구현은 설계의 고칠 파일 중 바뀐 수
export type Progress = { kind: "test"; round: number; total: number; pass: number; fail: number; skip: number } | { kind: "impl"; done: number; total: number } | { kind: "step"; role: TableRole; done: number; total: number };
// 완료 게시판의 쪽지. 테이블이 해산하면 붙고, 해결되면 책이 되어 떠난다
// 홀딩: 하루 넘게 움직임이 없거나(auto) 사람이 걸면(user) 테이블을 걷고 홀딩 게시판에서 따로 둔다
export interface Hold {
  at: number;
  by: "auto" | "user";
}
export interface DoneNote {
  at: number;
  round?: number; // 통과한 검증 회차. 검증 없이 끝난 오더(테스터를 켜지 않은 도비 오더)는 없다
  seen?: boolean;
}

export interface TaskState {
  id: string;
  key: string;
  title: string;
  env: Env;
  color: number; // 서류철 색 번호. 사무실에 들어올 때 정해 바꾸지 않는다
  folder: FolderAt;
  report?: Report; // 마지막 작업 단위가 어떻게 끝났는지
  waiting?: boolean; // 쉬는 일꾼이 없어 기다리는 중
  phase: string;
  script?: string; // 자동화 패널에 보일 지금 스크립트
  human?: boolean; // 사람 확인을 기다림(탁자에 물음표)
  confirm?: boolean; // 작업이 끝나 완료 확인을 기다림(탁자에 느낌표)
  createdAt: number;
  mock?: boolean;
  board?: boolean; // 프론트 데스크에 접수되어 첫 일꾼에게 건네지기를 기다림
  pr?: number; // 리뷰를 기다리는 PR 번호. 문패에 붙인다
  polledAt?: number; // 마지막으로 PR을 확인한 때. 모래시계가 깜빡인다
  waitSince?: number; // 리뷰 대기를 시작한 때
  longWait?: boolean; // 리뷰 대기가 기준 시간을 넘음
  paused?: boolean; // 일시정지. 지금 실행이 끝나면 다음 단계를 시작하지 않는다
  table?: WorkTable; // 모여 앉아 일하는 테이블
  note?: DoneNote; // 완료 게시판의 쪽지
  hold?: Hold; // 홀딩 게시판에 있음
  lastActive?: number; // 이 작업의 마지막 사건 시각. 일반 사무실의 자동 홀딩 기준
  retroOf?: string; // 도비 회고 탁자. 돌아보는 오더의 키(이 작업의 키는 "{키} 회고")
}

export interface Book {
  key: string;
  title: string;
  pr: number;
  rounds: number;
  lines: number;
  mins: number;
  human: boolean;
  doneAt: string;
  appendix?: boolean; // 기획서·요청 원문이 남은 실제 작업만 부록책이 있다
}

export interface Artifact {
  id: string;
  taskKey: string; // 빈 문자열이면 이슈와 상관없이 꽂은 아티팩트
  title: string;
  kind: string;
  url: string;
  at: string;
}

export interface LogLine {
  seq: number;
  at: number;
  text: string;
}

export interface OfficeState {
  models: Record<TableRole, Model>; // 역할별 모델
  agents: AgentState[];
  tasks: TaskState[];
  books: Book[];
  artifacts: Artifact[];
  log: LogLine[];
}

export type OfficeEvent =
  | { type: "task.created"; taskId: string; key: string; title: string; env: Env; color: number; mock?: boolean; retroOf?: string } // 색은 보내는 쪽이 nextColor 로 정한다
  | { type: "folder.at"; taskId: string; at: FolderAt; report?: Report } // 서류철이 옮겨짐. 캐비닛으로 갈 때 report 를 함께 보낸다
  | { type: "task.phase"; taskId: string; phase: string; book?: Book }
  | { type: "task.human"; taskId: string; kind: string; question: string; step?: string } // step: 답한 뒤 돌아갈 단계. 없으면 지금 단계
  | { type: "task.answered"; taskId: string; why?: string } // why: 답 없이 닫힌 까닭. 없으면 사람이 답함
  | { type: "task.confirm"; taskId: string } // 완료 확인 요청
  | { type: "task.discarded"; taskId: string } // 작업을 버려 서류철이 사라짐
  | { type: "task.env"; taskId: string; env: Env } // 검증 환경을 바꿈
  | { type: "task.titled"; taskId: string; title: string } // 기획자가 지시서 기준으로 제목을 고침
  | { type: "task.paused"; taskId: string; paused: boolean }
  | { type: "models.changed"; models: Record<TableRole, Model> } // 역할별 모델을 바꿈
  | { type: "pr.polled"; taskId: string; pr: number; longWait?: boolean } // 리뷰 대기 중 PR을 한 번 확인함
  | { type: "task.confirmed"; taskId: string; request?: string } // request가 있으면 추가 수정 요청, 없으면 책꽂이로
  | { type: "task.waiting"; taskId: string; on: boolean } // 쉬는 일꾼을 기다리기 시작함(on)·끝남
  | { type: "agent.status"; agentId: string; status: AgentStatus; ctx?: number }
  | { type: "agent.doing"; agentId: string; text: string; taskId?: string } // 지금 하는 일 한 줄. 화면에만 보내고 DB에는 적지 않는다
  | { type: "agent.asking"; agentId: string; taskId: string; asking: boolean } // 대화를 연 채 사람에게 묻는 중
  | { type: "agent.quip"; agentId: string; situation: string; vars?: Record<string, string | number> }
  | { type: "script.started"; taskId: string; name: string }
  | { type: "script.finished"; taskId: string; name: string; ok: boolean; count?: number }
  | { type: "artifact.added"; artifact: Artifact }
  | { type: "table.set"; taskId: string; table: WorkTable } // 테이블을 폄. 같은 작업이면 자리와 사람을 바꿈
  | { type: "table.work"; taskId: string; work: Partial<Record<TableRole, SeatWork>>; stage?: string; band?: number; also?: number; cells?: string[] } // 자리마다 일하는 정도와 깃발 글씨. 일반 사무실은 깃발을 단계에서 바로 그린다
  | { type: "table.prog"; taskId: string; prog?: Progress } // 이름표 진행. 값이 바뀔 때만 보낸다
  | { type: "table.closing"; taskId: string; closing?: TableClosing } // 완성: 도비가 책을 가지러 옴. closing 이 없으면 정리를 거둠(다시 일이 생김)
  | { type: "table.cleared"; taskId: string; note?: DoneNote } // 해산. note 가 있으면 완료 게시판에 붙인다
  | { type: "note.seen"; taskId: string } // 완료 쪽지를 열어 봄
  | { type: "note.cleared"; taskId: string } // 완료 쪽지를 뗌(다시 일이 생김)
  | { type: "task.held"; taskId: string; hold: Hold } // 홀딩. 테이블은 따로 걷는다
  | { type: "task.unheld"; taskId: string } // 홀딩을 풂
  | { type: "log"; text: string };

export interface Envelope {
  seq: number;
  eventId?: number; // 이력용 일련번호(메모리). 오피스 DB 를 가져오지 않아 재시작하면 처음부터 센다
  at: number;
  event: OfficeEvent;
}

export interface Snapshot {
  instanceId: string;
  seq: number;
  state: OfficeState;
}

export const MODELS: { id: Model; name: string }[] = [
  { id: "claude-opus-5-5", name: "Opus 5.5" },
  { id: "claude-sonnet-5-5", name: "Sonnet 5.5" },
  { id: "claude-haiku-5-5", name: "Haiku 5.5" },
];
export const ROLE_NAME: Record<TableRole, string> = {
  planner: "기획자",
  developer: "개발자",
  reviewer: "리뷰어",
  intern: "인턴",
  deployer: "배포담당",
  tester: "테스터",
  producer: "산출자",
};
// 사무실마다 테이블에 앉는 역할 다섯
export const GENERAL_ROLES: SeatRole[] = ["planner", "developer", "reviewer", "intern", "tester"];
export const DOBBY_ROLES: SeatRole[] = ["planner", "developer", "reviewer", "deployer", "tester"];
// 도비 오더에 켤 수 있는 자리 여섯(/do 상태 문서의 담당자 줄 순서). 오더마다 켜진 자리만 앉는다. 담당자 줄이 없는 옛 오더는 위의 다섯이다
export const DOBBY_ALL_ROLES: TableRole[] = ["planner", "developer", "producer", "reviewer", "deployer", "tester"];
