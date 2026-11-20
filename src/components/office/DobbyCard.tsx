"use client";
import { useEffect, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AskInfo, AskKind } from "@/lib/office/ask";
import { dashboardUrl } from "@/lib/office/office";
import type { TaskState } from "@/lib/office/core/types";

// ask: 답을 기다리는 질문. detail: 옛 오더의 판단 요청에 적힌 "확인이 필요했던 것"
type Notice = { text: string; cmd: string; action: string; env: string; link: string; kind: string; ask?: AskInfo | null; detail?: string };
// 대시보드 다음 할 일 버튼과 같은 이름
const BUTTON: Record<string, string> = {
  resolve: "해결 처리",
  approve: "설계 승인하고 자동 실행",
  "approve-deploy": "설계 승인하고 배포까지",
  autorun: "자동 실행 다시",
  deploy: "배포하기",
  drift: "단계 밖 변경 반영",
};
const ENVS = ["dev", "rc1", "rc4"];
// 질문 창의 글은 대시보드 오더 화면의 질문 카드와 같다
const KIND_LABEL: Record<AskKind, string> = { yesno: "예 / 아니오", choice: "하나 고르기", input: "글로 적기", action: "직접 해 주기" };
const KIND_HEAD: Record<AskKind, string> = { yesno: "결정이 필요합니다", choice: "결정이 필요합니다", input: "알려 주실 것이 있습니다", action: "직접 해 주실 일이 있습니다" };
const STOP = "멈추기"; // 자동 실행을 끝내는 답
const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

// "2026-11-14 09:05" → "11/14(토) 09:05 · 3시간 전"
function since(at: string): string {
  const m = at.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/);
  if (!m) return "";
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  const ago = min < 1 ? "방금" : min < 60 ? `${min}분 전` : min < 1440 ? `${Math.floor(min / 60)}시간 전` : `${Math.floor(min / 1440)}일 전`;
  return `${+m[2]}/${+m[3]}(${DAYS[d.getDay()]}) ${m[4]}:${m[5]} · ${ago}`;
}

// 칸 하나: 작은 이름과 그 아래 내용
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="ask-field">
      <h5>{label}</h5>
      <div>{children}</div>
    </section>
  );
}

type Pending = { value: string; title: string; desc?: string; ok: string };

// 답하는 방식 넷의 입력창. send 는 답으로 저장될 값을 보낸다. 예/아니오와 방법 버튼은 확인을 한 번 거친다
function AskAnswer({ ask, busy, send, confirm }: { ask: AskInfo; busy: boolean; send: (value: string) => void; confirm: (p: Pending) => void }) {
  const [text, setText] = useState("");
  const isNew = ask.v >= 2;
  const sendText = () => {
    const v = text.trim();
    if (v) send(v);
  };
  if (ask.kind === "yesno")
    return (
      <div className="row">
        {["예", "아니오"].map((c, i) => (
          <button key={c} type="button" className={i === 0 ? "primary" : undefined} disabled={busy} onClick={() => confirm({ value: c, title: `"${c}"로 답할까요?`, ok: c })}>
            {c}
          </button>
        ))}
      </div>
    );
  if (ask.kind === "choice" && isNew && ask.options.length > 0)
    return (
      <>
        <div className="row">
          {ask.options.map((o) => (
            <button key={o.label} type="button" className={o.recommended ? "primary" : undefined} disabled={busy} onClick={() => confirm({ value: o.label, title: `"${o.label}"(으)로 답할까요?`, desc: o.effect || o.does, ok: "이 방법으로" })}>
              {o.label}
              {o.recommended ? " (권장)" : ""}
            </button>
          ))}
        </div>
        <div className="ask-other">
          <input type="text" aria-label="다른 의견" maxLength={2000} placeholder="다른 의견 — 다른 방법을 원하시면 여기에 적어 주세요" value={text} disabled={busy} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && sendText()} />
          <button type="button" disabled={busy || !text.trim()} onClick={sendText}>
            다른 의견 보내기
          </button>
        </div>
      </>
    );
  if (ask.kind === "choice")
    // 옛 형식의 하나 고르기는 선택지 안의 값만 받는다
    return (
      <div className="row">
        {ask.choices
          .filter((c) => c !== STOP)
          .map((c, i) => (
            <button key={c} type="button" className={i === 0 ? "primary" : undefined} disabled={busy} onClick={() => send(c)}>
              {c}
            </button>
          ))}
      </div>
    );
  if (ask.kind === "action")
    return (
      <div className="row">
        <button
          type="button"
          className="primary"
          disabled={busy}
          title={ask.hasCheck ? (ask.waiting ? "됐는지 1분마다 저절로 확인합니다. 누르면 지금 다시 확인합니다." : "누르면 자동 실행을 다시 시작해 됐는지 확인하고 이어 갑니다.") : undefined}
          onClick={() => send("했어요")}
        >
          {isNew ? "했습니다" : "했어요"}
        </button>
      </div>
    );
  // 글로 적기
  if (!isNew)
    return (
      <div className="ask-other">
        <input type="text" aria-label="답" maxLength={2000} placeholder="값을 적어 주세요" value={text} disabled={busy} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && sendText()} />
        <button type="button" className="primary" disabled={busy || !text.trim()} onClick={sendText}>
          보내기
        </button>
      </div>
    );
  return (
    <>
      <textarea rows={3} aria-label="답" maxLength={2000} placeholder="여기에 적어 주세요" value={text} disabled={busy} onChange={(e) => setText(e.target.value)} />
      <div className="row">
        <button type="button" className="primary" disabled={busy || !text.trim()} onClick={sendText}>
          보내기
        </button>
      </div>
    </>
  );
}

// 할 일 글. 직접 해 주기면 명령을 복사할 수 있게 그린다("터미널에서 실행: 명령" 꼴이면 명령만 복사한다)
function Todo({ ask }: { ask: AskInfo }) {
  const [copied, setCopied] = useState(false);
  if (!ask.todo) return null;
  if (ask.kind !== "action") return <p className="ask-text">{ask.todo}</p>;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ask.todo.replace(/^[^:]*:\s*/, ""));
      setCopied(true);
    } catch {}
  };
  return (
    <p className="ask-cmd">
      <code>{ask.todo}</code>
      <button type="button" onClick={() => void copy()}>
        {copied ? "복사했습니다" : "명령 복사"}
      </button>
    </p>
  );
}

// 질문 창. 새 형식은 일곱 칸(질문, 무슨 일, 왜, 해 본 것, 방법, 답하는 방식, 답한 뒤)을 차례로, 옛 형식은 있는 칸만 보여 준다
function AskBody({ ask, busy, send }: { ask: AskInfo; busy: boolean; send: (value: string) => void }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const isNew = ask.v >= 2;
  const how = KIND_LABEL[ask.kind] + (ask.kind === "choice" && ask.choices.length ? ` (${ask.choices.filter((c) => c !== STOP).join(" / ")})` : "");
  const empty = "적힌 내용이 없습니다.";
  return (
    <>
      <Field label="질문">
        <p className="ask-text ask-title">{ask.title}</p>
      </Field>
      {isNew && (
        <Field label="무슨 일이 있었나">
          <p className="ask-text">{ask.what || empty}</p>
        </Field>
      )}
      {(isNew || ask.why) && (
        <Field label={isNew ? "왜 스스로 정하지 못했나" : "이유"}>
          <p className="ask-text">{ask.why || empty}</p>
        </Field>
      )}
      {isNew && (
        <Field label="지금까지 해 본 것">
          {ask.tried.length ? (
            <ol>
              {ask.tried.map((t, i) => (
                <li key={i} className="ask-text">
                  {t}
                </li>
              ))}
            </ol>
          ) : (
            <p>{empty}</p>
          )}
        </Field>
      )}
      {isNew && (
        <Field label="방법">
          {ask.options.length ? (
            <ul className="ask-options">
              {ask.options.map((o) => (
                <li key={o.label}>
                  <p className="ask-text">
                    <b>{o.label}.</b> {o.does}
                    {o.recommended && <span className="ask-rec">권장</span>}
                  </p>
                  {o.effect && <p className="ask-text ask-sub">고르면: {o.effect}</p>}
                  {o.recommended && o.reason && <p className="ask-text ask-sub">권하는 이유: {o.reason}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p>{ask.kind === "yesno" ? "고를 방법이 따로 없습니다. 위 질문에 예 또는 아니오로 답해 주세요." : ask.kind === "action" ? "고를 방법이 따로 없습니다. 아래 할 일을 직접 해 주세요." : "고를 방법이 따로 없습니다. 아래 칸에 적어 주세요."}</p>
          )}
        </Field>
      )}
      <Field label={isNew ? `답하는 방식: ${how}` : "답하기"}>
        <Todo ask={ask} />
        {ask.note && <p className="ask-note">{ask.note}</p>}
        {pending ? (
          <div className="ask-confirm" role="group" aria-label="답 확인">
            <b>{pending.title}</b>
            {pending.desc && <p className="ask-text">{pending.desc}</p>}
            <div className="row">
              <button
                type="button"
                className={pending.value === STOP ? "danger" : "primary"}
                disabled={busy}
                onClick={() => {
                  setPending(null);
                  send(pending.value);
                }}
              >
                {pending.ok}
              </button>
              <button type="button" disabled={busy} onClick={() => setPending(null)}>
                취소
              </button>
            </div>
          </div>
        ) : (
          <AskAnswer ask={ask} busy={busy} send={send} confirm={setPending} />
        )}
      </Field>
      {(isNew || !ask.waiting) && (
        <Field label="답한 뒤">
          {ask.after && <p className="ask-text">{ask.after}</p>}
          <p className="ask-sub">{ask.waiting ? "자동 실행이 답을 기다리고 있습니다. 답하면 1분 안에 읽고 이어 갑니다." : "자동 실행이 멈춰 있습니다. 답하면 자동 실행을 다시 시작해 이어 갑니다."}</p>
        </Field>
      )}
      {ask.waiting && !pending && (
        <div className="row">
          <button type="button" className="danger" disabled={busy} onClick={() => setPending({ value: STOP, title: "자동 실행을 멈출까요?", desc: "질문에 답하지 않고 자동 실행을 끝냅니다.", ok: "멈추기" })}>
            답하지 않고 멈추기
          </button>
        </div>
      )}
    </>
  );
}

// 도비 사무실의 물음표 창. 답을 기다리는 질문이 있으면 질문 창을, 버튼으로 끝나는 일은 버튼을, 옛 오더의 판단 요청은 글 답을 보인다. 바깥에서 할 일은 링크를 보인다
export function DobbyCard({ name, task, onClose }: { name: string; task: TaskState; onClose: () => void }) {
  const [n, setN] = useState<Notice | null>(null);
  const [env, setEnv] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(""); // 질문에 답을 보낸 뒤의 안내
  const url = `/api/office/dobby/${encodeURIComponent(task.key)}`;
  useEffect(() => {
    fetch(url, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Notice | null) => {
        setN(j);
        setEnv(j?.env && ENVS.includes(j.env) ? j.env : "");
      })
      .catch(() => setN(null));
  }, [url]);
  const ask = n?.ask ?? null;
  // 질문에 답했지만 판정이 아직 따라오지 않은 잠깐 동안에는 누를 것이 없다
  const answered = !!n && !ask && n.action === "ask";
  const action = n && !ask && !answered ? n.action : "";
  const needEnv = action === "approve-deploy" || action === "deploy";
  // 글 답은 할 일 명령이 /do {키} 일 때 받는다. 답을 넣어 그 명령을 뒤에서 돌린다
  const canWrite = !!n && !ask && !action && !answered && n.cmd.startsWith("/do ");
  const [copied, setCopied] = useState(false);
  const copyCmd = async () => {
    try {
      await navigator.clipboard.writeText(n!.cmd);
      setCopied(true);
    } catch {}
  };
  const post = async (body: object) => {
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = (await r.json().catch(() => ({}))) as { error?: string; restarted?: boolean; note?: string };
      if (!r.ok) setMsg(j.error ?? "보내지 못했습니다.");
      return r.ok ? j : null;
    } catch {
      setMsg("보내지 못했습니다.");
      return null;
    } finally {
      setBusy(false);
    }
  };
  const send = async (body: object) => {
    if (await post(body)) onClose();
  };
  // 질문의 답. 자동 실행이 살아서 기다리는 중이었는지, 멈춰 있어 다시 띄웠는지에 따라 안내가 다르다
  const sendAsk = async (value: string) => {
    const j = await post({ action: "ask", value });
    if (!j) return;
    setDone(
      value === STOP
        ? "자동 실행을 멈춥니다."
        : j.restarted
          ? "답을 보냈습니다. 멈춰 있던 자동 실행을 다시 시작해 이어 갑니다."
          : j.note
            ? `답은 적어 두었습니다. 자동 실행은 다시 시작하지 못했습니다 — ${j.note}`
            : "답을 보냈습니다. 기다리던 자동 실행이 1분 안에 읽고 이어 갑니다.",
    );
  };
  return (
    <div className={`art-card${ask ? " ask-card" : ""}`} role="dialog" aria-label={`${task.key} 사람 차례`} aria-busy={busy}>
      <div className="kick">{ask ? ["사람 차례", `${ask.from}의 질문`, since(ask.created)].filter(Boolean).join(" · ") : "사람 차례"}</div>
      <h4>
        {task.key} · {ask ? KIND_HEAD[ask.kind] : task.title}
      </h4>
      {ask ? (
        <>
          <p className="ask-sub">{task.title}</p>
          {done ? (
            <>
              <Field label="질문">
                <p className="ask-text ask-title">{ask.title}</p>
              </Field>
              <p role="status" className="ask-done">
                {done}
              </p>
            </>
          ) : (
            <AskBody ask={ask} busy={busy} send={(v) => void sendAsk(v)} />
          )}
        </>
      ) : (
        <p>{!n ? "안내를 불러오는 중입니다." : answered ? "질문에는 이미 답했습니다. 이어서 진행되기를 기다리면 됩니다." : n.text}</p>
      )}
      {canWrite && n?.detail && (
        <Field label="확인이 필요했던 것">
          <div className="ask-md">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{n.detail}</ReactMarkdown>
          </div>
        </Field>
      )}
      {action && (
        <>
          {needEnv && (
            <label>
              배포 환경
              <select value={env} onChange={(e) => setEnv(e.target.value)}>
                <option value="">고르세요</option>
                {ENVS.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="row">
            <button type="button" className="primary" disabled={busy || (needEnv && !env)} onClick={() => void send({ action, env: needEnv ? env : undefined })}>
              {BUTTON[action] ?? "진행하기"}
            </button>
          </div>
        </>
      )}
      {canWrite && (
        <>
          <label>
            답
            <textarea rows={4} value={answer} maxLength={2000} placeholder="한 일이나 판단을 적으면 도비가 이어서 진행합니다" onChange={(e) => setAnswer(e.target.value)} />
          </label>
          <div className="row">
            <button type="button" className="primary" disabled={busy || !answer.trim()} onClick={() => void send({ answer })}>
              답하고 이어서 진행
            </button>
          </div>
        </>
      )}
      {n && !ask && n.link && (
        <p>
          바깥에서 할 일:{" "}
          <a href={n.link} target="_blank" rel="noopener noreferrer">
            {n.link}
          </a>
          . 끝나면 도비가 알아서 넘어갑니다.
        </p>
      )}
      {n && !ask && !answered && !action && !canWrite && !n.link && (
        n.cmd ? (
          // /dobby-ship·/dobby-release 처럼 사람에게 묻는 명령은 뒤에서 돌릴 수 없어 복사만 한다
          <p className="ask-cmd">
            터미널에서 이어 갈 명령: <code>{n.cmd}</code>
            <button type="button" onClick={() => void copyCmd()}>
              {copied ? "복사했습니다" : "명령 복사"}
            </button>
          </p>
        ) : (
          <p>위 안내대로 열려 있는 터미널 세션에서 이어 가 주세요.</p>
        )
      )}
      {msg && <p role="alert">{msg}</p>}
      <div className="row">
        <button type="button" onClick={() => window.open(dashboardUrl(task.key), "_blank", "noopener")}>
          대시보드에서 보기
        </button>
        <button type="button" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  );
}
