import type { CSSProperties } from "react";

/** 도는 표시. antd Spin 대체. 모양은 Button 안 스피너(.ui-spin)와 같은 것을 쓴다. */
export default function Spinner({
  size = "md",
  label,
  style,
}: {
  size?: "sm" | "md" | "lg";
  label?: string;
  style?: CSSProperties;
}) {
  const px = size === "sm" ? 12 : size === "lg" ? 28 : 18;
  return (
    <span className="ui-spinner" role="status" style={style}>
      <span className="ui-spin" style={{ width: px, height: px, color: "var(--accent)" }} aria-hidden />
      {label && <span className="ui-sm">{label}</span>}
    </span>
  );
}
