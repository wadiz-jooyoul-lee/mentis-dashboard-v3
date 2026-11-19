import type { Ref } from "react";

// 창 오른쪽 위 닫기 버튼. 모든 창이 같은 자리에 둔다
export function CloseX({ onClick, ref }: { onClick: () => void; ref?: Ref<HTMLButtonElement> }) {
  return (
    <button ref={ref} type="button" className="close-x" aria-label="닫기" title="닫기" onClick={onClick}>
      ×
    </button>
  );
}
