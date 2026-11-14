// aespa(에스파) 멤버 에이전트용 실사진 아바타. 원형 크롭 + 시그니처 색 링.
// 멤버마다 사진이 한 장이라 작업 상태가 바뀌어도 같은 사진을 보인다(state 는 다른 그룹과 맞춘 자리만 둔다).
// 사진은 얼굴 중심 정사각(로컬 전용, public/avatars/aespa/)이라 초점은 항상 중앙이다.
// 알 수 없는 멤버면 null(호출부에서 폴백).

import { AESPA_AVATARS, aespaSrc } from "@/lib/aespa";

export { AESPA_AVATARS };

export default function AespaAvatar({
  member,
  size = 56,
}: {
  member: string;
  size?: number;
  /** 다른 그룹 아바타와 같은 모양으로 받기만 한다. 표정 사진이 없어 쓰지 않는다. */
  state?: string;
}) {
  const cfg = AESPA_AVATARS[member];
  if (!cfg) return null;
  const ring = Math.max(2, Math.round(size * 0.05));
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        padding: ring,
        background: cfg.color,
        flexShrink: 0,
        lineHeight: 0,
      }}
      aria-label={`${member} 아바타`}
      role="img"
    >
      <img
        src={aespaSrc(cfg.slug)}
        alt={member}
        width={size - ring * 2}
        height={size - ring * 2}
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          objectFit: "cover",
          objectPosition: "50% 50%",
          border: "2px solid rgba(255,255,255,0.85)",
          display: "block",
        }}
      />
    </span>
  );
}
