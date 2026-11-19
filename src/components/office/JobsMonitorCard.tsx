"use client";
import { useCallback, useEffect, useState } from "react";
import { CloseX } from "@/components/office/CloseX";
import type { JobsSummary } from "@/lib/office/jobs";

const KINDS = ["새로 생김", "진행 시작", "해결됨", "종료"];
const hm = (s?: string | null) => (s ? `${s.slice(5, 10)} ${s.slice(11, 16)}` : "없음");

// 왼쪽 모니터 창: 팀 이슈 조사 요약과 지금 조사. 큰 표는 대시보드로 넘긴다
export function JobsMonitorCard({ name, onClose }: { name: string; onClose: () => void }) {
  const [s, setS] = useState<JobsSummary | null>(null);
  const [note, setNote] = useState("");
  const [ask, setAsk] = useState(false);
  const api = `/api/office/dobby-jobs`;
  const load = useCallback(() => fetch(api, { cache: "no-store" }).then((r) => r.json()).then(setS).catch(() => setNote("조사 상태를 읽지 못했습니다.")), [api]);
  useEffect(() => void load(), [load]);
  const running = !!s?.status?.running;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [running, load]);

  async function run() {
    const r = await fetch(api, { method: "POST" }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as { result?: string; error?: string } | null;
    setNote(j?.result ?? j?.error ?? "시작하지 못했습니다.");
    void load();
  }

  const st = s?.status;
  const doneToday = st?.lastSuccess?.slice(0, 10) === new Date().toISOString().slice(0, 10);
  return (
    <div className="art-card jobs-card" role="dialog" aria-label="팀 이슈 현황">
      <CloseX onClick={onClose} />
      <div className="kick">왼쪽 모니터</div>
      <h4>팀 이슈 현황</h4>
      <div className="jobs-meta">
        <span>마지막 조사 <b>{hm(st?.lastSuccess)}</b></span>
        <span>다음 자동 조사 <b>{hm(st?.nextAuto)}</b></span>
      </div>
      {st?.lastError && <p className="jobs-err">{st.lastError}</p>}
      {s?.counts ? (
        <div className="jobs-nums">
          {KINDS.map((k) => (
            <div key={k}>
              <span>{k}</span>
              <strong>{s.counts?.[k] ?? 0}</strong>
            </div>
          ))}
        </div>
      ) : s?.mode === "baseline" ? (
        <p>처음 조사라 기준 정리를 했습니다. 다음 조사부터 바뀐 이슈 수가 보입니다.</p>
      ) : s && !s.until ? (
        <p>아직 조사 기록이 없습니다.</p>
      ) : null}
      {s?.crit && s.crit.length > 0 ? (
        <div className="jobs-alert">
          <b>내 오더와 충돌 주의 {s.crit.length}건</b>
          {s.crit.slice(0, 3).map((c) => (
            <span key={c.issue + c.order}>
              {c.issue} {c.summary.length > 34 ? `${c.summary.slice(0, 34)}…` : c.summary} ({c.assignee}) · {c.order}와 같은 파일
            </span>
          ))}
        </div>
      ) : s?.until ? (
        <p className="jobs-ok">남의 작업 중 내 오더와 같은 파일을 고친 것이 없습니다.</p>
      ) : null}
      {note && <p role="status">{note}</p>}
      <div className="row">
        <a href="/team-jobs" target="_blank" rel="noopener noreferrer">
          대시보드에서 자세히 보기
        </a>
        <span className="sp" />
        {ask ? (
          <>
            <span>오늘 이미 조사했습니다. 다시 조사할까요?</span>
            <button type="button" onClick={() => setAsk(false)}>취소</button>
            <button type="button" className="primary" onClick={() => (setAsk(false), void run())}>다시 조사</button>
          </>
        ) : (
          <button type="button" className="primary" disabled={!s || running} onClick={() => (doneToday ? setAsk(true) : void run())}>
            {running ? "조사 중…" : doneToday ? "다시 조사" : "지금 조사"}
          </button>
        )}
      </div>
    </div>
  );
}
