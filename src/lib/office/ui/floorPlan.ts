import type { Pose } from "@/lib/office/core/avatars";
import type { TableRole } from "@/lib/office/core/types";
import { FLAG, allSeats, flagBox, tableBlocks, tableFootprint, tableLanes, type FlagSide } from "@/lib/office/ui/workTable";

// 2:1 고정 판(설계 19번). 공간 경계는 2026-11-05 배치 스케치를 판에 옮긴 값이다
export interface Pt {
  x: number;
  y: number;
}
export interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
export const VW = 1700;
export const VH = 850;
export const WALL_H = 34; // 위쪽 벽 면 높이
const WT = 4; // 벽 두께의 반

export const ZONES = {
  cafe: { x1: 10, y1: 10, x2: 590, y2: 380 },
  work: { x1: 10, y1: 380, x2: 590, y2: 840 },
  nook: { x1: 10, y1: 380, x2: 312, y2: 500 },
  hall: { x1: 590, y1: 10, x2: 690, y2: 575 }, // 복도는 수면실 위에서 끝난다. 폭 100
  top: { x1: 690, y1: 10, x2: 1300, y2: 130 },
  plan: { x1: 1300, y1: 10, x2: 1690, y2: 575 },
  pantry: { x1: 690, y1: 130, x2: 1300, y2: 575 },
  sleep: { x1: 590, y1: 575, x2: 720, y2: 840 }, // 복도 아래쪽 끝. 침대가 들어가야 해서 복도(폭 100)보다 30 넓다. 왼쪽 벽은 책상 방 벽을 같이 쓴다
  sofa: { x1: 720, y1: 575, x2: 1275, y2: 840 },
  open: { x1: 1275, y1: 575, x2: 1690, y2: 840 },
} satisfies Record<string, Box>;

// 벽: 가로벽 [y, x1, x2], 세로벽 [x, y1, y2]. 문은 벽을 끊어 둔 곳이다
const H_WALLS: [number, number, number][] = [
  [380, 10, 590],
  [130, 690, 830],
  [130, 930, 1186],
  [575, 590, 720],
];
const V_WALLS: [number, number, number][] = [
  [590, 10, 287],
  [590, 363, 422],
  [590, 498, 840],
  [312, 380, 500],
  [690, 130, 575], // 복도와 탕비실 사이
  [720, 575, 620], // 수면실과 소파 사이. 수면실 문 자리만 끊는다
  [720, 696, 840],
  [1186, 10, 44], // 위 복도와 오른쪽 방 사이. 책장 바로 뒤이고 문 자리만 끊는다
  [1186, 120, 130],
];
// 미닫이 자동문: 벽을 끊어 둔 곳마다 둔다. v는 세로벽 [x, y1, y2], h는 가로벽 [y, x1, x2]. single 은 한 짝짜리 문(한쪽 벽 속으로 밀려 들어간다)
export const DOORS: { v: boolean; at: number; a: number; b: number; single?: boolean }[] = [
  // 카페, 책상 방, 수면실(위 벽 바로 아래) 문은 한 짝짜리이고 폭 76이다. 탕비실 위 문만 두 짝이다
  ...([[590, 287, 363], [590, 422, 498], [720, 620, 696]] as const).map(([at, a, b]) => ({ v: true, at, a, b, single: true })),
  { v: false, at: 130, a: 830, b: 930 },
  // 책장 바로 뒤 세로벽의 한 짝 문. 위 복도에서 오른쪽 방으로 간다
  { v: true, at: 1186, a: 44, b: 120, single: true },
];
export const WALLS: Box[] = [
  ...H_WALLS.map(([y, x1, x2]) => ({ x1, x2, y1: y - WT, y2: y + WT })),
  ...V_WALLS.map(([x, y1, y2]) => ({ x1: x - WT, x2: x + WT, y1, y2 })),
];
// 벽 면: 판 위쪽 바깥벽과, 아래에 공간이 있는 가로벽 밑에 그린다
export const FACES: Box[] = [{ x1: 10, x2: 1690, y1: 10, y2: 10 + WALL_H }, ...H_WALLS.map(([y, x1, x2]) => ({ x1, x2, y1: y + WT, y2: y + WT + WALL_H }))];

// 가구 그림: [그림, x, y, 너비, 높이, 카페 도비 앞에 그릴지]. 주문 카운터가 카페 도비의 아랫몸을 가린다
export type Art = [string, number, number, number, number, boolean?];
// 책꽂이·캐비닛의 아래 끝. 벽 면 아래 끝(y 168)보다 조금 아래에 두어 벽에 기대 선 것처럼 보인다. 위쪽은 벽 위로 올라가 복도에 걸친다
const WALL_FOOT = 190;
export const TOASTER: Pt = { x: 396, y: 130 };
// 카페 아래쪽 둥근 탁자 둘(4인)과 위쪽 세로 긴 탁자 둘(6인, 스툴이 좌우에 셋씩)
const ROUNDS = [40, 210].map((x) => ({ x, y: 225, w: 100, h: 110 }));
const SIXES = [45, 205].map((x) => ({ x, y: 58, w: 105, h: 108 }));
// 입식 둥근 테이블: 스낵바 아래. 좌표는 기둥 발의 가운데. 서서 간식을 먹고 간다
export const STAND_TABLES: Pt[] = [{ x: 835, y: 575 }, { x: 960, y: 575 }];
export const standTableArt = (p: Pt) => ({ x: p.x - 25, y: p.y - 49, width: 50, height: 56.5 });
// 맥 책상: 수면실과 아래 소파 사이, 아래 벽에 붙인다. 서서 쓰는 책상이다. 모니터 뒷면이 보이는 쪽이라 책상 뒤에 서서 앞을 본다.
// 사람을 가려야 해서 ART 에 넣지 않고 사람 다음에 그린다(mac-desk-front.webp)
export const MAC_DESK = { x: 770, y: 763, w: 100, h: 73 };
// 프론트 데스크: 탕비실 위 문 아래. 서서 쓰는 책상이고 화면이 보이는 쪽(mac-desk.webp)이다. 프론트 도비가 앞에 서서 문 쪽을 본다
export const FRONT_DESK = { x: 830, y: 297, w: 100, h: 78 }; // 스낵바에 바짝 붙여 조금 내려, 앞에 선 도비가 데스크 아래쪽과 겹친다
const PANTRY_DY = 65;
// 스낵바(ㄷ자): 원래 크기의 0.9배. 앞면 위 가운데를 기준으로 줄였다
const SNACK = { x: 820, y: 300 + PANTRY_DY, w: 154, h: 86, sw: 46, sh: 98, sy: 336 + PANTRY_DY }; // 프론트 데스크 자리를 내려고 스낵바 일대를 이만큼 내렸다
// 침대는 머리가 왼쪽으로 가게 눕혀 둔다. w가 길이, h가 폭이다
// 소파 묶음은 아래 벽에 붙여 가로로 두 벌. 값은 왼쪽 소파의 x. 소파와 탁자 사이에 30씩 통로를 둔다
const SOFA_XS = [920, 1110];
const SOFA_Y = 725;
const SOFA_IN = 36; // 소파 바깥 끝에서 앉는 점까지
// 수면실 폭(복도 폭)에 맞춰 줄인 크기. 침대 끝과 오른쪽 벽 사이로 한 사람이 지나간다
export const BEDS = [622, 688, 754].map((y) => ({ x: 600, y, w: 80, h: 43 }));
// 침대 사이 칸막이. 침대 끝까지 두고, 그 앞은 한 사람이 지나갈 만큼만 남긴다
export const BED_SCREENS: Box[] = BEDS.slice(1).map((b) => ({ x1: 594, y1: b.y - 5, x2: b.x + b.w, y2: b.y - 2 }));
// 작은 탕비 칸막이 오른쪽 모니터 두 대와 그 앞 긴 테이블. SCREEN은 모니터 그림 안 화면의 비율 위치
export const MONITORS = [320, 410].map((x) => ({ x, y: 392, w: 84, h: 73 }));
export const SCREEN = { x: 11 / 390, y: 11 / 341, w: 368 / 390, h: 184 / 341 };
const HUDDLE_TABLE = { x: 339, y: 468, w: 136, h: 108 };
const MEET_TABLE = { x: 1080, y: 452 + PANTRY_DY, w: 130, h: 105 };
export const ART: Art[] = [
  // 커피 머신과 토스터, 주문 데스크는 원래 크기의 0.9배다. 머신과 토스터는 아래 끝(y 130)과 오른쪽 끝을 그대로 두고 줄였다
  ["coffee-front", 419, 39, 153, 91],
  ["toaster", 378, 55, 36, 75],
  ...ROUNDS.map((t): Art => ["cafe-table", t.x, t.y, t.w, t.h]),
  ...SIXES.map((t): Art => ["cafe-long-v", t.x, t.y, t.w, t.h]),
  ["order-back", 409, 150, 156, 83, true],
  ["mac-desk", FRONT_DESK.x, FRONT_DESK.y, FRONT_DESK.w, FRONT_DESK.h],
  ["plant-round", 20, 330, 33, 44],
  ["fridge", 18, 380, 43, 80],
  ["water-cooler", 66, 385, 40, 75],
  ["pantry-table", 140, 422, 40, 51],
  ["copier", 224, 380, 73, 90],
  ["snack-front", SNACK.x, SNACK.y, SNACK.w, SNACK.h],
  ["snack-side-l", SNACK.x - SNACK.sw, SNACK.sy, SNACK.sw, SNACK.sh],
  ["snack-side-r", SNACK.x + SNACK.w, SNACK.sy, SNACK.sw, SNACK.sh],
  ...MONITORS.map((m): Art => ["pantry-monitor", m.x, m.y, m.w, m.h]),
  ["monitor-table", HUDDLE_TABLE.x, HUDDLE_TABLE.y, HUDDLE_TABLE.w, HUDDLE_TABLE.h],
  ["display-sofa", 1070, 311 + PANTRY_DY, 96, 120],
  ["display-case-side-l", 1192, 308 + PANTRY_DY, 31, 119],
  ["meeting-table", MEET_TABLE.x, MEET_TABLE.y, MEET_TABLE.w, MEET_TABLE.h],
  ...STAND_TABLES.map((p): Art => { const a = standTableArt(p); return ["stand-table", a.x, a.y, a.width, a.height]; }),

  ...SOFA_XS.flatMap((x): Art[] => [
    ["sofa-l", x, SOFA_Y, 44, 111],
    ["sofa-table", x + 74, SOFA_Y + 7, 32, 97],
    ["sofa-r", x + 136, SOFA_Y, 44, 111],
  ]),
  ["plant-beige", 1640, 780, 39, 50],
  ["plant-round", 20, 790, 33, 44],
];
// 세로 침대 그림을 가운데에서 -90도 돌려 그린다. 이불은 그림의 110/346 지점부터 177/346 길이
export function bedArt(b: Pt & { w: number; h: number }) {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, top = cy - b.w / 2, transform = `rotate(-90 ${cx} ${cy})`;
  return {
    bed: { x: cx - b.h / 2, y: top, width: b.h, height: b.w, transform },
    cover: { x: cx - b.h / 2, y: top + (b.w * 110) / 346, width: b.h, height: (b.w * 177) / 346, transform },
  };
}

// 책꽂이와 캐비닛의 위 끝
const SHELF_Y = WALL_FOOT - 84;
// 서고 책꽂이: 중앙 탕비 위 벽, 문 오른쪽. 누르면 작업 책장 서랍이 열린다
export const LIB_SHELVES: [string, number, number, number, number][] = [
  ["bookshelf-front-a", 1018, SHELF_Y, 76, 84],
  ["bookshelf-front-b", 1096, SHELF_Y, 76, 84],
];
export const SHELF_SLOT = { x: 1056, y: SHELF_Y + 40 }; // 날아온 책이 꽂히는 곳
// 도비 사무실은 오른쪽 책꽂이를 회고 책장으로 쓴다. 기획자가 그 앞에 서서 회고록을 꽂는다
export const RETRO_SHELF_SLOT = { x: 1134, y: SHELF_Y + 40 };
export const RETRO_SHELF_SPOT: Pt = { x: 1134, y: WALL_FOOT + 26 };
// 보고서 캐비닛: 탕비실 위 벽, 문 오른쪽이고 책장 왼쪽. 작업 단위가 끝난 서류철이 꽂힌다
export const CABINET = { x: 938, y: SHELF_Y, w: 76, h: 84 };
export const CABINET_SLOT = { x: CABINET.x + CABINET.w / 2, y: CABINET.y + 40 }; // 서류철이 꽂히는 곳, 책이 날아가는 출발점
export const CABINET_SPOT: Pt = { x: CABINET.x + CABINET.w / 2, y: WALL_FOOT + 26 };
export const LIB_SPOT: Pt = { x: 1060, y: WALL_FOOT + 26 };
// 카페: 카페 도비는 입구 앞 주문 카운터 뒤, 손님은 카운터 앞에 서고 줄은 왼쪽으로 선다
export const CAFE_DOBBY: Pt = { x: 487, y: 173 };
export const COUNTER: Pt = { x: 487, y: 284 };
export const LINE: Pt[] = [1, 2, 3].map((i) => ({ x: 487 - i * 40, y: 284 }));
// 프론트 도비: 프론트 데스크 앞(아래쪽)에 서서 문으로 들어오는 사람을 맞는다
// 데스크를 내려도 도비 자리는 그대로다(발이 스낵바 윗면에 조금 겹친다)
export const FRONT_DOBBY: Pt = { x: FRONT_DESK.x + FRONT_DESK.w / 2, y: 379 };
// 접수 자리: 프론트 데스크 맞은편(위쪽). 접수된 쪽지를 일꾼 도비가 여기서 받아 간다
export const FRONT_SPOT: Pt = { x: FRONT_DESK.x + FRONT_DESK.w / 2, y: FRONT_DESK.y + 8 };

// 가구가 차지하는 바닥(사람이 지나지 못하는 곳)
const FURNITURE: Box[] = [
  { x1: 378, y1: 44, x2: 572, y2: 130 },
  ...ROUNDS.map((t) => ({ x1: t.x + 4, y1: t.y + 16, x2: t.x + t.w - 4, y2: t.y + t.h })), // 의자까지
  { x1: 409, y1: 130, x2: 565, y2: 233 }, // 주문 카운터와 그 뒤(카페 도비 자리)
  { x1: FRONT_DESK.x + 2, y1: FRONT_DESK.y + FRONT_DESK.h * 0.29, x2: FRONT_DESK.x + FRONT_DESK.w - 2, y2: FRONT_DOBBY.y + 6 }, // 프론트 데스크와 그 앞(프론트 도비 자리)
  ...SIXES.map((t) => ({ x1: t.x + 4, y1: t.y + 4, x2: t.x + t.w - 4, y2: t.y + t.h - 4 })), // 의자까지
  ...STAND_TABLES.map((p) => ({ x1: p.x - 22, y1: p.y - 32, x2: p.x + 22, y2: p.y + 6 })), // 상판 아래 전체. 상판 뒤로 지나가면 상판을 뚫는 것처럼 보인다
  { x1: MAC_DESK.x + 2, y1: MAC_DESK.y + MAC_DESK.h * 0.25, x2: MAC_DESK.x + MAC_DESK.w - 2, y2: 840 }, // 맥 책상과 그 뒤 앉는 자리. 아래 벽까지
  // 작은 탕비: 왼쪽 구석부터 냉장고와 정수기, 작은 탁자, 복사기
  { x1: 18, y1: 420, x2: 106, y2: 468 },
  { x1: 140, y1: 432, x2: 180, y2: 473 },
  { x1: 224, y1: 420, x2: 304, y2: 468 },
  { x1: SNACK.x - SNACK.sw, y1: SNACK.y + 4, x2: SNACK.x + SNACK.w + SNACK.sw, y2: SNACK.y + SNACK.h },
  { x1: SNACK.x - SNACK.sw, y1: SNACK.sy + 4, x2: SNACK.x, y2: SNACK.sy + SNACK.sh },
  { x1: SNACK.x + SNACK.w, y1: SNACK.sy + 4, x2: SNACK.x + SNACK.w + SNACK.sw, y2: SNACK.sy + SNACK.sh },
  // 모니터 받침과 그 앞 테이블. 모니터와 테이블 사이는 위 의자로 들어가는 통로로 비운다
  { x1: 320, y1: 450, x2: 494, y2: 465 },
  { x1: 312, y1: 488, x2: 475, y2: 576 },
  // 스낵바 옆 진열장과 ㄷ자 소파. 스낵바와 소파 사이는 한 사람이 지나갈 만큼 비운다
  { x1: 1070, y1: 320 + PANTRY_DY, x2: 1088, y2: 431 + PANTRY_DY },
  { x1: 1088, y1: 311 + PANTRY_DY, x2: 1145, y2: 336 + PANTRY_DY },
  { x1: 1088, y1: 408 + PANTRY_DY, x2: 1142, y2: 431 + PANTRY_DY },
  { x1: 1122, y1: 352 + PANTRY_DY, x2: 1166, y2: 394 + PANTRY_DY },
  { x1: 1192, y1: 360 + PANTRY_DY, x2: 1223, y2: 427 + PANTRY_DY },
  // 진열장 아래 회의 탁자(의자 위아래 셋씩). 위 자리는 위에서, 아래 자리는 아래에서 앉는다
  { x1: 1080, y1: 452 + PANTRY_DY, x2: 1210, y2: 557 + PANTRY_DY },
  ...BEDS.map((b, i) => ({ x1: b.x, y1: b.y, x2: b.x + b.w, y2: i === BEDS.length - 1 ? 840 : b.y + b.h })), // 맨 아래 침대는 벽까지
  ...BED_SCREENS,
  ...SOFA_XS.flatMap((x) => [
    { x1: x, y1: SOFA_Y, x2: x + 44, y2: SOFA_Y + 111 },
    { x1: x + 74, y1: SOFA_Y + 7, x2: x + 106, y2: SOFA_Y + 104 },
    { x1: x + 136, y1: SOFA_Y, x2: x + 180, y2: SOFA_Y + 111 },
  ]),
  // 캐비닛·책꽂이의 윗부분은 벽 위 복도에 걸친다. 복도에서 그 위를 밟고 지나지 않게 막는다
  { x1: CABINET.x, y1: SHELF_Y + 12, x2: 1172, y2: WALL_FOOT - 4 },
  ...ART.filter(([n]) => n.startsWith("plant")).map(([, x, y, w, h]) => ({ x1: x, y1: y + 8, x2: x + w, y2: y + h })),
];

// 쉬는 자리. 쉬는 에이전트가 가끔 들른다(화면에서만 하는 연출)
export type RestKind = "cafe" | "nook" | "toaster" | "sofa" | "bed" | "meet" | "huddle" | "present" | "stand" | "mac";
export interface Rest {
  kind: RestKind;
  at: Pt;
  pose: Pose;
  plate?: Pt; // 다과를 내려놓는 탁자 위 점(다과 그림의 아래 가운데)
  pick?: PickKind; // 앉기 전에 간식을 집으러 들르는 곳
  lane?: number; // 앉는 점에서 바깥으로 터 두는 길의 길이(기본 30). 탁자 쪽으로 당겨 앉는 자리는 그만큼 길다
  cover?: Cover; // 등을 보이고 앉는 아래 자리: 사람보다 화면 앞에 있는 의자(등받이, 스툴 다리) 부분. 앉아 있는 동안 사람 다음에 다시 그린다
}
// 가구 그림 가운데 사람 앞에 올 부분. 같은 그림을 같은 자리에 그리고 clip 상자만 보이게 해, 덮어도 원래 그림과 픽셀이 같다
export interface Cover {
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
  clip: { x: number; y: number; w: number; h: number };
}
// a: 그림을 놓은 상자, sw·sh: 그림 파일의 픽셀 크기, [x1, y1, x2, y2]: 그림 파일 안에서 사람 앞에 올 부분(픽셀)
const coverOf = (src: string, a: Pt & { w: number; h: number }, sw: number, sh: number, [x1, y1, x2, y2]: [number, number, number, number]): Cover => ({
  src,
  ...a,
  clip: { x: a.x + (x1 * a.w) / sw, y: a.y + (y1 * a.h) / sh, w: ((x2 - x1) * a.w) / sw, h: ((y2 - y1) * a.h) / sh },
});
// 간식을 집는 곳: 스낵바 앞과 작은 탕비 냉장고 앞. 서서 집은 뒤 앉을 자리로 가져간다
export type PickKind = "snack" | "nook";
export const PICKS: Record<PickKind, Pt[]> = {
  snack: [{ x: 872, y: SNACK.y + SNACK.h + 40 }, { x: 922, y: SNACK.y + SNACK.h + 40 }],
  nook: [{ x: 40, y: 490 }],
};
const LIE_H = 58; // 서 있는 그림 높이(OfficeAgent의 AVATAR_H)
const SEAT_DY = 14; // 의자 가운데보다 조금 아래에 발이 와야 앉은 것처럼 보인다
const roundSeat = (t: Pt & { w: number; h: number }, fx: number, fy: number) => ({ x: Math.round(t.x + fx * t.w), y: Math.round(t.y + fy * t.h) + SEAT_DY });
const onTable = (t: Pt & { w: number; h: number }, fx: number, fy: number) => ({ x: Math.round(t.x + fx * t.w), y: Math.round(t.y + fy * t.h) });
export const RESTS: Rest[] = [
  ...ROUNDS.flatMap((t): Rest[] => [
    // 위 자리는 탁자 쪽으로 당겨 앉는다. 무릎 아래를 자른 앞모습 그림의 아래 끝이 탁자 가장자리에 닿아 다리가 탁자 밑에 든 것처럼 보인다
    { kind: "cafe", at: roundSeat(t, 0.5, 0.19), pose: "front", plate: onTable(t, 0.5, 0.39), lane: 42 },
    { kind: "cafe", at: roundSeat(t, 0.1, 0.52), pose: "side-r", plate: onTable(t, 0.36, 0.55) },
    { kind: "cafe", at: roundSeat(t, 0.9, 0.52), pose: "side-l", plate: onTable(t, 0.64, 0.55) },
    // 아래 자리: 의자 등받이(cafe-table.webp 400×438 의 아래 의자)가 앉은 사람의 허리 아래를 가린다
    { kind: "cafe", at: roundSeat(t, 0.5, 0.88), pose: "back", plate: onTable(t, 0.5, 0.67), cover: coverOf("cafe-table", t, 400, 438, [160, 338, 240, 438]) },
  ]),
  // 세로 긴 탁자: 왼쪽 스툴 셋은 오른쪽을, 오른쪽 스툴 셋은 왼쪽을 본다. fy 는 스툴 좌석의 가운데
  ...SIXES.flatMap((t): Rest[] => [0.21, 0.46, 0.71].flatMap((fy): Rest[] => [
    { kind: "cafe", at: roundSeat(t, 0.13, fy), pose: "side-r", plate: onTable(t, 0.38, fy) },
    { kind: "cafe", at: roundSeat(t, 0.87, fy), pose: "side-l", plate: onTable(t, 0.62, fy) },
  ])),
  { kind: "nook", at: { x: 120, y: 470 }, pose: "side-r", plate: { x: 152, y: 448 }, pick: "nook" },
  { kind: "nook", at: { x: 200, y: 470 }, pose: "side-l", plate: { x: 168, y: 448 }, pick: "nook" },
  { kind: "toaster", at: { x: TOASTER.x, y: 152 }, pose: "up" },
  ...SOFA_XS.flatMap((x): Rest[] => [
    // 방석 앞쪽에 앉아 정강이와 발이 소파 밖으로 나온다
    { kind: "sofa", at: { x: x + SOFA_IN, y: SOFA_Y + 50 }, pose: "side-r" },
    { kind: "sofa", at: { x: x + SOFA_IN, y: SOFA_Y + 95 }, pose: "side-r" },
    { kind: "sofa", at: { x: x + 180 - SOFA_IN, y: SOFA_Y + 50 }, pose: "side-l" },
    { kind: "sofa", at: { x: x + 180 - SOFA_IN, y: SOFA_Y + 95 }, pose: "side-l" },
  ]),
  ...[1105, 1145, 1185].flatMap((x, k): Rest[] => [
    // 위 자리: 잘린 앞모습 그림의 아래 끝(발에서 11 위)이 탁자 윗변(그림 위에서 26)에 닿는 높이
    { kind: "meet", at: { x, y: 490 + PANTRY_DY }, pose: "front", lane: 38 },
    // 아래 자리: 의자 등받이(meeting-table.webp 271×219 의 아래 의자 셋)가 앉은 사람의 허리 아래를 가린다
    { kind: "meet", at: { x, y: 540 + PANTRY_DY }, pose: "back", cover: coverOf("meeting-table", MEET_TABLE, 271, 219, [[25, 108, 192][k], 148, [79, 162, 246][k], 219]) },
  ]),
  { kind: "sofa", at: { x: 1102, y: 360 + PANTRY_DY }, pose: "side-r", plate: { x: 1134, y: 372 + PANTRY_DY }, pick: "snack" },
  { kind: "sofa", at: { x: 1102, y: 396 + PANTRY_DY }, pose: "side-r", plate: { x: 1146, y: 392 + PANTRY_DY }, pick: "snack" },
  // 모니터 앞 테이블: 위 의자는 앞을 보고, 아래 의자는 모니터를 본다. 발표자는 오른쪽 모니터 옆에 선다
  ...[0.2, 0.5, 0.81].flatMap((fx, k): Rest[] => [
    { kind: "huddle", at: roundSeat(HUDDLE_TABLE, fx, 0.155), pose: "front", lane: 38 },
    // 아래 자리: 스툴 판의 앞쪽 절반(판 가운데 y 205 아래)과 다리(monitor-table.webp 373×295)가 앉은 사람의 엉덩이·다리 앞에 온다
    { kind: "huddle", at: roundSeat(HUDDLE_TABLE, fx, 0.7), pose: "back", cover: coverOf("monitor-table", HUDDLE_TABLE, 373, 295, [[41, 149, 264][k], 205, [110, 217, 334][k], 295]) },
  ]),
  { kind: "present", at: { x: 507, y: 478 }, pose: "stand" },
  // 누우면 발끝(서 있는 그림의 바닥)이 오른쪽, 머리가 베개 쪽이다
  ...BEDS.map((b): Rest => ({ kind: "bed", at: { x: b.x + 10 + LIE_H, y: b.y + b.h / 2 }, pose: "stand" })),
  // 입식 테이블: 왼쪽 사람은 오른쪽을, 오른쪽 사람은 왼쪽을 보고(옆모습), 아래 사람은 등을 보인다. 스낵바에서 간식을 집어 와 테이블에 놓고 먹는다
  ...STAND_TABLES.flatMap((p): Rest[] => [
    { kind: "stand", at: { x: p.x - 36, y: p.y + 2 }, pose: "walk", plate: { x: p.x - 12, y: p.y - 26 }, pick: "snack" },
    { kind: "stand", at: { x: p.x + 36, y: p.y + 2 }, pose: "walk-l", plate: { x: p.x + 12, y: p.y - 26 }, pick: "snack" },
    { kind: "stand", at: { x: p.x, y: p.y + 24 }, pose: "up", plate: { x: p.x, y: p.y - 20 }, pick: "snack" },
  ]),
  // 책상 뒤에 서면 몸은 모니터에 가리고 머리만 모니터 위로 보인다
  { kind: "mac", at: { x: MAC_DESK.x + MAC_DESK.w / 2, y: Math.round(MAC_DESK.y + MAC_DESK.h * 0.54) }, pose: "stand", lane: 34 },
];
// 카페 테이블마다 네 자리의 RESTS 번호. 같은 부서가 함께 앉을 때 쓴다
export const CAFE_TABLES: number[][] = [...ROUNDS.map((_, k) => [0, 1, 2, 3].map((n) => k * 4 + n)), ...SIXES.map((_, k) => [0, 1, 2, 3, 4, 5].map((n) => ROUNDS.length * 4 + k * 6 + n))];
// 모니터 앞 회의: 의자 여섯 자리와 발표자 자리의 RESTS 번호
export const HUDDLE_SEATS = RESTS.flatMap((r, i) => (r.kind === "huddle" ? [i] : []));
export const PRESENT_SPOT = RESTS.findIndex((r) => r.kind === "present");

// 모일 곳: 작업 테이블을 펴지 않고 이미 있는 가구에 담당자들이 모여 일하는 곳(도비 사무실).
// seats 는 RESTS 번호이고 첫째가 기획자 자리다. flags 는 깃발 자리 후보(첫째가 기본), box 는 누르면 상세를 여는 넓이다.
// 모니터 앞 테이블(데이터 분석 발표), 침대, 토스터, 맥 책상은 쓰지 않는다
// 깃발 자리: 깃대 밑동, pole 은 깃대 길이(기본 117. 앉은 사람 머리를 가리지 않게 곳마다 줄인다), side 는 천을 다는 쪽
export type PlaceFlag = Pt & { pole?: number; side: FlagSide };
export interface WorkPlace {
  id: string;
  name: string;
  seats: number[];
  flags: PlaceFlag[];
  box: Box;
}
const restsOf = (pred: (r: Rest) => boolean) => RESTS.flatMap((r, i) => (pred(r) ? [i] : []));
const boxOf = (seats: number[], pad = 22): Box => {
  const ps = seats.map((i) => RESTS[i].at);
  return { x1: Math.min(...ps.map((p) => p.x)) - pad, y1: Math.min(...ps.map((p) => p.y)) - 40, x2: Math.max(...ps.map((p) => p.x)) + pad, y2: Math.max(...ps.map((p) => p.y)) + 6 };
};
// 천이 판 밖으로 나가는 후보는 뺀다(판 왼쪽 끝에 붙은 곳은 오른쪽 하나만 남는다)
const place = (id: string, name: string, seats: number[], flags: PlaceFlag[]): WorkPlace => ({ id, name, seats, flags: flags.filter((f) => flagBox(f, f.side).x1 >= 10 && flagBox(f, f.side).x2 <= VW - 10), box: boxOf(seats) });
const LOUNGE = restsOf((r) => r.kind === "sofa" && !r.pick);
const MEET = restsOf((r) => r.kind === "meet");
const STAND = restsOf((r) => r.kind === "stand");
// 깃발은 그 곳 탁자 위에 꽂는다(base: 탁자 판 위 한 점). 깃대 길이는 그 곳 자리에 앉은 사람의 머리와 역할 이름표(앉은 그림 56 위로 6~20)
// 바로 위에 천(높이 38)의 아래 끝이 오게 계산한다. lift 는 다른 곳 사람을 피하려고 더 올리는 만큼이다
const FLAG_H = 38;
const occupiedTop = (i: number) => {
  const r = RESTS[i];
  if (r.pose === "back") return r.at.y - 58; // 뒷모습 자리는 이름표가 발 아래다
  if (r.pose === "stand" || r.pose === "walk" || r.pose === "walk-l" || r.pose === "up") return r.at.y - 80;
  return r.at.y - 78;
};
const planted = (seats: number[], base: Pt, lift = 0): Pt & { pole: number } => ({ ...base, pole: base.y - (Math.min(...seats.map(occupiedTop)) - 2 - FLAG_H - lift) });
// 깃발 후보 둘: base 에 꽂고 천을 오른쪽으로 다는 자리, left(없으면 base)에 꽂고 천을 왼쪽으로 다는 자리
const at = (id: string, name: string, seats: number[], base: Pt, left: Pt = base) =>
  place(id, name, seats, [{ ...planted(seats, base), side: "r" }, { ...planted(seats, left), side: "l" }]);
export const WORK_PLACES: WorkPlace[] = [
  // 둥근 탁자: 판 왼쪽(왼쪽 사람과 위 사람 사이)에 꽂아 오른쪽으로, 또는 판 오른쪽에 꽂아 왼쪽으로
  ...ROUNDS.map((t, k) => at(`cafe-round-${k + 1}`, "카페 둥근 탁자", CAFE_TABLES[k], { x: t.x + 30, y: t.y + 65 }, { x: t.x + t.w - 30, y: t.y + 65 })),
  // 긴 탁자: 벽 바로 아래부터 사람이 앉아 천을 달 빈 곳이 없다. 깃대는 판 위쪽 끝 가운데에 꽂고 천은 위쪽 벽에 건다(위 줄 이름표는 가린다)
  ...SIXES.map((t, k) => {
    const base = { x: Math.round(t.x + t.w / 2), y: t.y + 17, pole: t.y + 17 };
    return place(`cafe-long-${k + 1}`, "카페 긴 탁자", CAFE_TABLES[ROUNDS.length + k], [{ ...base, side: "r" }, { ...base, side: "l" }]);
  }),
  // 회의 탁자는 위 줄 셋을 먼저 채운다(기획자는 위 줄 가운데). 깃대는 판 오른쪽 끝에 꽂아 천을 오른쪽 빈 바닥 위로, 또는 판 왼쪽 끝에 꽂아 왼쪽으로
  at("meet", "탕비실 회의 탁자", [MEET[2], MEET[0], MEET[4], MEET[1], MEET[3], MEET[5]], { x: MEET_TABLE.x + MEET_TABLE.w - 8, y: MEET_TABLE.y + 55 }, { x: MEET_TABLE.x + 8, y: MEET_TABLE.y + 55 }),
  // 소파 묶음: 두 소파 사이 낮은 탁자 위
  ...SOFA_XS.map((x, k) => at(`lounge-${k + 1}`, "소파 묶음", LOUNGE.slice(k * 4, k * 4 + 4), { x: x + 90, y: SOFA_Y + 35 })),
  // 입식 테이블: 상판 위. 오른쪽 것은 천을 오른쪽으로 달 때 천 오른쪽 끝이 회의 탁자 위 줄 이름표에 덜 닿게 상판 왼쪽에 꽂는다
  ...STAND_TABLES.map((p, k) => at(`stand-${k + 1}`, "입식 테이블", [STAND[k * 3 + 2], STAND[k * 3], STAND[k * 3 + 1]], { x: k === 1 ? p.x - 14 : p.x, y: p.y - 22 }, { x: k === 1 ? p.x + 14 : p.x, y: p.y - 22 })),
  // ㄷ자 소파: 앞의 둥근 탁자 위
  at("pantry-sofa", "진열장 ㄷ자 소파", restsOf((r) => r.kind === "sofa" && r.pick === "snack"), { x: 1150, y: 380 + PANTRY_DY }),
  // 작은 탕비 탁자: 두 사람 사이 탁자 위. 천은 위쪽 벽에 걸친다
  at("nook", "작은 탕비 탁자", restsOf((r) => r.kind === "nook"), { x: 158, y: 440 }),
];
export const placeOf = (id: string | undefined) => WORK_PLACES.find((p) => p.id === id);
type Spread = Pt & { place?: string; flag?: Pt & { pole?: number; side?: FlagSide }; roles?: TableRole[]; crew?: Partial<Record<TableRole, string>> };
// 일하는 곳의 깃발. 모일 곳은 적어 둔 방향(side)의 후보를 지금 도면에서 읽고, 방향이 없는 옛 기록이면 첫째 후보다. 작업 테이블은 왼쪽 위 모서리
export const flagOf = (tb: Spread): PlaceFlag => {
  const p = placeOf(tb.place);
  if (p) return p.flags.find((f) => f.side === tb.flag?.side) ?? p.flags[0];
  return { ...(tb.flag ?? { x: tb.x + FLAG.poleX, y: tb.y + FLAG.poleBottom }), side: "r" };
};
// 모일 곳에 앉은 사람과 머리 위 이름표까지의 넓이(누르는 넓이 box 는 머리까지라 이름표가 빠진다)
const seatedBox = (p: WorkPlace): Box => ({ ...p.box, y1: Math.min(p.box.y1, ...p.seats.map(occupiedTop)) });
// 일하는 곳이 차지하는 넓이. 작업 테이블은 테이블과 사람, 이름표, 깃발을 담은 한 상자, 모일 곳은 앉은 사람 상자와 깃발 상자 둘
export const workArea = (tb: Spread): Box[] => {
  const p = placeOf(tb.place);
  if (!p) return [tableFootprint(tb)];
  const f = flagOf(tb);
  return [seatedBox(p), flagBox(f, f.side)];
};
// 모일 곳에 앉은 역할의 자리. 이미 앉은 사람은 그 자리 그대로 두고, 새 역할은 앞에서부터 빈 자리에 앉힌다(기획자는 첫 자리)
export function placeSeats(p: WorkPlace, roles: TableRole[], before: Partial<Record<TableRole, number>> = {}): Partial<Record<TableRole, number>> {
  const out: Partial<Record<TableRole, number>> = {};
  for (const r of roles) if (before[r] != null && p.seats.includes(before[r]!)) out[r] = before[r];
  const order = [...roles].sort((a, b) => Number(b === "planner") - Number(a === "planner"));
  for (const r of order) {
    if (out[r] != null) continue;
    const free = p.seats.find((i) => !Object.values(out).includes(i));
    if (free == null) break;
    out[r] = free;
  }
  return out;
}
// 모일 곳 자리에서 노트북을 놓을 곳. 작업 테이블의 자리별 노트북 위치(workTable 의 SLOTS)와 같은 간격을 쓴다
export function placeLaptop(i: number): { href: string; x: number; y: number; width: number; height: number; transform?: string } {
  const { at, pose } = RESTS[i], w = 24, h = 23;
  if (pose === "front") return { href: "/sprites/laptop-for-top.webp", x: at.x - w / 2, y: at.y - 6, width: w, height: h };
  if (pose === "back" || pose === "up") return { href: "/sprites/laptop-for-bottom.webp", x: at.x - w / 2, y: at.y - 42, width: w, height: h };
  // 오른쪽을 보는 사람(side-r, walk)은 오른쪽 끝 자리 노트북을 뒤집어 앞에 놓는다
  const right = pose === "side-r" || pose === "walk", x = right ? at.x + 12 : at.x - 12 - w;
  return { href: "/sprites/laptop-for-right.webp", x, y: at.y - 34, width: w, height: h + 2, transform: right ? `translate(${2 * x + w} 0) scale(-1 1)` : undefined };
}

// 책상 방: 아래 왼쪽 방에 책상을 네 줄 놓는다. 아래 세 줄은 여섯 개씩, 맨 위 줄은 왼쪽에 세 개(21개). 오른쪽 큰 방에 19개를 더 놓아 모두 40개다. 주인 없이 일하는 사람이 빈 책상에 앉는다
// 두 개씩 짝지어 짝 사이를 통로로 둔다. col 은 통로 쪽(0이면 오른쪽, 1이면 왼쪽)을 고르는 데 쓴다. 에이전트는 책상 뒤에 앉아 정면을 본다
const ROW_DY = 62, DESK_W = 64;
const DESK_BANDS: [number, number][] = [[26, 194], [211, 389], [406, 574]];
export type Desk = Pt & { w: number; row: number; col: number };
// 맨 위 줄(row 0)은 왼쪽 세 개뿐이다. 그 오른쪽은 모니터 앞 테이블 자리다
const bandDesks = (bands: [number, number][], row: number, y: number): Desk[] =>
  bands.flatMap(([lo, hi]) => [0, 1].map((col) => ({ x: col === 0 ? lo + 4 + DESK_W / 2 : hi - 4 - DESK_W / 2, y, w: DESK_W, row, col })));
const ROOM_DESKS: Desk[] = [0, 1, 2, 3].flatMap((row) => bandDesks(DESK_BANDS, row, 621 + row * ROW_DY).slice(0, row === 0 ? 3 : 6));
// 오른쪽 큰 방(탕비실 오른쪽, 작업 테이블을 펴던 넓은 바닥): 에이전트 수만큼 책상이 되도록 오른쪽 위부터 채운다.
// 두 짝(띠)을 오른쪽 벽에 붙여 한 줄에 넷, 의자 위 끝이 위 벽 면 아래 끝(y 44)에 닿지 않는 높이부터 다섯 줄. 아래 왼쪽 하나는 빼서 19개다.
// 빈 책상은 번호가 작은 것부터 쓰므로, 책상 방이 차면 이 방의 오른쪽 위 책상부터 앉는다
const EAST_BANDS: [number, number][] = [[1514, 1682], [1329, 1497]];
const EAST_ROWS = 5, EAST_COUNT = 19, EAST_TOP = 86;
const EAST_DESKS: Desk[] = Array.from({ length: EAST_ROWS }, (_, r) => bandDesks(EAST_BANDS, 4 + r, EAST_TOP + r * ROW_DY).sort((a, b) => b.x - a.x))
  .flat()
  .slice(0, EAST_COUNT);
export const DESKS: Desk[] = [...ROOM_DESKS, ...EAST_DESKS];
export const DESK_ROWS = [...new Set(DESKS.map((d) => d.row))].sort((a, b) => a - b);
// 책장 정리 도비(돌아다니는 도비)의 책상: 탕비실 왼쪽 위 구석(옛 작업 생성 게시판 자리). 할 일이 없으면 여기 앉는다.
// 다른 사람은 쓰지 않아 DESKS 에 넣지 않는다. row 는 그리는 차례를 가르는 데만 쓴다
export const COURIER_DESK: Desk = { x: 749, y: 210, w: DESK_W, row: 4 + EAST_ROWS, col: 0 };
const ALL_DESKS = [...DESKS, COURIER_DESK];
// 책상 그림 두 장의 위치. 의자(101×103)는 캐릭터 뒤에, 책상 앞면(240×157)은 캐릭터 허리 높이부터 앞을 가린다
export function deskArt(p: Pt & { w: number }) {
  const k = p.w / 240;
  return {
    chair: { x: p.x - (101 * k) / 2, y: p.y - 40, width: 101 * k, height: 103 * k },
    front: { x: p.x - p.w / 2, y: p.y - 24, width: p.w, height: 157 * k },
  };
}
// 책상 그림 전체(의자 위 끝부터 앞면 아래 끝까지)를 막아 책상 위로 걷지 않게 한다
const deskFoot = (p: Pt & { w: number }): Box => ({ x1: p.x - p.w / 2, y1: p.y - 40, x2: p.x + p.w / 2, y2: p.y + 18 });
// 앉는 점에서 통로 쪽으로 터 둔 길의 끝. 서류철을 건네는 사람도 여기 선다
export const deskSide = (p: Pt & { w: number; col: number }): Pt => ({ x: p.x + (p.col === 1 ? -1 : 1) * (p.w / 2 + 12), y: p.y });

// 길찾기 칸판. 10 단위 칸마다 막혔는지 적어 둔다
const CELL = 10, GW = VW / CELL, GH = VH / CELL, AG = 8; // AG: 벽에서 떨어져 걷는 거리
const BOUNDS: Box = { x1: 10 + WT, y1: 10, x2: 1690 - WT, y2: 840 - WT };
let blocked: Uint8Array = new Uint8Array(GW * GH);
const DOOR_R = 18, DOOR_HEAD = 46, DOOR_SIDE = 14; // 문틀을 막는 범위: 벽에서의 거리, 세로문 위쪽 높이, 가로문 양옆 폭
const hit = (b: Box, x: number, y: number) => x > b.x1 && x < b.x2 && y > b.y1 && y < b.y2;
// 앉는 자리에서 바라보는 쪽의 반대로 30만큼 길을 터, 막아 둔 탁자 옆 자리에도 탁자를 지나지 않고 들어가게 한다
const OUTWARD: Partial<Record<Pose, Pt>> = { front: { x: 0, y: -1 }, back: { x: 0, y: 1 }, "side-r": { x: -1, y: 0 }, "side-l": { x: 1, y: 0 } };
const CAFE_SEATS = RESTS.filter((r) => r.kind === "cafe" || r.kind === "meet" || r.kind === "huddle" || r.kind === "mac").map((r) => ({ ...r.at, pose: r.kind === "mac" ? ("front" as Pose) : r.pose, lane: r.lane })); // 맥 책상은 서 있지만 길은 책상 뒤(위쪽)로 튼다
// 소파 자리는 방석 위를 걷지 않게, 탁자 쪽 통로에서 옆으로 들어와 앉는다
const SOFA_SEATS = SOFA_XS.flatMap((x) => [50, 95].flatMap((dy) => [{ x: x + SOFA_IN, y: SOFA_Y + dy, d: 1 }, { x: x + 180 - SOFA_IN, y: SOFA_Y + dy, d: -1 }]));
function buildGrid(extra: Box[], seats: (Pt & { pose: Pose; lane?: number })[] = []): Uint8Array {
  const g = new Uint8Array(GW * GH);
  const walls = [...WALLS, ...FACES].map((b) => ({ x1: b.x1 - AG, y1: b.y1 - AG, x2: b.x2 + AG, y2: b.y2 + AG }));
  // 문틀: 발만 문 안에 있어도 몸(폭 26, 키 58)이 벽에 겹치면 벽을 뚫는 것처럼 보인다. 세로벽 문은 머리가 위 문틀에 걸리지 않는 아래쪽으로만, 가로벽 문은 양 문틀에서 몸 반쪽만큼 떨어져 지나게 한다
  const jambs: Box[] = DOORS.flatMap((d) =>
    d.v
      ? [{ x1: d.at - DOOR_R, x2: d.at + DOOR_R, y1: d.a, y2: d.a + DOOR_HEAD }]
      : [{ x1: d.a, x2: d.a + DOOR_SIDE, y1: d.at - DOOR_R, y2: d.at + DOOR_R }, { x1: d.b - DOOR_SIDE, x2: d.b, y1: d.at - DOOR_R, y2: d.at + DOOR_R }],
  );
  const things = [...FURNITURE, ...extra].map((b) => ({ x1: b.x1 - 2, y1: b.y1 - 2, x2: b.x2 + 2, y2: b.y2 + 2 })).concat(jambs);
  for (let cy = 0; cy < GH; cy++)
    for (let cx = 0; cx < GW; cx++) {
      const x = cx * CELL + CELL / 2, y = cy * CELL + CELL / 2;
      if (x < BOUNDS.x1 + AG || x > BOUNDS.x2 - AG || y < BOUNDS.y1 + AG || y > BOUNDS.y2 - AG || walls.some((b) => hit(b, x, y)) || things.some((b) => hit(b, x, y))) g[cy * GW + cx] = 1;
    }
  for (const s of [...CAFE_SEATS, ...seats]) {
    const d = OUTWARD[s.pose];
    if (d) for (let k = 0; k <= (s.lane ?? 30); k += 5) g[Math.floor((s.y + d.y * k) / CELL) * GW + Math.floor((s.x + d.x * k) / CELL)] = 0;
  }
  for (const s of SOFA_SEATS) for (let k = 0; k <= 30; k += 5) g[Math.floor(s.y / CELL) * GW + Math.floor((s.x + s.d * k) / CELL)] = 0;
  return g;
}
// 책상과 작업 테이블을 막고, 앉는 점에서 통로 쪽으로 길을 터 옆에서 들어와 앉게 한다
function withDesks(desks: Desk[], tables: Pt[] = []) {
  const g = buildGrid([...desks.map(deskFoot), ...tables.flatMap(tableBlocks)]);
  const open = (a: Pt, b: Pt) => {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 5);
    for (let k = 0; k <= n; k++) g[cellOf({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n })] = 0;
  };
  for (const p of desks) open(p, deskSide(p));
  for (const t of tables) for (const [a, b] of tableLanes(t)) open(a, b);
  return g;
}

const cellOf = (p: Pt) => Math.min(GH - 1, Math.max(0, Math.floor(p.y / CELL))) * GW + Math.min(GW - 1, Math.max(0, Math.floor(p.x / CELL)));
const center = (c: number): Pt => ({ x: (c % GW) * CELL + CELL / 2, y: Math.floor(c / GW) * CELL + CELL / 2 });
// 막힌 칸이면 가장 가까운 빈 칸으로
function nearestFree(g: Uint8Array, c: number): number {
  if (!g[c]) return c;
  const seen = new Set([c]), q = [c];
  for (let i = 0; i < q.length; i++) {
    const u = q[i], ux = u % GW;
    for (const v of [u - 1, u + 1, u - GW, u + GW]) {
      if (v < 0 || v >= GW * GH || seen.has(v) || (Math.abs((v % GW) - ux) > 1)) continue;
      if (!g[v]) return v;
      seen.add(v);
      q.push(v);
    }
  }
  return c;
}
// A* 탐색(남은 거리를 어림해 가까운 칸부터 넓혀 가는 길찾기). 대각선은 양옆이 모두 비었을 때만 간다
function astar(g: Uint8Array, s: number, t: number): number[] | null {
  const gs = new Float64Array(GW * GH).fill(Infinity), prev = new Int32Array(GW * GH).fill(-1), done = new Uint8Array(GW * GH);
  const tx = t % GW, ty = Math.floor(t / GW);
  const h = (c: number) => {
    const dx = Math.abs((c % GW) - tx), dy = Math.abs(Math.floor(c / GW) - ty);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };
  const heap: [number, number][] = [];
  const push = (f: number, c: number) => {
    heap.push([f, c]);
    for (let i = heap.length - 1; i > 0; ) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ; ) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  gs[s] = 0;
  push(h(s), s);
  while (heap.length) {
    const [, u] = pop();
    if (done[u]) continue;
    if (u === t) break;
    done[u] = 1;
    const ux = u % GW, uy = Math.floor(u / GW);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = ux + dx, ny = uy + dy;
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
        const v = ny * GW + nx;
        if (g[v] || (dx && dy && (g[uy * GW + nx] || g[ny * GW + ux]))) continue;
        const d = gs[u] + (dx && dy ? Math.SQRT2 : 1);
        if (d < gs[v]) {
          gs[v] = d;
          prev[v] = u;
          push(d + h(v), v);
        }
      }
  }
  if (s !== t && prev[t] < 0) return null;
  const path = [t];
  while (path[0] !== s) path.unshift(prev[path[0]]);
  return path;
}
// 두 점 사이가 막힌 칸을 지나지 않는지(5 단위마다 본다)
function clear(g: Uint8Array, a: Pt, b: Pt) {
  const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 5);
  for (let i = 1; i < n; i++) if (g[cellOf({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n })]) return false;
  return true;
}
// 두 점 사이의 꺾임점(시작점 제외, 끝점 포함). avoid: 걷지 않고 있는 다른 에이전트 위치
export function path(from: Pt, to: Pt, avoid: Pt[] = []): Pt[] {
  let g = blocked;
  if (avoid.length) {
    g = blocked.slice();
    for (const p of avoid) {
      if (Math.hypot(p.x - from.x, p.y - from.y) < 30 || Math.hypot(p.x - to.x, p.y - to.y) < 30) continue;
      for (const dx of [-10, 0, 10]) for (const dy of [-10, 0]) g[cellOf({ x: p.x + dx, y: p.y + dy })] = 1;
    }
  }
  const s0 = cellOf(from), t0 = cellOf(to), s = nearestFree(g, s0), t = nearestFree(g, t0);
  const cells = astar(g, s, t);
  if (!cells) return avoid.length ? path(from, to) : [to];
  const pts = [from, ...cells.map(center)];
  // 보이는 점끼리 바로 이어 꺾임점만 남긴다
  const out: Pt[] = [];
  let a = pts[0], i = 1;
  while (i < pts.length) {
    let j = i;
    while (j + 1 < pts.length && clear(g, a, pts[j + 1])) j++;
    out.push(pts[j]);
    a = pts[j];
    i = j + 1;
  }
  if (out.length && clear(g, out[out.length - 1], to)) out[out.length - 1] = to;
  else out.push(to);
  return out;
}

blocked = withDesks(ALL_DESKS);

// 펴 둔 작업 테이블. 바뀔 때마다 칸판을 다시 만들어, 걷던 사람도 다음 길부터 테이블을 돌아간다
export function setTables(tables: Pt[]) {
  blocked = withDesks(ALL_DESKS, tables);
}

// 테이블을 펴도 꼭 갈 수 있어야 하는 곳: 쉬는 자리, 간식 집는 곳, 책상(책장 정리 도비 책상 포함), 접수 자리·캐비닛·서고 앞, 카페 줄
const MUST: Pt[] = [...RESTS.map((r) => r.at), ...PICKS.snack, ...PICKS.nook, ...ALL_DESKS, FRONT_SPOT, CABINET_SPOT, LIB_SPOT, COUNTER, ...LINE];
const HALL: Pt = { x: 640, y: 425 };
// 복도에서 막히지 않은 칸만 밟아(상하좌우) 모든 점에 닿는지
function allReachable(g: Uint8Array, pts: Pt[]) {
  const seen = new Uint8Array(GW * GH), q = [nearestFree(g, cellOf(HALL))];
  seen[q[0]] = 1;
  for (let i = 0; i < q.length; i++) {
    const u = q[i], ux = u % GW;
    for (const v of [u - 1, u + 1, u - GW, u + GW]) {
      if (v < 0 || v >= GW * GH || seen[v] || g[v] || Math.abs((v % GW) - ux) > 1) continue;
      seen[v] = 1;
      q.push(v);
    }
  }
  return pts.every((p) => seen[nearestFree(g, cellOf(p))]);
}
const overlap = (a: Box, b: Box) => a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;
// 작업 테이블을 펼 자리. 넓이가 통째로 비고(책상 방은 빼고), 펴도 모든 곳으로 다닐 수 있는 후보 가운데 가장 위(같으면 왼쪽). 없으면 null
// 위에서부터 차곡차곡 채워야 테이블 사이에 어중간한 틈이 남지 않는다
// roles: 새로 펼 테이블에 켜진 자리. 개발자와 산출자가 함께 있으면 왼쪽 끝 여섯째 자리까지 넓게 잡는다(도비 사무실). 없으면 다섯 자리
// busy: 쓰고 있는 모일 곳이 차지하는 넓이(workArea). 그 사람과 깃발 아래에는 펴지 않는다
export function findTableSpot(tables: (Pt & { roles?: TableRole[] })[], roles?: TableRole[], busy: Box[] = []): Pt | null {
  const g0 = withDesks(ALL_DESKS, tables);
  const others = [...tables.map(tableFootprint), ...busy];
  const keep = [...MUST, ...DOORS.map((d) => (d.v ? { x: d.at, y: (d.a + d.b) / 2 } : { x: (d.a + d.b) / 2, y: d.at }))];
  const out: Pt[] = [];
  for (let y = 160; y <= VH - 80; y += 2)
    for (let x = 140; x <= VW - 100; x += 10) {
      // 칸판이 이미 벽과 가구 둘레에 여유를 두므로 넓이 그대로 본다. 지킬 점은 10, 다른 테이블은 옆 10·위아래 4를 더 띄운다
      const c = { x, y }, m = tableFootprint({ ...c, roles }), wide = { x1: m.x1 - 10, y1: m.y1 - 10, x2: m.x2 + 10, y2: m.y2 + 10 };
      const near = { ...wide, y1: m.y1 - 4, y2: m.y2 + 4 };
      if (overlap(m, ZONES.work) || others.some((o) => overlap(near, o)) || keep.some((p) => hit(wide, p.x, p.y))) continue;
      let free = true;
      for (let cy = Math.floor(m.y1 / CELL); free && cy <= Math.floor(m.y2 / CELL); cy++)
        for (let cx = Math.floor(m.x1 / CELL); cx <= Math.floor(m.x2 / CELL); cx++)
          if (g0[cy * GW + cx]) {
            free = false;
            break;
          }
      if (free) out.push(c);
    }
  const seats = tables.flatMap((t) => allSeats(t));
  for (const c of out) {
    const g = withDesks(ALL_DESKS, [...tables, c]);
    if (allReachable(g, [...MUST, ...seats, ...allSeats({ ...c, roles })])) return c;
  }
  return null;
}

// 빈 바닥에 편 작업 테이블만(모일 곳은 이미 있는 가구라 길찾기에서 따로 막지 않는다)
export const popTables = <T extends { table?: (Pt & { place?: string }) | undefined }>(tasks: T[]) =>
  tasks.flatMap((t) => (t.table && !t.table.place ? [t.table as NonNullable<T["table"]>] : []));
// 모일 곳의 깃발 자리. busy(다른 일하는 곳의 넓이)와 겹치지 않는 첫 후보, 모두 겹치면 첫째 후보
export const pickFlag = (p: WorkPlace, busy: Box[]): PlaceFlag => p.flags.find((f) => !busy.some((b) => overlap(flagBox(f, f.side), b))) ?? p.flags[0];
// 그 모일 곳을 써도 다른 일하는 곳과 겹치지 않는지: 앉은 사람 상자가 비고, 겹치지 않는 깃발 자리가 하나라도 있다
const clearOf = (p: WorkPlace, busy: Box[]) => !busy.some((b) => overlap(seatedBox(p), b)) && p.flags.some((f) => !busy.some((b) => overlap(flagBox(f, f.side), b)));
// 담당자들이 모일 곳. 정원이 담당자 수 이상이고 비어 있는 곳들과 "빈 바닥에 작업 테이블 펴기" 하나를 같은 확률로 고른다
// (가까운 곳부터 채우면 늘 같은 곳만 쓰인다). 모일 곳은 다른 일하는 곳과 겹치지 않는 곳 가운데에서 고르고, 그런 곳이 없을 때만 겹치는 곳을 쓴다.
// 작업 테이블을 골랐는데 펼 바닥(findTableSpot)이 없으면 모일 곳 가운데 다시 고른다. 둘 다 없으면 null
// tableOnly(데모 모드)면 늘 작업 테이블을 고르고, 펼 바닥이 없을 때만 모일 곳으로 간다
// busy: 쓰고 있는 모일 곳이 차지하는 넓이(workArea). 모일 곳을 고르면 겹치지 않는 깃발 자리(pickFlag)를 함께 돌려준다
export function findWorkPlace(taken: string[], tables: (Pt & { roles?: TableRole[] })[], roles: TableRole[], rand: () => number = Math.random, tableOnly = false, busy: Box[] = []): { place: WorkPlace; flag: PlaceFlag } | { spot: Pt } | null {
  const all = [...tables.map(tableFootprint), ...busy];
  const fit = WORK_PLACES.filter((p) => p.seats.length >= roles.length && !taken.includes(p.id));
  const clear = fit.filter((p) => clearOf(p, all));
  const of = (p: WorkPlace) => ({ place: p, flag: pickFlag(p, all) });
  const i = tableOnly ? clear.length : Math.floor(rand() * (clear.length + 1));
  if (i < clear.length) return of(clear[i]);
  const spot = findTableSpot(tables, roles, busy);
  if (spot) return { spot };
  const rest = clear.length ? clear : fit;
  return rest.length ? of(rest[Math.floor(rand() * rest.length)]) : null;
}

