"use client";
import { useState } from "react";
import type { TaskState } from "@/lib/office/core/types";
import { CloseX } from "@/components/office/CloseX";

const when = (at: number) => {
  const d = new Date(at);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const post = (name: string, taskId: string, hold: boolean) =>
  fetch(`/api/office/hold/${encodeURIComponent(taskId)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ hold }) });

// 깃발의 홀딩 단추를 눌렀을 때. 화면에서만 홀딩하며 진행 중인 일은 그대로 이어진다
export function HoldAskCard({ name, task, dobby, onClose }: { name: string; task: TaskState; dobby?: boolean; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="art-card" role="dialog" aria-label={`${task.key} 홀딩`} aria-busy={busy}>
      <div className="kick">홀딩</div>
      <h4>
        {task.key} · {task.title}
      </h4>
      <p>
        {dobby
          ? "자리를 걷고 프론트 도비의 홀딩 탭으로 옮길까요? 화면에서만 옮기며, 진행 중인 일은 멈추지 않습니다. 홀딩 탭에서 다시 시작을 누르면 담당자들이 다시 모입니다."
          : "테이블을 걷고 홀딩 게시판으로 옮길까요? 화면에서만 옮기며, 진행 중인 일은 멈추지 않습니다. 홀딩 게시판에서 다시 시작을 누르면 테이블로 돌아옵니다."}
      </p>
      <div className="row">
        <button type="button" className="primary" disabled={busy} onClick={() => (setBusy(true), void post(name, task.id, true).finally(onClose))}>
          홀딩
        </button>
        <button type="button" onClick={onClose}>
          취소
        </button>
      </div>
    </div>
  );
}

// 홀딩 게시판의 쪽지 목록. 사람 답이 필요한 작업이 위에 온다. 다시 시작을 누르면 테이블로 돌아가고, 사람 차례인 작업은 여기서 답할 수 있다
// bare: 프론트 데스크 창의 탭 안에 넣을 때. 겉 틀(닫기, 머리말)을 빼고 목록만 그린다. 도비 사무실은 테이블 대신 "자리"라고 쓴다
export function HoldCard({ name, held, onAnswer, onClose, bare }: { name: string; held: TaskState[]; onAnswer: (t: TaskState) => void; onClose: () => void; bare?: boolean }) {
  const [busy, setBusy] = useState("");
  const list = [...held].sort((a, b) => Number(!!b.human) - Number(!!a.human) || b.hold!.at - a.hold!.at);
  const asks = list.filter((t) => t.human).length;
  return (
    <div className={bare ? "desk-tab" : "art-card done-card"} role={bare ? undefined : "dialog"} aria-label={bare ? undefined : "홀딩 게시판"}>
      {!bare && <CloseX onClick={onClose} />}
      {!bare && <div className="kick">홀딩 게시판</div>}
      <h4>
        멈춰 둔 작업 {list.length}건{asks > 0 && <span className="hold-ask-count"> · 사람 답이 필요한 작업 {asks}건</span>}
      </h4>
      <p className="done-lead">{bare ? "자리를 걷어 둔 작업입니다. 다시 시작을 누르면 담당자들이 다시 모입니다." : "테이블을 걷어 둔 작업입니다. 다시 시작을 누르면 테이블로 돌아갑니다."} 화면에서만 걷어 두며 진행 중인 일은 멈추지 않습니다.</p>
      {list.length ? (
        <ul className="done-list">
          {list.map((t) => (
            <li key={t.id}>
              <div className={`done-note hold-note${t.human ? " ask" : ""}`}>
                <span className="done-top">
                  {t.human && <span className="hold-ask">❓ 답 필요</span>}
                  <span className="done-key">{t.key}</span>
                  {t.phase && <span className="hold-phase">{t.phase}</span>}
                </span>
                <span className="done-title">{t.title}</span>
                <span className="hold-why">
                  ⏸ {t.hold!.by === "auto" ? "하루 넘게 멈춰 자동 홀딩" : "직접 홀딩"} · {when(t.hold!.at)}
                </span>
                <span className="hold-actions">
                  {t.human && (
                    <button type="button" onClick={() => onAnswer(t)}>
                      ❓ 답하기
                    </button>
                  )}
                  <button type="button" className="primary" disabled={busy === t.id} onClick={() => (setBusy(t.id), void post(name, t.id, false).finally(() => setBusy("")))}>
                    다시 시작
                  </button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p>홀딩한 작업이 없습니다.</p>
      )}
      <div className="done-bottom">
        <p>하루 넘게 움직임이 없는 작업은 자동으로 이리 옵니다. 자동 홀딩은 일이 다시 움직이면 저절로 풀립니다.</p>
        {!bare && (
          <button type="button" onClick={onClose}>
            닫기
          </button>
        )}
      </div>
    </div>
  );
}
