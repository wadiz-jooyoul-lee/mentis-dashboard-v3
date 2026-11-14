/**
 * aespa(에스파) 멤버 아바타 정본. 리센느와 같은 실사진 방식이지만 멤버마다 사진이 한 장뿐이라
 * 상태(대기·분석·구현·리뷰·완료)가 바뀌어도 같은 사진을 쓴다. 출처는 public/avatars/aespa/SOURCES.md.
 * 사진이 머리 중심 정사각이라 focal 없이 중앙(50% 50%)이면 된다.
 * 멤버 키는 한국어 이름(다른 그룹과 동일 규약) — avatarAssign 풀·소개 카드·GroupAvatar가 이 키로 참조한다.
 *
 * 그룹: 2020-11-17 데뷔, SM엔터테인먼트, 4인조 다국적(한국 2·일본 1·중국 1).
 */
export type AespaCfg = {
  slug: string; // 파일명(ascii)
  color: string; // 시그니처 색(링·카드 태그 공용)
  real: string;
  birth: string;
  nation: string;
  pos: string;
};

export const AESPA_AVATARS: Record<string, AespaCfg> = {
  카리나: { slug: "karina", color: "#7B61FF", real: "유지민", birth: "2000-04-11", nation: "대한민국", pos: "리더" },
  윈터: { slug: "winter", color: "#4FC3F7", real: "김민정", birth: "2001-01-01", nation: "대한민국", pos: "보컬" },
  지젤: { slug: "giselle", color: "#E53935", real: "우치나가 에리", birth: "2000-10-30", nation: "일본", pos: "래퍼" },
  닝닝: { slug: "ningning", color: "#F48FB1", real: "닝이줘", birth: "2002-10-23", nation: "중국", pos: "보컬·막내" },
};

/** 멤버 → 시그니처 색(없으면 null). */
export function aespaColor(member: string): string | null {
  return AESPA_AVATARS[member]?.color ?? null;
}

/** 사진 경로(public 기준). 표정 사진이 따로 없어 상태와 무관하게 한 장이다. */
export function aespaSrc(slug: string): string {
  return `/avatars/aespa/${slug}.jpeg`;
}
