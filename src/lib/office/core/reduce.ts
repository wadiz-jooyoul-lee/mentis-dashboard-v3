import { MODELS, ROLE_NAME, type Envelope, type OfficeState, type SeatRole } from "@/lib/office/core/types";

const LOG_KEEP = 40;

// 이 사건들은 작업이 움직였다는 뜻이 아니다(테이블·쪽지·홀딩·기다림 표시). 나머지는 마지막 활동 시각을 당긴다. 홀딩을 풀면 하루를 다시 센다
export const NOT_ACTIVITY = new Set(["task.held", "task.waiting", "table.set", "table.work", "table.prog", "table.cleared", "note.seen", "note.cleared", "log"]);

// 서버와 화면이 같은 함수로 상태를 만든다. 원본을 바꾸지 않고 새 상태를 돌려준다
export function reduce(state: OfficeState, env: Envelope): OfficeState {
  const next = step(state, env);
  const id = "taskId" in env.event ? env.event.taskId : undefined;
  if (!id || NOT_ACTIVITY.has(env.event.type)) return next;
  return { ...next, tasks: next.tasks.map((t) => (t.id === id ? { ...t, lastActive: env.at } : t)) };
}

function step(state: OfficeState, env: Envelope): OfficeState {
  const e = env.event;
  const log = (text: string) => [{ seq: env.seq, at: env.at, text }, ...state.log].slice(0, LOG_KEEP);
  const agentName = (id: string) => state.agents.find((a) => a.id === id)?.name ?? id;
  const taskKey = (id: string) => state.tasks.find((t) => t.id === id)?.key ?? id;
  const patchAgent = (id: string, fn: (a: OfficeState["agents"][number]) => OfficeState["agents"][number]) =>
    state.agents.map((a) => (a.id === id ? fn(a) : a));
  const patchTask = (id: string, part: Partial<OfficeState["tasks"][number]>) => state.tasks.map((t) => (t.id === id ? { ...t, ...part } : t));

  switch (e.type) {
    case "task.created":
      return {
        ...state,
        tasks: [...state.tasks, { id: e.taskId, key: e.key, title: e.title, env: e.env, color: e.color, folder: { kind: "board" }, phase: "기획", createdAt: env.at, mock: e.mock, board: true, retroOf: e.retroOf }],
        log: log(`${e.key} 프론트 데스크에 접수됨 (검증 ${e.env})`),
      };
    case "folder.at": {
      const where = e.at.kind === "agent" ? `${agentName(e.at.agentId)} 책상` : e.at.kind === "cabinet" ? "보고서 캐비닛" : "프론트 데스크";
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === e.taskId ? { ...t, folder: e.at, report: e.report ?? t.report, board: e.at.kind === "board" ? t.board : false } : t)),
        log: log(`${taskKey(e.taskId)} 서류철 → ${where}${e.report ? ` (${e.report.result})` : ""}`),
      };
    }
    case "task.phase": {
      if (e.phase === "done") {
        return {
          ...state,
          tasks: state.tasks.filter((t) => t.id !== e.taskId),
          // 이어서 한 작업은 같은 키의 옛 책을 빼고 새 책을 꽂는다
          books: e.book ? [...state.books.filter((b) => b.key !== e.book!.key), e.book] : state.books,
          log: log(`${taskKey(e.taskId)} 완료: 책장에 꽂힘`),
        };
      }
      // 리뷰 대기를 벗어나면 기다린 시간 표시를 지운다
      const wait = e.phase.includes("리뷰 대기") || e.phase.includes("빌드 대기") ? {} : { waitSince: undefined, longWait: false };
      return { ...state, tasks: state.tasks.map((t) => (t.id === e.taskId ? { ...t, phase: e.phase, ...wait } : t)) };
    }
    case "task.human":
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === e.taskId ? { ...t, human: true } : t)),
        log: log(`${taskKey(e.taskId)} 사람 확인 필요: ${e.question}`),
      };
    case "task.answered":
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === e.taskId ? { ...t, human: false } : t)),
        log: log(`${taskKey(e.taskId)} ${e.why ?? "사람 확인 답변: 이어서 진행"}`),
      };
    case "task.confirm":
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === e.taskId ? { ...t, confirm: true } : t)),
        log: log(`${taskKey(e.taskId)} 작업 끝: 완료 확인 대기`),
      };
    case "pr.polled":
      return { ...state, tasks: state.tasks.map((t) => (t.id === e.taskId ? { ...t, pr: e.pr, polledAt: env.at, waitSince: t.waitSince ?? env.at, longWait: !!e.longWait } : t)) };
    case "task.discarded":
      return { ...state, tasks: state.tasks.filter((t) => t.id !== e.taskId), log: log(`${taskKey(e.taskId)} 작업 버림`) };
    case "task.confirmed":
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === e.taskId ? { ...t, confirm: false } : t)),
        log: log(`${taskKey(e.taskId)} ${e.request ? `추가 수정 요청: ${e.request}` : "완료 확인: 책꽂이로"}`),
      };
    case "task.waiting":
      return { ...state, tasks: state.tasks.map((t) => (t.id === e.taskId ? { ...t, waiting: e.on } : t)) };
    case "models.changed": {
      const name = (m: string) => MODELS.find((x) => x.id === m)?.name ?? m;
      const diff = (Object.keys(e.models) as SeatRole[]).filter((r) => state.models[r] !== e.models[r]);
      return { ...state, models: e.models, log: diff.length ? log(`역할별 모델: ${diff.map((r) => `${ROLE_NAME[r]} ${name(e.models[r])}`).join(", ")}`) : state.log };
    }
    case "task.env":
      return { ...state, tasks: state.tasks.map((t) => (t.id === e.taskId ? { ...t, env: e.env } : t)), log: log(`${taskKey(e.taskId)} 검증 환경을 ${e.env}로 바꿈`) };
    case "task.titled":
      return { ...state, tasks: state.tasks.map((t) => (t.id === e.taskId ? { ...t, title: e.title } : t)), log: log(`${taskKey(e.taskId)} 제목을 "${e.title}"로 고침`) };
    case "task.paused":
      return { ...state, tasks: state.tasks.map((t) => (t.id === e.taskId ? { ...t, paused: e.paused } : t)), log: log(`${taskKey(e.taskId)} ${e.paused ? "일시정지" : "다시 진행"}`) };
    case "agent.status": {
      // 쉬게 되면 지금 하는 일을 지운다
      const rest = e.status === "rest" ? { doing: undefined, doingTask: undefined, asking: false } : {};
      return { ...state, agents: patchAgent(e.agentId, (a) => ({ ...a, status: e.status, ctx: e.ctx ?? a.ctx, ...rest })) };
    }
    case "agent.doing":
      return { ...state, agents: patchAgent(e.agentId, (a) => ({ ...a, doing: e.text, doingTask: e.text ? e.taskId : undefined })) };
    case "agent.asking":
      return { ...state, agents: patchAgent(e.agentId, (a) => ({ ...a, asking: e.asking, status: e.asking ? "think" : "work" })) };
    case "agent.quip":
      return { ...state, agents: patchAgent(e.agentId, (a) => ({ ...a, quipCtx: { situation: e.situation, vars: e.vars ?? {}, at: env.at } })) };
    case "script.started":
      return { ...state, tasks: state.tasks.map((t) => (t.id === e.taskId ? { ...t, script: e.name } : t)) };
    case "script.finished":
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === e.taskId ? { ...t, script: undefined } : t)),
        log: log(`${taskKey(e.taskId)} ${e.name} ${e.ok ? "통과" : `실패${e.count ? ` ${e.count}건` : ""}`}`),
      };
    case "table.set":
      return { ...state, tasks: patchTask(e.taskId, { table: e.table, note: undefined }), log: log(`${taskKey(e.taskId)} 테이블을 폄`) };
    case "table.work":
      return { ...state, tasks: state.tasks.map((t) => (t.id === e.taskId && t.table ? { ...t, table: { ...t.table, work: e.work, stage: e.stage, band: e.band, also: e.also, cells: e.cells } } : t)) };
    case "table.prog":
      return { ...state, tasks: state.tasks.map((t) => (t.id === e.taskId && t.table ? { ...t, table: { ...t.table, prog: e.prog } } : t)) };
    case "table.closing":
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === e.taskId && t.table ? { ...t, table: { ...t.table, closing: e.closing } } : t)),
        log: log(`${taskKey(e.taskId)} ${e.closing ? "완성: 도비가 책을 가지러 감" : "다시 일이 생겨 정리를 거둠"}`),
      };
    case "table.cleared":
      return { ...state, tasks: patchTask(e.taskId, { table: undefined, note: e.note }), log: log(`${taskKey(e.taskId)} ${e.note ? (e.note.round ? "검증 통과로 해산" : "맡은 일을 모두 마쳐 해산") : "테이블을 걷음"}`) };
    case "note.seen":
      return { ...state, tasks: state.tasks.map((t) => (t.id === e.taskId && t.note ? { ...t, note: { ...t.note, seen: true } } : t)) };
    case "note.cleared":
      return { ...state, tasks: patchTask(e.taskId, { note: undefined }) };
    case "task.held":
      return { ...state, tasks: patchTask(e.taskId, { hold: e.hold, table: undefined, waiting: false }), log: log(`${taskKey(e.taskId)} 홀딩으로 (${e.hold.by === "auto" ? "하루 넘게 멈춤" : "사람이 홀딩"})`) };
    case "task.unheld":
      return { ...state, tasks: patchTask(e.taskId, { hold: undefined }), log: log(`${taskKey(e.taskId)} 홀딩을 풂`) };
    case "artifact.added":
      return { ...state, artifacts: [...state.artifacts, e.artifact], log: log(`아티팩트 등록: ${e.artifact.title}`) };
    case "log":
      return { ...state, log: log(e.text) };
  }
}
