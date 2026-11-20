import { useId } from "react";

/** 제목 옆 버전 표시. 포인트 색 그러데이션 알약에 손글씨풍 v3 와 반짝임. 색은 style 로 넘겨야 var() 가 먹는다. */
export default function V3Badge() {
  const id = useId().replace(/:/g, "");
  return (
    <svg className="ui-v3" width="40" height="22" viewBox="0 0 40 22" role="img" aria-label="버전 3">
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "color-mix(in srgb, var(--accent) 80%, #ffffff)" }} />
          <stop offset="1" style={{ stopColor: "color-mix(in srgb, var(--accent) 70%, #1f1e1b)" }} />
        </linearGradient>
        <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".45" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="1" y="2" width="34" height="18" rx="9" fill={`url(#${id}-fill)`} />
      <rect x="3" y="3" width="30" height="7" rx="3.5" fill={`url(#${id}-shine)`} />
      <g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" style={{ stroke: "var(--accent-fg)" }}>
        <path d="M8.5 7.5 L12 15 L15.5 7.5" />
        <path d="M19.5 7.6 C21.5 6.4 25.2 6.6 25.2 9 C25.2 10.5 23.6 11 22.4 11 C24 11 25.8 11.6 25.8 13.2 C25.8 15.6 21.8 15.9 19.3 14.6" />
      </g>
      <path
        d="M35.5 1 L36.4 3.6 L39 4.5 L36.4 5.4 L35.5 8 L34.6 5.4 L32 4.5 L34.6 3.6 Z"
        style={{ fill: "color-mix(in srgb, var(--accent) 60%, #ffd76a)" }}
      />
    </svg>
  );
}
