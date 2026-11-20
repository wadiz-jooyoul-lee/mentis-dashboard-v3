"use client";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { onOfficeEvent, useOffice } from "@/lib/office/ui/store";
import { ART, BEDS, BED_SCREENS, CABINET, CABINET_SLOT, CABINET_SPOT, CAFE_DOBBY, CAFE_TABLES, COUNTER, COURIER_DESK, DESKS, DESK_ROWS, DOORS, FACES, FRONT_DESK, FRONT_DOBBY, FRONT_SPOT, HUDDLE_SEATS, LIB_SHELVES, LIB_SPOT, LINE, MAC_DESK, MONITORS, PICKS, PRESENT_SPOT, RESTS, RETRO_SHELF_SLOT, RETRO_SHELF_SPOT, SCREEN, SHELF_SLOT, TOASTER, VH, VW, WALLS, ZONES, bedArt, deskArt, deskSide, flagOf, path, placeLaptop, placeOf, popTables, setTables, type Pt, type RestKind } from "@/lib/office/ui/floorPlan";
import { FLAG, bandOfPhase, clothX, laptopOf, seatOf, snackOf, tableArt } from "@/lib/office/ui/workTable";
import { Motion, type WalkDir } from "@/lib/office/ui/motion";
import { PERSONA_LABEL, quipText } from "@/lib/office/ui/quips";
import { FOLDER_COLORS, isReviewWait } from "@/lib/office/ui/folders";
import { ROLE_NAME, type AgentState, type FolderAt, type OfficeState, type Progress, type SeatRole, type TaskState, type WorkTable } from "@/lib/office/core/types";
import { avatarSrcs, type Pose } from "@/lib/office/core/avatars";
import { coverOf, hash } from "@/components/office/Bookshelf";
import { OfficeAgent, type Face } from "@/components/office/OfficeAgent";

// 받아 둔 그림. 참조를 쥐고 있어야 풀어 둔 그림이 버려지지 않는다
const PRELOADED = new Map<string, HTMLImageElement>();

// 에이전트가 가는 자리. desk 는 일할 때 앉는 빈 책상, home 은 일 없을 때 앉아 있는 쉼터 의자(RESTS 번호),
// rest 는 잠깐 들르는 쉬는 자리(RESTS), pt 는 카페 줄이나 서류철 심부름처럼 잠깐 서는 곳, seat 는 작업 테이블의 역할 자리(row 0 위쪽, 1 아래쪽)
type Spot = { kind: "desk"; at: Pt } | { kind: "home"; i: number } | { kind: "lib" } | { kind: "rest"; i: number } | { kind: "pt"; at: Pt; pose: Pose } | { kind: "seat"; at: Pt; pose: Pose; row: number; taskId: string; role: SeatRole; rest?: number }; // rest: 모일 곳 자리면 그 RESTS 번호
interface Track {
  at: Spot; // 대기열의 이동을 모두 마친 뒤 있을 자리
  targetKey: string;
  busy: number; // 대기 중인 이동 수
  teaSeat: number | null;
  teaTimer?: ReturnType<typeof setTimeout>;
}
interface Bubble {
  id: number;
  agentId: string;
  head: string;
  text: string;
}

const FLY_MS = 1500;
const TOAST_MS = 2000;
const ORDER_MS = 1600;
const PICK_MS = 800;
const FOLDER_IN_MS = 500; // 서류철이 캐비닛으로 날아 들어가는 시간
const FADE_MS = 400; // 버린 서류철이 흐려지며 사라지는 시간
// 서류철 그림(binder-1.webp, 93×71)을 그리는 크기. 책상 위와 머리 위
const BINDER_DESK = { w: 20, h: 15 };
const BINDER_HEAD = { w: 24, h: 18 };
// 다과 그림(public/sprites/treat-*.webp)의 너비와 높이. 머리 위에 높이 22로 그린다
const TREAT_SIZE: Record<string, [number, number]> = {
  "iced-latte": [60, 100], "iced-americano": [57, 100], latte: [80, 71], lemonade: [80, 109], cola: [37, 74], juice: [45, 97], frappe: [51, 97],
  cappuccino: [71, 65], espresso: [54, 71], "cold-brew": [51, 74], sandwich: [86, 71], wrap: [123, 68], shot: [57, 86], takeout: [57, 88],
  "flat-white": [71, 60], baguette: [123, 54], club: [117, 74],
  "bean-bun": [68, 55], "biscuit-beige": [66, 76], "biscuit-box": [57, 68], "biscuit-purple": [71, 76], "biscuit-red": [56, 80],
  "brownie-pack": [46, 45], bun: [68, 58], "can-berry": [43, 77], "can-red": [43, 77], "candy-basket": [79, 69], "candy-blue": [60, 76],
  "candy-bowl": [77, 62], "candy-dish": [77, 55], "candy-purple": [60, 72], "chips-blue": [71, 78], "chips-green": [70, 77], "choco-bar": [81, 34],
  "choco-cup": [51, 60], "choco-orange": [81, 60], "choco-plain": [76, 35], "cola-bottle": [38, 88], "cookie-blue": [54, 68], "cookie-box": [73, 63],
  "cookie-pack": [34, 35], "cookie-purple": [60, 72], "cracker-pack": [45, 50], "donut-choco": [58, 52], "donut-pink": [55, 52],
  "fanta-grape": [43, 77], "fanta-orange": [44, 77], "jelly-green": [60, 71], "jelly-red": [60, 71], "juice-bottle": [38, 84],
  "juice-pack": [40, 76], "milk-can": [43, 77], muffin: [58, 60], "nacho-red": [70, 78], "nacho-yellow": [70, 78], "nut-bowl": [75, 54],
  "orange-soda": [38, 86], popcorn: [68, 80], "popcorn-tub": [68, 81], "pretzel-brown": [70, 78], "pretzel-orange": [69, 78],
  "snicker-bar": [82, 60], tart: [42, 37], "tea-pack": [46, 68], "toast-pack": [52, 52], "wonder-bar": [83, 61], "wonder-brown": [77, 54],
  yogurt: [49, 58],
};
// 높이 h 로 그릴 다과의 너비와 높이. 옆으로 긴 그림은 너비를 높이의 1.6배까지만 두고 높이를 줄인다
const treatBox = (treat: string, h: number) => {
  const [w0, h0] = TREAT_SIZE[treat], w = Math.min((h * w0) / h0, h * 1.6);
  return [w, (w * h0) / w0];
};
// 어디서 무엇을 주는지. 카페는 주문할 때, 스낵바와 작은 탕비는 들러서 집을 때 받는다
const TREATS = {
  cafe: ["iced-latte", "iced-americano", "latte", "cappuccino", "espresso", "cold-brew", "shot", "takeout", "flat-white", "frappe", "sandwich", "baguette", "club", "wrap"],
  snack: ["lemonade", "cola", "juice", "frappe", "sandwich", "club", "wrap", "bean-bun", "biscuit-beige", "biscuit-box", "biscuit-purple", "biscuit-red", "brownie-pack", "bun", "can-berry", "can-red", "candy-basket", "candy-blue", "candy-bowl", "candy-dish", "candy-purple", "chips-blue", "chips-green", "choco-bar", "choco-cup", "choco-orange", "choco-plain", "cola-bottle", "cookie-blue", "cookie-box", "cookie-pack", "cookie-purple", "cracker-pack", "donut-choco", "donut-pink", "fanta-grape", "fanta-orange", "jelly-green", "jelly-red", "juice-bottle", "juice-pack", "milk-can", "muffin", "nacho-red", "nacho-yellow", "nut-bowl", "orange-soda", "popcorn", "popcorn-tub", "pretzel-brown", "pretzel-orange", "snicker-bar", "tart", "tea-pack", "toast-pack", "wonder-bar", "wonder-brown", "yogurt"],
  nook: ["cola", "juice", "lemonade", "can-berry", "can-red", "milk-can", "tea-pack", "juice-pack", "orange-soda", "cola-bottle", "fanta-grape", "fanta-orange", "juice-bottle", "yogurt"],
};
// 쉬는 자리에서 하는 말. 모니터 앞에서는 회의하고, 발표자는 발표한다
const talkOf = (kind: RestKind) => (kind === "present" ? "presenting" : kind === "huddle" ? "meeting" : "tea");
const SLIDE_MS = 3000;
const CAFE_DOBBY_ID = "cafe-dobby";
// 카페 도비는 인턴 인원에 들지 않는 화면 속 일꾼이다
const CAFE_DOBBY_AGENT = { id: CAFE_DOBBY_ID, name: "카페 도비", persona: "elf", hair: "", status: "happy", location: { kind: "desk" }, ctx: 0 } as AgentState;
// 프론트 도비도 인원에 들지 않는다. 탕비실 위 문으로 들어오는 사람에게 인사한다
const FRONT_DOBBY_ID = "front-dobby";
const FRONT_DOBBY_AGENT = { ...CAFE_DOBBY_AGENT, id: FRONT_DOBBY_ID, name: "프론트 도비" } as AgentState;
const GREETINGS = ["어서 오세요!", "도비가 반겨요!", "좋은 하루예요!", "간식은 아래쪽이에요!"];
const GREET_GAP_MS = 7000; // 인사 사이 간격
const spotKey = (s: Spot) => (s.kind === "desk" || s.kind === "pt" ? `${s.kind}:${s.at.x},${s.at.y}` : s.kind === "rest" ? `s:${s.i}` : s.kind === "home" ? `home:${s.i}` : s.kind === "seat" ? `seat:${s.taskId}:${s.role}` : s.kind);

// 자리에 서거나 앉았을 때의 모습. 책상(뒤에 앉음)은 앞모습, 책꽂이 앞은 뒷모습
function poseOf(s: Spot | undefined): Pose {
  if (!s) return "stand";
  if (s.kind === "desk") return "front";
  if (s.kind === "home") return RESTS[s.i].pose;
  if (s.kind === "seat") return s.pose;
  if (s.kind === "lib") return "back";
  if (s.kind === "rest") return RESTS[s.i].pose;
  return s.pose;
}

// 책상과 쉼터 의자는 주인이 없다. 일하거나 서류철을 든 사람은 빈 책상을 잡고, 일이 없으면 놓고 일어나 빈 의자에 앉는다
// desk: 지금 앉을 책상 번호. lastDesk: 마지막으로 앉았던 책상(서류철을 건네러 그 책상 옆에 선다). home: 일 없을 때 앉는 의자. used: 의자마다 앉은 사람
// parked: 일 없는 사람의 책상. 쉬는 곳에 다녀와도 이 책상으로 돌아오고, 일할 사람이 오면 자리를 비켜 준다
interface Seats {
  desk: Map<string, number>;
  parked: Map<string, number>;
  lastDesk: Map<string, number>;
  home: Map<string, number>;
  used: (string | null)[]; // 사람 아이디, 또는 모일 곳으로 쓰는 중이면 "work:{작업 아이디}"
  planted: Set<string>; // 깃발을 꽂은 작업. 꽂기 전에는 담당자가 자리로 가지 않는다
}
const newSeats = (): Seats => ({ desk: new Map(), parked: new Map(), lastDesk: new Map(), home: new Map(), used: RESTS.map(() => null), planted: new Set() });
const WORK = "work:";
// 멈춰 세운 까닭: 업무 맡기기 창이 열려 있음, 기획자가 데리러 오기를 기다림. GAP: 줄 서서 걸을 때 앞사람과 떨어지는 거리
const ASK = "ask", GATHER = "gather", GAP = 26;
const flagSig = (tb: WorkTable) => `${tb.place ?? ""}:${tb.x},${tb.y}`;
const HOME_KINDS = new Set<RestKind>(["cafe", "nook", "sofa", "meet", "huddle"]);
const CAFE_KINDS = new Set<RestKind>(["cafe"]);
const needsDesk = (a: AgentState, st: OfficeState) => a.status !== "rest" || holds(st, a.id).length > 0;
// 일 없는 사람이 앉을 의자. 이미 있으면 그 자리, 없으면 빈 의자 가운데 무작위 하나
function homeOf(seats: Seats, id: string, kinds = HOME_KINDS): Spot {
  let i = seats.home.get(id);
  if (i == null) {
    const free = RESTS.flatMap((r, k) => (kinds.has(r.kind) && !seats.used[k] ? [k] : []));
    i = free[Math.floor(Math.random() * free.length)] ?? RESTS.findIndex((r) => HOME_KINDS.has(r.kind));
    seats.home.set(id, i);
    seats.used[i] = id;
  }
  return { kind: "home", i };
}
function leaveHome(seats: Seats, id: string) {
  const i = seats.home.get(id);
  if (i == null) return;
  if (seats.used[i] === id) seats.used[i] = null;
  seats.home.delete(id);
}
// 이 사람이 앉을 작업 테이블 자리. 없으면 undefined
const seatIn = (st: OfficeState, id: string) => {
  for (const t of st.tasks) for (const [role, who] of Object.entries(t.table?.crew ?? {})) if (who === id) return { t, role: role as SeatRole };
};
// near: 지금 있는 곳. 그 가까운 빈 책상을 잡는다. 테이블에 앉을 사람은 책상보다 테이블이 먼저다
function targetOf(a: AgentState, st: OfficeState, seats: Seats, near?: Pt): Spot {
  // 책장 정리 도비는 할 일(책 가져가기·반납)이 없으면 자기 책상에 앉는다
  if (a.persona === "elf") return { kind: "desk", at: { x: COURIER_DESK.x, y: COURIER_DESK.y } };
  const sat = seatIn(st, a.id);
  if (sat && seats.planted.has(sat.t.id)) {
    seats.desk.delete(a.id);
    seats.parked.delete(a.id);
    leaveHome(seats, a.id);
    const tb = sat.t.table!, ri = tb.place ? tb.seats?.[sat.role] : undefined;
    if (ri != null) {
      const r = RESTS[ri];
      return { kind: "seat", at: { ...r.at }, pose: r.pose, row: r.pose === "back" || r.pose === "up" ? 1 : 0, taskId: sat.t.id, role: sat.role, rest: ri };
    }
    const p = seatOf(tb, sat.role);
    return { kind: "seat", at: { x: p.x, y: p.y }, pose: p.pose, row: p.row, taskId: sat.t.id, role: sat.role };
  }
  if (needsDesk(a, st)) {
    const pk = seats.parked.get(a.id);
    if (pk != null) {
      seats.parked.delete(a.id);
      seats.desk.set(a.id, pk);
    }
    let i = seats.desk.get(a.id);
    if (i == null) {
      const used = new Set([...seats.desk.values(), ...seats.parked.values()]);
      const free = DESKS.map((_, k) => k).filter((k) => !used.has(k));
      const last = seats.lastDesk.get(a.id);
      const dist = (k: number) => (near ? Math.hypot(DESKS[k].x - near.x, DESKS[k].y - near.y) : k);
      i = last != null && !used.has(last) ? last : free.sort((x, y) => dist(x) - dist(y))[0];
      // 빈 책상이 없으면 처음부터 앉아 쉬던 사람의 책상을 비켜 받는다
      const idle = [...seats.parked].sort((x, y) => dist(x[1]) - dist(y[1]))[0];
      if (i == null && idle) {
        seats.parked.delete(idle[0]);
        i = idle[1];
      }
      if (i == null) return homeOf(seats, a.id); // 빈 책상이 없으면 앉아 있던 의자에서 일한다
      seats.desk.set(a.id, i);
      seats.lastDesk.set(a.id, i);
    }
    leaveHome(seats, a.id);
    return { kind: "desk", at: { x: DESKS[i].x, y: DESKS[i].y } };
  }
  seats.desk.delete(a.id);
  const pk = seats.parked.get(a.id);
  if (pk != null) return { kind: "desk", at: { x: DESKS[pk].x, y: DESKS[pk].y } };
  return homeOf(seats, a.id);
}
// 책상이나 테이블이 필요한 사람부터 자리를 잡는다. 그래야 비켜 줄 사람이 같은 차례에 의자로 간다
const deskFirst = (st: OfficeState) => [...st.agents].sort((x, y) => Number(!!seatIn(st, y.id) || needsDesk(y, st)) - Number(!!seatIn(st, x.id) || needsDesk(x, st)));

// 서류철을 하나 이상 들었고 일하는 상태면 쉬러 가지 않고 책상에 앉아 있다
const holds = (st: OfficeState, id: string) => st.tasks.filter((t) => t.folder.kind === "agent" && t.folder.agentId === id);
const isWorking = (a: AgentState, st: OfficeState) => (a.status === "work" || a.status === "think" || a.status === "review") && holds(st, a.id).length > 0;
const sameAt = (a: FolderAt, b: FolderAt) => a.kind === b.kind && (a.kind !== "agent" || (b.kind === "agent" && a.agentId === b.agentId));
// 화면이 그린 서류철 위치. moving 은 누군가 머리에 이고 가는 중
type Shown = FolderAt | { kind: "moving" };

export function OfficeFloor({ onAgent, waitFor, dobby, onZoom, onRetroShelf, onHuman, onConfirm, onFlight, onPickup, onBoard, onGear, onModels, onHold, onPr, onShelf, onCabinet, onMonitor, jobsRunning, onDataMonitor, dataScreen, dataFresh, present }: { onAgent?: (a: AgentState, at: Pt, near: (Pt & { id: string })[]) => void; waitFor?: string; onPickup?: (t: TaskState) => void; dataScreen?: { text: string; tone?: string } | null; present?: { n: number; text: string }; dobby?: boolean; onMonitor?: () => void; jobsRunning?: boolean; onDataMonitor?: () => void; dataFresh?: number; onZoom?: (t: TaskState, box: Box) => void; onRetroShelf?: () => void; onHold?: (t: TaskState) => void; onShelf?: () => void; onCabinet?: () => void; onPr?: (t: TaskState) => void; onHuman?: (t: TaskState) => void; onConfirm?: (t: TaskState) => void; onFlight?: (key: string, on: boolean) => void; onBoard?: () => void; onGear?: (t: TaskState) => void; onModels?: () => void }) {
  const state = useOffice((s) => s.state);
  const epoch = useOffice((s) => s.epoch);
  const seats = useRef<Seats>(newSeats());
  const pointOf = useCallback((s: Spot): Pt => {
    if (s.kind === "desk" || s.kind === "pt" || s.kind === "seat") return s.at;
    if (s.kind === "lib") return LIB_SPOT;
    return RESTS[s.i].at;
  }, []);
  const route = useCallback((from: Spot, to: Spot, avoid: Pt[] = []) => path(pointOf(from), pointOf(to), avoid), [pointOf]);

  // 해결된 작업은 캐비닛의 서류철이 책이 되어 서고 책꽂이로 날아간다
  const [flights, setFlights] = useState<{ key: string; x: number; y: number; to?: Pt }[]>([]);
  const retroPlanner = useRef(new Map<string, string>()); // 회고 작업 → 회고록을 꽂으러 갈 기획자
  const [burnt, setBurnt] = useState<Record<string, boolean>>({}); // 토스터가 터져 시꺼멓게 탄 도비
  const [toasterBoom, setToasterBoom] = useState(0);
  // laptop: 테이블로 오가며 머리에 인 노트북. onTable: 테이블 위에 내려놓은 간식(테이블보다 나중에 그린다)
  const [carry, setCarry] = useState<{ key: string; agentId: string; note?: boolean; toast?: boolean; treat?: string; folder?: number; laptop?: boolean; flag?: string; book?: string; onTable?: boolean; at?: Pt }[]>([]); // flag: 머리에 인 깃발의 이슈 번호, book: 머리에 인 완성 책의 이슈 번호
  const [picked, setPicked] = useState<string[]>([]); // 도비가 테이블에서 책을 집어 간 작업. 테이블이 걷힐 때까지 테이블 위 책을 그리지 않는다
  const [returning, setReturning] = useState<string[]>([]); // 도비가 책을 들고 프론트 데스크로 가는 중인 작업. 반납 전에는 데스크 위 책에 넣지 않는다
  const closings = useRef(new Set<string>()); // 책을 가지러 보낸 정리. 작업 아이디와 정리 시각
  const returned = useRef(new Map<string, { done: Promise<void>; ok: () => void }>()); // 작업 → 도비가 책을 데스크에 내려놓으면 풀리는 약속. 해결되어 날아가는 책은 이것을 기다린다
  const [flagHover, setFlagHover] = useState<string | null>(null); // 마우스를 올린 깃발의 작업. 나머지 깃발을 사람 뒤로 내린다
  const [plantTick, setPlantTick] = useState(0); // 깃발을 꽂으면 늘려, 담당자들이 그때 자리로 가게 한다
  const flagSigs = useRef(new Map<string, string>()); // 작업마다 마지막으로 본 테이블 자리
  const flagBases = useRef(new Map<string, Pt>()); // 작업마다 깃발을 꽂은 곳(옮길 때 뽑으러 간다)
  const eating = useRef(new Map<string, string>()); // 에이전트별로 머리 위에 든 다과의 carry 키
  const [motion] = useState(() => new Motion()); // 코드 부분 새로 고침에도 같은 객체를 유지해야 그림에 붙은 이동이 끊기지 않는다
  const tracks = useRef(new Map<string, Track>());
  const cafeLine = useRef<string[]>([]); // 카페 주문 줄. 앞사람 주문이 끝나야 카운터로 간다
  const cafeTurn = useRef<Promise<void>>(Promise.resolve());
  const [walking, setWalking] = useState<Record<string, WalkDir | false>>({});
  const [stopped, setStopped] = useState<Record<string, boolean>>({}); // 걷던 길 위에 멈춰 선 사람
  const gather = useRef(new Map<string, { wait: Set<string>; train: string[] }>()); // 작업마다 기획자가 데리러 갈 동료와 이미 줄에 붙은 동료
  const [tea, setTea] = useState<Record<string, boolean>>({});
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const bubbleNo = useRef(0);
  // 서류철: 화면에 그린 위치(shown), 연출 줄에 넣은 마지막 위치(want), 작업마다 연출 줄(chains), 마지막으로 본 작업(seen)
  const [shown, setShown] = useState<Record<string, Shown>>({});
  const want = useRef<Record<string, FolderAt>>({});
  const chains = useRef(new Map<string, Promise<void>>());
  const seen = useRef(new Map<string, TaskState>());
  const seenEpoch = useRef(-1);
  const [flyIns, setFlyIns] = useState<{ key: string; color: number; x: number; y: number }[]>([]);
  const [fading, setFading] = useState<{ key: string; color: number; x: number; y: number }[]>([]);

  useEffect(() => {
    motion.onWalking = (id, w) => setWalking((s) => ({ ...s, [id]: w }));
    motion.onStop = (id, on) => setStopped((s) => ({ ...s, [id]: on }));
    motion.place(CAFE_DOBBY_ID, CAFE_DOBBY);
    motion.place(FRONT_DOBBY_ID, FRONT_DOBBY);
  }, [motion]);

  const binders = useRef(new Map<string, (o: SVGGElement | null, i: SVGGElement | null) => void>());
  const bindFor = useCallback(
    (id: string) => {
      let b = binders.current.get(id);
      if (!b) {
        b = (o, i) => motion.attach(id, o, i);
        binders.current.set(id, b);
      }
      return b;
    },
    [motion],
  );

  // 다과를 받아 머리 위에 든다. 다 먹고 자리를 뜨면(freeTea) 지운다
  const serve = (id: string, menu: string[]) => {
    const key = `treat:${id}:${Date.now()}`;
    eating.current.set(id, key);
    setCarry((c) => [...c, { key, agentId: id, treat: menu[Math.floor(Math.random() * menu.length)] }]);
  };
  // 앞에 탁자나 판이 있는 자리에 닿으면 다과를 그 위에 내려놓는다
  const putDown = (id: string, at: Pt) => {
    const key = eating.current.get(id);
    if (key) setCarry((c) => c.map((x) => (x.key === key ? { ...x, at } : x)));
  };
  const freeTea = (id: string, t: Track) => {
    const treat = eating.current.get(id);
    if (treat) {
      eating.current.delete(id);
      setCarry((c) => c.filter((x) => x.key !== treat));
    }
    clearTimeout(t.teaTimer);
    if (t.teaSeat != null && seats.current.used[t.teaSeat] === id) seats.current.used[t.teaSeat] = null;
    t.teaSeat = null;
    setTea((s) => (s[id] ? { ...s, [id]: false } : s));
  };

  // 모일 곳으로 쓰는 쉼터 자리를 "work:{작업}" 으로 막아 쉬는 사람이 고르지 않게 하고, 다 쓴 자리는 푼다. 그 자리에 있던 사람(담당자 빼고)을 돌려준다
  const markWorkRests = (st: OfficeState): string[] => {
    const s = seats.current, want = new Map<number, TaskState>();
    for (const t of st.tasks) if (t.table?.place) for (const i of Object.values(t.table.seats ?? {})) if (i != null) want.set(i, t);
    const out: string[] = [];
    s.used.forEach((u, i) => {
      const t = want.get(i);
      if (!t) {
        if (u?.startsWith(WORK)) s.used[i] = null;
        return;
      }
      if (u && !u.startsWith(WORK) && !Object.values(t.table!.crew).includes(u)) out.push(u);
      s.used[i] = WORK + t.id;
    });
    return out;
  };

  // 스냅샷을 받으면 걷지 않고 제자리에 놓는다. 일 없는 사람도 처음엔 빈 책상에 앉히고, 책상이 모자라면 카페에서 기다린다
  useEffect(() => {
    const st = useOffice.getState().state;
    if (!st) return;
    for (const [id, t] of tracks.current) freeTea(id, t);
    tracks.current.clear();
    motion.release(GATHER);
    gather.current.clear();
    cafeLine.current = [];
    cafeTurn.current = Promise.resolve();
    seats.current = newSeats();
    // 처음 받은 테이블은 깃발이 이미 꽂힌 것으로 둔다
    flagSigs.current.clear();
    for (const t of st.tasks)
      if (t.table) {
        seats.current.planted.add(t.id);
        flagSigs.current.set(t.id, flagSig(t.table));
        flagBases.current.set(t.id, flagOf(t.table));
      }
    markWorkRests(st);
    for (const a of deskFirst(st)) {
      // 도비는 자기 책상이 있어 빈 책상이나 의자를 잡지 않는다
      if (a.persona !== "elf" && !seatIn(st, a.id) && !needsDesk(a, st)) {
        const used = new Set([...seats.current.desk.values(), ...seats.current.parked.values()]);
        const k = DESKS.findIndex((_, i) => !used.has(i));
        if (k >= 0) seats.current.parked.set(a.id, k);
        else homeOf(seats.current, a.id, CAFE_KINDS);
      }
      const at = targetOf(a, st, seats.current);
      tracks.current.set(a.id, { at, targetKey: (isWorking(a, st) ? "work:" : "") + spotKey(at), busy: 0, teaSeat: null });
      motion.place(a.id, pointOf(at));
    }
    setWalking({});
    setStopped({});
    setCarry([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [epoch, motion]);

  const go = useCallback(
    (id: string, to: Spot) => {
      const t = tracks.current.get(id);
      if (!t) return;
      t.busy++;
      void motion.enqueue(id, async () => {
        const from = t.at;
        if (from.kind === "rest") freeTea(id, t);
        t.at = to;
        const moved = spotKey(from) !== spotKey(to), lap = moved && (from.kind === "seat" || to.kind === "seat");
        if (lap) setCarry((c) => [...c.filter((x) => x.key !== `laptop:${id}`), { key: `laptop:${id}`, agentId: id, laptop: true }]);
        if (moved) await motion.walk(id, route(from, to, motion.others(id)));
        if (lap) setCarry((c) => c.filter((x) => x.key !== `laptop:${id}`));
        t.busy--;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [motion, route],
  );

  // 토스터: 70%는 토스트를 머리에 이고 2초 동안 자랑하고, 30%는 작게 터진다. 도비는 터지면 2초 동안 시꺼멓게 탄다
  const toast = useCallback(
    (agentId: string, intern: boolean) => {
      if (Math.random() < 0.7) {
        const key = `toast:${agentId}:${Date.now()}`;
        setCarry((c) => [...c, { key, agentId, toast: true }]);
        setTimeout(() => setCarry((c) => c.filter((x) => x.key !== key)), TOAST_MS);
        return;
      }
      setToasterBoom(Date.now());
      setTimeout(() => setToasterBoom(0), 900);
      if (!intern) return;
      setBurnt((s) => ({ ...s, [agentId]: true }));
      setTimeout(() => setBurnt((s) => ({ ...s, [agentId]: false })), TOAST_MS);
    },
    [],
  );

  // 처음 걷거나 앉는 순간 그림 자리가 비지 않게, 캐릭터의 자세 그림을 미리 받아 풀어 둔다
  useEffect(() => {
    for (const a of state?.agents ?? [])
      for (const src of a.avatar ? avatarSrcs(a.avatar) : []) {
        if (PRELOADED.has(src)) continue;
        const img = new Image();
        img.src = src;
        img.decode().catch(() => {});
        PRELOADED.set(src, img);
      }
  }, [state?.agents]);

  // 펴 둔 테이블을 길찾기 칸판에 넣는다. 사람을 움직이는 아래 effect 보다 먼저 돌아야 새 길이 테이블을 돌아간다
  const tableSig = state?.tasks.map((t) => (t.table ? `${t.table.x},${t.table.y},${t.table.place ?? ""},${JSON.stringify(t.table.seats ?? "")}` : "")).join("|") ?? "";
  useEffect(() => {
    const st = useOffice.getState().state;
    setTables(popTables(st?.tasks ?? []));
    if (!st) return;
    // 모일 곳으로 쓰는 자리에 앉아 쉬던 사람은 일어나 다른 자리로 간다
    for (const id of markWorkRests(st)) {
      const t = tracks.current.get(id), a = st.agents.find((x) => x.id === id);
      if (!t || !a) continue;
      const hi = seats.current.home.get(id);
      if (hi != null && seats.current.used[hi]?.startsWith(WORK)) seats.current.home.delete(id);
      if (t.teaSeat != null && seats.current.used[t.teaSeat]?.startsWith(WORK)) freeTea(id, t);
      const to = targetOf(a, st, seats.current, motion.pos(id));
      t.targetKey = (isWorking(a, st) ? "work:" : "") + spotKey(to);
      go(id, to);
    }
  }, [tableSig, epoch]); // eslint-disable-line react-hooks/exhaustive-deps

  // 업무 맡기기 창이 열린 동안 그 사람은 제자리에 멈춰 기다린다. 맡아서 테이블 자리가 생기면 풀어 깃발 연출로 넘긴다
  const waitId = waitFor && state && !seatIn(state, waitFor) ? waitFor : undefined;
  useEffect(() => {
    if (!waitId) return;
    motion.hold(waitId, ASK, true);
    return () => motion.hold(waitId, ASK, false);
  }, [waitId, motion, epoch]);

  // 깃발: 테이블이 새로 생기거나 곳이 바뀌면 기획자가 제자리에서 깃발을 만들어(옮길 때는 옛 깃발을 뽑아) 머리에 이고 가서 꽂는다.
  // 새로 만든 깃발이면 가는 길에 가까운 동료부터 찾아가 줄 뒤에 달고 함께 간다. 동료는 데리러 올 때까지 제자리에서 기다린다.
  // 꽂기 전까지 나머지 담당자는 자리로 가지 않는다. 회고와 기획자가 없는 테이블은 바로 꽂는다
  useEffect(() => {
    if (!state) return;
    const sigs = flagSigs.current, pl = seats.current.planted;
    const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    for (const t of state.tasks) {
      const tb = t.table, before = sigs.get(t.id);
      if (!tb) {
        if (before != null) (sigs.delete(t.id), pl.delete(t.id), flagBases.current.delete(t.id));
        continue;
      }
      const sig = flagSig(tb);
      if (before === sig) continue;
      sigs.set(t.id, sig);
      const lead = tb.crew.planner, base = flagOf(tb);
      const plant = () => {
        flagBases.current.set(t.id, base);
        pl.add(t.id);
        setPlantTick((n) => n + 1);
      };
      if (t.retroOf || !lead || !tracks.current.get(lead)) {
        plant();
        continue;
      }
      const old = before != null && pl.has(t.id) ? flagBases.current.get(t.id) : undefined;
      pl.delete(t.id);
      const key = `flag:${t.id}`, name = state.agents.find((a) => a.id === lead)?.name ?? "";
      // 데리러 갈 동료. 옮기는 깃발이면 다들 이미 앉아 있으니 데리러 가지 않는다
      const mates = old ? [] : [...new Set(Object.values(tb.crew))].filter((id): id is string => !!id && id !== lead && !!tracks.current.get(id));
      const g = { wait: new Set(mates), train: [] as string[] };
      // 꽂기 전에 곳이 또 바뀌었으면 앞선 심부름은 아무도 데리러 가지 않게 비운다
      const prev = gather.current.get(t.id);
      for (const id of prev?.wait ?? []) motion.hold(id, GATHER, false);
      prev?.wait.clear();
      gather.current.set(t.id, g);
      for (const id of mates) motion.hold(id, GATHER, true);
      // 담당자가 바뀌어 빠진 사람은 기다리지 않고 하던 일을 잇는다
      const crewNow = () => Object.values(useOffice.getState().state?.tasks.find((x) => x.id === t.id)?.table?.crew ?? {});
      const drop = () => {
        const now = crewNow();
        for (const id of [...g.wait]) if (!now.includes(id) || !tracks.current.get(id)) (g.wait.delete(id), motion.hold(id, GATHER, false));
      };
      const pickups = mates.map(() => {
        let next: string | undefined;
        return {
          at: () => {
            drop();
            const me = motion.pos(lead) ?? base, d = (id: string) => { const p = motion.pos(id) ?? me; return Math.hypot(p.x - me.x, p.y - me.y); };
            next = gather.current.get(t.id) === g ? [...g.wait].sort((x, y) => d(x) - d(y))[0] : undefined;
            return (next && motion.pos(next)) || me;
          },
          act: async () => {
            const id = next, tr = id && tracks.current.get(id), p = id && motion.pos(id);
            if (!id || !tr || !p || !g.wait.has(id)) return;
            // 닿으면 동료가 일어나(먹던 다과는 치우고) 줄 맨 뒤에 붙는다. 걷던 길은 버리고, 하던 쉬기는 끝낸다
            g.wait.delete(id);
            motion.place(id, p);
            motion.hold(id, GATHER, false);
            freeTea(id, tr);
            tr.at = { kind: "pt", at: { ...p }, pose: "stand" };
            tr.targetKey = `gather:${t.id}`;
            motion.follow(id, g.train[g.train.length - 1] ?? lead, GAP);
            g.train.push(id);
            await wait(300);
          },
        };
      });
      // 깃발을 꽂으면 줄을 풀고, 각자 자리로 가게 지금 선 곳을 출발점으로 둔다. 데리러 가지 못한 사람도 푼다
      const unhitch = () => {
        if (gather.current.get(t.id) === g) gather.current.delete(t.id);
        for (const id of g.train) {
          motion.unfollow(id);
          const tr = tracks.current.get(id), p = motion.pos(id);
          if (tr && p) (tr.at = { kind: "pt", at: { ...p }, pose: "stand" }), (tr.targetKey = "");
        }
        for (const id of g.wait) motion.hold(id, GATHER, false);
      };
      // 처음 만드는 깃발은 기획자가 자기 책상 옆(제 자리)에서 만든다. 책상이 없으면 심부름을 시작할 때 서 있는 곳에서 만든다
      const ownDesk = () => {
        const s = seats.current, i = s.desk.get(lead) ?? s.parked.get(lead) ?? s.lastDesk.get(lead);
        return i != null ? deskSide(DESKS[i]) : motion.pos(lead) ?? base;
      };
      void errand(lead, [
        {
          at: old ?? ownDesk,
          act: async () => {
            const id = ++bubbleNo.current;
            setBubbles((b) => [...b.filter((x) => x.agentId !== lead), { id, agentId: lead, head: `${name} · 기획자 · ${t.key}`, text: old ? "더 넓은 곳으로 옮겨요!" : "깃발 완성! 자리 찾으러 가요" }].slice(-3));
            setTimeout(() => setBubbles((b) => b.filter((x) => x.id !== id)), 3000);
            await wait(old ? 400 : 1200);
            setCarry((c) => [...c.filter((x) => x.key !== key), { key, agentId: lead, flag: t.key }]);
          },
        },
        ...pickups,
        {
          at: { x: base.x + 10, y: base.y + 8 },
          act: async () => {
            setCarry((c) => c.filter((x) => x.key !== key));
            unhitch();
            plant();
            await wait(300);
          },
        },
      ]);
    }
  }, [state?.tasks, epoch]); // eslint-disable-line react-hooks/exhaustive-deps

  // 일하기 시작하면 가까운 빈 책상에 가서 앉고, 일이 끝나 서류철도 없으면 일어나 빈 의자로 가서 앉는다
  useEffect(() => {
    if (!state) return;
    for (const a of deskFirst(state)) {
      const t = tracks.current.get(a.id);
      // 깃발을 꽂기 전인 테이블의 담당자는 제자리에 둔다(기획자는 깃발 심부름 중이다)
      const sat = seatIn(state, a.id);
      if (t && sat && !seats.current.planted.has(sat.t.id)) continue;
      // 업무 맡기기 창이 열린 사람은 제자리에서 기다린다. 창을 닫으면 이 효과가 다시 돌아 원래대로 움직인다
      if (t && a.id === waitId) continue;
      const to = targetOf(a, state, seats.current, motion.pos(a.id)), key = (isWorking(a, state) ? "work:" : "") + spotKey(to);
      if (!t) {
        tracks.current.set(a.id, { at: to, targetKey: key, busy: 0, teaSeat: null });
        motion.place(a.id, pointOf(to));
        continue;
      }
      if (key === t.targetKey) continue;
      t.targetKey = key;
      clearTimeout(t.teaTimer);
      go(a.id, to);
    }
  }, [state, go, plantTick, waitId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 심부름: 에이전트가 자리마다 걸어가 할 일을 하고 자기 책상으로 돌아온다. 끝나면 풀리는 약속을 돌려준다
  const errand = useCallback(
    (id: string, stops: { at: Pt | (() => Pt); act: () => void | Promise<void> }[]) => {
      const t = tracks.current.get(id), st = useOffice.getState().state;
      const a = st?.agents.find((x) => x.id === id);
      if (!t || !st || !a) return (async () => { for (const s of stops) await s.act(); })();
      t.busy++;
      return motion.enqueue(id, async () => {
        try {
          if (t.at.kind === "rest") freeTea(id, t);
          for (const s of stops) {
            // at 이 함수면 그 정류장에 갈 차례에 정한다(앞선 걸음이 끝난 뒤의 자리를 보려고)
            const to: Spot = { kind: "pt", at: typeof s.at === "function" ? s.at() : s.at, pose: "back" }, from = t.at;
            t.at = to;
            await motion.walk(id, route(from, to, motion.others(id)));
            await s.act();
          }
          const home = targetOf(a, useOffice.getState().state ?? st, seats.current), from = t.at;
          t.at = home;
          await motion.walk(id, route(from, home, motion.others(id)));
        } finally {
          t.busy--;
        }
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [motion, route],
  );

  // 완성: 돌아다니는 도비가 테이블로 가서 책을 집는다. 집는 순간 서버에 알려 테이블을 걷고, 책을 이고 프론트 데스크에 반납한다
  // 정리가 여럿이면 도비가 하나씩 차례로 돈다. 도비가 없거나 아직 자리를 잡지 못했으면 바로 걷는다
  useEffect(() => {
    if (!state) return;
    const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    const courier = state.agents.find((a) => a.persona === "elf");
    const say = (text: string, key: string) => {
      if (!courier) return;
      const id = ++bubbleNo.current;
      setBubbles((b) => [...b.filter((x) => x.agentId !== courier.id), { id, agentId: courier.id, head: `${courier.name} · ${key}`, text }].slice(-3));
      setTimeout(() => setBubbles((b) => b.filter((x) => x.id !== id)), 2500);
    };
    for (const t of state.tasks) {
      const c = t.table?.closing;
      if (!c || closings.current.has(`${t.id}:${c.at}`)) continue;
      closings.current.add(`${t.id}:${c.at}`);
      if (!courier || !tracks.current.get(courier.id)) {
        onPickup?.(t);
        continue;
      }
      const base = flagOf(t.table!), key = `book:${t.id}`;
      void errand(courier.id, [
        {
          at: { x: base.x + 10, y: base.y + 8 },
          act: async () => {
            say("완성! 책 가져갈게요", t.key);
            await wait(500);
            let ok = () => {};
            const done = new Promise<void>((r) => (ok = r));
            returned.current.set(t.id, { done, ok });
            setPicked((p) => [...p, t.id]);
            setReturning((r) => [...r, t.id]);
            setCarry((cs) => [...cs.filter((x) => x.key !== key), { key, agentId: courier.id, book: t.key }]);
            onPickup?.(t);
          },
        },
        {
          at: FRONT_SPOT,
          act: async () => {
            setCarry((cs) => cs.filter((x) => x.key !== key));
            setReturning((r) => r.filter((x) => x !== t.id));
            setPicked((p) => p.filter((x) => x !== t.id));
            say("책 반납했어요", t.key);
            returned.current.get(t.id)?.ok();
            returned.current.delete(t.id);
            await wait(300);
          },
        },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.tasks, epoch]);

  // 서류철 연출. 서버 상태의 위치가 바뀌면 작업마다 줄을 세워 하나씩 그린다. 서버는 연출을 기다리지 않는다
  useEffect(() => {
    if (!state) return;
    const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    const put = (id: string, at: Shown | null) =>
      setShown((s) => {
        const n = { ...s };
        if (at) n[id] = at;
        else delete n[id];
        return n;
      });
    const queue = (id: string, job: () => Promise<void>) => {
      const p = (chains.current.get(id) ?? Promise.resolve()).then(job, job);
      chains.current.set(id, p);
    };
    const deskOf = (agentId: string) => {
      const i = seats.current.desk.get(agentId) ?? seats.current.lastDesk.get(agentId);
      return i == null ? undefined : DESKS[i];
    };
    const deskStand = (agentId: string): Pt | undefined => {
      const p = deskOf(agentId);
      return p && deskSide(p); // 책상 옆 통로에 선다
    };
    const lift = (id: string, agentId: string, color: number) => {
      put(id, { kind: "moving" });
      setCarry((c) => [...c, { key: `folder:${id}`, agentId, folder: color }]);
    };
    const drop = (id: string, at: Shown) => {
      setCarry((c) => c.filter((x) => x.key !== `folder:${id}`));
      put(id, at);
    };
    // 의자에 앉아 쉬는 사람 하나(아무나). 없으면 첫 사람
    const idleRunner = () => {
      const st = useOffice.getState().state;
      const all = st?.agents ?? [];
      const free = all.find((a) => a.persona !== "elf" && a.status === "rest" && !holds(st!, a.id).length && !tracks.current.get(a.id)?.busy && tracks.current.get(a.id)?.at.kind === "home");
      return (free ?? all[0])?.id;
    };
    const move = async (t: TaskState, from: FolderAt, to: FolderAt) => {
      if (sameAt(from, to)) return;
      const st = useOffice.getState().state;
      const exists = (aid: string) => !!st?.agents.some((a) => a.id === aid);
      if (to.kind === "board" || (from.kind === "board" && to.kind === "cabinet")) return put(t.id, to);
      if (to.kind === "agent") {
        const stand = deskStand(to.agentId);
        if (!stand || !exists(to.agentId)) return put(t.id, { kind: "cabinet" });
        // 앞 사람이 자기 책상의 서류철을 이고 다음 사람 책상까지 건넨다
        if (from.kind === "agent" && exists(from.agentId) && deskOf(from.agentId)) {
          const giver = from.agentId;
          await errand(giver, [
            { at: deskStand(giver)!, act: () => lift(t.id, giver, t.color) },
            { at: stand, act: () => drop(t.id, to) },
          ]);
          return;
        }
        // 프론트 데스크의 쪽지를 받아 가거나 캐비닛에서 꺼내 도비가 가져다준다
        const runner = idleRunner();
        if (!runner) return put(t.id, to);
        const fromBoard = from.kind === "board";
        await errand(runner, [
          {
            at: fromBoard ? FRONT_SPOT : CABINET_SPOT,
            act: async () => {
              if (!fromBoard) return lift(t.id, runner, t.color);
              // 스티커를 떼면 머리 위 그림이 스티커에서 서류철로 바뀐다
              put(t.id, { kind: "moving" });
              setCarry((c) => [...c, { key: `note:${t.id}`, agentId: runner, note: true }]);
              await wait(400);
              setCarry((c) => [...c.filter((x) => x.key !== `note:${t.id}`), { key: `folder:${t.id}`, agentId: runner, folder: t.color }]);
            },
          },
          { at: stand, act: () => drop(t.id, to) },
        ]);
        return;
      }
      // 캐비닛으로: 든 사람이 캐비닛 앞까지 가서 꽂는다
      if (from.kind === "agent" && exists(from.agentId) && deskOf(from.agentId)) {
        const giver = from.agentId;
        await errand(giver, [
          { at: deskStand(giver)!, act: () => lift(t.id, giver, t.color) },
          {
            at: CABINET_SPOT,
            act: async () => {
              setCarry((c) => c.filter((x) => x.key !== `folder:${t.id}`));
              const key = `in:${t.id}:${Date.now()}`;
              setFlyIns((f) => [...f, { key, color: t.color, x: CABINET_SPOT.x, y: CABINET_SPOT.y - 66 }]);
              await wait(FOLDER_IN_MS);
              setFlyIns((f) => f.filter((x) => x.key !== key));
              put(t.id, { kind: "cabinet" });
            },
          },
        ]);
        return;
      }
      put(t.id, to);
    };
    // 화면에서 서류철이 지금 있는 곳의 점. 흐려지며 사라질 자리
    const pointNow = (at: FolderAt | undefined): Pt => {
      if (at?.kind === "agent") {
        const p = deskOf(at.agentId);
        if (p) return { x: p.x + p.w / 2 - 14, y: p.y - 34 };
      }
      return at?.kind === "board" ? { x: FRONT_DESK.x + FRONT_DESK.w / 2, y: FRONT_DESK.y + 14 } : CABINET_SLOT;
    };

    // 스냅샷으로 바뀌면(처음 열 때, 서버를 다시 켰을 때) 연출 없이 서버 위치 그대로 그린다
    if (seenEpoch.current !== epoch) {
      seenEpoch.current = epoch;
      chains.current.clear();
      seen.current = new Map(state.tasks.map((t) => [t.id, t]));
      want.current = Object.fromEntries(state.tasks.map((t) => [t.id, t.folder]));
      setShown(Object.fromEntries(state.tasks.map((t) => [t.id, t.folder])));
      return;
    }
    for (const t of state.tasks) {
      seen.current.set(t.id, t);
      if (t.retroOf && t.table?.crew.planner) retroPlanner.current.set(t.id, t.table.crew.planner);
      const w = want.current[t.id];
      if (!w) {
        want.current[t.id] = t.folder;
        put(t.id, t.folder);
        continue;
      }
      if (sameAt(w, t.folder)) continue;
      want.current[t.id] = t.folder;
      queue(t.id, () => move(t, w, t.folder));
    }
    for (const [id, t] of [...seen.current]) {
      if (state.tasks.some((x) => x.id === id)) continue;
      seen.current.delete(id);
      const w = want.current[id];
      delete want.current[id];
      if (t.retroOf) {
        // 회고 끝: 기획자가 회고록을 들고 회고 책장 앞으로 가서 꽂는다
        const planner = retroPlanner.current.get(id);
        retroPlanner.current.delete(id);
        queue(id, async () => {
          put(id, null);
          if (!planner) return;
          const key = `retro:${id}`;
          setCarry((c) => [...c, { key, agentId: planner, folder: t.color }]);
          await errand(planner, [
            {
              at: RETRO_SHELF_SPOT,
              act: async () => {
                setCarry((c) => c.filter((x) => x.key !== key));
                setFlights((f) => [...f, { key, x: RETRO_SHELF_SPOT.x, y: RETRO_SHELF_SPOT.y - 66, to: RETRO_SHELF_SLOT }]);
                await wait(FLY_MS);
                setFlights((f) => f.filter((x) => x.key !== key));
              },
            },
          ]);
        });
      } else if (state.books.some((b) => b.key === t.key)) {
        // 해결: 서류철을 캐비닛에 꽂은 뒤 책이 되어 책꽂이로 날아간다. 도비 사무실은 프론트 데스크에 반납된 책이 날아간다
        if (w && w.kind !== "cabinet") queue(id, () => move(t, w, { kind: "cabinet" }));
        const from = dobby ? { x: DESK_BOOKS.x + 15, y: DESK_BOOKS.y + 18 } : CABINET_SLOT;
        const back = returned.current.get(id)?.done;
        queue(id, async () => {
          // 도비가 아직 책을 들고 데스크로 가는 중이면 내려놓은 뒤에 날린다(바로 해결된 오더, 데모)
          if (back) await Promise.race([back, wait(30_000)]);
          put(id, null);
          setFlights((f) => [...f, { key: t.key, x: from.x, y: from.y }]);
          onFlight?.(t.key, true);
          await wait(FLY_MS);
          setFlights((f) => f.filter((x) => x.key !== t.key));
          onFlight?.(t.key, false);
        });
      } else {
        // 버림: 그 자리에서 흐려지며 사라진다
        const at = pointNow(w);
        queue(id, async () => {
          put(id, null);
          setCarry((c) => c.filter((x) => x.key !== `folder:${id}`));
          const key = `fade:${id}`;
          setFading((f) => [...f, { key, color: t.color, ...at }]);
          await wait(FADE_MS);
          setFading((f) => f.filter((x) => x.key !== key));
        });
      }
      queue(id, async () => void chains.current.delete(id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.tasks, epoch]);

  // 들고 가는 책·쪽지·서류철·토스트·다과는 머리 위를 따라간다
  const carryRefs = useRef(new Map<string, SVGGElement>());
  useEffect(() => {
    if (!carry.length) return;
    let raf = 0;
    const place = () => {
      for (const c of carry) {
        if (c.at) continue;
        const p = motion.pos(c.agentId), el = carryRefs.current.get(c.key);
        if (p && el) el.setAttribute("transform", `translate(${p.x} ${p.y - 66})`);
      }
      raf = requestAnimationFrame(place);
    };
    place();
    return () => cancelAnimationFrame(raf);
  }, [carry, motion]);

  // 말풍선: 사건이 생기면 그 에이전트가 바로 말하고, 조용하면 무작위 한 명이 가끔 말한다.
  // 서류철을 든 사람은 머리에 그 작업의 이슈 번호를 붙인다
  const taskFor = (st: OfficeState, a: AgentState) => st.tasks.find((t) => t.id === a.doingTask) ?? holds(st, a.id)[0];
  const say = useCallback((agentId: string, situation: string, vars: Record<string, string | number> = {}) => {
    const st = useOffice.getState().state;
    const a = st?.agents.find((x) => x.id === agentId);
    if (!st || !a) return;
    const taskKey = taskFor(st, a)?.key ?? "";
    const text = quipText(a.id, a.persona, situation, { task: taskKey, ...vars });
    const id = ++bubbleNo.current;
    setBubbles((b) => [...b.filter((x) => x.agentId !== agentId), { id, agentId, head: `${a.name} · ${a.avatar?.trait ?? PERSONA_LABEL[a.persona]}${taskKey ? ` · ${taskKey}` : ""}`, text }].slice(-3));
    setTimeout(() => setBubbles((b) => b.filter((x) => x.id !== id)), 3500);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // 지금 하는 일 말풍선. 머리는 "{키} · {제목 앞 24자}"
  const sayDoing = useCallback((agentId: string, text: string, taskId?: string) => {
    const st = useOffice.getState().state;
    const a = st?.agents.find((x) => x.id === agentId);
    if (!st || !a || !text) return;
    const t = st.tasks.find((x) => x.id === taskId);
    const id = ++bubbleNo.current;
    const head = t ? `${t.key} · ${t.title.slice(0, 24)}` : `${a.name} · ${a.avatar?.trait ?? PERSONA_LABEL[a.persona]}`;
    setBubbles((b) => [...b.filter((x) => x.agentId !== agentId), { id, agentId, head, text: `${a.name}: ${text}` }].slice(-3));
    setTimeout(() => setBubbles((b) => b.filter((x) => x.id !== id)), 3500);
  }, []);
  // 발표자가 데이터 분석 결과를 알리는 말풍선. 보통 말보다 오래 둔다
  const announce = useCallback((agentId: string, text: string) => {
    const a = useOffice.getState().state?.agents.find((x) => x.id === agentId);
    if (!a) return;
    const id = ++bubbleNo.current;
    setBubbles((b) => [...b.filter((x) => x.agentId !== agentId), { id, agentId, head: `${a.name} · 데이터 분석 발표`, text }].slice(-3));
    setTimeout(() => setBubbles((b) => b.filter((x) => x.id !== id)), 7000);
  }, []);
  // 새 분석 결과가 나오면 쉬는 사람들을 모니터 앞으로 불러 발표한다. 30초 안에 자리가 안 나면 그만둔다
  const presentCall = useRef<{ text: string; at: number } | null>(null);
  const presenter = useRef<{ id: string; text: string } | null>(null);
  useEffect(() => {
    if (present?.n) presentCall.current = { text: present.text, at: Date.now() };
  }, [present?.n]); // eslint-disable-line react-hooks/exhaustive-deps
  const dobbySays = useCallback((text: string) => {
    const id = ++bubbleNo.current;
    setBubbles((b) => [...b.filter((x) => x.agentId !== CAFE_DOBBY_ID), { id, agentId: CAFE_DOBBY_ID, head: "카페 도비", text }].slice(-3));
    setTimeout(() => setBubbles((b) => b.filter((x) => x.id !== id)), ORDER_MS + 600);
  }, []);

  // 프론트 도비: 누가 탕비실 위 문을 지나 들어오면(문 줄을 위에서 아래로 넘으면) 인사한다. 너무 잦지 않게 간격을 둔다
  useEffect(() => {
    const door = DOORS.find((d) => !d.v)!, lastY = new Map<string, number>();
    let last = 0;
    const timer = setInterval(() => {
      for (const a of useOffice.getState().state?.agents ?? []) {
        const p = motion.pos(a.id), prev = lastY.get(a.id);
        if (!p) continue;
        lastY.set(a.id, p.y);
        if (prev == null || !(prev < door.at && p.y >= door.at) || p.x < door.a || p.x > door.b || Date.now() - last < GREET_GAP_MS) continue;
        last = Date.now();
        const id = ++bubbleNo.current;
        setBubbles((b) => [...b.filter((x) => x.agentId !== FRONT_DOBBY_ID), { id, agentId: FRONT_DOBBY_ID, head: "프론트 도비", text: GREETINGS[Math.floor(Math.random() * GREETINGS.length)] }].slice(-3));
        setTimeout(() => setBubbles((b) => b.filter((x) => x.id !== id)), 2200);
      }
    }, 150);
    return () => clearInterval(timer);
  }, [motion]);

  // 빈 책상이 생기면 의자에서 기다리던 사람이 가서 앉는다. 책상이 일 없는 사람의 기본 자리다
  useEffect(() => {
    const timer = setInterval(() => {
      const st = useOffice.getState().state;
      if (!st) return;
      const used = new Set([...seats.current.desk.values(), ...seats.current.parked.values()]);
      const k = DESKS.findIndex((_, i) => !used.has(i));
      const one = k < 0 ? undefined : st.agents.find((a) => {
        const t = tracks.current.get(a.id);
        return t && a.persona !== "elf" && !needsDesk(a, st) && !seatIn(st, a.id) && t.at.kind === "home" && !t.busy && t.teaSeat == null && !motion.held(a.id);
      });
      if (!one) return;
      const t = tracks.current.get(one.id)!;
      leaveHome(seats.current, one.id);
      seats.current.parked.set(one.id, k);
      const to: Spot = { kind: "desk", at: { x: DESKS[k].x, y: DESKS[k].y } };
      t.targetKey = spotKey(to);
      go(one.id, to);
    }, 3000);
    return () => clearInterval(timer);
  }, [go]);

  // 쉬기: 쉬는 에이전트가 가끔 카페, 탕비, 소파, 수면실에 들렀다 돌아간다(화면에서만 하는 연출)
  useEffect(() => {
    const timer = setInterval(() => {
      const st = useOffice.getState().state;
      if (presentCall.current && Date.now() - presentCall.current.at > 30_000) presentCall.current = null;
      const call = presentCall.current;
      if (!st || !seats.current.used.includes(null) || (!call && Math.random() < 0.4)) return;
      const free = st.agents.filter((a) => {
        const t = tracks.current.get(a.id);
        const sitting = t?.at.kind === "home" || (t?.at.kind === "desk" && seats.current.parked.has(a.id));
        return t && sitting && !needsDesk(a, st) && !t.busy && t.teaSeat == null && !motion.held(a.id);
      });
      if (!free.length) return;
      const shuffled = () => [...free].sort(() => Math.random() - 0.5);
      // 데이터 분석 발표: 모니터 앞이 비면 쉬는 사람 가운데 한 명이 발표하고 나머지 여섯까지 앉아 듣는다
      if (call) {
        if (seats.current.used[PRESENT_SPOT]) return;
        presentCall.current = null;
        // 모니터 앞 의자에 이미 앉아 쉬는 사람은 그대로 듣고, 빈 의자만 채운다
        const chairs = HUDDLE_SEATS.filter((i) => !seats.current.used[i]).sort(() => Math.random() - 0.5), crew = shuffled().slice(0, 1 + chairs.length);
        presenter.current = { id: crew[0].id, text: call.text };
        crew.forEach((a, k) => visit(a, k ? chairs[k - 1] : PRESENT_SPOT));
        return;
      }
      // 가끔 아무나 2~4명이 빈 카페 테이블에 함께 앉는다
      const table = CAFE_TABLES.find((chairs) => chairs.every((i) => !seats.current.used[i]));
      const crew = free.length >= 2 ? shuffled() : undefined;
      if (table && crew && Math.random() < 0.2) {
        const n = 2 + Math.floor(Math.random() * (Math.min(4, crew.length) - 1));
        crew.sort(() => Math.random() - 0.5).slice(0, n).forEach((a, k) => visit(a, table[k]));
        return;
      }
      const empty = seats.current.used.flatMap((u, i) => (u ? [] : [i]));
      // 가끔 아무나 3~7명이 모니터 앞에서 회의한다. 한 명은 모니터 옆에 서서 발표한다
      const huddleFree = [PRESENT_SPOT, ...HUDDLE_SEATS].every((i) => !seats.current.used[i]);
      const team = free.length >= 3 ? shuffled() : undefined;
      if (huddleFree && team && Math.random() < 0.2) {
        const n = 3 + Math.floor(Math.random() * (Math.min(7, team.length) - 2));
        const chairs = [...HUDDLE_SEATS].sort(() => Math.random() - 0.5);
        team.sort(() => Math.random() - 0.5).slice(0, n).forEach((a, k) => visit(a, k ? chairs[k - 1] : PRESENT_SPOT));
        return;
      }
      const one = free[Math.floor(Math.random() * free.length)];
      // 가끔은 다른 빈 의자로 옮겨 앉는다(책상이 자리인 사람은 그대로)
      if (Math.random() < 0.3 && !seats.current.parked.has(one.id)) return void go(one.id, rehome(one.id));
      const solo = empty.filter((i) => i !== PRESENT_SPOT);
      visit(one, solo[Math.floor(Math.random() * solo.length)]);
    }, 2600);
    // 돌아갈 자리. 책상이 자리인 사람은 그 책상, 나머지는 의자를 새로 고른다
    const rehome = (id: string): Spot => {
      const t = tracks.current.get(id)!, pk = seats.current.parked.get(id);
      leaveHome(seats.current, id);
      const to: Spot = pk != null ? { kind: "desk", at: { x: DESKS[pk].x, y: DESKS[pk].y } } : homeOf(seats.current, id);
      t.targetKey = spotKey(to);
      return to;
    };
    const visit = (a: AgentState, seat: number) => {
      const t = tracks.current.get(a.id)!;
      seats.current.used[seat] = a.id;
      t.teaSeat = seat;
      const back = t.at, spot: Spot = { kind: "rest", i: seat }, rest = RESTS[seat];
      const stay = () => t.targetKey === spotKey(back);
      const walkTo = async (to: Spot) => {
        const from = t.at;
        t.at = to;
        await motion.walk(a.id, route(from, to, motion.others(a.id)));
      };
      t.busy++;
      void motion.enqueue(a.id, async () => {
        // 간식: 스낵바나 작은 탕비에 서서 집은 뒤 자리로 가져가 앉는다. 카페 자리도 가끔 스낵바에서 가져온다
        const pick = rest.pick ?? (rest.kind === "cafe" && Math.random() < 0.3 ? "snack" : undefined);
        if (pick) {
          await walkTo({ kind: "pt", at: PICKS[pick][Math.floor(Math.random() * PICKS[pick].length)], pose: "up" });
          if (stay()) {
            await new Promise((r) => setTimeout(r, PICK_MS));
            serve(a.id, TREATS[pick]);
          }
        }
        // 카페: 줄을 서고, 앞사람 주문이 끝나면 카운터에서 주문해 커피를 받아 자리에 앉는다
        else if (rest.kind === "cafe") {
          const n = cafeLine.current.push(a.id) - 1;
          let release = () => {};
          const prev = cafeTurn.current;
          cafeTurn.current = new Promise<void>((r) => (release = r));
          try {
            if (n > 0) await walkTo({ kind: "pt", at: LINE[Math.min(n, LINE.length) - 1], pose: "up" });
            await prev;
            if (stay()) {
              await walkTo({ kind: "pt", at: COUNTER, pose: "up" });
              dobbySays("주문하시겠어요?");
              await new Promise((r) => setTimeout(r, ORDER_MS));
              serve(a.id, TREATS.cafe);
            }
          } finally {
            cafeLine.current = cafeLine.current.filter((x) => x !== a.id);
            release();
          }
        }
        if (!stay()) {
          freeTea(a.id, t);
          t.busy--;
          return;
        }
        await walkTo(spot);
        t.busy--;
        if (t.at !== spot || !stay()) return;
        if (rest.kind === "toaster") toast(a.id, !a.avatar);
        if (rest.plate) putDown(a.id, rest.plate);
        setTea((s) => ({ ...s, [a.id]: true }));
        if (rest.kind === "present" && presenter.current?.id === a.id) (announce(a.id, presenter.current.text), (presenter.current = null));
        else if (rest.kind === "present" || (Math.random() < 0.5 && rest.kind !== "bed")) say(a.id, talkOf(rest.kind));
        // 멈춰 기다리는 동안에는 일어나지 않고 조금 뒤에 다시 본다
        const leave = () => {
          if (t.at === spot && stay()) motion.held(a.id) ? (t.teaTimer = setTimeout(leave, 2000)) : go(a.id, rehome(a.id));
        };
        t.teaTimer = setTimeout(leave, rest.kind === "stand" ? 4000 + Math.random() * 4000 : (rest.kind === "bed" ? 14000 : 7000) + Math.random() * 9000); // 입식 테이블은 먹고 금방 간다
      });
    };
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motion, go, toast, route, dobbySays]);

  // 테이블: 4초마다 가끔 한 명이 말하고, 테이블마다 가끔 일하지 않는 한 명이 간식을 집어 와 노트북 옆에 놓고 먹는다
  const snacking = useRef(new Set<string>());
  useEffect(() => {
    const timer = setInterval(() => {
      const st = useOffice.getState().state;
      const tables = st?.tasks.filter((t) => t.table) ?? [];
      if (!st || !tables.length) return;
      // 자리에 닿아 앉아 있는 사람만
      const sitting = (t: TaskState) =>
        (Object.entries(t.table!.crew) as [SeatRole, string][]).filter(([, id]) => {
          const tr = tracks.current.get(id);
          return tr?.at.kind === "seat" && !tr.busy && !snacking.current.has(id);
        });
      if (Math.random() < 0.15) {
        const t = tables[Math.floor(Math.random() * tables.length)], who = sitting(t);
        const [role, id] = who[Math.floor(Math.random() * who.length)] ?? [];
        if (id) {
          const w = t.table!.work?.[role!] ?? "idle", stage = (t.table!.stage ?? t.phase).replace(/^▶\s*/, "");
          const busy = (Object.entries(t.table!.work ?? {}) as [SeatRole, string][]).find(([, v]) => v === "work")?.[0];
          say(id, w === "work" ? "table_work" : w === "wait" ? "table_wait" : "table_idle", { stage, who: busy ? ROLE_NAME[busy] : "다들" });
        }
      }
      for (const t of tables) {
        if (Math.random() > 0.03 || [...snacking.current].some((id) => Object.values(t.table!.crew).includes(id))) continue;
        const idle = sitting(t).filter(([role]) => (t.table!.work?.[role] ?? "idle") === "idle");
        const [role, id] = idle[Math.floor(Math.random() * idle.length)] ?? [];
        if (!id) continue;
        const tr = tracks.current.get(id)!, seat = tr.at;
        if (seat.kind !== "seat") continue;
        snacking.current.add(id);
        tr.busy++;
        void motion.enqueue(id, async () => {
          try {
            const pickAt: Spot = { kind: "pt", at: PICKS.snack[Math.floor(Math.random() * PICKS.snack.length)], pose: "up" };
            tr.at = pickAt;
            await motion.walk(id, route(seat, pickAt, motion.others(id)));
            const now = useOffice.getState().state?.tasks.find((x) => x.id === t.id)?.table;
            // 일할 차례가 되면 집지 않고 바로 돌아온다
            if ((now?.work?.[role!] ?? "idle") === "idle") {
              await new Promise((r) => setTimeout(r, PICK_MS));
              serve(id, TREATS.snack);
            }
            tr.at = seat;
            await motion.walk(id, route(pickAt, seat, motion.others(id)));
            const key = eating.current.get(id);
            if (key && now) {
              const ri = now.place ? now.seats?.[role!] : undefined;
              const at = ri != null ? (RESTS[ri].plate ?? { x: RESTS[ri].at.x + 16, y: RESTS[ri].at.y - 14 }) : snackOf(now, role!);
              setCarry((c) => c.map((x) => (x.key === key ? { ...x, at, onTable: true } : x)));
              setTimeout(() => {
                setCarry((c) => c.filter((x) => x.key !== key));
                if (eating.current.get(id) === key) eating.current.delete(id);
              }, 20000 + Math.random() * 20000);
            }
          } finally {
            tr.busy--;
            snacking.current.delete(id);
          }
        });
      }
    }, 4000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motion, route, say]);

  useEffect(
    () =>
      onOfficeEvent((env) => {
        const e = env.event;
        if (e.type === "agent.doing") return sayDoing(e.agentId, e.text, e.taskId);
        if (e.type !== "agent.quip") return;
        const t = tracks.current.get(e.agentId);
        const fromTea = e.situation === "assigned" && t && (t.teaSeat != null || t.at.kind === "rest");
        say(e.agentId, fromTea ? "tea_called" : e.situation, e.vars);
      }),
    [say, sayDoing],
  );

  useEffect(() => {
    const timer = setInterval(() => {
      const st = useOffice.getState().state;
      if (!st || Math.random() < 0.3) return;
      setBubbles((cur) => {
        if (cur.length) return cur;
        const a = st.agents[Math.floor(Math.random() * st.agents.length)];
        const t = tracks.current.get(a.id);
        if (t?.at.kind === "rest" && RESTS[t.at.i].kind === "bed") return cur;
        const sit = t?.at.kind === "rest" ? talkOf(RESTS[t.at.i].kind) : !isWorking(a, st) ? "idle" : a.quipCtx?.situation ?? "idle";
        queueMicrotask(() => say(a.id, sit, t?.at.kind === "rest" || sit === "idle" ? {} : a.quipCtx?.vars ?? {}));
        return cur;
      });
    }, 3200);
    return () => clearInterval(timer);
  }, [say]);

  // 말풍선 위치는 걷는 캐릭터를 따라 매 프레임 맞춘다
  useEffect(() => {
    if (!bubbles.length) return;
    let raf = 0;
    const place = () => {
      const svg = svgRef.current, layer = layerRef.current, ctm = svg?.getScreenCTM();
      if (svg && layer && ctm) {
        const box = layer.getBoundingClientRect();
        for (const el of layer.querySelectorAll<HTMLDivElement>("[data-agent]")) {
          const p = motion.pos(el.dataset.agent!);
          if (!p) continue;
          const pt = new DOMPoint(p.x, p.y - 62).matrixTransform(ctm);
          const left = Math.max(6, Math.min(pt.x - box.left - el.offsetWidth / 2, box.width - el.offsetWidth - 6));
          el.style.left = `${left}px`;
          el.style.top = `${pt.y - box.top - el.offsetHeight}px`;
        }
      }
      raf = requestAnimationFrame(place);
    };
    place();
    return () => cancelAnimationFrame(raf);
  }, [bubbles, motion]);

  // 모니터 앞에 누가 앉아 있거나 서 있으면 장표를 넘긴다
  const meeting = Object.keys(tea).some((id) => {
    const at = tea[id] ? tracks.current.get(id)?.at : undefined;
    return at?.kind === "rest" && (RESTS[at.i].kind === "huddle" || RESTS[at.i].kind === "present");
  });
  const [slide, setSlide] = useState<number | null>(null);
  useEffect(() => {
    if (!meeting) return setSlide(null);
    setSlide(0);
    const timer = setInterval(() => setSlide((n) => (n ?? 0) + 1), SLIDE_MS);
    return () => clearInterval(timer);
  }, [meeting]);

  if (!state) return <svg ref={svgRef} id="office" viewBox={`0 0 ${VW} ${VH}`} />;

  const restAt = (id: string) => {
    const at = tracks.current.get(id)?.at;
    return at?.kind === "rest" ? RESTS[at.i].kind : undefined;
  };
  const flagEl = (t: TaskState) =>
    t.table && seats.current.planted.has(t.id) ? <WorkFlag key={t.id} t={t} dobby={dobby} onAsk={onHuman} onHold={onHold} onOpen={onZoom && ((x) => onZoom(x, zoomOf(x.table!, tableHit(x.table!))))} onHover={setFlagHover} /> : null;
  // 사람 하나. 테이블 자리에 앉아 있으면 역할 이름표와 전구를 단다(뒷모습 자리는 노트북을 가리지 않게 이름 아래)
  const person = (a: AgentState) => {
    const rk = restAt(a.id), at = tracks.current.get(a.id)?.at;
    const face: Face = walking[a.id] ? "walk" : tea[a.id] ? (rk === "bed" ? "rest" : rk === "huddle" ? "think" : rk === "present" ? "happy" : "tea") : a.status;
    // 걷던 길 위에 멈춰 섰으면 선 모습으로 그린다
    const w = walking[a.id] || (stopped[a.id] ? "front" : false), pose = w === "side" ? "walk" : w === "up" ? "up" : w || burnt[a.id] ? "stand" : poseOf(at);
    const task = holds(state, a.id).find((t) => t.human) ?? holds(state, a.id)[0];
    const table = at?.kind === "seat" && !w ? state.tasks.find((t) => t.id === at.taskId)?.table : undefined;
    const seat = at?.kind === "seat" && table ? { role: at.role, work: table.work?.[at.role] ?? "idle", below: at.row === 1, fill: fillOf(table.prog, at.role) } : undefined;
    // 쉼터 가구 자리(쉬는 자리, 일 없을 때 의자, 모일 곳 자리)의 RESTS 번호
    const ri = at?.kind === "rest" || at?.kind === "home" ? at.i : at?.kind === "seat" ? at.rest : undefined;
    // 작업 테이블과 작은 탕비 탁자에는 의자가 없다. 거기 앉을 때만 스툴을 깐다
    const stool = !w && ((at?.kind === "seat" && at.rest == null) || (ri != null && RESTS[ri].kind === "nook"));
    // 쉼터 탁자 위쪽(앞모습) 자리: 발 아래는 탁자 판이라 이름이 맞은편 사람 머리에 겹친다. 잘린 그림 바로 아래, 탁자 윗변에 붙여 쓴다.
    // 회의 탁자(meet)는 위아래 줄 사이가 좁아 거기도 맞은편 머리에 가리므로 머리 위(앉은 그림 높이 56 + 4)에 쓴다
    const frontRest = !w && !stool && a.avatar?.seated && pose === "front" && ri != null;
    // 의자 덮개가 있는 아래 자리는 이름이 의자 다리에 묻히지 않게 의자 아래 끝 밑에 쓴다
    const cover = !w && ri != null ? RESTS[ri].cover : undefined;
    const nameY = frontRest ? (RESTS[ri!].kind === "meet" ? -60 : 0) : cover && ri != null ? Math.round(cover.clip.y + cover.clip.h + 12 - RESTS[ri].at.y) : undefined;
    const body = <OfficeAgent key={a.id} nameY={nameY} stool={stool} agent={a} face={face} walking={!!walking[a.id]} busy={isWorking(a, state)} pose={pose} lying={!w && !!tea[a.id] && rk === "bed"} burnt={!!burnt[a.id]} bind={bindFor(a.id)} seat={seat} onAsk={a.asking && task ? () => onHuman?.(task) : undefined} />;
    // 도비 사무실: 일하지 않는 사람을 누르면 업무 맡기기 창이 열린다. 일하는 사람은 마우스를 올리면 하는 일만 보인다
    if (!onAgent || a.persona === "elf") return body;
    const sat = seatIn(state, a.id);
    if (sat) return <g key={a.id} className="agent-busy"><title>{`${sat.t.key} · ${ROLE_NAME[sat.role]} 작업 중`}</title>{body}</g>;
    if (a.asking) return body;
    // 다른 사람들의 지금 자리도 넘긴다. 서버가 가까운 동료부터 고를 때 쓴다
    const nearOf = () => state.agents.flatMap((x) => { const p = x.id !== a.id && x.persona !== "elf" && !seatIn(state, x.id) && motion.pos(x.id); return p ? [{ id: x.id, x: Math.round(p.x), y: Math.round(p.y) }] : []; });
    const assign = () => onAgent(a, motion.pos(a.id) ?? { x: 0, y: 0 }, nearOf());
    return (
      <g key={a.id} className="agent-free" role="button" tabIndex={0} aria-label={`${a.name}에게 업무 맡기기`} onClick={assign} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), assign())}>
        <title>{`${a.name}에게 업무 맡기기`}</title>
        {body}
      </g>
    );
  };
  const shownAt = (t: TaskState): Shown => shown[t.id] ?? t.folder;
  const doneNotes = state.tasks.filter((t) => t.note), freshDone = doneNotes.filter((t) => !t.note?.seen).length, held = state.tasks.filter((t) => t.hold);
  const onDesk = (agentId: string) => state.tasks.filter((t) => { const at = shownAt(t); return at.kind === "agent" && at.agentId === agentId; });
  const inCabinet = state.tasks.filter((t) => shownAt(t).kind === "cabinet");
  const asks = inCabinet.filter((t) => t.human).length, confirms = inCabinet.filter((t) => t.confirm).length;
  const folderImg = (color: number, x: number, y: number, w: number, h: number) => (
    <image href="/sprites/binder-1.webp" x={x} y={y} width={w} height={h} filter={`url(#folder-c${color % FOLDER_COLORS.length})`} className="pixel" />
  );
  return (
    <>
      <svg ref={svgRef} id="office" viewBox={`0 0 ${VW} ${VH}`} role="img" aria-label="왼쪽 위 카페, 왼쪽 아래 책상 방, 가운데 복도와 그 아래 끝 수면실, 프론트 데스크와 중앙 탕비실, 아래 소파가 있는 사무실 도면">
        {/* 탁자 확대 창이 이 묶음을 복사해 보인다 */}
        <g id="office-scene">
        <FloorPlan onShelf={onShelf} onRetroShelf={onRetroShelf} onCabinet={onCabinet} />
        <Doors motion={motion} />
        {slide != null && MONITORS.map((m, i) => <Slide key={i} k={slide + i * 2} x={m.x + SCREEN.x * m.w} y={m.y + SCREEN.y * m.h} w={SCREEN.w * m.w} h={SCREEN.h * m.h} />)}
        {onMonitor && <MonitorHit m={MONITORS[0]} name="팀 이슈 현황" hint="누르면 조사 요약이 열립니다" busy={jobsRunning ? "조사 중" : ""} onOpen={onMonitor} />}
        {onDataMonitor && <MonitorHit m={MONITORS[1]} name="데이터 분석" hint="누르면 해결된 오더의 분석 결과가 열립니다" busy={dataScreen?.text ?? ""} tone={dataScreen?.tone} fresh={dataFresh} onOpen={onDataMonitor} />}
        {[...DESKS, COURIER_DESK].map((p, i) => (
          <image key={i} href="/sprites/desk-chair.webp" {...deskArt(p).chair} />
        ))}
        {(asks > 0 || confirms > 0) && (
          // 사람 차례나 완료 확인에서 멈춘 작업은 서류철이 캐비닛에 있다. 캐비닛 위 꼬리표를 누르면 보고서 창이 열린다
          <g className="cabinet-tag" role="button" tabIndex={0} aria-label={`보고서 열기: 사람 확인 ${asks}건, 완료 확인 ${confirms}건`} onClick={onCabinet} onKeyDown={(e) => e.key === "Enter" && onCabinet?.()}>
            <title>사람이 할 일이 있는 작업. 누르면 작업 보고서가 열립니다</title>
            {[asks > 0 && `?${asks}`, confirms > 0 && `!${confirms}`].filter(Boolean).map((label, i) => (
              <g key={i}>
                <rect x={CABINET.x + 4 + i * 36} y={CABINET.y - 24} width={32} height={20} rx={10} className={i === 0 && asks > 0 ? "tag-ask" : "tag-confirm"} />
                <text x={CABINET.x + 20 + i * 36} y={CABINET.y - 9} textAnchor="middle">
                  {label}
                </text>
              </g>
            ))}
          </g>
        )}
        {flights.map((f) => {
          const to = f.to ?? SHELF_SLOT, [col] = coverOf(f.key), tx = to.x - 4, ty = to.y - 20;
          return (
            <g key={f.key} className="flying-book" style={{ "--fx": `${f.x - tx - 4}px`, "--fy": `${f.y - ty - 20}px` } as CSSProperties}>
              <rect x={tx} y={ty} width={8} height={40} rx={1.5} style={{ fill: col, stroke: "rgba(0,0,0,.35)" }} />
              <rect x={tx + 1} y={ty + 5} width={6} height={2} style={{ fill: "#e7cf86" }} />
            </g>
          );
        })}
        {flyIns.map((f) => (
          <g key={f.key} className="flying-folder" style={{ "--fx": `${f.x - CABINET_SLOT.x}px`, "--fy": `${f.y - CABINET_SLOT.y}px` } as CSSProperties} pointerEvents="none">
            {folderImg(f.color, CABINET_SLOT.x - BINDER_HEAD.w / 2, CABINET_SLOT.y - BINDER_HEAD.h / 2, BINDER_HEAD.w, BINDER_HEAD.h)}
          </g>
        ))}
        {toasterBoom > 0 && <Boom key={toasterBoom} x={TOASTER.x} y={TOASTER.y - 60} r={22} />}
        {/* 카페 도비를 누르면 역할별 모델 창이 열린다 */}
        <g
          className="cafe-dobby"
          role="button"
          tabIndex={0}
          aria-label="카페 도비: 역할별 모델 바꾸기"
          onClick={onModels}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onModels?.();
            }
          }}
        >
          <title>역할별 모델 바꾸기</title>
          <OfficeAgent agent={CAFE_DOBBY_AGENT} face="happy" walking={false} busy={false} pose="stand" bind={bindFor(CAFE_DOBBY_ID)} />
        </g>
        {/* 프론트 도비의 이름은 발 아래 스낵바와 앞의 책상을 피해 책상 위쪽 바닥에 쓴다. 주문 카운터는 카페 도비만 가린다. 카운터 뒤는 걷지 못하게 막아, 다른 에이전트는 늘 카운터 앞에 그린다 */}
        {/* 프론트 도비(와 데스크 위 쪽지)를 누르면 새 이슈·작업을 접수하는 창이 열린다. 도비 사무실에서는 새 이슈를 전체 자동 실행으로 시작하는 창이 열린다 */}
        <g
          className="front-dobby"
          role="button"
          tabIndex={0}
          aria-label={dobby ? `프론트 도비: 완료 ${doneNotes.length}건${freshDone ? `(새 ${freshDone})` : ""}, 홀딩 ${held.length}건 보기` : "프론트 도비: 새 이슈·작업 접수"}
          onClick={onBoard}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onBoard?.();
            }
          }}
        >
          <title>{dobby ? "완료·홀딩 보기. 일을 맡기려면 쉬는 사람을 누르세요" : "새 작업 접수하기"}</title>
          <DeskNotes tasks={state.tasks.filter((t) => shownAt(t).kind === "board")} />
          {dobby && <DeskBooks tasks={doneNotes.filter((t) => !returning.includes(t.id))} />}
          <OfficeAgent agent={FRONT_DOBBY_AGENT} face="happy" walking={false} busy={false} pose="up" nameY={FRONT_DESK.y - 5 - FRONT_DOBBY.y} bind={bindFor(FRONT_DOBBY_ID)} />
          {dobby && <DeskBadges fresh={freshDone} held={held.length} asking={held.filter((t) => t.human).length} />}
        </g>
        {ART.filter((a) => a[5]).map(([src, x, y, w, h], i) => (
          <image key={`${src}-${i}`} href={`/sprites/${src}.webp`} x={x} y={y} width={w} height={h} pointerEvents="none" />
        ))}
        {/* 탁자 위에 내려놓은 다과. 앉은 사람이 앞을 가리게 사람보다 먼저 그린다 */}
        <g pointerEvents="none">
          {carry.map((c) => {
            if (!c.at || !c.treat || c.onTable) return null;
            const [tw, th] = treatBox(c.treat, 14);
            return <image key={c.key} href={`/sprites/treat-${c.treat}.webp`} x={c.at.x - tw / 2} y={c.at.y - th} width={tw} height={th} className="pixel" />;
          })}
        </g>
        {flagHover && state.tasks.filter((t) => t.id !== flagHover).map(flagEl)}
        {/* 책상 줄마다 사람 → 책상 앞판 → 책상 위 서류철 순서로 그려, 아래 줄 사람이 위 줄 책상 앞에 보이게 한다. 책상에 앉지 않은 사람은 맨 뒤에 그린다 */}
        {[...DESK_ROWS, COURIER_DESK.row, -1].map((row) => {
          const deskOf = (id: string) => seats.current.desk.get(id) ?? seats.current.lastDesk.get(id);
          const rowOf = (id: string) => {
            const at = tracks.current.get(id)?.at;
            if (at?.kind === "desk" && at.at.x === COURIER_DESK.x && at.at.y === COURIER_DESK.y && !walking[id]) return COURIER_DESK.row;
            const i = seats.current.desk.get(id) ?? (at?.kind === "desk" ? seats.current.parked.get(id) : undefined);
            return i == null ? -1 : DESKS[i].row;
          };
          const people = state.agents.filter((a) => rowOf(a.id) === row);
          const desks = row < 0 ? [] : DESKS.map((p, i) => ({ p, i })).filter((d) => d.p.row === row);
          const topSeat = (a: AgentState) => {
            const at = tracks.current.get(a.id)?.at;
            return at?.kind === "seat" && at.row === 0 && !walking[a.id];
          };
          // 발이 위쪽에 있는 사람부터 그려, 세로 탁자처럼 위아래로 붙어 앉은 자리에서 아래 사람이 위 사람을 가리게 한다
          const byFeet = (list: AgentState[]) => [...list].sort((a, b) => (motion.pos(a.id)?.y ?? 0) - (motion.pos(b.id)?.y ?? 0));
          return (
            <g key={row}>
              <g>{byFeet(people.filter((a) => row >= 0 || topSeat(a))).map(person)}</g>
              {row < 0 && <Tables tasks={state.tasks.filter((t) => seats.current.planted.has(t.id))} carry={carry} picked={picked} onOpen={onZoom} />}
              {row < 0 && <g>{byFeet(people.filter((a) => !topSeat(a))).map(person)}</g>}
              <g pointerEvents="none">
                {desks.map(({ p, i }) => (
                  <image key={i} href="/sprites/desk-front.webp" {...deskArt(p).front} />
                ))}
                {row === COURIER_DESK.row && <image href="/sprites/desk-front.webp" {...deskArt(COURIER_DESK).front} />}
              </g>
              {desks.map(({ p, i }) => {
                const pile = state.agents.filter((a) => deskOf(a.id) === i).flatMap((a) => onDesk(a.id));
                if (!pile.length) return null;
                const x0 = p.x + p.w / 2 - BINDER_DESK.w - 2, y0 = p.y - 24 - BINDER_DESK.h + 4;
                return (
                  <DeskFolders
                    key={i}
                    pile={pile}
                    x={x0}
                    y={y0}
                    img={folderImg}
                    onGear={onGear}
                    onHuman={onHuman}
                    onConfirm={onConfirm}
                    onPr={onPr}
                  />
                );
              })}
            </g>
          );
        })}
        {/* 등을 보이고 앉은 아래 자리: 의자 등받이와 스툴 다리는 사람보다 화면 앞이라 사람 다음에 다시 그린다. 걸어 지나가는 사람을 가리지 않게 앉아 있는 동안만 그린다 */}
        <g pointerEvents="none">
          {state.agents.map((a) => {
            const at = tracks.current.get(a.id)?.at;
            const ri = at?.kind === "rest" || at?.kind === "home" ? at.i : at?.kind === "seat" ? at.rest : undefined;
            const c = !walking[a.id] && ri != null ? RESTS[ri].cover : undefined;
            if (!c || ri == null) return null;
            return (
              <g key={a.id}>
                <clipPath id={`cover-${ri}`}>
                  <rect x={c.clip.x} y={c.clip.y} width={c.clip.w} height={c.clip.h} />
                </clipPath>
                <image href={`/sprites/${c.src}.webp`} x={c.x} y={c.y} width={c.w} height={c.h} clipPath={`url(#cover-${ri})`} />
              </g>
            );
          })}
        </g>
        <g pointerEvents="none">
          {fading.map((f) => (
            <g key={f.key} className="folder-fade">
              {folderImg(f.color, f.x - BINDER_DESK.w / 2, f.y - BINDER_DESK.h / 2, BINDER_DESK.w, BINDER_DESK.h)}
            </g>
          ))}
        </g>
        {/* 깃발은 사람 위에 그린다. 마우스를 올린 동안에는 그 깃발만 남기고 나머지는 사람 뒤(위에서 그림)로 내린다 */}
        {state.tasks.filter((t) => !flagHover || t.id === flagHover).map(flagEl)}
        {/* 맥 책상은 뒤에 앉은 사람을 가린다 */}
        <image href="/sprites/mac-desk-front.webp" x={MAC_DESK.x} y={MAC_DESK.y} width={MAC_DESK.w} height={MAC_DESK.h} pointerEvents="none" />
        {/* 사람 앞에 오는 이불 */}
        <g pointerEvents="none">
          {BEDS.map((b, i) => (
            <image key={i} href="/sprites/bed-cover.webp" {...bedArt(b).cover} />
          ))}
        </g>
        <g pointerEvents="none">
          {carry.map((c) => {
            if (c.at) return null;
            const ref = (el: SVGGElement | null) => void (el ? carryRefs.current.set(c.key, el) : carryRefs.current.delete(c.key));
            if (c.toast)
              return (
                <g key={c.key} ref={ref}>
                  <image href="/sprites/toast.webp" x={-12} y={-16} width={24} height={22} className="pixel toast-up" />
                </g>
              );
            if (c.treat) {
              const [tw, th] = treatBox(c.treat, 22);
              return (
                <g key={c.key} ref={ref}>
                  <image href={`/sprites/treat-${c.treat}.webp`} x={-tw / 2} y={6 - th} width={tw} height={th} className="pixel toast-up" />
                </g>
              );
            }
            if (c.flag)
              // 머리에 인 깃발: 깃대와 이슈 번호를 쓴 작은 천
              return (
                <g key={c.key} ref={ref} className="carry-flag">
                  <line x1={0} y1={8} x2={0} y2={-30} />
                  <rect x={1} y={-30} width={Math.max(34, c.flag.length * 6 + 8)} height={14} rx={2} />
                  <text x={5} y={-20}>
                    {c.flag}
                  </text>
                </g>
              );
            if (c.book) {
              // 머리에 인 완성 책: 책장의 표지 색
              const [col] = coverOf(c.book);
              return (
                <g key={c.key} ref={ref}>
                  <rect x={-11} y={-6} width={22} height={7} rx={1.5} style={{ fill: col, stroke: "rgba(0,0,0,.35)" }} />
                  <rect x={-11} y={-6} width={3} height={7} style={{ fill: "#e7cf86" }} />
                </g>
              );
            }
            if (c.laptop)
              return (
                <g key={c.key} ref={ref}>
                  <image href="/sprites/laptop-for-bottom.webp" x={-13} y={-20} width={26} height={25} />
                </g>
              );
            if (c.note)
              return (
                <g key={c.key} ref={ref}>
                  <image href={`/sprites/note-${(hash(c.key) % 6) + 1}.webp`} x={-8} y={-14} width={16} height={16} />
                </g>
              );
            return (
              <g key={c.key} ref={ref}>
                {folderImg(c.folder ?? 0, -BINDER_HEAD.w / 2, -BINDER_HEAD.h + 2, BINDER_HEAD.w, BINDER_HEAD.h)}
              </g>
            );
          })}
        </g>
        </g>
      </svg>
      <div className="quip-layer" ref={layerRef}>
        {bubbles.map((b) => (
          <div key={b.id} className="tip" data-agent={b.agentId} role="status" onMouseEnter={() => setBubbles((cur) => cur.filter((x) => x.id !== b.id))}>
            <small>{b.head}</small>
            {b.text}
          </div>
        ))}
      </div>
    </>
  );
}

// 책상 위 서류철. 2px 씩 어긋나게 3개까지 쌓고, 넘으면 "+N". 맨 위 서류철에 물음표·느낌표·모래시계를 붙인다
function DeskFolders({ pile, x, y, img, onGear, onHuman, onConfirm, onPr }: { pile: TaskState[]; x: number; y: number; img: (color: number, x: number, y: number, w: number, h: number) => ReactNode; onGear?: (t: TaskState) => void; onHuman?: (t: TaskState) => void; onConfirm?: (t: TaskState) => void; onPr?: (t: TaskState) => void }) {
  const show = pile.slice(0, 3), k = show.length - 1;
  const ask = pile.find((t) => t.human), confirm = pile.find((t) => t.confirm), wait = pile.find((t) => isReviewWait(t) || t.waiting);
  const ax = x + k * 2 + BINDER_DESK.w / 2, ay = y - k * 2;
  return (
    <g>
      {show.map((t, i) => (
        <g key={t.id} className="desk-folder" role="button" tabIndex={0} aria-label={`${t.key} 서류철`} onClick={() => onGear?.(t)} onKeyDown={(e) => e.key === "Enter" && onGear?.(t)}>
          <title>{`${t.key} ${t.title} · ${t.phase}`}</title>
          {img(t.color, x + i * 2, y - i * 2, BINDER_DESK.w, BINDER_DESK.h)}
        </g>
      ))}
      {pile.length > 3 && (
        <text x={x + BINDER_DESK.w + 6} y={y - 6} className="strip-more">
          +{pile.length - 3}
        </text>
      )}
      {(ask || confirm) && (
        // 서류철 위 표시. 물음표는 사람 확인, 느낌표는 완료 확인. 누르면 창이 열린다
        <g
          className="room-alert"
          role="button"
          tabIndex={0}
          aria-label={`${(ask ?? confirm)!.key} ${ask ? "사람 확인" : "완료 확인"} 열기`}
          onClick={() => (ask ? onHuman?.(ask) : onConfirm?.(confirm!))}
          onKeyDown={(e) => e.key === "Enter" && (ask ? onHuman?.(ask) : onConfirm?.(confirm!))}
        >
          <rect x={ax - 10} y={ay - 36} width={20} height={36} rx={5} className="hit" />
          {ask ? <image href="/sprites/question.webp" x={ax - 8} y={ay - 32} width={16} height={30} className="pixel" /> : <image href="/sprites/alert.webp" x={ax - 6} y={ay - 32} width={12} height={30} className="pixel" />}
        </g>
      )}
      {!ask && !confirm && wait && (
        // 리뷰·빌드 대기나 일꾼 차례 기다림. 리뷰·빌드 대기면 누르면 PR(빌드)을 연다
        <g
          key={wait.polledAt ?? 0}
          className={`hourglass${wait.polledAt ? " polled" : ""}`}
          role={isReviewWait(wait) ? "button" : undefined}
          tabIndex={isReviewWait(wait) ? 0 : undefined}
          onClick={() => isReviewWait(wait) && onPr?.(wait)}
          onKeyDown={(e) => e.key === "Enter" && isReviewWait(wait) && onPr?.(wait)}
        >
          <title>{isReviewWait(wait) ? `${wait.key} ${wait.phase}${wait.waitSince ? ` · ${Math.round((Date.now() - wait.waitSince) / 60000)}분째` : ""}${wait.longWait ? " · 오래 기다림" : ""}` : `${wait.key} 쉬는 일꾼을 기다리는 중`}</title>
          <circle cx={ax} cy={ay - 14} r={11} className="hourglass-plate" />
          <image href="/sprites/hourglass.webp" x={ax - 9} y={ay - 23} width={18} height={18} className="pixel" />
        </g>
      )}
    </g>
  );
}

// 토스터가 터지는 작은 연출. 번쩍임 위로 불꽃 고리 셋이 퍼지며 사라진다
function Boom({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g className="boom small" pointerEvents="none">
      <circle cx={x} cy={y} r={r * 1.2} className="boom-flash" />
      {[
        ["#e53935", 0],
        ["#ff8a00", 0.08],
        ["#ffd54a", 0.16],
      ].map(([c, d]) => (
        <circle key={c} cx={x} cy={y} r={r} style={{ fill: c as string, animationDelay: `${d}s` }} />
      ))}
      <text x={x} y={y + 9} textAnchor="middle" className="boom-text">
        💥
      </text>
    </g>
  );
}

// 프론트 데스크 위 이름표(도비 사무실): 안 본 완료 수(빨강), 홀딩 수와 답을 기다리는 수(주황). 0건인 줄은 그리지 않는다
// 한글은 글자 크기만큼, 숫자·기호는 그 0.6배로 너비를 어림한다(SVG 글자는 그리기 전에 너비를 잴 수 없다)
const LABEL_FS = 9;
const labelW = (text: string) => [...text].reduce((w, c) => w + (/[가-힣]/.test(c) ? LABEL_FS : LABEL_FS * 0.6), 4);
function DeskBadges({ fresh, held, asking }: { fresh: number; held: number; asking: number }) {
  const rows = [
    fresh > 0 && { text: `새 완료 ${fresh}`, cls: "desk-label done" },
    held > 0 && { text: asking > 0 ? `홀딩 ${held} · 답 필요 ${asking}` : `홀딩 ${held}`, cls: "desk-label hold" },
  ].filter((r): r is { text: string; cls: string } => !!r);
  const cx = FRONT_DESK.x + FRONT_DESK.w / 2, h = 13, bottom = FRONT_DESK.y - 22; // 프론트 도비 이름(데스크 위 5) 위에 아래부터 쌓는다
  return (
    <g pointerEvents="none">
      {rows.map((r, i) => {
        const w = labelW(r.text), y = bottom - (rows.length - i) * (h + 3);
        return (
          <g key={r.cls} className={r.cls}>
            <rect x={cx - w / 2} y={y} width={w} height={h} rx={h / 2} />
            <text x={cx} y={y + h - 3.5} textAnchor="middle">
              {r.text}
            </text>
          </g>
        );
      })}
    </g>
  );
}

// 프론트 데스크 위 쪽지. 접수됐지만 아직 첫 일꾼에게 건네지지 않은 작업이다
const NOTE = 13, NOTE_MAX = 5;
// 프론트 데스크 위 완성 책 더미. 도비가 반납한 책을 눕혀 쌓는다. 해결되면 여기서 서고 책꽂이로 날아간다
const DESK_BOOKS = { x: FRONT_DESK.x + FRONT_DESK.w - 30, y: FRONT_DESK.y + 22, max: 6 };
function DeskBooks({ tasks }: { tasks: TaskState[] }) {
  const books = [...tasks].sort((a, b) => (a.note?.at ?? 0) - (b.note?.at ?? 0)).slice(0, DESK_BOOKS.max);
  return (
    <g pointerEvents="none">
      {books.map((t, i) => {
        const [col] = coverOf(t.key);
        return <rect key={t.id} x={DESK_BOOKS.x + (i % 2) * 2} y={DESK_BOOKS.y - i * 5} width={22} height={5} rx={1} style={{ fill: col, stroke: "rgba(0,0,0,.35)" }} />;
      })}
    </g>
  );
}

function DeskNotes({ tasks }: { tasks: TaskState[] }) {
  const notes = [...tasks].sort((a, b) => a.createdAt - b.createdAt);
  return (
    <g>
      {notes.slice(0, NOTE_MAX).map((t, i) => {
        const x = FRONT_DESK.x + 14 + i * (NOTE + 2), y = FRONT_DESK.y + 8;
        return (
          <g key={t.id}>
            <image href={`/sprites/note-${(hash(t.key) % 6) + 1}.webp`} x={x} y={y} width={NOTE} height={NOTE}>
              <title>{`${t.key} · ${t.title}${t.waiting ? " · 쉬는 일꾼을 기다리는 중" : ""}`}</title>
            </image>
            {/* 일꾼이 모두 바빠 첫 일꾼을 기다리는 쪽지에는 모래시계를 붙인다 */}
            {t.waiting && <image href="/sprites/hourglass.webp" x={x + NOTE - 8} y={y - 3} width={10} height={10} className="pixel" pointerEvents="none" />}
          </g>
        );
      })}
      {notes.length > NOTE_MAX && (
        <text x={FRONT_DESK.x + FRONT_DESK.w - 6} y={FRONT_DESK.y + 18} className="strip-more" textAnchor="end">
          +{notes.length - NOTE_MAX}
        </text>
      )}
    </g>
  );
}

// 작업 테이블: 판, 앉은 사람 앞 노트북, 노트북 옆 간식. 아직 노트북을 이고 오는 사람의 자리는 비워 둔다
export type Box = { x: number; y: number; w: number; h: number };
// 확대 창에 보일 범위: 탁자, 둘러앉은 사람, 깃발까지
// 탁자를 누를 자리. 모일 곳은 그 가구 자리다
function tableHit(tb: WorkTable) {
  const pl = placeOf(tb.place);
  return pl ? { x: pl.box.x1, y: pl.box.y1, width: pl.box.x2 - pl.box.x1, height: pl.box.y2 - pl.box.y1 } : tableArt(tb);
}

function zoomOf(tb: WorkTable, hit: { x: number; y: number; width: number; height: number }): Box {
  const f = flagOf(tb), cx = clothX(f.x, f.side), top = f.y - (f.pole ?? FLAG.poleBottom - FLAG.poleTop);
  const x1 = Math.max(0, Math.min(hit.x, cx) - 40), x2 = Math.min(VW, Math.max(hit.x + hit.width, cx + FLAG.w) + 40);
  const y1 = Math.max(0, Math.min(hit.y - 80, top - 10)), y2 = Math.min(VH, hit.y + hit.height + 70);
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

function Tables({ tasks, carry, picked, onOpen }: { tasks: TaskState[]; carry: { key: string; agentId: string; treat?: string; onTable?: boolean; at?: Pt }[]; picked: string[]; onOpen?: (t: TaskState, box: Box) => void }) {
  const coming = new Set(carry.filter((c) => c.key.startsWith("laptop:")).map((c) => c.agentId));
  return (
    <g pointerEvents="none">
      {tasks.map((t) => {
        const tb = t.table;
        if (!tb) return null;
        const crew = Object.entries(tb.crew) as [SeatRole, string][];
        // 모일 곳은 이미 있는 가구라 테이블 그림 없이 앉은 사람 앞에 노트북만 놓는다
        const pl = placeOf(tb.place);
        const hit = tableHit(tb);
        return (
          <g key={t.id}>
            {!pl && <image href="/sprites/work-table-narrow.webp" {...tableArt(tb)} />}
            {crew.map(([role, id]) => {
              if (coming.has(id)) return null;
              const ri = pl ? tb.seats?.[role] : undefined;
              if (pl && ri == null) return null;
              return <image key={role} {...(ri != null ? placeLaptop(ri) : laptopOf(tb, role))} />;
            })}
            {/* 완성: 도비가 가져갈 책을 테이블 가운데에 눕혀 둔다 */}
            {tb.closing && !picked.includes(t.id) && (
              <g className="table-book">
                <rect x={hit.x + hit.width / 2 - 11} y={hit.y + hit.height / 2 - 4} width={22} height={7} rx={1.5} style={{ fill: coverOf(t.key)[0], stroke: "rgba(0,0,0,.35)" }} />
                <rect x={hit.x + hit.width / 2 - 11} y={hit.y + hit.height / 2 - 4} width={3} height={7} style={{ fill: "#e7cf86" }} />
              </g>
            )}
            {onOpen && (
              <rect className="table-open" pointerEvents="all" role="button" tabIndex={0} aria-label={`${t.key} 탁자 크게 보기`} {...hit} onClick={() => onOpen(t, zoomOf(tb, hit))} onKeyDown={(e) => e.key === "Enter" && onOpen(t, zoomOf(tb, hit))}>
                <title>누르면 이 탁자를 크게 보여 줍니다</title>
              </rect>
            )}
          </g>
        );
      })}
      {carry.map((c) => {
        if (!c.onTable || !c.treat || !c.at) return null;
        const [tw, th] = treatBox(c.treat, 14);
        return <image key={c.key} href={`/sprites/treat-${c.treat}.webp`} x={c.at.x - tw / 2} y={c.at.y - th} width={tw} height={th} className="pixel" />;
      })}
    </g>
  );
}

// 이름표 밑 막대가 차오르는 정도. 테스터는 검증 회차의 판정 수, 개발자는 고칠 파일 중 바뀐 수, 그 밖은 기록한 마친 수. 비율이 없으면 없음
export const fillOf = (p: Progress | undefined, role: SeatRole) =>
  !p?.total ? undefined : p.kind === "test" ? (role === "tester" ? (p.pass + p.fail + p.skip) / p.total : undefined) : (p.kind === "impl" ? "developer" : p.role) === role ? p.done / p.total : undefined;

// 깃발: 첫 줄 이슈 번호와 제목, 둘째 줄 지금 단계를 크게, 아래 띠에서 큰 흐름 여섯 칸 중 지금 칸. 사람 차례면 오른쪽 위 물음표
// 둘째 줄 오른쪽 끝의 홀딩 단추를 누르면 테이블을 걷고 홀딩 게시판으로 보낸다
export const BAND_NAMES = ["설계", "구현", "리뷰", "통합", "배포", "검증"];
function WorkFlag({ t, dobby, onAsk, onHold, onOpen, onHover }: { t: TaskState; dobby?: boolean; onAsk?: (t: TaskState) => void; onHold?: (t: TaskState) => void; onOpen?: (t: TaskState) => void; onHover?: (id: string | null) => void }) {
  const tb = t.table!, base = flagOf(tb), px = base.x, cx = clothX(px, base.side), top = base.y - (base.pole ?? FLAG.poleBottom - FLAG.poleTop), band = tb.band ?? bandOfPhase(t.phase);
  const head = `${t.key} ${t.title}`;
  // 칸 간격은 25. 완성 칸까지 일곱 칸이면 깃발 천 안에 들도록 좁힌다
  const cells = tb.cells ?? BAND_NAMES, step = Math.min(25, (FLAG.w - 12) / cells.length);
  return (
    <g className="work-flag" onMouseEnter={() => onHover?.(t.id)} onMouseLeave={() => onHover?.(null)}>
      <line className="pole" x1={px} y1={top - 4} x2={px} y2={base.y} />
      <g className={onOpen ? "flag-open" : undefined} onClick={onOpen && (() => onOpen(t))}>
        <rect className="banner" x={cx} y={top} width={FLAG.w} height={FLAG.h} rx={3} />
        <text className="key" x={cx + 6} y={top + 10}>
          {head.length > 23 ? `${head.slice(0, 22)}…` : head}
        </text>
        <text className="stage" x={cx + 6} y={top + 24}>
          {tb.stage ?? `▶ ${t.phase}`}
        </text>
        {band >= 0 && <g className="band">
          {cells.map((n, i) => (
            <g key={n}>
              <rect className={i === band || i === tb.also ? "on" : i < band ? "past" : ""} x={cx + 6 + i * step} y={top + 27} width={step - 2} height={9} rx={2} />
              <text x={cx + 6 + i * step + (step - 2) / 2} y={top + 34} textAnchor="middle">
                {n}
              </text>
            </g>
          ))}
        </g>}
      </g>
      {onHold && (
        <g className="flag-hold" role="button" tabIndex={0} aria-label={`${t.key} 홀딩`} onClick={() => onHold(t)} onKeyDown={(e) => e.key === "Enter" && onHold(t)}>
          <title>{dobby ? "홀딩: 자리를 걷고 프론트 도비의 홀딩 탭으로 보냅니다" : "홀딩: 테이블을 걷고 홀딩 게시판으로 보냅니다"}</title>
          <rect x={cx + FLAG.w - 17} y={top + 14} width={13} height={11} rx={2} />
          <text x={cx + FLAG.w - 10.5} y={top + 22.5} textAnchor="middle">
            ❚❚
          </text>
        </g>
      )}
      {t.human && (
        <g className="flag-ask" role="button" tabIndex={0} aria-label={`${t.key} 사람 차례 열기`} onClick={() => onAsk?.(t)} onKeyDown={(e) => e.key === "Enter" && onAsk?.(t)}>
          <title>사람이 답할 차례입니다. 누르면 답하는 창이 열립니다</title>
          <image href="/sprites/question.webp" x={cx + FLAG.w - 18} y={top - 30} width={16} height={30} className="pixel" />
        </g>
      )}
    </g>
  );
}

// 미닫이 자동문. 에이전트가 50 안으로 오면 두 짝이 양옆 벽 속으로(한 짝짜리는 한쪽으로) 밀려 들어간다
function Doors({ motion }: { motion: Motion }) {
  const refs = useRef<(SVGGElement | null)[]>([]);
  useEffect(() => {
    const open = DOORS.map(() => 0);
    let raf = 0;
    const tick = () => {
      const ps = motion.all();
      DOORS.forEach((d, i) => {
        const near = ps.some((p) => {
          const along = d.v ? p.y : p.x, across = d.v ? p.x : p.y;
          return Math.abs(across - d.at) < 50 && along > d.a - 50 && along < d.b + 50;
        });
        const o = Math.max(0, Math.min(1, open[i] + (near ? 0.08 : -0.04)));
        if (o === open[i]) return;
        open[i] = o;
        const s = ((d.b - d.a) / (d.single ? 1 : 2)) * o, [p1, p2] = refs.current[i]?.children ?? [];
        p1?.setAttribute("transform", d.v ? `translate(0,${-s})` : `translate(${-s},0)`);
        p2?.setAttribute("transform", d.v ? `translate(0,${s})` : `translate(${s},0)`);
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [motion]);
  return (
    <g pointerEvents="none">
      {DOORS.map((d, i) => {
        const half = (d.b - d.a) / (d.single ? 1 : 2), box = d.v ? { x: d.at - 4, y: d.a, width: 8, height: d.b - d.a } : { x: d.a, y: d.at - 4, width: d.b - d.a, height: 8 };
        const panel = (k: number) => (d.v ? { x: d.at - 3, y: d.a + k * half, width: 6, height: half } : { x: d.a + k * half, y: d.at - 3, width: half, height: 6 });
        return (
          <g key={i}>
            <clipPath id={`door-${i}`}>
              <rect {...box} />
            </clipPath>
            <g ref={(el) => void (refs.current[i] = el)} clipPath={`url(#door-${i})`}>
              <rect {...panel(0)} className="door-panel" />
              {!d.single && <rect {...panel(1)} className="door-panel" />}
            </g>
          </g>
        );
      })}
    </g>
  );
}

// 회의 장표: 막대, 꺾은선, 원, 표, 큰 숫자를 돌아가며 보인다
const SLIDE_INK = ["#565a9c", "#a8545a"];
// 누르는 모니터: 왼쪽은 팀 이슈 현황, 오른쪽은 데이터 분석 창을 연다. 작업이 도는 동안 화면에 busy 글자를 띄우고, 안 본 새 결과가 있으면 모서리에 점을 찍는다
function MonitorHit({ m, name, hint, busy, tone, fresh, onOpen }: { tone?: string; m: { x: number; y: number; w: number; h: number }; name: string; hint: string; busy: string; fresh?: number; onOpen: () => void }) {
  const x = m.x + SCREEN.x * m.w, y = m.y + SCREEN.y * m.h, w = SCREEN.w * m.w, h = SCREEN.h * m.h;
  return (
    <g className="monitor-hit" role="button" tabIndex={0} aria-label={`${name} 열기${busy ? `, 화면에 ${busy}` : ""}${fresh ? `, 새 결과 ${fresh}건` : ""}`} onClick={onOpen} onKeyDown={(e) => e.key === "Enter" && onOpen()}>
      <title>{`${name}. ${hint}`}</title>
      {busy && (
        <g pointerEvents="none">
          <rect x={x} y={y} width={w} height={h} fill="#10233f" />
          <text x={x + w / 2} y={y + h / 2 + 4} textAnchor="middle" className={`jobs-screen-text${tone ? ` ${tone}` : ""}`}>{busy}</text>
        </g>
      )}
      {!!fresh && <circle className="monitor-dot" cx={m.x + m.w - 4} cy={m.y + 4} r={5} pointerEvents="none" />}
      <rect className="hit" x={m.x} y={m.y} width={m.w} height={m.h} rx={4} />
    </g>
  );
}

function Slide({ k, x, y, w, h }: { k: number; x: number; y: number; w: number; h: number }) {
  const bx = x + w * 0.08, by = y + h * 0.22, bw = w * 0.84, bh = h * 0.68, kind = k % 5;
  return (
    <g className="slide" shapeRendering="crispEdges">
      <rect x={x} y={y} width={w} height={h} fill="#fff" />
      <rect x={x} y={y} width={w} height={h * 0.1} fill={SLIDE_INK[1]} />
      <rect x={bx} y={y + h * 0.13} width={bw * 0.5} height={h * 0.05} fill={SLIDE_INK[0]} />
      {kind === 0 && [0.4, 0.65, 0.5, 0.9, 0.75].map((v, i) => <rect key={i} x={bx + (i * bw) / 5 + 1} y={by + bh * (1 - v)} width={bw / 5 - 2} height={bh * v} fill={SLIDE_INK[i % 2]} />)}
      {kind === 1 && <polyline points={[0.7, 0.5, 0.6, 0.3, 0.35, 0.1].map((v, i) => `${bx + (i * bw) / 5},${by + bh * v}`).join(" ")} fill="none" stroke={SLIDE_INK[0]} strokeWidth={1.5} />}
      {kind === 2 && (
        <>
          <circle cx={bx + bh / 2} cy={by + bh / 2} r={bh / 2} fill={SLIDE_INK[0]} />
          <path d={`M${bx + bh / 2},${by + bh / 2} V${by} A${bh / 2},${bh / 2} 0 0 1 ${bx + bh},${by + bh / 2} Z`} fill={SLIDE_INK[1]} />
          {[0, 1, 2].map((i) => <rect key={i} x={bx + bh + 6} y={by + (i * bh) / 3 + 2} width={bw - bh - 6} height={2} fill="#999" />)}
        </>
      )}
      {kind === 3 && [0, 1, 2, 3].map((i) => <rect key={i} x={bx} y={by + (i * bh) / 4 + 2} width={bw} height={bh / 4 - 4} fill={i ? "#e6e6ee" : SLIDE_INK[0]} />)}
      {kind === 4 && (
        <text x={x + w / 2} y={by + bh * 0.75} textAnchor="middle" fontSize={h * 0.45} fontWeight={700} fill={SLIDE_INK[1]}>
          +12%
        </text>
      )}
    </g>
  );
}

const FLOORS: [keyof typeof ZONES, string][] = [
  ["cafe", "url(#pat-tile)"],
  ["work", "url(#pat-wood)"],
  ["nook", "url(#pat-wood)"],
  ["hall", "url(#pat-wood)"],
  ["top", "url(#pat-wood)"],
  ["plan", "url(#pat-wood)"],
  ["pantry", "url(#pat-wood)"],
  ["sleep", "url(#pat-wood)"],
  ["sofa", "url(#pat-wood)"],
  ["open", "url(#pat-wood)"],
];
const LABELS: [string, number, number][] = [
  ["카페", 60, 372],
];
function FloorPlan({ onShelf, onRetroShelf, onCabinet }: { onShelf?: () => void; onRetroShelf?: () => void; onCabinet?: () => void }) {
  return (
    <g>
      <defs>
        {/* 서류철 그림의 밝기만 남기고 정해진 색으로 칠한다 */}
        {FOLDER_COLORS.map((c, i) => {
          const [r, g, b] = [1, 3, 5].map((k) => parseInt(c.slice(k, k + 2), 16) / 255);
          const row = (v: number) => `${0.6 * v} ${1.2 * v} ${0.25 * v} 0 0`;
          return (
            <filter key={i} id={`folder-c${i}`} colorInterpolationFilters="sRGB">
              <feColorMatrix type="matrix" values={`${row(r)} ${row(g)} ${row(b)} 0 0 0 1 0`} />
            </filter>
          );
        })}
        {(["wood", "tile"] as const).map((n) => (
          <pattern key={n} id={`pat-${n}`} patternUnits="userSpaceOnUse" width={24} height={24}>
            <image href={`/sprites/floor-${n}.webp`} width={24} height={24} className="pixel" />
          </pattern>
        ))}
        {FACES.map((f, k) => (
          <pattern key={k} id={`pat-wall-${k}`} patternUnits="userSpaceOnUse" y={f.y1} width={((f.y2 - f.y1) * 2) / 3} height={f.y2 - f.y1}>
            <image href="/sprites/wall.webp" width={((f.y2 - f.y1) * 2) / 3} height={f.y2 - f.y1} className="pixel" preserveAspectRatio="none" />
          </pattern>
        ))}
      </defs>
      <rect x={0} y={0} width={VW} height={VH} className="floor" />
      {FLOORS.map(([z, fill]) => {
        const b = ZONES[z];
        return <rect key={z} x={b.x1} y={b.y1} width={b.x2 - b.x1} height={b.y2 - b.y1} style={{ fill }} />;
      })}
      {FACES.map((f, k) => (
        <rect key={k} x={f.x1} y={f.y1} width={f.x2 - f.x1} height={f.y2 - f.y1} style={{ fill: `url(#pat-wall-${k})` }} />
      ))}
      {WALLS.map((w, k) => (
        <rect key={k} x={w.x1} y={w.y1} width={w.x2 - w.x1} height={w.y2 - w.y1} className="wall" />
      ))}
      <rect x={10} y={10} width={VW - 20} height={VH - 20} className="outer-wall" />
      {LABELS.map(([t, x, y]) => (
        <text key={t} x={x} y={y} className="pantry-name">
          {t}
        </text>
      ))}
      {ART.filter((a) => !a[5]).map(([src, x, y, w, h], i) => (
        <image key={`${src}-${i}`} href={`/sprites/${src}.webp`} x={x} y={y} width={w} height={h} />
      ))}
      {BEDS.map((b, i) => (
        <image key={i} href="/sprites/bed.webp" {...bedArt(b).bed} />
      ))}
      {BED_SCREENS.map((b, i) => (
        <rect key={i} x={b.x1} y={b.y1} width={b.x2 - b.x1} height={b.y2 - b.y1} className="bed-screen" />
      ))}
      {/* 서고 책꽂이를 누르면 작업 책장 서랍을 여닫는다. 도비 사무실의 오른쪽 책꽂이는 색을 바꾼 회고 책장이다 */}
      {LIB_SHELVES.map(([src, x, y, w, h], i) => {
        const retro = i === 1 && !!onRetroShelf;
        const open = retro ? onRetroShelf : onShelf, label = retro ? "회고 책장 열기" : "작업 책장 열기";
        return (
          <g key={i} className="shelf-btn" role="button" tabIndex={0} aria-label={label} onClick={open} onKeyDown={(e) => e.key === "Enter" && open?.()}>
            <title>{label}</title>
            <image href={`/sprites/${src}.webp`} x={x} y={y} width={w} height={h} className={retro ? "pixel retro-shelf" : "pixel"} />
          </g>
        );
      })}
      {/* 보고서 캐비닛을 누르면 작업 보고서 창이 열린다 */}
      <g className="shelf-btn" role="button" tabIndex={0} aria-label="작업 보고서 보기" onClick={onCabinet} onKeyDown={(e) => e.key === "Enter" && onCabinet?.()}>
        <title>작업 보고서 보기</title>
        <image href="/sprites/report-cabinet-1.webp" x={CABINET.x} y={CABINET.y} width={CABINET.w} height={CABINET.h} className="pixel" />
      </g>
    </g>
  );
}
