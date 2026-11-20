"use client";
import { useEffect, useState } from "react";
import { useOffice } from "@/lib/office/ui/store";
import { bandOfPhase } from "@/lib/office/ui/workTable";
import { DOBBY_ALL_ROLES, ROLE_NAME, type Progress, type SeatRole, type TableRole, type TaskState } from "@/lib/office/core/types";
import type { CrewDetail, CrewDetailRow } from "@/lib/office/crewDetail";
import { BAND_NAMES, fillOf } from "@/components/office/OfficeFloor";
import { OfficeAgent } from "@/components/office/OfficeAgent";

const noBind = () => {};
const countOf = (p: Progress) => (p.kind === "test" ? `검증 ${p.pass + p.fail + p.skip}/${p.total}` : p.kind === "impl" ? `${p.done}/${p.total} 파일` : `${p.done}/${p.total}`);
// 하위 작업 행(슬러그가 이슈 번호)은 개발자 카드 안 목록으로 보인다
const isSub = (r: CrewDetailRow) => /^[A-Z][A-Z0-9]*-\d+$/.test(r.slug);
// "2026-11-12 07:35" → "11-12 07:35 (6일 전)"
function when(at: string) {
  const m = at.match(/^(\d{4})-(\d\d)-(\d\d) (\d\d):(\d\d)/);
  if (!m) return at;
  const mins = Math.round((Date.now() - new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime()) / 60000);
  const ago = mins < 1 ? "방금" : mins < 60 ? `${mins}분 전` : mins < 1440 ? `${Math.round(mins / 60)}시간 전` : `${Math.round(mins / 1440)}일 전`;
  return `${m[2]}-${m[3]} ${m[4]}:${m[5]} (${ago})`;
}
// 상태 칸 글자 → 표시 색
const toneOf = (state: string) => (/작업\s*중/.test(state) ? "work" : /막힘|실패/.test(state) ? "stuck" : /사람/.test(state) ? "human" : /완료/.test(state) ? "done" : /기다림|대기/.test(state) ? "wait" : "idle");
const MARK: Record<string, string> = { work: "💡", stuck: "⛔", human: "🙋", done: "✔", wait: "⏳", idle: "○", ask: "?" };
const SEV_NAME: Record<string, string> = { blocker: "막는 문제", major: "큰 문제", minor: "작은 문제", nit: "사소함" };

// 탁자 확대 창의 카드 보기: 위에 오더 판, 아래에 역할마다 메타에서 읽은 상세 카드. onAsk: 사람 차례일 때 질문 창 열기
export function TableCrewView({ name, taskId, onAsk }: { name: string; taskId: string; onAsk?: () => void }) {
  const t = useOffice((s) => s.state?.tasks.find((x) => x.id === taskId));
  const key = t?.retroOf ?? t?.key;
  const [d, setD] = useState<CrewDetail | null>(null);
  useEffect(() => {
    if (!key) return;
    let live = true;
    const load = () =>
      fetch(`/api/office/dobby/${encodeURIComponent(key)}/crew`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => live && j && !j.error && setD(j))
        .catch(() => {});
    load();
    const timer = setInterval(load, 5000);
    return () => ((live = false), clearInterval(timer));
  }, [name, key]);
  const tb = t?.table;
  if (!t || !tb) return <p className="crew-gone">이 작업은 탁자를 정리했습니다.</p>;
  const cells = tb.cells ?? BAND_NAMES, band = tb.band ?? bandOfPhase(t.phase);
  const roles = DOBBY_ALL_ROLES.filter((r) => (tb.roles ? tb.roles.includes(r) : true) && tb.crew[r]);
  const half = Math.ceil(roles.length / 2);
  const todos = d?.rows.filter((r) => r.todo) ?? [];
  const autoTone = /^멈춤/.test(d?.auto ?? "") ? "stuck" : /^끝/.test(d?.auto ?? "") ? "done" : "work";
  const ask = t.human && onAsk ? onAsk : undefined;
  return (
    <div className="crew-view">
      <div className="crew-head">
        <div className="crew-key">{t.key}</div>
        <div className="crew-title">{t.title}</div>
        <div className="crew-stage">{tb.stage ?? `▶ ${t.phase}`}</div>
        {band >= 0 && (
          <div className="crew-band">
            {cells.map((n, i) => (
              <span key={n} className={i === band || i === tb.also ? "on" : i < band ? "past" : ""}>
                {n}
              </span>
            ))}
          </div>
        )}
        {d?.auto && (
          <div className={`crew-line ${autoTone}`}>
            <b>자동 실행</b> {d.auto}
          </div>
        )}
        {todos.map((r) => (
          <div key={r.slug} className="crew-line human">
            <b>사람 할 일</b> {ROLE_NAME[r.role]}: <code>{r.todo}</code>
            {ask && <AskButton onAsk={ask} />}
          </div>
        ))}
        {!!d?.events.length && (
          <ul className="crew-events">
            {d.events.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="crew-cols">
        {[roles.slice(0, half), roles.slice(half)].map((col, i) => (
          <div key={i} className="crew-col">
            {col.map((r) => (
              <CrewCard key={r} role={r} t={t} d={d} onAsk={ask} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

const AskButton = ({ onAsk }: { onAsk: () => void }) => (
  <button type="button" className="crew-ask" onClick={onAsk}>
    여기서 답하기
  </button>
);

function CrewCard({ role, t, d, onAsk }: { role: TableRole; t: TaskState; d: CrewDetail | null; onAsk?: () => void }) {
  const agent = useOffice((s) => s.state?.agents.find((a) => a.id === t.table!.crew[role]));
  const [open, setOpen] = useState(false);
  if (!agent) return null;
  const rows = d?.rows.filter((r) => r.role === role) ?? [];
  const subs = rows.filter(isSub), main = rows.find((r) => !isSub(r)) ?? rows[0];
  const live = t.table!.work?.[role] ?? "idle";
  const tone = agent.asking ? "ask" : main ? toneOf(main.state) : live;
  const label = agent.asking ? "사람 답을 기다림" : main?.state || (live === "work" ? "작업중" : live === "wait" ? "기다림" : "쉬는 중");
  const fill = fillOf(t.table!.prog, role as SeatRole);
  const working = live === "work" || tone === "work";
  const round = /^\d+$/.test(main?.round ?? "") && Number(main!.round) > 0 ? `${main!.round}회차` : "";
  return (
    <div className={`crew-card ${tone}`}>
      <div className="crew-top">
        <svg className="zoom-view crew-fig" viewBox="-26 -66 52 70" aria-hidden>
          {/* 일하는 사람만 서서 걷고, 나머지는 스툴에 앉아 있다 */}
          {working ? <OfficeAgent agent={agent} face="walk" walking busy pose="walk" bind={noBind} /> : <OfficeAgent agent={agent} face="rest" walking={false} busy={false} pose="front" stool bind={noBind} />}
        </svg>
        <div className="crew-body">
          <div className="crew-who">
            <b>{agent.name}</b> <span className={`crew-role ${role}`}>{ROLE_NAME[role]}</span>
          </div>
          <div className="crew-state">
            {MARK[tone]} {label}
          </div>
          {main && (
            <div className="crew-meta">
              {[round, main.start && `시작 ${when(main.start)}`, main.at && `갱신 ${when(main.at)}`].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
      </div>
      {main?.desc && (
        <div className={`crew-desc${open ? " open" : ""}`} role="button" tabIndex={0} title={open ? "누르면 접습니다" : "누르면 펼칩니다"} onClick={() => setOpen(!open)} onKeyDown={(e) => e.key === "Enter" && setOpen(!open)}>
          {main.desc}
        </div>
      )}
      {main?.todo && (
        <div className="crew-todo">
          👉 <code>{main.todo}</code>
          {onAsk && <AskButton onAsk={onAsk} />}
        </div>
      )}
      {working && agent.doing && <div className="crew-doing">지금: {agent.doing}</div>}
      {fill !== undefined && (
        <div className="crew-prog">
          <span className="crew-bar">
            <i style={{ width: `${Math.round(Math.min(1, fill) * 100)}%` }} />
          </span>
          {countOf(t.table!.prog!)}
        </div>
      )}
      {d && <RoleExtra role={role} d={d} subs={subs} />}
    </div>
  );
}

// 역할마다 더 보이는 것
function RoleExtra({ role, d, subs }: { role: TableRole; d: CrewDetail; subs: CrewDetailRow[] }) {
  if (role === "planner")
    return (
      <div className="crew-extra">
        변경 접수 {d.planner.changes}번 · 설계 확인 {d.planner.ack ? "받음" : "아직"}
      </div>
    );
  if (role === "developer" && subs.length) {
    const done = subs.filter((s) => toneOf(s.state) === "done").length;
    return (
      <div className="crew-extra">
        <div>
          하위 작업 {subs.length}개 · 완료 {done}
        </div>
        <ul>
          {subs.map((s) => (
            <li key={s.slug} className={toneOf(s.state)}>
              {MARK[toneOf(s.state)]} {s.slug} {s.name.replace(/^.*·/, "")} — {s.state}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (role === "reviewer" && d.review)
    return (
      <div className="crew-extra">
        <div>
          {d.review.round}차 리뷰 · 지적 {d.review.titles.length}건
          {d.review.titles.length > 0 && ` (${Object.entries(d.review.counts).map(([k, n]) => `${SEV_NAME[k]} ${n}`).join(", ")})`}
        </div>
        <ul>
          {d.review.titles.map((x, i) => (
            <li key={i}>
              <span className={`crew-sev ${x.sev}`}>{x.sev}</span> {x.title}
            </li>
          ))}
        </ul>
      </div>
    );
  if (role === "deployer" && d.ship.length)
    return (
      <div className="crew-extra">
        <ul>
          {d.ship.map((s, i) => (
            <li key={i}>
              {s.repo} · {s.env} · <b>{s.stage}</b>
              {s.pr && s.pr !== "-" && ` · PR ${s.pr}`}
              {s.build && s.build !== "-" && ` · 빌드 ${s.build}`}
              {s.note && <div className="crew-note">{s.note}</div>}
            </li>
          ))}
        </ul>
      </div>
    );
  if (role === "tester" && d.test)
    return (
      <div className="crew-extra">
        <div>
          최근 회차 {d.test.label}
          {d.test.env && ` · ${d.test.env}`} · 통과 {d.test.pass} · 실패 {d.test.fail} · 보류 {d.test.skip}
        </div>
        <ul>
          {d.test.bad.map((b, i) => (
            <li key={i} className={b.verdict === "fail" ? "stuck" : "wait"}>
              {b.verdict === "fail" ? "✗" : "⏭"} {b.num} {b.name}
              {b.note && <div className="crew-note">{b.note}</div>}
            </li>
          ))}
        </ul>
      </div>
    );
  return null;
}
