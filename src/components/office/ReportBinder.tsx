"use client";
import { useEffect, useState } from "react";
import { FOLDER_COLORS } from "@/lib/office/ui/folders";
import type { Reports } from "@/lib/office/core/report";
import { CloseX } from "@/components/office/CloseX";

const DAY = ["일", "월", "화", "수", "목", "금", "토"];
const today = () => {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} (${DAY[d.getDay()]})`;
};

// 보고서 캐비닛을 누르면 여는 A4 서류철 모양 창. 해결되지 않은 작업마다 처리 결과, 사람이 할 일, 다음 추천을 보이고 5초마다 다시 읽는다
export function ReportBinder({ name, onClose, onAct, onOpen }: { name: string; onClose: () => void; onAct: (key: string, kind: "human" | "confirm") => void; onOpen: (key: string) => void }) {
  const [r, setR] = useState<Reports | null>(null);
  const [err, setErr] = useState(false);
  const [copied, setCopied] = useState("");
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch(`/api/office/reports`, { cache: "no-store" })
        .then((x) => (x.ok ? (x.json() as Promise<Reports>) : Promise.reject()))
        .then((j) => alive && (setR(j), setErr(false)))
        .catch(() => alive && setErr(true));
    void load();
    const timer = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [name]);
  const copy = async (cmd: string) => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(cmd);
    } catch {}
  };
  return (
    <div className="report-binder" role="dialog" aria-label="작업 보고서">
      <span className="binder-holes" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <CloseX onClick={onClose} />
      <h4>작업 보고서 · {today()}</h4>
      {err && !r && <p role="alert">보고서를 불러오지 못했습니다.</p>}
      {!r && !err && <p>보고서를 불러오는 중입니다.</p>}
      {r && (
        <>
          <section className="report-top" aria-label="지금 할 일">
            <b>지금 할 일</b>
            <p>{r.top}</p>
          </section>
          {!r.items.length && <p>해결되지 않은 작업이 없습니다.</p>}
          <ul className="report-list">
            {r.items.map((i) => (
              <li key={i.key}>
                <button type="button" className="report-head" onClick={() => onOpen(i.key)} aria-label={`${i.key} ${i.title} 열기`}>
                  <span className="report-chip" style={{ background: FOLDER_COLORS[i.color % FOLDER_COLORS.length] }} aria-hidden="true" />
                  <b>{i.key}</b>
                  <span className="report-title">{i.title}</span>
                  {i.where !== "cabinet" && <small className="report-live">진행 중</small>}
                  <small className="report-phase">{i.phase}</small>
                </button>
                <dl>
                  <dt>처리 결과</dt>
                  <dd>{i.result}</dd>
                  <dt>사람이 할 일</dt>
                  <dd className={i.human ? "report-human" : undefined}>
                    {i.human || "없음"}
                    {i.human && i.humanKind && (
                      <button type="button" className="report-act" aria-label={i.humanKind === "human" ? `${i.key} 사람 확인 열기` : `${i.key} 완료 확인 열기`} onClick={() => onAct(i.key, i.humanKind!)}>
                        {i.humanKind === "human" ? "?" : "!"}
                      </button>
                    )}
                  </dd>
                  <dt>다음 추천</dt>
                  <dd>
                    {i.next}
                    {i.cmd && (
                      <span className="report-cmd">
                        <code>{i.cmd}</code>
                        <button type="button" onClick={() => void copy(i.cmd!)}>
                          {copied === i.cmd ? "복사했습니다" : "복사"}
                        </button>
                      </span>
                    )}
                  </dd>
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
