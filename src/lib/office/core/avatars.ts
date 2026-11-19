import type { Persona } from "@/lib/office/core/types";

// 사무실 사람의 아바타 그룹과 멤버(설계서 6.3절). 그림은 public/avatars/{group}-{member}.webp, 높이 128px
export type AvatarGroup = "rescene" | "bts" | "ive" | "fromis" | "aespa" | "movie" | "drama" | "solo" | "anime" | "actor";
export interface AvatarMember {
  group: AvatarGroup;
  member: string;
  name: string;
  aspect: number; // 가로 ÷ 세로
  persona: Persona; // 말풍선 말투. 멤버별 템플릿이 생기기 전까지 가장 가까운 기본 말투를 쓴다
  trait: string; // 말풍선 머리에 보일 성격 한 줄
  seated?: { front: number; back: number; side?: number }; // 앉은 앞·뒤·옆(오른쪽을 봄) 그림의 가로 ÷ 세로. 없으면 앉아도 선 그림
  walk?: number; // 옆으로 걷는 그림(오른쪽을 봄)의 가로 ÷ 세로
  up?: number; // 위로 걷는 뒷모습 그림의 가로 ÷ 세로. 없으면 위로 걸어도 선 그림
}

const WALK: Record<string, number> = {
  "rescene/woni": 0.508, "rescene/liv": 0.484, "rescene/minami": 0.5, "rescene/may": 0.516, "rescene/zena": 0.484,
  "bts/rm": 0.453, "bts/jin": 0.477, "bts/suga": 0.453, "bts/jhope": 0.492, "bts/jimin": 0.453, "bts/v": 0.375, "bts/jungkook": 0.461,
  "ive/yujin": 0.516, "ive/gaeul": 0.469, "ive/rei": 0.484, "ive/wonyoung": 0.5, "ive/liz": 0.523, "ive/leeseo": 0.484,
  "fromis/hayoung": 0.5, "fromis/jiwon": 0.516, "fromis/chaeyoung": 0.469, "fromis/nakyung": 0.469, "fromis/jiheon": 0.484,
  "aespa/karina": 0.344, "aespa/winter": 0.398, "aespa/giselle": 0.359, "aespa/ningning": 0.398,
  "movie/jungwoosung": 0.383, "drama/saetbyul": 0.344, "drama/daehyeon": 0.391, "solo/iu": 0.344,
  "anime/kazama": 0.422, "anime/bo": 0.414, "anime/shinchan": 0.391, "actor/parkbogum": 0.328,
  "anime/nene": 0.398, "anime/masao": 0.414, "anime/ai": 0.422, "anime/shiro": 0.562,
};
const UP: Record<string, number> = {
  "rescene/woni": 0.492, "rescene/liv": 0.492, "rescene/minami": 0.594, "rescene/may": 0.742, "rescene/zena": 0.477,
  "bts/rm": 0.422, "bts/jin": 0.453, "bts/suga": 0.484, "bts/jhope": 0.492, "bts/jimin": 0.445, "bts/v": 0.367, "bts/jungkook": 0.477,
  "ive/yujin": 0.484, "ive/gaeul": 0.492, "ive/rei": 0.484, "ive/wonyoung": 0.523, "ive/liz": 0.742, "ive/leeseo": 0.469,
  "fromis/hayoung": 0.477, "fromis/jiwon": 0.539, "fromis/chaeyoung": 0.539, "fromis/nakyung": 0.547, "fromis/jiheon": 0.469,
  "aespa/karina": 0.375, "aespa/winter": 0.398, "aespa/giselle": 0.406, "aespa/ningning": 0.453,
  "movie/jungwoosung": 0.383, "drama/saetbyul": 0.383, "drama/daehyeon": 0.414, "solo/iu": 0.375,
  "anime/kazama": 0.414, "anime/bo": 0.469, "anime/shinchan": 0.43, "actor/parkbogum": 0.359,
  "anime/nene": 0.539, "anime/masao": 0.469, "anime/ai": 0.438, "anime/shiro": 0.641,
};

const m = (group: AvatarGroup, member: string, name: string, aspect: number, persona: Persona, trait: string, seated?: [number, number, number?]): AvatarMember => ({
  group,
  member,
  name,
  aspect,
  persona,
  trait,
  seated: seated && { front: seated[0], back: seated[1], side: seated[2] },
  walk: WALK[`${group}/${member}`],
  up: UP[`${group}/${member}`],
});

// 사무실 사람 가운데 아바타가 있는 39명(아이돌 다섯 그룹 27명과 영화·드라마·솔로·애니·배우 캐릭터 12명). 나머지는 그림이 없는 도비다
// 에스파 그림은 제미나이 시트에서 잘라 만든다(scripts/avatar-sheet-cut.py, avatar-sheet-build.py). 앉은 그림의 스툴은 그때 그려 넣는다
export const CREW: AvatarMember[] = [
  m("rescene", "woni", "원이", 0.5, "sunny", "밝은 분위기 리더", [0.516, 0.469, 0.539]),
  m("rescene", "liv", "리브", 0.508, "cool", "시크한 자신감파", [0.523, 0.516, 0.555]),
  m("rescene", "minami", "미나미", 0.555, "calm", "담백한 실무형", [0.625, 0.617, 0.586]),
  m("rescene", "may", "메이", 0.625, "sunny", "분위기 살리는 수다쟁이", [0.719, 0.758, 0.609]),
  m("rescene", "zena", "제나", 0.461, "sunny", "리액션 큰 막내", [0.484, 0.477, 0.516]),
  m("bts", "jungkook", "정국", 0.453, "sunny", "열정·승부욕", [0.469, 0.477, 0.477]),
  m("bts", "rm", "RM", 0.438, "calm", "분석적·차분한 리더", [0.438, 0.445, 0.453]),
  m("bts", "jin", "진", 0.453, "sunny", "유쾌한 맏형", [0.461, 0.438, 0.484]),
  m("bts", "suga", "슈가", 0.461, "cool", "시크·현실적", [0.461, 0.477, 0.461]),
  m("bts", "jhope", "제이홉", 0.5, "sunny", "초긍정 에너지", [0.492, 0.508, 0.539]),
  m("bts", "jimin", "지민", 0.461, "perfect", "섬세한 완벽주의", [0.461, 0.461, 0.453]),
  m("bts", "v", "뷔", 0.375, "sunny", "자유분방·엉뚱", [0.414, 0.422, 0.547]),
  m("ive", "yujin", "안유진", 0.5, "sunny", "초긍정 리더", [0.516, 0.461, 0.539]),
  m("ive", "gaeul", "가을", 0.492, "cool", "시크·속은 다정", [0.492, 0.516, 0.523]),
  m("ive", "rei", "레이", 0.5, "sunny", "마이페이스·반전", [0.516, 0.477, 0.555]),
  m("ive", "wonyoung", "장원영", 0.5, "perfect", "우아한 완벽주의", [0.523, 0.508, 0.539]),
  m("ive", "liz", "리즈", 0.625, "calm", "단단한 노력파", [0.789, 0.758, 0.617]),
  m("ive", "leeseo", "이서", 0.461, "sunny", "씩씩한 도전 정신", [0.461, 0.469, 0.523]),
  m("fromis", "hayoung", "송하영", 0.477, "calm", "든든한 부캡틴", [0.5, 0.516, 0.547]),
  m("fromis", "jiwon", "박지원", 0.523, "calm", "차분한 프로", [0.539, 0.531, 0.547]),
  m("fromis", "chaeyoung", "이채영", 0.523, "sunny", "활발·힙", [0.555, 0.516, 0.539]),
  m("fromis", "nakyung", "이나경", 0.523, "sunny", "밝고 상큼", [0.539, 0.531, 0.516]),
  m("fromis", "jiheon", "백지헌", 0.461, "sunny", "씩씩한 막내", [0.461, 0.469, 0.516]),
  m("aespa", "karina", "카리나", 0.391, "calm", "책임감 강한 리더", [0.398, 0.383, 0.523]),
  m("aespa", "winter", "윈터", 0.406, "cool", "조용한 승부사", [0.438, 0.438, 0.555]),
  m("aespa", "giselle", "지젤", 0.398, "sunny", "솔직한 분위기 메이커", [0.398, 0.383, 0.539]),
  m("aespa", "ningning", "닝닝", 0.461, "perfect", "자신감 넘치는 막내", [0.469, 0.469, 0.562]),
  m("movie", "jungwoosung", "정우성", 0.383, "cool", "말수 적은 반항아", [0.414, 0.414, 0.516]),
  m("drama", "saetbyul", "샛별", 0.383, "sunny", "씩씩한 편의점 알바", [0.406, 0.391, 0.516]),
  m("drama", "daehyeon", "대현", 0.414, "calm", "사람 좋은 점장", [0.453, 0.445, 0.555]),
  m("solo", "iu", "아이유", 0.375, "perfect", "꼼꼼한 올라운더", [0.398, 0.391, 0.539]),
  m("anime", "kazama", "철수", 0.43, "perfect", "똑 부러지는 모범생", [0.461, 0.469, 0.516]),
  m("anime", "bo", "맹구", 0.461, "calm", "느긋한 돌 수집가", [0.492, 0.531, 0.555]),
  m("anime", "shinchan", "짱구", 0.438, "sunny", "못 말리는 장난꾸러기", [0.469, 0.469, 0.531]),
  m("anime", "nene", "유리", 0.523, "perfect", "야무진 소꿉놀이 대장", [0.578, 0.602, 0.516]),
  m("anime", "masao", "훈이", 0.484, "calm", "마음 여린 울보", [0.523, 0.531, 0.562]),
  m("anime", "ai", "수지", 0.438, "cool", "도도한 부잣집 아가씨", [0.477, 0.477, 0.562]),
  m("anime", "shiro", "흰둥이", 0.641, "calm", "묵묵하고 똑똑한 강아지", [0.727, 0.727, 0.617]),
  m("actor", "parkbogum", "박보검", 0.367, "sunny", "다정한 예의 바른 청년", [0.375, 0.367, 0.523]),
];

// 옆모습 그림은 오른쪽을 본다. 왼쪽을 볼 때는 화면에서 좌우를 뒤집는다. walk 는 옆으로, up 은 위로 걷는 모습
// walk-l 은 왼쪽을 보고 선 옆모습이다. 걷는 그림(walk)을 좌우로 뒤집어 쓴다
export type Pose = "stand" | "walk" | "walk-l" | "up" | "front" | "back" | "side-r" | "side-l";
// 앉은 그림에는 스툴이 같이 그려져 있다. 앞 그림의 bare 는 무릎 아래(탁자 밑이라 안 보이는 다리)까지 잘랐다(scripts/avatar-bare-front.py). bare 는 스툴을 지운 그림(의자가 딸린 가구에 앉을 때). scripts/avatar-bare.py 로 만든다
export const avatarSrc = (a: AvatarMember, pose: Pose = "stand", bare = false) =>
  `/avatars/${a.group}-${a.member}${pose === "stand" ? "" : `-${pose.startsWith("side") ? "side" : pose}`}${bare && (pose === "front" || pose === "back" || pose.startsWith("side")) ? "-bare" : ""}.webp`;
// 그 캐릭터에게 그림이 있는 자세 전부. 미리 받아 둘 때 쓴다
export const avatarSrcs = (a: AvatarMember) =>
  (["stand", ...(a.walk ? ["walk"] : []), ...(a.up ? ["up"] : []), ...(a.seated ? ["front", "back", ...(a.seated.side ? ["side-r"] : [])] : [])] as Pose[]).flatMap((p) => (p === "front" || p === "back" || p === "side-r" ? [avatarSrc(a, p), avatarSrc(a, p, true)] : [avatarSrc(a, p)]));
