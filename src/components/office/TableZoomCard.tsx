"use client";
import { useEffect, useRef, useState } from "react";
import type { TaskState } from "@/lib/office/core/types";
import type { Box } from "@/components/office/OfficeFloor";
import { CloseX } from "@/components/office/CloseX";
import { TableCrewView } from "@/components/office/TableCrewView";
import { DobbyCard } from "@/components/office/DobbyCard";

// 사무실 그림을 복사해 넣고, 원본이 바뀐 곳만 복사본에서 따라 바꾼다
function useMirror(target: React.RefObject<SVGGElement | null>) {
  useEffect(() => {
    const scene = document.getElementById("office-scene"), out = target.current;
    if (!scene || !out) return;
    const map = new WeakMap<Node, Node>();
    // 원본 노드를 깊게 복사하고 원본과 복사본을 짝지어 둔다
    const copy = (src: Node) => {
      const c = src.cloneNode(true);
      const a = document.createTreeWalker(src), b = document.createTreeWalker(c);
      for (let x: Node | null = a.currentNode, y: Node | null = b.currentNode; x && y; x = a.nextNode(), y = b.nextNode()) map.set(x, y);
      return c;
    };
    const root = copy(scene) as Element;
    root.removeAttribute("id");
    out.replaceChildren(root);
    const obs = new MutationObserver((list) => {
      for (const m of list) {
        // 짝이 없으면 새로 생긴 묶음 안이라, 그 묶음을 복사할 때 이미 지금 모습으로 들어갔다
        const twin = map.get(m.target);
        if (!twin) continue;
        if (m.type === "childList") {
          m.removedNodes.forEach((n) => (map.get(n) as ChildNode | undefined)?.remove());
          // 자리를 옮긴 노드는 복사본도 옮기기만 한다. 넣을 자리는 그 변경이 일어난 때의 다음 형제 앞
          const ref = (m.nextSibling && map.get(m.nextSibling)) ?? null;
          m.addedNodes.forEach((n) => twin.insertBefore(map.get(n) ?? copy(n), ref));
        } else if (m.type === "characterData") twin.nodeValue = m.target.nodeValue;
        else {
          const v = (m.target as Element).getAttribute(m.attributeName!);
          if (v == null) (twin as Element).removeAttribute(m.attributeName!);
          else (twin as Element).setAttribute(m.attributeName!, v);
        }
      }
    });
    obs.observe(scene, { subtree: true, childList: true, attributes: true, characterData: true });
    return () => obs.disconnect();
  }, [target]);
}

// 작업 탁자 확대 창. 사람·깃발 움직임이 같이 보인다
export function TableZoomCard({ name, task, box, onClose }: { name: string; task: TaskState; box: Box; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const mirror = useRef<SVGGElement>(null);
  const [mode, setMode] = useState<"table" | "crew">("table");
  const [asking, setAsking] = useState(false); // 카드 보기에서 연 질문 창
  useEffect(() => closeRef.current?.focus(), []);
  useMirror(mirror);
  return (
    <>
      {asking && <DobbyCard name={name} task={task} onClose={() => setAsking(false)} />}
      {/* 질문 창이 떠 있는 동안 확대 창은 지우지 않고 숨긴다. 지우면 탁자 그림 복사본이 더는 따라 바뀌지 않는다 */}
      <div className="art-card zoom-card" role="dialog" aria-label={`${task.key} 탁자 크게 보기`} style={asking ? { display: "none" } : undefined}>
        <CloseX onClick={onClose} />
        <div className="zoom-tabs" role="tablist">
          {([["table", "탁자 보기"], ["crew", "카드 보기"]] as const).map(([k, n]) => (
            <button key={k} type="button" role="tab" aria-selected={mode === k} className={mode === k ? "on" : undefined} onClick={() => setMode(k)}>
              {n}
            </button>
          ))}
        </div>
        {mode === "table" && (
          <h4>
            {task.key} {task.title}
          </h4>
        )}
        {mode === "crew" && <TableCrewView name={name} taskId={task.id} onAsk={() => setAsking(true)} />}
        {/* 복사본은 창이 열린 동안 계속 따라 바꾸므로 카드 보기에서도 지우지 않고 숨긴다 */}
        <svg className="zoom-view" viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} style={{ aspectRatio: `${box.w} / ${box.h}`, display: mode === "table" ? undefined : "none" }} aria-hidden>
          <g ref={mirror} pointerEvents="none" />
        </svg>
        <div className="row">
          <button ref={closeRef} type="button" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </>
  );
}
