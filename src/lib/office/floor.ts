import { canWork } from "@/lib/office/core/seed";
import { getBus, type OfficeBus } from "@/lib/office/core/bus";
import { HOLD_MS, holdTask, unholdTask } from "@/lib/office/core/hold";
import { DOBBY_ROLES, type DoneNote, type Env, type Progress, type SeatWork, type TableRole, type TaskState, type WorkTable } from "@/lib/office/core/types";
import { nextColor } from "@/lib/office/ui/folders";
import { findWorkPlace, flagOf, placeOf, placeSeats, popTables, setTables, workArea, type PlaceFlag, type Pt } from "@/lib/office/ui/floorPlan";
import { sixSeats } from "@/lib/office/ui/workTable";
import { DOBBY_OFFICE } from "@/lib/office/office";
import { isDemoMeta, type CrewRow } from "@/lib/office/source";
import type { IntakeKind } from "@/lib/office/doCommand";

// 그림만 바꾼다. 이 파일은 bus.emit 외에 오피스 진행 코드를 부르지 않는다
// 상태표 슬러그 → 테이블 자리. 정해진 다섯 말고는 모두 개발자 자리다
const ROLE_OF_SLUG: Record<string, TableRole> = { "analysis-agent": "planner", "produce-agent": "producer", "review-agent": "reviewer", "deploy-agent": "deployer", "test-agent": "tester" };
export const roleOfSlug = (slug: string): TableRole => ROLE_OF_SLUG[slug] ?? "developer";
// 깃발 아래 띠 여섯 칸과 거기 드는 단계
const BAND: string[][] = [["착수", "설계", "설계확인", "실패분석", "보류"], ["구현", "수정"], ["리뷰"], ["통합"], ["배포"], ["검증"]];
// 완성(자동으로 할 일이 끝나 사람이 결과를 확인할 차례)은 띠 맨 끝에 따로 둔 "완성" 칸에 깃발을 둔다.
// 마지막 담당 칸(리뷰 등)에 두면 아직 그 단계인 것처럼 읽힌다
const DONE_CELL = "완성";
// 완성 뒤에 따로 실행하는 작업 단위(dobby-ship·dobby-test)가 보여 줄 단계와 맡을 자리
const AFTER_DONE: Record<string, { phase: string; role: TableRole } | undefined> = { ship: { phase: "배포", role: "deployer" }, test: { phase: "검증", role: "tester" } };
// 담당자 줄이 없는 옛 오더의 띠: 여섯 칸 뒤에 완성 칸
const OLD_CELLS = ["설계", "구현", "리뷰", "통합", "배포", "검증", DONE_CELL];
export const bandOf = (phase: string) => (phase === DONE_CELL ? OLD_CELLS.length - 1 : Math.max(0, BAND.findIndex((b) => b.includes(phase))));
// 담당자 줄이 있는 오더의 띠. 켜진 담당자에 맞춰 칸을 뺀다(대시보드의 띠와 같은 규칙): 리뷰어가 없으면 리뷰, 배포담당이 없으면 통합,
// 개발자가 없으면 배포, 테스터가 없으면 검증 칸이 없다. 구현 자리 칸은 개발자가 없거나 지금 산출물을 다루는 중이면 "산출"이다
export function bandFor(phase: string, roles: TableRole[], product: boolean): { cells: string[]; band: number } {
  const has = (r: TableRole) => roles.includes(r);
  const cells: [string, string[]][] = [["설계", BAND[0]], [!has("developer") || product || phase === "산출" ? "산출" : "구현", [...BAND[1], "산출"]]];
  if (has("reviewer")) cells.push(["리뷰", BAND[2]]);
  if (has("deployer")) cells.push(["통합", BAND[3]]);
  if (has("developer") && has("deployer")) cells.push(["배포", BAND[4]]);
  if (has("tester")) cells.push(["검증", BAND[5]]);
  cells.push([DONE_CELL, [DONE_CELL]]);
  const band = Math.max(0, cells.findIndex((c) => c[1].includes(phase)));
  return { cells: cells.map((c) => c[0]), band };
}
// 깃발에 적는 단계 이름. 담당자 줄이 있는 오더에서 기획자에게 넘어간 상태는 "설계 다시 보기"다(옛 오더는 단계값 그대로)
export const phaseName = (phase: string, roles: TableRole[] | null) => (roles && phase === "실패분석" ? "설계 다시 보기" : phase);
// 테스터 없이 끝날 수 있는 단계(go-dobby 의 끝 판정과 같다)
const LAST = ["산출", "리뷰", "수정", "통합", "배포"];
// 작업 단위 종류의 이름. 보고서 캐비닛에 보인다
export const UNIT_NAME: Record<string, string> = { do: "수동 실행", auto: "자동 실행", full: "전체 실행", ship: "배포", test: "검증" };
export const DONE = ["해결", "종료", "완료"];
const DOING_TTL = 3 * 60_000;
const CLOSE_FALLBACK_MS = 60_000; // 완성 테이블에 도비가 오지 않아도 이 시간이 지나면 걷는다
const UNIT_TTL = 2 * 60 * 60_000;
const RESTORED = "restored"; // 서버를 다시 켜 기억에서 사라진 단위. 다음 시작 알림이 그대로 갈아 끼운다

// 키마다 서류철 하나. unit: 열린 작업 단위(implicit: 도구 사용 알림으로 저절로 연 단위), rows: 상태표 슬러그 → 상태
// text, cmd, action, env, link: 사람 차례 판정 도구가 준 할 일(물음표 창에 보인다)
// asking: 아직 답을 받지 못한 질문이 있다. 판정 도구가 아니라 질문 파일을 보고 맞춘다(setAsking)
interface Unit { id: string; by: string; at: number; last: number; implicit?: boolean }
export interface Ask { text: string; cmd: string; action: string; env: string; link: string; kind: string; asking: boolean }
// lead: 사무실에서 업무를 맡긴 사람(기획자로 앉힌다). expect: 접수한 종류의 예상 담당자(담당자 줄이 생기기 전까지 쓴다). from: 맡긴 사람의 화면 자리
// near: 맡길 때 화면이 보낸 다른 사람들의 자리(가까운 동료부터 고를 때 쓴다)
export type NearPt = Pt & { id: string };
interface Seat extends Ask { taskId: string; unit?: Unit; rows: Map<string, string>; roles?: TableRole[] | null; lead?: string; expect?: TableRole[]; from?: Pt; near?: NearPt[] }
const g = globalThis as unknown as { __dobbyFloor?: Map<string, Seat>; __dobbyDoingAt?: Map<string, number>; __dobbyFinishing?: Map<string, number> };
const finishing = () => (g.__dobbyFinishing ??= new Map()); // 테이블이 걷히기를 기다리는 끝난 오더 → 리뷰 회차
const retroTask = (key: string) => bus().current.tasks.find((t) => t.retroOf === key);
const seats = () => (g.__dobbyFloor ??= new Map());
const doingAt = () => (g.__dobbyDoingAt ??= new Map());
export const bus = (): OfficeBus => getBus(DOBBY_OFFICE);
const taskOf = (s: Seat): TaskState | undefined => bus().current.tasks.find((t) => t.id === s.taskId);
export const known = () => [...seats().keys()];
export const notice = (key: string): Ask | null => {
  const s = seats().get(key);
  return s ? { text: s.text, cmd: s.cmd, action: s.action, env: s.env, link: s.link, kind: s.kind, asking: s.asking } : null;
};
export const asking = (key: string) => !!seats().get(key)?.asking;
// 그 오더에 켜진 자리. 담당자 줄이 없는 옛 오더와 아직 맞추지 않은 오더는 null
export const rolesOf = (key: string) => seats().get(key)?.roles ?? null;
// 열린 작업 단위(보고서 창에 "진행 중"으로 보인다). 다시 켜 기억에서 사라진 단위는 없는 것으로 본다
export const unitOf = (key: string) => {
  const u = seats().get(key)?.unit;
  return u && u.id !== RESTORED ? u : undefined;
};
const newSeat = (taskId: string, key: string): Seat => ({ taskId, rows: new Map(), text: "", cmd: `/do ${key}`, action: "", env: "", link: "", kind: "", asking: false });

// 서버를 다시 켜면 DB 에서 살아난 서류철을 키로 다시 잇는다. 사람이 든 채 남은 서류철은 다음 알림이 단위를 다시 열거나 두 시간 정리가 캐비닛에 넣는다
export function adopt() {
  // 회고 탁자는 서버가 꺼지면 끝 알림을 받을 곳이 없다. 다시 켤 때 걷는다
  for (const t of bus().current.tasks.filter((x) => x.retroOf)) {
    if (t.table) bus().emit({ type: "table.cleared", taskId: t.id });
    bus().emit({ type: "task.discarded", taskId: t.id });
  }
  setTables(popTables(bus().current.tasks));
  for (const t of bus().current.tasks) {
    if (seats().has(t.key)) continue;
    const s = newSeat(t.id, t.key);
    if (t.folder.kind !== "cabinet") s.unit = { id: RESTORED, by: "do", at: Date.now(), last: Date.now() };
    seats().set(t.key, s);
  }
}

let taskNo = 0; // 같은 밀리초에 서류철이 둘 생겨도 작업 번호가 겹치지 않게 늘기만 하는 번호를 붙인다

// 서류철을 보장한다. 처음 보는 키면 만들어 캐비닛에 넣는다(단위가 열리기 전의 오더는 캐비닛에 있다)
export function ensure(key: string, title: string): Seat {
  let s = seats().get(key);
  if (s && taskOf(s)) return s;
  const taskId = `d${Date.now().toString(36)}${taskNo++}`;
  bus().emit({ type: "task.created", taskId, key, title: title.slice(0, 60), env: "dev" as Env, color: nextColor(bus().current.tasks) });
  bus().emit({ type: "folder.at", taskId, at: { kind: "cabinet" } });
  s = newSeat(taskId, key);
  seats().set(key, s);
  return s;
}

// 알림을 받았다. 열린 단위의 마지막 소식 시각을 바꾼다
export function beat(key: string) {
  const u = seats().get(key)?.unit;
  if (u) u.last = Date.now();
}

// 작업 단위 시작. 열린 단위가 있으면 무시한다. 단, 자동·전체 실행이 수동 단위를 이어받으면 앞 단위를 닫고 새로 연다
// implicit 은 도구 사용 알림으로 여는 단위다. 같은 세션의 시작 알림(배포·검증 따로 실행)이 뒤에 오면 그 이름으로 바꿔 단다
export function unitStart(key: string, by: string, unit: string, title: string, implicit = false) {
  const s = ensure(key, title), t = taskOf(s);
  if (!t) return;
  const cur = s.unit;
  const sameSession = (a: string, b: string) => a.slice(a.indexOf(":")) === b.slice(b.indexOf(":"));
  if (cur && cur.id !== RESTORED && cur.implicit && !implicit && sameSession(cur.id, unit)) {
    Object.assign(cur, { id: unit, by, last: Date.now(), implicit: false });
    return;
  }
  if (cur && cur.id !== RESTORED) {
    const takeover = (by === "auto" || by === "full") && cur.by !== "auto" && cur.by !== "full";
    if (!takeover) {
      cur.last = Date.now();
      return;
    }
    file(s, t, cur, "자동 실행으로 이어짐");
  }
  s.unit = { id: unit, by, at: Date.now(), last: Date.now(), implicit };
}

// 작업 단위 끝. 단위 이름이 같을 때(세션 종료 훅은 단위 이름이 그 세션으로 끝날 때)만 닫는다
export function unitEnd(key: string, m: { unit?: string; session?: string; result?: string }) {
  const s = seats().get(key), t = s && taskOf(s), u = s?.unit;
  if (!s || !t || !u || u.id === RESTORED) return;
  const match = m.unit ? u.id === m.unit : !!m.session && u.id.endsWith(`:${m.session}`);
  if (match) file(s, t, u, m.result || "끝났습니다");
}

// 단위를 닫고 결과를 보고서 캐비닛에 남긴다. 서류철은 늘 캐비닛에 있다
function file(s: Seat, t: TaskState, u: Unit, result: string) {
  s.unit = undefined;
  bus().emit({ type: "folder.at", taskId: t.id, at: { kind: "cabinet" }, report: { by: UNIT_NAME[u.by] ?? u.by, result, at: Date.now() } });
}

// 바뀐 것이 있으면 true
export function setTitle(key: string, title: string): boolean {
  const s = seats().get(key), t = s && taskOf(s);
  if (!t || !title || t.title === title.slice(0, 60)) return false;
  bus().emit({ type: "task.titled", taskId: t.id, title: title.slice(0, 60) });
  return true;
}

export function setPhase(key: string, phase: string): boolean {
  const s = seats().get(key), t = s && taskOf(s);
  if (!s || !t || t.phase === phase) return false;
  bus().emit({ type: "task.phase", taskId: t.id, phase });
  return true;
}

// 상태표 한 줄의 상태를 기억한다. 테이블 전구는 syncTable 이 한꺼번에 맞춘다
export function setAgent(key: string, slug: string, state: string): boolean {
  const s = seats().get(key);
  if (!s) return false;
  const before = s.rows.get(slug);
  s.rows.set(slug, state);
  return before !== state;
}

// 답을 기다리는 질문이 있는지 기억한다. 있는 동안에는 두 시간 정리와 하루 홀딩을 하지 않는다. 바뀌었으면 true
export function setAsking(key: string, on: boolean): boolean {
  const s = seats().get(key);
  if (!s || s.asking === on) return false;
  s.asking = on;
  return true;
}

const others = (taskId: string) => popTables(bus().current.tasks.filter((t) => t.id !== taskId));
const takenPlaces = (taskId: string) => bus().current.tasks.flatMap((t) => (t.id !== taskId && t.table?.place ? [t.table.place] : []));
// 다른 작업이 쓰고 있는 모일 곳이 차지하는 넓이(앉은 사람과 깃발)
const busyPlaces = (taskId: string) => bus().current.tasks.flatMap((t) => (t.id !== taskId && t.table?.place ? workArea(t.table) : []));
const seated = () => new Set(bus().current.tasks.flatMap((t) => Object.values(t.table?.crew ?? {})));
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

// 다른 접수에 기획자로 잡혀 아직 앉지 않은 사람
const leadsBut = (key?: string) => new Set([...seats()].flatMap(([k, s]) => (k !== key && s.lead ? [s.lead] : [])));
// 일을 맡길 수 있는 사람: 일할 수 있고, 어느 테이블에도 없고, 다른 접수에 잡히지 않았고, 사람에게 묻는 중이 아니다(화면과 접수 API 가 같이 쓴다)
export function isFree(agentId: string): boolean {
  const a = bus().current.agents.find((x) => x.id === agentId);
  return !!a && canWork(a) && !a.asking && !seated().has(agentId) && !leadsBut().has(agentId);
}

// 자리와 사람을 맞춘다. 이미 펴 둔 곳은 인원이 맞는 한 그대로 두고 빈 역할만 쉬는 사람으로 채운다(기획자는 맡긴 사람이 먼저).
// 곳은 모일 곳(카페·회의 탁자·소파 등) 가운데 담당자 수에 맞는 곳, 없으면 빈 바닥의 작업 테이블이다.
// 곳이나 사람이 모자라면 null(기다림), 바뀐 것이 있으면 true
function placeTeam(s: Seat, t: TaskState, on: TableRole[], roles: TableRole[] | null): boolean | null {
  const b = bus(), tb = t.table;
  // 여섯째 자리가 생겨 작업 테이블이 좁아졌거나, 모일 곳의 정원보다 담당자가 많아지면 다시 고른다. 못 찾으면 있던 곳에 둔다
  const fits = !!tb && (tb.place ? (placeOf(tb.place)?.seats.length ?? 0) >= on.length : sixSeats(tb) || !sixSeats({ x: 0, y: 0, roles: on }));
  const found = fits ? null : findWorkPlace(takenPlaces(t.id), others(t.id), on, Math.random, isDemoMeta(), busyPlaces(t.id));
  // 이미 편 모일 곳은 깃발 자리도 그대로 둔다(방향이 없는 옛 기록은 첫째 후보)
  let where: { x: number; y: number; place?: string; flag?: PlaceFlag } | null = tb ? { x: tb.x, y: tb.y, place: tb.place, ...(tb.place ? { flag: flagOf(tb) } : {}) } : null;
  if (found && "place" in found) {
    const bx = found.place.box;
    where = { x: Math.round((bx.x1 + bx.x2) / 2), y: Math.round((bx.y1 + bx.y2) / 2), place: found.place.id, flag: found.flag };
  } else if (found) where = { x: found.spot.x, y: found.spot.y };
  if (!where) return null;
  const busy = seated(), held = leadsBut(t.key);
  const free = b.current.agents.filter((a) => canWork(a) && !busy.has(a.id) && !held.has(a.id)).map((a) => a.id);
  const take = (id: string) => void free.splice(free.indexOf(id), 1);
  const crew: Partial<Record<TableRole, string>> = {};
  for (const r of on) if (tb?.crew[r]) crew[r] = tb.crew[r];
  if (on.includes("planner") && !crew.planner && s.lead && free.includes(s.lead)) take((crew.planner = s.lead));
  // 화면이 보낸 자리가 있으면 맡긴 사람에게서 가까운 사람부터, 자리를 모르는 사람은 그 뒤에 무작위로 고른다
  const at = new Map(s.near?.map((p) => [p.id, p]));
  const next = () => {
    const o = s.from, known = o ? free.filter((id) => at.has(id)) : [];
    if (!o || !known.length) return pick(free);
    const d = (id: string) => Math.hypot(at.get(id)!.x - o.x, at.get(id)!.y - o.y);
    return known.reduce((x, y) => (d(y) < d(x) ? y : x));
  };
  for (const r of on)
    if (!crew[r]) {
      const id = next();
      if (!id) break;
      take((crew[r] = id));
    }
  const pl = placeOf(where.place);
  const sameSpot = !!tb && tb.place === where.place && tb.x === where.x && tb.y === where.y;
  const placeSeatsNow = pl ? placeSeats(pl, on, sameSpot ? tb!.seats : {}) : undefined;
  if (on.some((r) => !crew[r] || (placeSeatsNow && placeSeatsNow[r] == null))) return null;
  if (crew.planner === s.lead) s.lead = undefined;
  // 켜진 자리가 달라졌으면(담당자가 더 켜졌거나, 예상으로 편 뒤 담당자 줄이 적혔으면) 다시 맞춘다. 자리를 잃은 사람은 쉬러 간다
  const left = (Object.entries(tb?.crew ?? {}) as [TableRole, string][]).filter(([r]) => !on.includes(r)).map(([, id]) => id);
  const same = !!tb && sameSpot && !left.length && on.every((r) => tb.crew[r] === crew[r]) && String(tb.roles ?? "") === String(roles ?? "") && JSON.stringify(tb.seats ?? null) === JSON.stringify(placeSeatsNow ?? null);
  if (same) return false;
  b.emit({ type: "table.set", taskId: t.id, table: { x: where.x, y: where.y, crew, ...(roles ? { roles } : {}), ...(pl ? { place: pl.id, seats: placeSeatsNow, flag: where.flag } : {}) } });
  setTables(popTables(b.current.tasks));
  for (const id of left) if (b.current.agents.find((x) => x.id === id)?.status !== "rest") b.emit({ type: "agent.status", agentId: id, status: "rest" });
  return true;
}

// 접수한 종류마다 예상 담당자(접수 창의 종류 표와 같다). 설계 세션이 담당자 줄을 적으면 그것으로 바뀐다
export const EXPECT: Record<IntakeKind, TableRole[]> = {
  dev: ["planner", "developer", "reviewer", "deployer", "tester"],
  doc: ["planner", "producer", "reviewer", "deployer"],
  research: ["planner", "producer"],
  light: ["planner", "developer", "deployer", "tester"],
};
const RESERVE_MS = 15 * 60_000;
// 폴더가 아직 없어도 지우지 않고 기다리는 접수인지. 단계가 접수이고 서류철을 만든 지 15분 안이면 설계 세션이 폴더를 만드는 중으로 본다
export const phaseOf = (key: string) => {
  const s = seats().get(key);
  return s ? taskOf(s)?.phase : undefined;
};
export function reserving(key: string): boolean {
  const s = seats().get(key), t = s && taskOf(s);
  return !!t && t.phase === "접수" && Date.now() - t.createdAt < RESERVE_MS;
}
// 사무실에서 업무를 맡겼다. 폴더가 생기기 전에 서류철을 만들고, 맡긴 사람을 기획자로 종류에 맞는 곳에 자리를 잡는다
export function reserve(key: string, o: { lead?: string; kind: IntakeKind; from?: Pt; near?: NearPt[] }) {
  const s = ensure(key, ""), t = taskOf(s), b = bus(); // 제목은 폴더가 생기면 setTitle 이 채운다
  if (!t) return;
  s.lead = o.lead;
  s.expect = EXPECT[o.kind];
  s.from = o.from;
  s.near = o.near;
  if (t.table || t.hold) return; // 이미 자리가 있으면 옮기지 않는다(다시 맡긴 오더)
  setPhase(key, "접수");
  const placed = placeTeam(s, t, s.expect, null);
  if (placed === null) {
    if (!t.waiting) b.emit({ type: "task.waiting", taskId: t.id, on: true });
    log(`${key} 접수: 모일 곳이나 쉬는 사람이 없어 기다립니다`);
    return;
  }
  const crew = taskOf(s)!.table!.crew, on = s.expect;
  b.emit({ type: "table.work", taskId: t.id, work: Object.fromEntries(on.map((r) => [r, r === "planner" ? "work" : "idle"])), stage: "▶ 접수", ...bandFor("접수", on, false) });
  if (crew.planner) b.emit({ type: "agent.status", agentId: crew.planner, status: "think" });
  const p = placeOf(taskOf(s)!.table!.place);
  log(`${key} 접수: 기획자 ${b.current.agents.find((a) => a.id === crew.planner)?.name ?? ""}, 깃발을 들고 ${p ? p.name : "작업 테이블"} 쪽으로 갑니다`);
}

// 테이블을 펴거나 걷고, 자리마다 전구와 깃발 글씨를 맞춘다. 검증까지 통과했으면 해산해 완료 게시판에 쪽지를 붙인다
// mtime: 메타 파일의 마지막 수정 시각. 하루 넘게 그대로면 홀딩하고, 자동 홀딩은 그 뒤에 바뀌면 푼다
// 답을 기다리는 질문이 있으면 홀딩하지 않고, 자동 홀딩된 채였으면 푼다(자동 실행이 여덟 시간까지 답을 기다린다)
// roles: 상태 문서의 담당자 줄에 켜진 자리. 없으면(옛 오더) 다섯 자리 그대로다. product: 리뷰와 수정이 산출물을 다루는 중
// light: 한 세션 실행 오더. 깃발 단계 글씨 뒤에 "· light" 를 붙인다
// docs: 결과 문서를 배포와 함께 쓰는 중(결과 문서 줄이 대기·작성 중). 지난 통합 칸도 함께 칠한다
export function syncTable(key: string, rows: CrewRow[], test: { round: number; ok: boolean } | null, mtime = 0, qa = false, roles: TableRole[] | null = null, product = false, light = false, docs = false): boolean {
  const s = seats().get(key), t = s && taskOf(s);
  if (!s || !t) return false;
  const b = bus();
  s.roles = roles;
  // 담당자 줄이 아직 없으면 접수한 종류의 예상 담당자를 쓴다(조사 오더가 다섯 자리로 부풀었다가 줄지 않게). 줄이 생기면 그것을 따른다
  if (roles) s.expect = undefined;
  const on: TableRole[] = roles ?? s.expect ?? DOBBY_ROLES;
  // 켜지지 않은 자리의 행은 지금까지처럼 개발자 자리로 본다
  const roleOf = (slug: string) => (on.includes(roleOfSlug(slug)) ? roleOfSlug(slug) : "developer");
  // 테스터가 가장 나중에 끝냈을 때만 해산으로 본다. 그 뒤 다른 담당이 다시 움직이면 테이블을 다시 편다
  const tester = rows.find((r) => r.slug === "test-agent");
  // 테스터를 켜지 않았거나 테스터가 "할 일 없음"으로 끝난 오더는 검증이 없다. 켜진 담당자가 모두 완료이고 남은 질문이 없으면 끝난 것이다
  const tested = !roles || (roles.includes("tester") && !(tester?.state === "완료" && tester.desc.startsWith("할 일 없음")));
  const allDone = () => !s.asking && LAST.includes(t.phase) && on.every((r) => rows.some((x) => roleOf(x.slug) === r) && rows.every((x) => roleOf(x.slug) !== r || x.state === "완료"));
  // 완성은 go-dobby 가 자동으로 할 일이 모두 끝났다고 판정한 단계다. 담당자 행과 상관없이 해산한다
  const passed = tested && tester?.state === "완료" && !!test?.ok && rows.every((r) => r.at <= tester.at);
  // 완성 뒤 따로 실행한 배포·검증이 도는 동안은 해산하지 않고 그 단계로 탁자를 편다
  const after = t.phase === DONE_CELL ? AFTER_DONE[s.unit?.by ?? ""] : undefined;
  // QA 중에는 해산하지 않는다(감시와 수정이 이어진다)
  if (!qa && !after && (t.phase === DONE_CELL || (tested ? passed : allDone()))) {
    const note: DoneNote = passed ? { at: Date.now(), round: test!.round } : { at: Date.now() };
    if (t.hold) unholdTask(b, t.id);
    // 테이블이 있으면 바로 걷지 않는다. 돌아다니는 도비가 와서 책을 집어 가면 그때 해산한다(pickup, 늦으면 sweepClosing)
    if (t.table) {
      if (t.table.closing) return false;
      b.emit({ type: "table.closing", taskId: t.id, closing: { at: Date.now(), note } });
      return true;
    }
    if (!t.note) b.emit({ type: "table.cleared", taskId: t.id, note });
    return !t.note;
  }
  // 도비가 오기 전에 다시 일이 생기면 정리를 거둔다
  if (t.table?.closing) b.emit({ type: "table.closing", taskId: t.id });
  if (t.hold?.by === "auto" && (mtime > t.hold.at || s.asking)) unholdTask(b, t.id);
  else if (!t.hold && !s.asking && mtime && Date.now() - Math.max(mtime, t.lastActive ?? 0) > HOLD_MS) return holdTask(b, t.id, "auto");
  if (taskOf(s)?.hold) {
    if (t.waiting) b.emit({ type: "task.waiting", taskId: t.id, on: false });
    return false;
  }
  let changed = false;
  if (t.note) {
    b.emit({ type: "note.cleared", taskId: t.id });
    changed = true;
  }
  const placed = placeTeam(s, t, on, roles);
  if (placed === null) {
    if (!t.waiting) b.emit({ type: "task.waiting", taskId: t.id, on: true });
    return changed;
  }
  if (t.waiting) b.emit({ type: "task.waiting", taskId: t.id, on: false });
  if (placed) changed = true;
  const crew = taskOf(s)!.table!.crew;
  // 자리마다: 하나라도 작업중이면 일함, 기다림이면 모래시계, 나머지는 꺼짐
  const work: Partial<Record<TableRole, SeatWork>> = {};
  for (const r of on) {
    const st = rows.filter((x) => roleOf(x.slug) === r).map((x) => x.state);
    work[r] = st.includes("작업중") ? "work" : st.includes("기다림") ? "wait" : "idle";
  }
  // 수동 배포·검증은 담당자 상태표에 작업중 줄을 남기지 않는다. 맡은 자리를 일함으로 둔다
  if (after && on.includes(after.role)) work[after.role] = "work";
  const phase = after?.phase ?? t.phase;
  const round = Math.max(0, ...rows.filter((r) => r.slug === "review-agent").map((r) => r.round));
  const stage = qa ? "▶ QA" : `▶ ${phaseName(phase, roles)}${(phase === "리뷰" || phase === "수정") && round ? ` (${round}차)` : ""}${light ? " · light" : ""}`;
  // 담당자 줄이 있는 오더는 띠 칸을 켜진 담당자에 맞춘다. 옛 오더는 여섯 칸 뒤에 완성 칸이다
  const cellRoles = roles ?? s.expect;
  const fit = cellRoles ? bandFor(qa ? "검증" : phase, cellRoles, product) : { cells: OLD_CELLS, band: bandOf(qa ? "검증" : phase) };
  const band = fit.band;
  const docsAt = docs ? fit.cells.indexOf("통합") : -1;
  const also = docsAt >= 0 && docsAt < band ? docsAt : -1;
  const cur = bus().current.tasks.find((x) => x.id === t.id)?.table as WorkTable;
  if (cur.stage !== stage || cur.band !== band || (cur.also ?? -1) !== also || String(cur.cells ?? "") !== String(fit.cells) || on.some((r) => cur.work?.[r] !== work[r])) {
    b.emit({ type: "table.work", taskId: t.id, work, stage, band, also, cells: fit.cells });
    for (const r of on) {
      const a = b.current.agents.find((x) => x.id === crew[r]);
      const want = work[r] === "work" ? (r === "planner" ? "think" : r === "reviewer" ? "review" : "work") : "rest";
      if (a && a.status !== want) b.emit({ type: "agent.status", agentId: a.id, status: want });
    }
    changed = true;
  }
  return changed;
}

// 이름표 진행을 맞춘다. 값이 그대로면 보내지 않는다
export function setProgress(key: string, prog: Progress | undefined) {
  const s = seats().get(key), t = s && taskOf(s);
  if (!t?.table || JSON.stringify(t.table.prog) === JSON.stringify(prog)) return;
  bus().emit({ type: "table.prog", taskId: t.id, prog });
}

// 세션이 도구를 썼다. 그 역할 자리에 앉은 사람의 말풍선에 지금 하는 일을 띄운다
export function setDoing(key: string, text: string, role: TableRole) {
  const s = seats().get(key), t = s && taskOf(s);
  const id = t?.table?.crew[role];
  if (!t || !id) return;
  doingAt().set(id, Date.now());
  bus().emit({ type: "agent.doing", agentId: id, text: text.slice(0, 80), taskId: t.id });
}

// 완성 테이블 해산. 정리 중(closing)인 테이블만 걷고, 정리할 때 받아 둔 완료 쪽지를 붙인다
function closeTable(t: TaskState): boolean {
  const c = t.table?.closing;
  if (!c) return false;
  bus().emit({ type: "table.cleared", taskId: t.id, note: c.note });
  setTables(others(t.id));
  // 테이블을 걷기를 기다리던 끝(해결)이 있으면 이제 마친다
  const rounds = finishing().get(t.key);
  if (rounds != null) finish(t.key, rounds, false);
  return true;
}

// 화면의 도비가 완성 테이블에서 책을 집었다. 여러 화면이 알려도 처음 한 번만 걷는다
export function pickup(key: string): boolean {
  const t = bus().current.tasks.find((x) => x.key === key && x.table?.closing);
  return !!t && closeTable(t);
}

// 사무실을 보는 화면이 없거나 도비가 늦으면 서버가 스스로 걷는다
export function sweepClosing() {
  const now = Date.now();
  for (const t of bus().current.tasks) if (t.table?.closing && now - t.table.closing.at > CLOSE_FALLBACK_MS) closeTable(t);
}

// 3분 동안 소식이 없는 말풍선을 지우고, 두 시간 동안 소식이 없는 단위는 캐비닛으로 정리한다
// 답을 기다리는 동안에는 소식이 없는 것이 정상이라 정리하지 않는다. 답이 온 뒤부터 두 시간을 다시 센다
export function expireDoing() {
  const now = Date.now();
  for (const [id, at] of [...doingAt()])
    if (now - at > DOING_TTL) {
      doingAt().delete(id);
      if (bus().current.agents.find((a) => a.id === id)?.doing) bus().emit({ type: "agent.doing", agentId: id, text: "" });
    }
  for (const s of seats().values()) {
    const t = taskOf(s);
    if (s.asking) {
      if (s.unit) s.unit.last = now;
      continue;
    }
    if (t && s.unit && now - s.unit.last > UNIT_TTL) file(s, t, s.unit, "두 시간 동안 소식이 없어 정리했습니다");
  }
}

export function setHuman(key: string, mine: boolean, ask: Omit<Ask, "asking">): boolean {
  const s = seats().get(key), t = s && taskOf(s);
  if (!s || !t) return false;
  const text = ask.text;
  Object.assign(s, ask);
  if (mine && !t.human) bus().emit({ type: "task.human", taskId: t.id, kind: "dobby", question: text });
  else if (!mine && t.human) bus().emit({ type: "task.answered", taskId: t.id, why: "도비에서 이어서 진행" });
  else return false;
  return true;
}

// 끝난 오더는 서류철을 캐비닛에 넣은 뒤 책으로 꽂는다. gone 이면 서류철만 치운다
export function finish(key: string, rounds: number, gone: boolean) {
  const s = seats().get(key), t = s && taskOf(s);
  // 테이블이 남은 채 끝났으면(완성을 거치지 않고 바로 해결된 오더, 데모) 도비가 책을 집어 테이블을 걷은 뒤에 마친다.
  // 서류철은 그대로 두므로 다음 확인에도 여기로 온다. 걷히면 closeTable 이 다시 부른다
  if (!gone && t?.table) {
    finishing().set(key, rounds);
    if (!t.table.closing) bus().emit({ type: "table.closing", taskId: t.id, closing: { at: Date.now(), note: { at: Date.now() } } });
    return;
  }
  finishing().delete(key);
  seats().delete(key);
  if (!s || !t) return;
  if (s.unit) file(s, t, s.unit, gone ? "오더 폴더가 없어졌습니다" : "오더가 끝났습니다");
  if (t.table) {
    bus().emit({ type: "table.cleared", taskId: t.id });
    setTables(others(t.id));
  }
  if (gone) {
    bus().emit({ type: "task.discarded", taskId: t.id });
    return;
  }
  bus().emit({
    type: "task.phase",
    taskId: t.id,
    phase: "done",
    book: { key, title: t.title, pr: 0, rounds, lines: 0, mins: Math.max(1, Math.round((Date.now() - t.createdAt) / 60000)), human: false, doneAt: new Date().toISOString().slice(5, 10) },
  });
}

// 회고 시작: 그 오더의 담당자들이 작업할 때처럼 탁자에 둘러앉는다(담당자 줄이 없는 옛 오더는 다섯). 깃발은 「▶ 회고」, 단계 띠는 그리지 않는다
// 오더 서류철과 섞이지 않게 키를 "{키} 회고"로 따로 만든다. 끝난 오더도 받는다
export function retroStart(key: string, title: string, roles: TableRole[] | null = null) {
  const on: TableRole[] = roles ?? DOBBY_ROLES;
  if (retroTask(key)) return;
  const b = bus();
  const taskId = `r${Date.now().toString(36)}${taskNo++}`;
  b.emit({ type: "task.created", taskId, key: `${key} 회고`, title: title.slice(0, 60), env: "dev" as Env, color: nextColor(b.current.tasks), retroOf: key });
  b.emit({ type: "folder.at", taskId, at: { kind: "cabinet" } });
  // 작업할 때와 같은 규칙으로 모일 곳(없으면 작업 테이블)을 고른다
  const t = b.current.tasks.find((x) => x.id === taskId)!;
  if (placeTeam(newSeat(taskId, t.key), t, on, roles) === null) {
    log(`${key} 회고: 모일 곳이나 쉬는 사람이 없습니다`);
    return;
  }
  const crew = b.current.tasks.find((x) => x.id === taskId)!.table!.crew;
  const work = Object.fromEntries(on.map((r) => [r, "work"])) as Record<TableRole, SeatWork>;
  b.emit({ type: "table.work", taskId, work, stage: "▶ 회고", band: -1 });
  for (const r of on) b.emit({ type: "agent.status", agentId: crew[r]!, status: "think" });
  log(`${key} 회고를 시작합니다`);
}

// 회고 끝: 탁자를 걷고 회고 작업을 치운다. 기획자가 회고록을 회고 책장에 꽂는 연출은 화면이 한다
export function retroEnd(key: string, result = "") {
  const t = retroTask(key), b = bus();
  if (!t) return;
  const crew = Object.values(t.table?.crew ?? {});
  if (t.table) {
    b.emit({ type: "table.cleared", taskId: t.id });
    setTables(others(t.id));
  }
  for (const id of crew) b.emit({ type: "agent.status", agentId: id, status: "rest" });
  b.emit({ type: "task.discarded", taskId: t.id });
  log(`${key} 회고를 마쳤습니다${result ? ` (${result})` : ""}`);
}

export function log(text: string) {
  bus().emit({ type: "log", text });
}

// 지난 세션 표의 단계 이름 → 말풍선을 띄울 자리. 산출 세션("산출", "N차 산출 수정")은 산출자 자리다
export const roleOfStage = (stage: string): TableRole => (/설계|분석|이어받기|변경/.test(stage) ? "planner" : /산출/.test(stage) ? "producer" : /리뷰/.test(stage) ? "reviewer" : /검증/.test(stage) ? "tester" : /배포|통합/.test(stage) ? "deployer" : "developer");
