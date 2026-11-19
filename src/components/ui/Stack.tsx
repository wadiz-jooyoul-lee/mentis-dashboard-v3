import type { CSSProperties, ReactNode } from "react";

/*
 * 간격을 둔 나란히 놓기(flex + gap). antd Space 를 대체한다.
 * - size: 숫자 하나면 가로·세로 같은 간격, [가로, 세로] 면 따로. "small"=8 "middle"=12 "large"=20.
 * - vertical(또는 antd 이름 그대로 orientation/direction="vertical"): 세로 쌓기.
 * - 가로는 antd 와 같게 기본 세로 가운데 정렬, 세로는 늘이지 않고 시작 정렬.
 */
type Size = number | "small" | "middle" | "large";
const px = (s: Size) => (typeof s === "number" ? s : s === "small" ? 8 : s === "middle" ? 12 : 20);

export default function Stack({
  size = 8,
  vertical,
  orientation,
  direction,
  wrap = false,
  align,
  block = false,
  className,
  style,
  title,
  onClick,
  children,
}: {
  size?: Size | [Size, Size];
  vertical?: boolean;
  orientation?: "horizontal" | "vertical";
  direction?: "horizontal" | "vertical";
  wrap?: boolean;
  align?: "start" | "end" | "center" | "baseline";
  block?: boolean;
  className?: string;
  style?: CSSProperties;
  title?: string;
  onClick?: () => void;
  children?: ReactNode;
}) {
  const isV = vertical || orientation === "vertical" || direction === "vertical";
  const [gx, gy] = Array.isArray(size) ? [px(size[0]), px(size[1])] : [px(size), px(size)];
  const al = align ?? (isV ? undefined : "center");
  const st: CSSProperties = {
    display: isV || block ? "flex" : "inline-flex",
    flexDirection: isV ? "column" : "row",
    flexWrap: wrap ? "wrap" : undefined,
    alignItems: al === "start" ? "flex-start" : al === "end" ? "flex-end" : al,
    columnGap: gx,
    rowGap: gy,
    minWidth: 0,
    ...style,
  };
  return (
    <div className={["ui-stack", className ?? ""].filter(Boolean).join(" ")} style={st} title={title} onClick={onClick}>
      {children}
    </div>
  );
}
