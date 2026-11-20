/** 포인트 색 계산. 서버(레이아웃)와 설정 창이 함께 쓴다. */

export const DEFAULT_ACCENT = "#c15f3c";
export const INK = "#1f1e1b";

export const ACCENT_PRESETS: { name: string; value: string }[] = [
  { name: "테라코타", value: DEFAULT_ACCENT },
  { name: "파랑", value: "#2b5fd9" },
  { name: "초록", value: "#2f7d5c" },
  { name: "보라", value: "#7048e8" },
  { name: "회색", value: "#4a4741" },
];

export const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);

function luminance(hex: string): number {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = ch.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** 두 색의 명도 대비(1~21). 웹 접근성 기준 계산식. */
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** 포인트 색 바탕 위 글자 색 — 흰색과 먹색 중 대비가 큰 쪽. */
export const accentFg = (accent: string) => (contrast(accent, "#ffffff") >= contrast(accent, INK) ? "#ffffff" : INK);

/** 흰 바탕 위 글자로 쓰기에 흐린가(대비 3:1 미만). */
export const tooLight = (accent: string) => contrast(accent, "#ffffff") < 3;
