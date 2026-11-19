"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CloseX } from "@/components/office/CloseX";
import type { AgentState } from "@/lib/office/core/types";
import { consoleUrl } from "@/lib/office/office";
import { FIELDS, INTAKE_ENVS, KINDS, KIND_ORDER, LIGHT_NOTE_MAX, NOTE_MAX, checkIntake, hasContent, intakeCommand, jiraKeyOf, type IntakeEnv, type IntakeKind } from "@/lib/office/doCommand";

const LAST_KIND = "office.intake.kind";
const ENV_LABEL = (e: IntakeEnv) => (e ? `${e} 배포·검증까지` : "통합까지");

function loadKind(): IntakeKind {
  try {
    const v = localStorage.getItem(LAST_KIND) as IntakeKind | null;
    return v && KIND_ORDER.includes(v) ? v : "dev";
  } catch {
    return "dev";
  }
}

// 도비 사무실 업무 맡기기 창(쉬는 에이전트를 누르면 열린다). 일의 종류를 고르면 그 종류에 맞는 칸과 안내가 나오고,
// 입력으로 만든 /do 명령을 미리 보여 준 뒤 자동 실행으로 시작한다. 사람에게 묻지 않고 진행하므로 동의를 받는다.
// Jira 이슈는 가벼운 수정만 필수다. 비우면 대시보드가 작업 키(TASK-1, TASK-2처럼 차례로 이어지는 번호)를 잡고, 내용은 request.md 로 넘긴다
// 미리 보기는 고칠 수 없다. 서버는 명령 글이 아니라 값을 받아 같은 규칙으로 다시 만든다(권한 확인 없이 도는 실행이다)
// 누른 에이전트(agent)가 기획자로 깃발을 들고 담당자 수에 맞는 곳을 찾아간다. from 은 그 에이전트의 지금 화면 자리(가까운 곳을 고를 때 쓴다)
export function DobbyStartCard({ name, agent, from, near, onClose }: { name: string; agent: AgentState; from: { x: number; y: number }; near: { id: string; x: number; y: number }[]; onClose: () => void }) {
  const [kind, setKind] = useState<IntakeKind>("dev");
  const [target, setTarget] = useState("");
  const [env, setEnv] = useState<IntakeEnv>("");
  const [base, setBase] = useState("");
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState<{ key: string; command: string; kind: IntakeKind } | null>(null);
  const keyRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setKind(loadKind());
    keyRef.current?.focus();
  }, []);

  const f = FIELDS[kind];
  const copy = KINDS[kind];
  const issue = !!jiraKeyOf(target);
  const shownEnv: IntakeEnv = f.env && issue ? env : "";
  const input = { kind, target, env: shownEnv, base: f.base ? base : "", note };
  const checked = checkIntake(input);
  const ready = checked.ok;
  const noteMax = kind === "light" ? LIGHT_NOTE_MAX : NOTE_MAX;
  // 빈 칸은 자리표시로 채워 명령의 모양을 보여 준다(Jira 이슈가 없으면 작업 키는 시작할 때 정해진다)
  const shape = checkIntake({ ...input, target: f.issueRequired && !issue ? "XX-0" : target, note: hasContent(note) ? note : "{내용}" });
  const previewText = checked.ok ? intakeCommand(checked) : shape.ok ? intakeCommand(shape).replace("XX-0", "{이슈 키}") : "";
  const keyBad = touched && !!target.trim() && !issue;

  function pick(k: IntakeKind) {
    setKind(k);
    setAgree(false);
    setErr("");
    try {
      localStorage.setItem(LAST_KIND, k);
    } catch {}
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr("");
    if (!checked.ok) return setErr(checked.error);
    setBusy(true);
    const r = await fetch(`/api/office/dobby-start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...input, agentId: agent.id, from, near }),
    }).catch(() => null);
    setBusy(false);
    const j = (await r?.json().catch(() => null)) as { key?: string; command?: string; error?: string } | null;
    if (j?.error === "agent_busy") return setErr(`방금 다른 일을 맡은 사람입니다(${agent.name}). 창을 닫고 다른 사람을 눌러 주세요.`);
    if (!r?.ok || !j?.key) return setErr(j?.error ?? "시작하지 못했습니다.");
    setStarted({ key: j.key, command: j.command || previewText, kind });
  }

  return (
    <div className="art-card board-card intake-card" role="dialog" aria-label={`${agent.name}에게 업무 맡기기`} aria-busy={busy}>
      <CloseX onClick={onClose} />
      <div className="kick">{agent.name}에게 업무 맡기기</div>
      {!started && <p className="assign-lead">{agent.name} · 기획자. 깃발을 들고 담당자 수에 맞는 자리를 찾아가면, 나머지 담당자가 그리로 모입니다.</p>}
      {started ? (
        <>
          <h4>{started.key} 시작</h4>
          <p role="status">
            {KINDS[started.kind].name} 자동 실행을 시작했습니다{started.key.startsWith("TASK-") ? `(Jira 이슈가 없어 작업 키 ${started.key} 를 만들었습니다)` : ""}. 기획자 {agent.name}, 깃발을 만들어 자리를 찾으러 갑니다. {started.kind === "light" ? "light 세션이" : "설계 세션이"} 담당자를 정하면 인원이 맞춰집니다.
          </p>
          <div className="cmd-preview">
            <span className="kick">실행한 명령</span>
            <code>{started.command}</code>
          </div>
          <div className="row">
            <a href={consoleUrl(started.key)} target="_blank" rel="noopener noreferrer">
              진행 로그 보기(대시보드)
            </a>
            <button type="button" onClick={onClose}>
              닫기
            </button>
          </div>
        </>
      ) : (
        <form className="art-form" noValidate onSubmit={submit}>
          <fieldset className="kind-grid">
            <legend>어떤 일인가요</legend>
            {KIND_ORDER.map((k) => (
              <label key={k} className={`kind-card${kind === k ? " on" : ""}`}>
                <input type="radio" name="kind" checked={kind === k} onChange={() => pick(k)} />
                <b>{KINDS[k].name}</b>
                <span>{KINDS[k].line}</span>
                <small>{KINDS[k].end}</small>
              </label>
            ))}
          </fieldset>

          <label>
            Jira 이슈{f.issueRequired ? "" : " (선택)"}
            <input
              ref={keyRef}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder={f.issueRequired ? "FE1-1234 또는 https://…/browse/FE1-1234" : "FE1-1234 또는 이슈 주소 · 없으면 비워 두세요"}
              maxLength={200}
              aria-invalid={keyBad}
            />
            {keyBad ? (
              <small className="field-err">Jira 이슈 키(FE1-1234)나 이슈 주소가 아닙니다. 이슈가 없으면 비워 두세요.</small>
            ) : (
              !f.issueRequired && !issue && <small className="hint">이슈가 없으면 작업 키(TASK-1, TASK-2처럼 차례로 이어지는 번호)를 새로 만들고, 아래 내용으로 진행합니다.</small>
            )}
          </label>

          <label className="note-field">
            <span className="note-head">
              {copy.noteLabel}
              {kind !== "light" && issue ? " (선택 · 덧붙일 말)" : ""}
              <button type="button" className="mini" onClick={() => setNote((n) => (n.trim() ? `${n.trimEnd()}\n\n${copy.template}` : copy.template))}>
                양식 넣기
              </button>
            </span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={10} maxLength={noteMax} placeholder={copy.notePlaceholder} />
            <small className="hint">
              {note.length.toLocaleString()}/{noteMax.toLocaleString()}자 ·{" "}
              {kind === "light" ? "원인을 새로 찾지 않으므로 고칠 곳이 분명할수록 좋습니다" : "설계 세션이 이슈 본문처럼 읽습니다"}
            </small>
          </label>

          {f.env && (
            <fieldset className="seg">
              <legend>어디까지 진행할까요</legend>
              {INTAKE_ENVS.map((e) => (
                <label key={e} className={e && !issue ? "off" : undefined}>
                  <input
                    type="radio"
                    name="env"
                    disabled={!!e && !issue}
                    checked={shownEnv === e}
                    onChange={() => {
                      setEnv(e);
                      setAgree(false);
                    }}
                  />{" "}
                  {ENV_LABEL(e)}
                </label>
              ))}
              {!issue && !f.issueRequired && <small className="hint">Jira 이슈가 없는 작업은 배포하지 않습니다. 통합에서 기준 브랜치로 PR 까지 만듭니다.</small>}
            </fieldset>
          )}

          {f.base && (
            <details className="adv">
              <summary>고급: 기준 브랜치</summary>
              <label>
                기준 브랜치(비우면 설정의 기본 브랜치)
                <input value={base} onChange={(e) => setBase(e.target.value)} placeholder="master" maxLength={100} />
              </label>
            </details>
          )}

          <details className="auto-guide" open>
            <summary>진행 순서</summary>
            <ol>
              {copy.steps(shownEnv, issue).map((s) => (
                <li key={s.text} className={s.off ? "off" : undefined}>
                  {s.text}
                </li>
              ))}
            </ol>
            {copy.note && <p>{copy.note}</p>}
            <p>사람 판단이 필요하면 답을 기다리고 그 테이블에 물음표가 뜹니다. 권한 확인 없이 이 맥에서 실행합니다.</p>
          </details>

          <div className="cmd-preview" aria-live="polite">
            <span className="kick">실행할 명령</span>
            <code className={ready ? undefined : "dim"}>{previewText || "—"}</code>
            <small>{copy.done(shownEnv, issue)}</small>
          </div>

          <label className={`agree${shownEnv || kind === "light" ? " warn" : ""}`}>
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> {copy.agree(shownEnv, issue)}
          </label>
          {err && <p role="alert">{err}</p>}
          <div className="row">
            <button type="submit" className="primary auto-start" disabled={busy || !agree || !ready}>
              맡기기(자동 실행 시작)
            </button>
            <button type="button" onClick={onClose}>
              닫기
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
