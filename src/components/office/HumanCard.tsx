"use client";
import { useEffect, useRef } from "react";
import { CloseX } from "@/components/office/CloseX";
import type { TaskState } from "@/lib/office/core/types";

// 작업 탁자를 눌렀을 때 대시보드로 옮겨 가기 전에 한 번 묻는다
export function OpenDashCard({ task, url, onClose }: { task: TaskState; url: string; onClose: () => void }) {
  const okRef = useRef<HTMLButtonElement>(null);
  useEffect(() => okRef.current?.focus(), []);
  const key = task.retroOf ?? task.key;
  return (
    <div className="art-card" role="alertdialog" aria-label={`${key} 대시보드 열기`}>
      <CloseX onClick={onClose} />
      <div className="kick">대시보드 열기</div>
      <h4>{key} 대시보드를 열까요?</h4>
      <p>{task.retroOf ? "이 오더의 회고 화면" : "이 오더의 상세 화면"}을 새 탭으로 엽니다.</p>
      <div className="row">
        <button
          ref={okRef}
          type="button"
          onClick={() => {
            window.open(url, "_blank", "noopener");
            onClose();
          }}
        >
          열기
        </button>
        <button type="button" onClick={onClose}>
          취소
        </button>
      </div>
    </div>
  );
}
