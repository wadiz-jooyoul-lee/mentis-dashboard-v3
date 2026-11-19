"use client";
import { useRef, useState, type KeyboardEvent } from "react";
import type { TaskState } from "@/lib/office/core/types";
import { CloseX } from "@/components/office/CloseX";
import { DoneCard } from "@/components/office/DoneCard";
import { HoldCard } from "@/components/office/HoldCard";

type Tab = "done" | "hold";

// 도비 사무실 프론트 데스크 창(프론트 도비를 누르면 열린다). 완료 쪽지와 홀딩한 작업을 탭 둘로 나눠 본다.
// 처음 여는 탭: 안 본 완료 쪽지가 있으면 완료, 아니면 사람 답을 기다리는 홀딩이 있으면 홀딩, 아니면 완료
export function FrontDeskCard({ name, notes, held, onOpen, onAnswer, onClose }: { name: string; notes: TaskState[]; held: TaskState[]; onOpen: (t: TaskState) => void; onAnswer: (t: TaskState) => void; onClose: () => void }) {
  const fresh = notes.filter((t) => !t.note?.seen).length;
  const [tab, setTab] = useState<Tab>(() => (fresh > 0 ? "done" : held.some((t) => t.human) ? "hold" : "done"));
  const refs = useRef<Record<Tab, HTMLButtonElement | null>>({ done: null, hold: null });
  const tabs: { id: Tab; label: string }[] = [
    { id: "done", label: `완료 ${notes.length}${fresh ? ` · 새 ${fresh}` : ""}` },
    { id: "hold", label: `홀딩 ${held.length}${held.some((t) => t.human) ? " · ❓" : ""}` },
  ];
  // 화살표 키로 탭을 옮긴다
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const next: Tab = tab === "done" ? "hold" : "done";
    setTab(next);
    refs.current[next]?.focus();
  };
  return (
    <div className="art-card done-card desk-card" role="dialog" aria-label="프론트 데스크">
      <CloseX onClick={onClose} />
      <div className="kick">프론트 데스크</div>
      <div className="desk-tabs" role="tablist" aria-label="완료와 홀딩" onKeyDown={onKey}>
        {tabs.map((t) => (
          <button
            key={t.id}
            ref={(el) => void (refs.current[t.id] = el)}
            type="button"
            role="tab"
            id={`desk-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`desk-panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            className={tab === t.id ? "on" : undefined}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`desk-panel-${tab}`} aria-labelledby={`desk-tab-${tab}`}>
        {tab === "done" ? <DoneCard bare name={name} dobby notes={notes} onOpen={onOpen} onClose={onClose} /> : <HoldCard bare name={name} held={held} onAnswer={onAnswer} onClose={onClose} />}
      </div>
      <div className="row">
        <button type="button" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  );
}
