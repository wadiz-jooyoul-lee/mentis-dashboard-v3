import type { CSSProperties, ReactNode } from "react";
import { Inbox } from "lucide-react";

/** 비어 있음 표시. antd Empty 대체. compact 면 아이콘을 작게(antd 의 PRESENTED_IMAGE_SIMPLE 자리). */
export default function Empty({
  description = "데이터가 없습니다",
  compact = false,
  style,
  children,
}: {
  description?: ReactNode;
  compact?: boolean;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  return (
    <div className={["ui-empty", compact ? "is-compact" : ""].filter(Boolean).join(" ")} style={style}>
      <Inbox size={compact ? 22 : 34} strokeWidth={1.25} className="ui-empty-icon" />
      <div className="ui-empty-desc">{description}</div>
      {children && <div className="ui-empty-extra">{children}</div>}
    </div>
  );
}
