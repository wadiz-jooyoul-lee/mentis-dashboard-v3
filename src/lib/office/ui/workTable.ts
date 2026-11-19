import type { Pose } from "@/lib/office/core/avatars";
import type { TableRole } from "@/lib/office/core/types";

// 작업 테이블 한 벌의 모양. 좌표는 모두 테이블 그림 가운데를 0으로 둔 값이다
interface P {
  x: number;
  y: number;
}
// 켜진 자리를 아는 테이블. roles 가 없으면 앉은 사람(crew)으로 본다
type T = P & { roles?: TableRole[]; crew?: Partial<Record<TableRole, string>> };
interface B {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
// work-table-narrow.webp(300×195)를 반으로 그리되, 위쪽에 앉은 사람의 몸이 보이도록 위아래만 조금 눌러(98 → 79) 위 가장자리를 내린다. 아래 가장자리는 그대로다
export const TABLE = { w: 150, h: 79, top: -30 };
type Slot = { dx: number; dy: number; pose: Pose; laptop: "top" | "bottom" | "right"; flip?: boolean; lx: number; ly: number; lw: number; lh: number };
// 위쪽 둘은 정면, 아래쪽 둘은 뒷모습, 오른쪽 끝은 왼쪽을 본다. 노트북은 앉은 사람 앞 가장자리에 놓는다
const SLOTS = {
  tl: { dx: -35, dy: -20, pose: "front", laptop: "top", lx: -50, ly: -28, lw: 30, lh: 29 },
  tr: { dx: 25, dy: -20, pose: "front", laptop: "top", lx: 10, ly: -28, lw: 30, lh: 29 },
  bl: { dx: -35, dy: 64, pose: "back", laptop: "bottom", lx: -50, ly: 18, lw: 30, lh: 29 },
  br: { dx: 25, dy: 64, pose: "back", laptop: "bottom", lx: 10, ly: 18, lw: 30, lh: 29 },
  r: { dx: 86, dy: 24, pose: "side-l", laptop: "right", lx: 41, ly: -12, lw: 30, lh: 31 },
  // 여섯째 자리: 왼쪽 끝에서 오른쪽을 본다(오른쪽 끝 자리를 뒤집은 것). 깃대 밑동(-17)보다 아래다
  l: { dx: -86, dy: 24, pose: "side-r", laptop: "right", flip: true, lx: -71, ly: -12, lw: 30, lh: 31 },
} satisfies Record<string, Slot>;
const SLOT_OF: Record<TableRole, keyof typeof SLOTS> = { planner: "tl", developer: "tr", reviewer: "bl", tester: "br", deployer: "r", intern: "r", producer: "l" };
// 여섯째 자리는 개발자와 산출자가 함께 켜진 테이블에서만 쓴다. 개발자가 없는 오더는 산출자가 개발자 자리에 앉는다
export const sixSeats = (c: T) => {
  const on = c.roles ?? (Object.keys(c.crew ?? {}) as TableRole[]);
  return on.includes("producer") && on.includes("developer");
};
const slotOf = (c: T, role: TableRole): Slot => SLOTS[role === "producer" && !sixSeats(c) ? "tr" : SLOT_OF[role]];

export const seatOf = (c: T, role: TableRole) => {
  const s = slotOf(c, role);
  return { x: c.x + s.dx, y: c.y + s.dy, pose: s.pose as Pose, row: s.dy < 0 ? 0 : 1 };
};
export const laptopOf = (c: T, role: TableRole) => {
  const s = slotOf(c, role), x = c.x + s.lx;
  // 왼쪽 끝 자리는 오른쪽 끝 자리의 노트북 그림을 좌우로 뒤집어 쓴다(화면이 테이블 안쪽, 터치패드가 사람 쪽)
  return { href: `/sprites/laptop-for-${s.laptop}.webp`, x, y: c.y + s.ly, width: s.lw, height: s.lh, transform: s.flip ? `translate(${2 * x + s.lw} 0) scale(-1 1)` : undefined };
};
// 간식은 노트북 옆, 사람 쪽 가장자리에 놓는다
export const snackOf = (c: T, role: TableRole): P => {
  const s = slotOf(c, role);
  return s.laptop === "right" ? { x: c.x + s.lx + (s.flip ? s.lw - 14 : 14), y: c.y + s.ly + s.lh + 8 } : { x: c.x + s.lx + s.lw + 10, y: c.y + (s.dy < 0 ? -15 : 34) };
};
export const tableArt = (c: P) => ({ x: c.x - TABLE.w / 2, y: c.y + TABLE.top, width: TABLE.w, height: TABLE.h, preserveAspectRatio: "none" });
// 깃발: 테이블 왼쪽 위 모서리에 깃대를 세우고 천을 오른쪽으로 단다. 위쪽 사람 머리 위 역할 이름표보다 높다
export const FLAG = { poleX: -62, poleTop: -134, poleBottom: -17, w: 160, h: 38 };
export type FlagSide = "r" | "l";
// 깃대에서 천을 다는 쪽으로 천 왼쪽 끝 x. 오른쪽(r)이면 깃대 오른쪽 2, 왼쪽(l)이면 천 오른쪽 끝이 깃대 왼쪽 2 에 온다
export const clothX = (poleX: number, side: FlagSide = "r") => (side === "l" ? poleX - 2 - FLAG.w : poleX + 2);
// 깃발이 차지하는 넓이: 깃대부터 천 끝까지(가로 162), 천 위에 뜨는 물음표(높이 30)부터 천 아래 끝까지
export const flagBox = (b: P & { pole?: number }, side: FlagSide = "r"): B => {
  const top = b.y - (b.pole ?? FLAG.poleBottom - FLAG.poleTop), x1 = side === "l" ? b.x - FLAG.w - 2 : b.x;
  return { x1, y1: top - 30, x2: x1 + FLAG.w + 2, y2: top + FLAG.h };
};

// 길찾기에서 막는 상자: 테이블 판. 깃발 천은 머리 위라 막지 않는다
export const tableBlocks = (c: P): B[] => [{ x1: c.x - TABLE.w / 2, y1: c.y + TABLE.top, x2: c.x + TABLE.w / 2, y2: c.y + 45 }];
// 위쪽 자리는 테이블 판 안쪽에 앉으므로, 앉는 점에서 위로 길을 터 둔다
export const tableLanes = (c: P): [P, P][] => (["tl", "tr"] as const).map((k) => [{ x: c.x + SLOTS[k].dx, y: c.y + SLOTS[k].dy }, { x: c.x + SLOTS[k].dx, y: c.y - 70 }]);
// 테이블을 펴려면 통째로 비어 있어야 하는 넓이(깃발, 앉은 사람과 발 아래 이름, 오른쪽 끝 자리까지)
// 여섯 자리 테이블은 왼쪽 끝 자리와 그 이름표(너비 50)만큼 왼쪽으로 더 잡는다
export const tableFootprint = (c: T): B => ({ x1: c.x - (sixSeats(c) ? 115 : 78), y1: c.y + FLAG.poleTop, x2: c.x + 98, y2: c.y + 98 });
export const tableSeats = (c: T, roles: TableRole[]) => roles.map((r) => seatOf(c, r));
// 길 검사에 쓰는 그 테이블의 모든 자리. 여섯 자리 테이블이면 왼쪽 끝 자리까지 본다
export const allSeats = (c: T) => tableSeats(c, ["planner", "developer", "reviewer", "tester", "deployer", ...(sixSeats(c) ? (["producer"] as const) : [])]);
// 깃발 띠 여섯 칸(설계, 구현, 리뷰, 통합, 배포, 검증) 가운데 지금 칸
export function bandOfPhase(phase: string): number {
  if (/테스트|기록|완료 확인/.test(phase)) return 5;
  if (/배포|빌드/.test(phase)) return 4;
  if (/PR|머지/.test(phase)) return 3;
  if (/리뷰 반영/.test(phase)) return 1;
  if (/리뷰/.test(phase)) return 2;
  if (/구현|게이트|작업 공간/.test(phase)) return 1;
  return 0;
}
