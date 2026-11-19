"use client";
import { memo, useId, useLayoutEffect, useRef, type CSSProperties } from "react";
import { avatarSrc, type Pose } from "@/lib/office/core/avatars";
import { ROLE_NAME, type AgentState, type SeatRole, type SeatWork } from "@/lib/office/core/types";

export type Face = AgentState["status"] | "walk" | "tea";

// 그림 없는 캐릭터(도비)의 몸 색
const BODY = "var(--intern)";

function FaceParts({ face, elf }: { face: Face; elf: boolean }) {
  const ey = -39, big = elf ? 2.4 : 1.6;
  switch (face) {
    case "rest":
      return (
        <>
          <path d={`M-6,${ey} h4 M2,${ey} h4`} className="ink" />
          <path d="M-3,-33 h6" className="ink" />
        </>
      );
    case "think":
      return (
        <>
          <circle cx={-4} cy={ey - 1.5} r={big} className="inkf" />
          <circle cx={4} cy={ey - 1.5} r={big} className="inkf" />
          <path d="M-2,-33 h4" className="ink" />
        </>
      );
    case "work":
      return (
        <>
          <path d={`M-7,${ey - 4} l4,1.5 M7,${ey - 4} l-4,1.5`} className="ink" />
          <circle cx={-4} cy={ey} r={big} className="inkf" />
          <circle cx={4} cy={ey} r={big} className="inkf" />
          <path d="M-3,-33 h6" className="ink" />
        </>
      );
    case "rush":
      return (
        <>
          <circle cx={-4} cy={ey} r={big + 0.6} className="ink" />
          <circle cx={4} cy={ey} r={big + 0.6} className="ink" />
          <circle cx={0} cy={-32.5} r={1.8} className="ink" />
          <path d="M10,-46 q2,4 0,6 q-2,-2 0,-6 Z" style={{ fill: "#6fb3e8" }} />
        </>
      );
    case "review":
      return (
        <>
          <path d={`M-7,${ey - 4} l4,-1 M3,${ey - 5} l4,2`} className="ink" />
          <circle cx={-4} cy={ey} r={big} className="inkf" />
          <circle cx={4} cy={ey} r={big} className="inkf" />
          <path d="M-3,-33 q3,1.5 6,0" className="ink" />
        </>
      );
    case "happy":
    case "tea":
      return (
        <>
          <path d={`M-7,${ey + 1} q3,-4 6,0 M1,${ey + 1} q3,-4 6,0`} className="ink" />
          <path d="M-5,-34 q5,6 10,0" className="ink" />
        </>
      );
    default:
      return (
        <>
          <circle cx={-4} cy={ey} r={big} className="inkf" />
          <circle cx={4} cy={ey} r={big} className="inkf" />
          <path d="M-3,-33 q3,2 6,0" className="ink" />
        </>
      );
  }
}

// 그림 파일이 없는 캐릭터(도비)의 앉은 모습. 몸을 6 내리고 다리를 접는다. 옆모습은 오른쪽을 보고 side-l 은 뒤집는다
// 의자가 없는 자리에 앉을 때 엉덩이 밑에 까는 스툴. 그림 파일이 없는 캐릭터(도비)에 쓴다. y 는 좌석 윗면
function Stool({ y }: { y: number }) {
  return (
    <g className="stool">
      <path d={`M-8,${y + 4} V${y + 12} M8,${y + 4} V${y + 12}`} />
      <rect x={-11} y={y} width={22} height={5} rx={2} />
    </g>
  );
}

function SeatedBody({ pose, face, elf, color, hair, stool }: { pose: Exclude<Pose, "stand" | "walk" | "walk-l" | "up">; face: Face; elf: boolean; color: string; hair?: string; stool?: boolean }) {
  const side = pose.startsWith("side");
  return (
    <g className="torso" transform={`translate(0,6)${pose === "side-l" ? " scale(-1,1)" : ""}`}>
      {stool && <Stool y={-13} />}
      {side ? (
        <path d="M-1,-12 H9 V-6" className="leg" style={{ fill: "none" }} />
      ) : (
        <>
          <line x1={-4} y1={-12} x2={-4} y2={-6} className="leg" />
          <line x1={4} y1={-12} x2={4} y2={-6} className="leg" />
        </>
      )}
      <rect x={side ? -7 : -10} y={-28} width={side ? 14 : 20} height={17} rx={7} style={{ fill: color }} />
      {elf && !side && (
        <>
          <path d="M-9,-38 L-24,-46 L-10,-31 Z" className="skin elf" />
          <path d="M9,-38 L24,-46 L10,-31 Z" className="skin elf" />
        </>
      )}
      {elf && side && <path d="M-4,-38 L-20,-47 L-6,-31 Z" className="skin elf" />}
      <circle cx={0} cy={-38} r={11} className={elf ? "skin elf" : "skin"} />
      {hair && <path d={pose === "back" ? "M-11,-38 C-12,-54 12,-54 11,-38 Q0,-30 -11,-38 Z" : "M-11,-37 C-12,-53 12,-53 11,-37 Q6,-44 0,-43 Q-6,-44 -11,-37 Z"} style={{ fill: hair }} />}
      {pose === "front" && <FaceParts face={face} elf={elf} />}
      {side && (
        <>
          <circle cx={6} cy={-39} r={elf ? 2.2 : 1.6} className="inkf" />
          <path d="M4,-33 h4" className="ink" />
        </>
      )}
    </g>
  );
}

// 그림 파일이 없는 캐릭터(도비)가 옆으로 걷는 모습. 오른쪽을 보고, 왼쪽으로 갈 때는 Motion 이 뒤집는다
function SideWalkBody({ elf, color, hair }: { elf: boolean; color: string; hair?: string }) {
  return (
    <>
      <line x1={-1} y1={-13} x2={-1} y2={0} className="leg leg-l" />
      <line x1={1} y1={-13} x2={1} y2={0} className="leg leg-r" />
      <g className="torso">
        <rect x={-7} y={-28} width={14} height={17} rx={7} style={{ fill: color }} />
        {elf && <path d="M-4,-38 L-20,-47 L-6,-31 Z" className="skin elf" />}
        <circle cx={0} cy={-38} r={11} className={elf ? "skin elf" : "skin"} />
        {hair && <path d="M-11,-37 C-12,-53 12,-53 11,-40 Q2,-44 -2,-38 Q-6,-36 -11,-37 Z" style={{ fill: hair }} />}
        <circle cx={6} cy={-39} r={elf ? 2.2 : 1.6} className="inkf" />
        <path d="M4,-33 h4" className="ink" />
      </g>
    </>
  );
}

// 걷는 동안 선 그림을 상체와 두 다리로 잘라, 다리를 엉덩이 기준으로 번갈아 움직인다
// 옆으로 걸으면 흔들고, 앞뒤로 걸으면(step) 한쪽씩 짧아졌다 길어진다
const HIP = 0.26;
function WalkingImage({ src, w, h, step }: { src: string; w: number; h: number; step: boolean }) {
  const id = useId().replace(/[^\w-]/g, ""), hip = -h * HIP;
  const img = (clip: string) => <image href={src} x={-w / 2} y={-h} width={w} height={h} clipPath={`url(#${id}${clip})`} />;
  const leg = (cls: string, x: number) => <g className={`img-leg ${cls}${step ? " step" : ""}`} style={{ transformOrigin: `${x}px ${hip}px` }}>{img(cls)}</g>;
  return (
    <>
      <defs>
        <clipPath id={`${id}u`}><rect x={-w / 2} y={-h} width={w} height={h + hip} /></clipPath>
        <clipPath id={`${id}leg-l`}><rect x={-w / 2} y={hip} width={w / 2} height={-hip} /></clipPath>
        <clipPath id={`${id}leg-r`}><rect x={0} y={hip} width={w / 2} height={-hip} /></clipPath>
      </defs>
      {leg("leg-l", -w / 6)}
      {leg("leg-r", w / 6)}
      {img("u")}
    </>
  );
}

const AVATAR_H = 58;
// 연두는 카페 도비만 쓴다. 도비 1~4 는 서로와 카페 도비, 따뜻한 나무 바닥과 모두 구별되는 색으로 둔다
const CAFE_SKIN = "#B8C98C";
const ELF_SKIN = ["#D4509A", "#9CC7DE", "#D3B5E6", "#3BA99C"];
const SEATED_H = 56;
const FRONT_CUT = 102 / 128; // 사람 앞모습 bare 그림의 아래 끝(무릎). 앉는 점이 이 높이를 탁자 윗변에 맞춘다(floorPlan SEAT_DY)
const MARK: Partial<Record<Face, string>> = { rest: "z", think: "…", rush: "!", tea: "♨" };

// 전신 캐릭터. 위치(transform)는 Motion이 직접 바꾸고, 여기서는 모양만 그린다
export const OfficeAgent = memo(function OfficeAgent({
  agent,
  face,
  walking,
  busy,
  pose,
  burnt,
  lying,
  bind,
  onAsk,
  seat,
  stool,
  nameY,
}: {
  agent: AgentState;
  face: Face;
  walking: boolean;
  busy: boolean;
  pose: Pose;
  burnt?: boolean; // 버린 방 폭파에 휘말려 시꺼멓게 탐
  lying?: boolean; // 침대에 누움. 서 있는 그림을 발끝 기준으로 돌려 머리가 왼쪽으로 간다
  bind: (outer: SVGGElement | null, inner: SVGGElement | null) => void;
  onAsk?: () => void; // 대화를 연 채 사람에게 묻는 중. 머리 위 물음표를 누르면 사람 확인 창이 열린다
  nameY?: number; // 이름을 쓸 높이(발 기준). 기본은 발 아래 20. 발 아래에 가구가 있어 이름이 묻히는 자리에서 옮긴다
  stool?: boolean; // 의자가 없는 자리(작업 테이블, 작은 탕비 탁자). 스툴을 깔고 앉는다. 의자가 딸린 가구에서는 스툴 없는 그림을 쓴다
  seat?: { role: SeatRole; work: SeatWork; below?: boolean; fill?: number }; // 테이블에 앉아 있으면 역할 이름표와 전구. fill 은 왼쪽 세로 막대가 차오르는 비율
}) {
  const elf = !agent.avatar;
  // 도비는 이름 번호(도비 1~4)마다 피부색을 달리해 구별한다
  const no = agent.name.match(/\d+/)?.[0];
  // 돌아다니는 도비(dobby-1, 완성 책을 나른다)는 번호가 없어도 카페·프론트 도비와 다른 색을 쓴다
  const elfSkin = !elf ? undefined : no ? ELF_SKIN[(Number(no) - 1) % ELF_SKIN.length] : agent.id.startsWith("dobby-") ? ELF_SKIN[0] : CAFE_SKIN;
  // 앉은 그림이 있는 멤버만 자세를 바꾼다. 옆모습이 없으면 옆 의자에서도 앞모습
  const seated = agent.avatar?.seated;
  // walk-l 은 walk 그림을 좌우로 뒤집어 왼쪽을 보게 한다
  const left = pose === "walk-l";
  if (left) pose = "walk";
  const p: Pose = pose === "walk" || pose === "up" ? (agent.avatar?.[pose] ? pose : "stand") : pose === "stand" || !seated ? "stand" : pose.startsWith("side") && !seated.side ? "front" : pose;
  const upright = p === "stand" || p === "walk" || p === "up";
  const h = upright ? AVATAR_H : SEATED_H;
  const w = h * (p === "stand" ? agent.avatar?.aspect ?? 0 : p === "walk" || p === "up" ? agent.avatar![p]! : p.startsWith("side") ? seated!.side! : seated![p as "front" | "back"]);
  const curly = agent.persona === "sunny" || agent.persona === "perfect";
  const outer = useRef<SVGGElement>(null), inner = useRef<SVGGElement>(null);
  useLayoutEffect(() => bind(outer.current, inner.current), [bind]);
  return (
    <g ref={outer} id={`agent-${agent.id}`} className={`agent${walking ? " walking" : ""}${burnt ? " burnt" : ""}`} aria-label={agent.name} style={elfSkin ? ({ "--elf": elfSkin } as CSSProperties) : undefined}>
      <g ref={inner}>
        <g transform={lying ? "rotate(-90)" : undefined}>
        {walking && <ellipse cx={0} cy={1} rx={11} ry={3} style={{ fill: "var(--line)" }} />}
        {agent.avatar ? (
          <g className="torso">
            {walking && upright ? (
              <WalkingImage src={avatarSrc(agent.avatar, p)} w={w} h={h} step={p !== "walk"} />
            ) : p === "front" && !stool ? (
              // 탁자 쪽으로 당겨 앉은 앞모습: 그림마다 자른 무릎 높이가 달라(흰둥이는 앞발까지 남음) 탁자 윗변 높이에서 한 번 더 잘라 다리가 탁자 위로 올라오지 않게 한다
              <svg x={-w / 2} y={-h} width={w} height={h * FRONT_CUT} overflow="hidden">
                <image href={avatarSrc(agent.avatar, p, true)} width={w} height={h} />
              </svg>
            ) : (
              <image href={avatarSrc(agent.avatar, p, !stool)} x={-w / 2} y={-h} width={w} height={h} transform={p === "side-l" || (left && p === "walk") ? "scale(-1,1)" : undefined} />
            )}
            <text x={w / 2} y={-h + 6} className="z">
              {MARK[face] ?? ""}
            </text>
          </g>
        ) : pose === "walk" ? (
          <g transform={left ? "scale(-1,1)" : undefined}>
            <SideWalkBody elf={elf} color={BODY} hair={elf ? undefined : agent.hair} />
          </g>
        ) : pose !== "stand" && pose !== "up" && pose !== "walk-l" ? (
          <SeatedBody pose={pose} face={face} elf={elf} color={BODY} hair={elf ? undefined : agent.hair} stool={stool} />
        ) : (
          <>
            <line x1={-4} y1={-13} x2={-4} y2={0} className="leg step leg-l" />
            <line x1={4} y1={-13} x2={4} y2={0} className="leg step leg-r" />
            <g className="torso">
              <rect x={-10} y={-28} width={20} height={17} rx={7} style={{ fill: BODY }} />
              {elf && (
                <>
                  <path d="M-9,-38 L-24,-46 L-10,-31 Z" className="skin elf" />
                  <path d="M9,-38 L24,-46 L10,-31 Z" className="skin elf" />
                </>
              )}
              <circle cx={0} cy={-38} r={11} className={elf ? "skin elf" : "skin"} />
              {!elf && (
                <path
                  d={curly ? "M-11,-38 C-13,-54 13,-54 11,-38 L11,-28 Q9,-26 8,-30 L8,-40 Q0,-46 -8,-40 L-8,-30 Q-9,-26 -11,-28 Z" : "M-11,-37 C-12,-53 12,-53 11,-37 Q6,-44 0,-43 Q-6,-44 -11,-37 Z"}
                  style={{ fill: agent.hair }}
                />
              )}
              {pose !== "up" && (
                <g>
                  <FaceParts face={face} elf={elf} />
                </g>
              )}
              <text x={13} y={-50} className="z">
                {MARK[face] ?? ""}
              </text>
            </g>
          </>
        )}
        {burnt && !walking && (
          <g className="burnt-eyes">
            <ellipse cx={-4} cy={-39} rx={2.2} ry={2.6} />
            <ellipse cx={4} cy={-39} rx={2.2} ry={2.6} />
          </g>
        )}
        </g>
      </g>
      {seat && <SeatTag role={seat.role} work={seat.work} top={seat.below ? 34 : -h - 6} />}
      {seat?.fill !== undefined && <SeatGauge role={seat.role} fill={seat.fill} top={(seat.below ? 34 : -h - 6) + 3} />}
      {onAsk && (
        <g className="agent-ask" role="button" tabIndex={0} aria-label={`${agent.name} 질문 열기`} onClick={onAsk} onKeyDown={(e) => e.key === "Enter" && onAsk()}>
          <title>{agent.name}이(가) 답을 기다립니다 · 누르면 질문을 엽니다</title>
          <rect x={-12} y={-h - 44} width={24} height={40} rx={6} className="hit" />
          <image href="/sprites/question.webp" x={-9} y={-h - 42} width={18} height={34} className="pixel" />
        </g>
      )}
      <g style={{ opacity: busy ? 1 : 0 }}>
        <rect x={-14} y={6} width={28} height={3} rx={1.5} className="gauge-bg" />
        <rect x={-14} y={6} width={Math.round(28 * Math.min(1, agent.ctx))} height={3} rx={1.5} className={`gauge-fg${agent.ctx >= 0.8 ? " hi" : ""}`} />
      </g>
      <text x={0} y={nameAt(nameY, h, seat)} className="name">
        {agent.name}
      </text>
    </g>
  );
});

// 이름을 쓸 높이. 테이블 자리에서는 역할 이름표와 막대를 피한다: 머리 위 이름은 이름표 위로, 발 아래로 내린 이름은 막대 자리 밑으로
// 옆자리 막대의 퍼센트 글씨가 이름 쪽으로 넘어오므로, 막대가 없는 사람도 같은 높이에 쓴다
const nameAt = (nameY: number | undefined, h: number, seat?: { below?: boolean }) => {
  if (!seat || nameY == null) return nameY ?? 20;
  if (!seat.below) return nameY < 0 ? -h - 24 : nameY;
  return Math.max(nameY, 57);
};

// 역할 이름표 바로 밑 가로 진행 막대. 이름표 너비만큼 역할 색이 왼쪽부터 차오르고, 오른쪽에 퍼센트를 적는다
function SeatGauge({ role, fill, top }: { role: SeatRole; fill: number; top: number }) {
  const f = Math.max(0, Math.min(1, fill));
  const w = TAG_W[role] ?? 50;
  return (
    <g className={`seat-gauge ${role}`} pointerEvents="none">
      <rect className="track" x={-w / 2} y={top} width={w} height={5} rx={2.5} />
      <rect className="bar" x={-w / 2} y={top} width={w * f} height={5} rx={2.5} />
      <text x={w / 2 + 3} y={top + 5} textAnchor="start">
        {Math.round(f * 100)}%
      </text>
    </g>
  );
}

// 머리 위 역할 이름표. 일하면 전구가 켜지고, 기다리면 모래시계, 나머지는 꺼진 전구와 흐린 이름표
const TAG_W: Partial<Record<SeatRole, number>> = { deployer: 60 };
function SeatTag({ role, work, top }: { role: SeatRole; work: SeatWork; top: number }) {
  const w = TAG_W[role] ?? 50;
  return (
    <g className={`seat-tag ${role} ${work}`} transform={`translate(0 ${top})`} pointerEvents="none">
      <rect x={-w / 2} y={-14} width={w} height={14} rx={7} />
      {work === "wait" ? (
        <text x={-w / 2 + 8} y={-3.5} className="seat-bulb" textAnchor="middle">
          ⌛
        </text>
      ) : (
        <circle cx={-w / 2 + 8} cy={-7} r={4} className="seat-bulb" />
      )}
      <text x={6} y={-3.5} textAnchor="middle">
        {ROLE_NAME[role]}
      </text>
    </g>
  );
}
