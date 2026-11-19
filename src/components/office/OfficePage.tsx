"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useOfficeStream } from "@/lib/office/ui/useOfficeStream";
import { useOffice } from "@/lib/office/ui/store";
import { type AgentState, type Artifact, type Book, type OfficeState, type TaskState } from "@/lib/office/core/types";
import { Bookshelf, type ActiveBook, type Tip } from "@/components/office/Bookshelf";
import { OpenDashCard } from "@/components/office/HumanCard";
import { RetroBook } from "@/components/office/RetroShelf";
import type { RetroItem } from "@/lib/office/retro";
import { HoldAskCard } from "@/components/office/HoldCard";
import { OfficeFloor, type Box } from "@/components/office/OfficeFloor";
import { TableZoomCard } from "@/components/office/TableZoomCard";
import { ModelCard } from "@/components/office/SettingsCards";
import { ArtifactAdd, type LiveInfo } from "@/components/office/OpenBook";
import { DobbyArtifactBook, DobbyWorkBook } from "@/components/office/DobbyBooks";
import { DobbyCard } from "@/components/office/DobbyCard";
import { DobbyStartCard } from "@/components/office/DobbyStartCard";
import { FrontDeskCard } from "@/components/office/FrontDeskCard";
import { DobbyDemoBar } from "@/components/office/DobbyDemoBar";
import { ReportBinder } from "@/components/office/ReportBinder";
import { JobsMonitorCard } from "@/components/office/JobsMonitorCard";
import { DataMonitorCard, readDataSeen, writeDataSeen } from "@/components/office/DataMonitorCard";
import type { DataItem } from "@/lib/office/data";
import { DOBBY_OFFICE, dashboardUrl } from "@/lib/office/office";

const CONN_LABEL = { connecting: "연결 중", live: "실시간", reconnecting: "다시 연결 중" } as const;
const hhmmss = (t: number) => new Date(t).toTimeString().slice(0, 8);

// 도비 사무실의 창들. 대시보드에 합치며 오피스 자체 오케스트레이터 창(작업 게시판·작업 설정·폐기·완료 확인·부록)은 가져오지 않았다
type Asking = { kind: "human"; task: TaskState } | { kind: "active"; key: string } | { kind: "reports" } | { kind: "jobs" } | { kind: "data" } | { kind: "retro"; key: string } | { kind: "open"; task: TaskState; url: string } | { kind: "zoom"; task: TaskState; box: Box } | { kind: "hold"; task: TaskState } | { kind: "assign"; agent: AgentState; from: { x: number; y: number }; near: { id: string; x: number; y: number }[] } | { kind: "desk" } | { kind: "models" };
// 진행 중인 작업을 펼친 책으로 열 때 쓸 책 정보와 지금 상황
function liveBook(state: OfficeState, key: string): { book: Book; live: LiveInfo } | null {
  const t = state.tasks.find((x) => x.key === key);
  if (!t) return null;
  const ids = new Set([...Object.values(t.table?.crew ?? {}), ...(t.folder.kind === "agent" ? [t.folder.agentId] : [])]);
  const crew = state.agents.filter((a) => ids.has(a.id));
  return {
    book: { key: t.key, title: t.title, pr: t.pr ?? 0, rounds: 0, lines: 0, mins: 0, human: !!t.human, doneAt: "" },
    live: {
      phase: t.phase,
      flag: t.human ? "사람 확인을 기다립니다(물음표)" : t.confirm ? "완료 확인을 기다립니다(느낌표)" : t.note ? `${t.note.round ? `${t.note.round}회차 검증 통과` : "맡은 일을 모두 마침"}, 해결 처리를 기다립니다` : t.waiting ? "자리가 나기를 기다립니다" : t.paused ? "일시정지" : "진행 중",
      env: t.env,
      crew: crew.length ? crew.map((a) => a.name).join(", ") : "없음",
      pr: t.pr,
      logs: state.log.filter((l) => l.text.includes(t.key)).slice(0, 5),
    },
  };
}

type View = { kind: "book"; book: Book } | { kind: "active"; key: string } | { kind: "art"; artifact: Artifact } | { kind: "add-art" } | null;

// 사무실은 도비 하나뿐이다. 도비 오더를 읽어 그리고, 접수는 대시보드 자동 실행으로 넘기며, 작업 설정 창은 열지 않는다
export function OfficePage({ initialTask }: { initialTask?: string }) {
  const name = DOBBY_OFFICE;
  useOfficeStream(name);
  const conn = useOffice((s) => s.conn);
  const state = useOffice((s) => s.state);
  const epoch = useOffice((s) => s.epoch);
  const [view, setView] = useState<View>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  // 사람 확인·완료 확인·접수·작업 설정·부서 설정·보고서 창. 오른쪽 화면과 따로 사무실 위에 뜬다
  const [asking, setAsking] = useState<Asking | null>(null);
  const closeAsking = useCallback(() => setAsking(null), []);
  const askingRef = useRef(asking);
  askingRef.current = asking;
  const [tip, setTip] = useState<Tip | null>(null);
  const [drawer, setDrawer] = useState(false); // 오른쪽 탭에서 밀려 나오는 작업 책장
  const [flying, setFlying] = useState<string[]>([]); // 사무실에서 작은 책꽂이로 날아가는 중인 책. 꽂히기 전까지 작업 중 책장에 둔다
  // 책장 회고 칸의 회고록. 도비 사무실에서 책장을 열 때마다 다시 읽는다. 글은 읽지 못한 까닭
  const [retros, setRetros] = useState<RetroItem[] | string | null>(null);
  const [focusRetro, setFocusRetro] = useState(0);
  useEffect(() => {
    if (!drawer) return;
    fetch(`/api/office/dobby/retros`)
      .then((r) => r.json())
      .then((j) => setRetros(j.items ?? j.error ?? "목록을 읽지 못했습니다."))
      .catch(() => setRetros("목록을 읽지 못했습니다."));
  }, [drawer]);
  const [notice, setNotice] = useState("");
  // 팀 이슈 조사가 도는 동안 왼쪽 모니터에 "조사 중"을 띄운다. 도비 사무실에서만 30초마다 묻는다
  const [jobsRunning, setJobsRunning] = useState(false);
  useEffect(() => {
    const ask = () => fetch(`/api/office/dobby-jobs`, { cache: "no-store" }).then((r) => r.json()).then((j) => setJobsRunning(!!j?.status?.running)).catch(() => {});
    void ask();
    const t = setInterval(ask, 30_000);
    return () => clearInterval(t);
  }, [asking]);
  // 오른쪽 모니터: 데이터 작업이 도는 동안 "수집 중"을 띄우고, 이 브라우저에서 안 본 새 결과 수만큼 점을 찍는다. 창을 닫을 때도 다시 묻는다
  // 서버가 data/ 가 바뀐 것을 이벤트 줄("… 데이터 분석 …")로 알리면 30초를 기다리지 않고 바로 다시 묻는다. 데모의 데이터 단계도 이 길로 따라온다
  const dataSeq = state?.log.find((l) => l.text.includes("데이터 분석"))?.seq ?? 0;
  const [dataMon, setDataMon] = useState<{ running: boolean; fresh: number; verdict: string }>({ running: false, fresh: 0, verdict: "" });
  const [dataFlash, setDataFlash] = useState(""); // 스펙이 막 완성됐을 때 모니터에 잠깐 띄우는 글
  const [present, setPresent] = useState({ n: 0, text: "" }); // 새 결과가 나오면 모니터 앞 발표를 부른다
  const dataPrev = useRef<Map<string, DataItem> | null>(null);
  useEffect(() => {
    const ask = () =>
      fetch(`/api/office/dobby-data`, { cache: "no-store" })
        .then((r) => r.json())
        .then((j: { items?: DataItem[] }) => {
          const items = j.items ?? [], prev = dataPrev.current;
          dataPrev.current = new Map(items.map((i) => [i.key, i]));
          // 처음 보는 브라우저는 지금 있는 결과를 모두 본 것으로 두어, 이후에 나오는 결과만 새 결과로 센다
          let seen = readDataSeen(name);
          if (!seen) writeDataSeen(name, (seen = Object.fromEntries(items.filter((i) => i.lastRunId).map((i) => [i.key, i.lastRunId!]))));
          const unseen = items.filter((i) => i.lastRunId && seen![i.key] !== i.lastRunId);
          setDataMon({ running: items.some((i) => i.running), fresh: unseen.length, verdict: unseen[0]?.verdict ?? "" });
          if (!prev) return;
          // 지난번과 견줘 새 회차 결과가 나왔으면 발표를, 스펙만 생겼으면 모니터에 잠깐 알림을 띄운다
          const got = items.find((i) => i.lastRunId && prev.get(i.key)?.lastRunId !== i.lastRunId);
          if (got) setPresent((p) => ({ n: p.n + 1, text: `${got.key} 분석 결과 나왔습니다. ${got.verdict}! ${got.oneLine ?? ""}`.trim() }));
          else if (items.some((i) => i.state === "ready" && prev.get(i.key)?.state === "none")) setDataFlash("스펙 완성");
        })
        .catch(() => {});
    void ask();
    const t = setInterval(ask, 30_000);
    return () => clearInterval(t);
  }, [name, asking, dataSeq]);
  useEffect(() => {
    if (!dataFlash) return;
    const t = setTimeout(() => setDataFlash(""), 10_000);
    return () => clearTimeout(t);
  }, [dataFlash]);
  const VERDICT_TONE: Record<string, string> = { "성과 있음": "good", "수집 확인": "good", 나빠짐: "bad", "수집 이상": "bad" };
  const dataScreen = dataMon.running ? { text: "수집 중" } : dataFlash ? { text: dataFlash } : dataMon.verdict ? { text: dataMon.verdict, tone: VERDICT_TONE[dataMon.verdict] ?? "wait" } : null;
  // 펼쳐 본 완료 책. 이 브라우저에만 남기고, 처음 열면 지금 꽂힌 책은 모두 본 것으로 둔다
  const seenKey = `office-seen-books:${name}`;
  const [seen, setSeen] = useState<Set<string> | null>(null);
  useEffect(() => {
    if (!state || seen) return;
    let saved: string[] | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(seenKey) ?? "null");
    } catch {}
    const s = new Set(Array.isArray(saved) ? saved : state.books.map((b) => b.key));
    setSeen(s);
    try {
      localStorage.setItem(seenKey, JSON.stringify([...s]));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, seen]);
  const markSeen = (key: string) =>
    setSeen((s) => {
      if (!s || s.has(key)) return s;
      const n = new Set(s).add(key);
      try {
        localStorage.setItem(seenKey, JSON.stringify([...n]));
      } catch {}
      return n;
    });

  // 주소로 들어온 작업은 책을 펼친 채로 시작하고, 펼치고 닫을 때 주소도 맞춘다
  useEffect(() => {
    if (!initialTask || !state || view) return;
    const b = state.books.find((x) => x.key === initialTask);
    if (b) setView({ kind: "book", book: b });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTask, epoch]);
  useEffect(() => {
    const path = view?.kind === "book" ? `/office/tasks/${encodeURIComponent(view.book.key)}` : "/office";
    if (location.pathname !== path) history.replaceState(null, "", path);
  }, [view]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // 사람 확인 창이 떠 있으면 그것부터 닫는다
      if (askingRef.current) setAsking(null);
      else if (viewRef.current) setView(null);
      else setDrawer(false);
    };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, []);

  async function syncDobby() {
    setNotice("동기화하는 중입니다.");
    const r = await fetch(`/api/office/dobby-sync`, { method: "POST" }).catch(() => null);
    const j = r?.ok ? ((await r.json()) as { changed: number }) : null;
    setNotice(j ? `동기화: 바뀐 오더 ${j.changed}건` : "동기화하지 못했습니다.");
  }

  // 서류철을 들었거나 테이블에 앉아 일하는 사람
  const working = state?.agents.filter((a) => a.status !== "rest" && state.tasks.some((t) => (t.folder.kind === "agent" && t.folder.agentId === a.id) || Object.values(t.table?.crew ?? {}).includes(a.id))).length ?? 0;
  const resting = (state?.agents.length ?? 0) - working;
  const openBook = (b: Book) => {
    markSeen(b.key);
    setView({ kind: "book", book: b });
  };
  // 이어서 하거나 다시 진행 중인 책은 작업 중 책장으로 옮겨 가므로 완료 책장에서는 뺀다
  const doneBooks = state?.books.filter((b) => !flying.includes(b.key) && !state.tasks.some((t) => !t.mock && t.key === b.key)) ?? [];
  const fresh = new Set(seen ? doneBooks.filter((b) => !seen.has(b.key)).map((b) => b.key) : []);
  const activeBooks: ActiveBook[] = [
    ...(state?.tasks.filter((t) => !t.retroOf).map((t) => ({ key: t.key, title: t.title, phase: t.phase, appendix: !t.mock })) ?? []),
    ...(state?.books.filter((b) => flying.includes(b.key)).map((b) => ({ key: b.key, title: b.title, phase: "책꽂이로 가는 중", appendix: !!b.appendix })) ?? []),
  ];

  return (
    <div className="app">
      <div className="office-bar">
        <b>사무실 · 도비 /do 오더</b>
        <span className={`conn ${conn}`}>{CONN_LABEL[conn]}</span>
        <span>
          작업 {state?.tasks.filter((t) => !t.hold).length ?? 0}건 · 홀딩 {state?.tasks.filter((t) => t.hold).length ?? 0}건 · 일하는 중 {working}명 · 쉬는 중 {resting}명
        </span>
        <span className="sp" />
        {notice && <span role="status">{notice}</span>}
        <span>읽기 전용</span>
        <button type="button" className="primary" disabled={!state} onClick={() => void syncDobby()}>
          동기화
        </button>
      </div>
      <div className="office-main">
        <div className="office-pane">
          <OfficeFloor
            dobby
            onAgent={(agent, from, near) => setAsking({ kind: "assign", agent, from, near })}
            waitFor={asking?.kind === "assign" ? asking.agent.id : undefined}
            onTable={(task) => setAsking({ kind: "open", task, url: task.retroOf ? `${dashboardUrl(task.retroOf)}/retro` : dashboardUrl(task.key) })}
            onZoom={(task, box) => setAsking({ kind: "zoom", task, box })}
            onRetroShelf={() => (setDrawer(true), setFocusRetro(Date.now()))}
            onHuman={(task) => setAsking({ kind: "human", task })}
            onFlight={(key, on) => setFlying((f) => (on ? [...f, key] : f.filter((k) => k !== key)))}
            onPickup={(task) => void fetch(`/api/office/tasks/${encodeURIComponent(task.key)}/pickup`, { method: "POST" }).catch(() => {})}
            onBoard={() => setAsking({ kind: "desk" })}
            onCabinet={() => setAsking({ kind: "reports" })}
            onGear={(task) => window.open(dashboardUrl(task.key), "_blank", "noopener")}
            onModels={() => setAsking({ kind: "models" })}
            onHold={(task) => setAsking({ kind: "hold", task })}
            onShelf={() => setDrawer((d) => !d)}
            onMonitor={() => setAsking({ kind: "jobs" })}
            jobsRunning={jobsRunning}
            onDataMonitor={() => setAsking({ kind: "data" })}
            dataScreen={dataScreen}
            dataFresh={dataMon.fresh}
            present={present}
          />
          <DobbyDemoBar name={name} />
          {asking && (
            <div className={`floor-modal${asking.kind === "active" || asking.kind === "retro" || asking.kind === "data" ? " full" : ""}`} onClick={(e) => e.target === e.currentTarget && setAsking(null)}>
              {asking.kind === "open" ? (
                <OpenDashCard task={asking.task} url={asking.url} onClose={closeAsking} />
              ) : asking.kind === "zoom" ? (
                <TableZoomCard name={name} task={asking.task} box={asking.box} onClose={closeAsking} />
              ) : asking.kind === "jobs" ? (
                <JobsMonitorCard name={name} onClose={closeAsking} />
              ) : asking.kind === "data" ? (
                <DataMonitorCard name={name} tick={dataSeq} onClose={closeAsking} />
              ) : asking.kind === "retro" ? (
                <RetroBook name={name} retroKey={asking.key} onClose={() => (setAsking(null), setDrawer(true))} />
              ) : asking.kind === "reports" ? (
                <ReportBinder
                  name={name}
                  onClose={closeAsking}
                  onAct={(key) => {
                    // 도비 사무실의 보고서는 사람 확인(물음표)만 단추로 단다. 완료 확인(느낌표)은 오피스 자체 오케스트레이터 몫이라 없다
                    const task = state?.tasks.find((t) => t.key === key);
                    if (task) setAsking({ kind: "human", task });
                  }}
                  onOpen={(key) => (setAsking(null), setView({ kind: "active", key }))}
                />
              ) : asking.kind === "assign" ? (
                <DobbyStartCard name={name} agent={asking.agent} from={asking.from} near={asking.near} onClose={closeAsking} />
              ) : asking.kind === "desk" ? (
                <FrontDeskCard
                  name={name}
                  notes={state?.tasks.filter((t) => t.note) ?? []}
                  held={state?.tasks.filter((t) => t.hold) ?? []}
                  onClose={closeAsking}
                  onAnswer={(task) => setAsking({ kind: "human", task })}
                  onOpen={(t) => {
                    if (!t.note?.seen) void fetch(`/api/office/notes/${encodeURIComponent(t.key)}`, { method: "POST" });
                    setAsking({ kind: "active", key: t.key });
                  }}
                />
              ) : asking.kind === "active" ? (
                state && (() => {
                  const lb = liveBook(state, asking.key);
                  const done = state.books.find((b) => b.key === asking.key);
                  const book = lb?.book ?? done;
                  return !book ? null : <DobbyWorkBook name={name} book={book} live={lb?.live} artifacts={state.artifacts} onClose={closeAsking} onOpenArtifact={(a) => window.open(a.url, "_blank", "noopener")} />;
                })()
              ) : asking.kind === "hold" ? (
                <HoldAskCard name={name} task={asking.task} dobby onClose={closeAsking} />
              ) : asking.kind === "models" ? (
                <ModelCard onClose={closeAsking} />
              ) : (
                <DobbyCard name={name} task={asking.task} onClose={() => setAsking(null)} />
              )}
            </div>
          )}
        </div>
        <button type="button" className="shelf-tab" aria-expanded={drawer} aria-controls="shelf-drawer" onClick={() => setDrawer((d) => !d)}>
          작업 책장
          {fresh.size > 0 && <span className="badge" aria-label={`새 책 ${fresh.size}권`}>{fresh.size}</span>}
        </button>
        <div id="shelf-drawer" className={`drawer${drawer ? " open" : ""}`} inert={!drawer}>
          <div className="pane-bar">
            <b>작업 책장</b>
            <span className="sp" />
            <span className="pg">
              작업 중 {activeBooks.length}권 · 완료 {doneBooks.length}권 · 아티팩트 {state?.artifacts.length ?? 0}권
            </span>
          </div>
          {state && (
            <Bookshelf
              active={activeBooks}
              books={doneBooks}
              artifacts={state.artifacts}
              retros={retros}
              focusRetro={focusRetro}
              epoch={epoch}
              fresh={fresh}
              onOpenBook={(b) => {
                setTip(null);
                openBook(b);
              }}
              onOpenActive={(key) => {
                setTip(null);
                setView({ kind: "active", key });
              }}
              onOpenAppendix={(key) => {
                setTip(null);
                window.open(dashboardUrl(key), "_blank", "noopener");
              }}
              onOpenArtifact={(a) => {
                setTip(null);
                setView({ kind: "art", artifact: a });
              }}
              onAddArtifact={() => {
                setTip(null);
                setView({ kind: "add-art" });
              }}
              onOpenRetro={(key) => {
                setTip(null);
                setAsking({ kind: "retro", key });
              }}
              onTip={setTip}
            />
          )}
          {tip && (
            <div className="tip" style={{ left: Math.max(6, tip.x - 120), top: Math.max(4, tip.y - 58) }} onMouseEnter={() => setTip(null)}>
              <small>{tip.head}</small>
              {tip.text}
            </div>
          )}
        </div>
      </div>
      {view && state && (
        // 책과 카드는 화면 전체로 펼친다. 바깥을 누르면 닫히고 서랍으로 돌아간다
        <div className="floor-modal full" onClick={(e) => e.target === e.currentTarget && setView(null)}>
          {view.kind === "book" ? (
            <DobbyWorkBook name={name} book={view.book} artifacts={state.artifacts} onClose={() => setView(null)} onOpenArtifact={(a) => setView({ kind: "art", artifact: a })} onRetro={(key) => (setView(null), setDrawer(false), setAsking({ kind: "retro", key }))} />
          ) : view.kind === "active" ? (
            (() => {
              const lb = liveBook(state, view.key);
              const done = state.books.find((b) => b.key === view.key);
              const book = lb?.book ?? done;
              return !book ? null : <DobbyWorkBook name={name} book={book} live={lb?.live} artifacts={state.artifacts} onClose={() => setView(null)} onOpenArtifact={(a) => setView({ kind: "art", artifact: a })} />;
            })()
          ) : view.kind === "add-art" ? (
            <ArtifactAdd name={name} artifacts={state.artifacts} onClose={() => setView(null)} />
          ) : (
            (() => {
              const a = view.artifact, done = state.books.find((b) => b.key === a.taskKey);
              const active = !done && a.taskKey && state.tasks.some((t) => t.key === a.taskKey);
              return <DobbyArtifactBook artifact={a} onClose={() => setView(null)} onOpenWork={done ? () => openBook(done) : active ? () => setView({ kind: "active", key: a.taskKey }) : undefined} />;
            })()
          )}
        </div>
      )}
      <ul className="office-log" aria-label="최근 이벤트" tabIndex={0}>
        {state?.log.map((l) => (
          <li key={l.seq}>
            {hhmmss(l.at)} {l.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
