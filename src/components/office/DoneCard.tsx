"use client";
import { useState } from "react";
import type { TaskState } from "@/lib/office/core/types";
import { CloseX } from "@/components/office/CloseX";

const when = (at: number) => {
  const d = new Date(at);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// 완료 게시판의 쪽지 목록. 최근 해산한 작업이 위에 온다. 쪽지를 누르면 그 작업의 펼친 책이 열리고 "NEW" 표시가 사라진다
// bare: 프론트 데스크 창의 탭 안에 넣을 때. 겉 틀(닫기, 머리말)을 빼고 목록만 그린다
export function DoneCard({ name, dobby, notes, onOpen, onClose, bare }: { name: string; dobby?: boolean; notes: TaskState[]; onOpen: (t: TaskState) => void; onClose: () => void; bare?: boolean }) {
  const list = [...notes].sort((a, b) => b.note!.at - a.note!.at);
  const fresh = list.filter((t) => !t.note!.seen).length;
  return (
    <div className={bare ? "desk-tab" : "art-card done-card"} role={bare ? undefined : "dialog"} aria-label={bare ? undefined : "완료 게시판"}>
      {!bare && <CloseX onClick={onClose} />}
      {!bare && <div className="kick">완료 게시판</div>}
      <h4>
        해결 처리를 기다리는 작업 {list.length}건{fresh > 0 && <span className="done-fresh"> · 새로 붙은 쪽지 {fresh}장</span>}
      </h4>
      <p className="done-lead">
        {dobby
          ? "검증을 모두 통과했거나, 검증 없이 맡은 일을 모두 마쳐 테이블을 해산한 작업입니다. 라이브에 배포되고 문제가 없으면(문서나 조사는 결과를 확인한 뒤) 해결 처리를 눌러 주세요. 쪽지가 책이 되어 책장으로 갑니다."
          : "검증을 모두 통과해 테이블을 해산한 작업입니다. 라이브에 배포되고 문제가 없으면 해결 처리를 눌러 주세요. 쪽지가 책이 되어 책장으로 갑니다."}
      </p>
      {list.length ? (
        <ul className="done-list">
          {list.map((t) => (
            <li key={t.id} className={`done-note${t.note!.seen ? "" : " new"}`}>
              <button type="button" className="done-open" onClick={() => onOpen(t)}>
                <span className="done-top">
                  {!t.note!.seen && <span className="done-new">NEW</span>}
                  <span className="done-key">{t.key}</span>
                  <span className="done-round">{t.note!.round ? `✓ ${t.note!.round}회차 검증 통과` : "✓ 맡은 일을 모두 마침"}</span>
                </span>
                <span className="done-title">{t.title}</span>
                <span className="done-foot">
                  <span>{when(t.note!.at)} 테이블 해산</span>
                  <span aria-hidden="true">작업 기록 보기 ›</span>
                </span>
              </button>
              {dobby && <Resolve name={name} taskKey={t.key} tested={!!t.note!.round} />}
            </li>
          ))}
        </ul>
      ) : (
        <p>{dobby ? "아직 끝난 작업이 없습니다." : "아직 검증을 통과한 작업이 없습니다."}</p>
      )}
      <div className="done-bottom">
        <p>쪽지를 누르면 그 작업의 기록이 열리고 &quot;새&quot; 표시가 사라집니다.</p>
        {!bare && (
          <button type="button" onClick={onClose}>
            닫기
          </button>
        )}
      </div>
    </div>
  );
}

// 쪽지 아래 해결 처리 줄. 잘못 누르지 않게 확인을 한 번 더 받고, 대시보드의 해결 표시를 부른다
// tested: 검증을 통과한 작업. 검증 없이 끝난 작업(문서, 조사, 검증이 필요 없는 변경)은 확인 문구가 다르다
function Resolve({ name, taskKey, tested }: { name: string; taskKey: string; tested: boolean }) {
  const [step, setStep] = useState<"idle" | "confirm" | "busy" | "done">("idle");
  const [err, setErr] = useState("");

  async function run() {
    setStep("busy");
    setErr("");
    const r = await fetch(`/api/office/resolve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: taskKey }),
    }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as { error?: string } | null;
    if (r?.ok) return setStep("done");
    setErr(j?.error ?? "해결 처리를 하지 못했습니다.");
    setStep("confirm");
  }

  if (step === "done")
    return (
      <p className="done-resolve ok" role="status">
        ✓ 해결로 표시했습니다. 곧 책장으로 갑니다.
      </p>
    );
  if (step === "idle")
    return (
      <div className="done-resolve">
        <button type="button" onClick={() => setStep("confirm")}>
          해결 처리
        </button>
      </div>
    );
  return (
    <div className="done-resolve ask" aria-busy={step === "busy"}>
      <span>{taskKey}를 해결로 표시할까요? {tested ? "라이브 배포 뒤 문제가 없을 때만 누르세요." : "결과를 확인한 뒤에 누르세요."}</span>
      {err && <span role="alert">{err}</span>}
      <span className="done-resolve-btns">
        <button type="button" className="primary" disabled={step === "busy"} onClick={run}>
          {step === "busy" ? "처리 중…" : "해결로 표시"}
        </button>
        <button type="button" disabled={step === "busy"} onClick={() => (setStep("idle"), setErr(""))}>
          취소
        </button>
      </span>
    </div>
  );
}
