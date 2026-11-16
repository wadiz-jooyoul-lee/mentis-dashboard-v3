"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCanAct } from "@/components/CanAct";
import FeedView from "@/components/FeedView";
import OrderHeader from "@/components/OrderHeader";
import PerfReport from "@/components/PerfReport";
import type { PerfData } from "@/lib/perf";
import type { FeedItem, JobState } from "@/lib/jobs";
import s from "./PerfReport.module.css";

type PerfJob = { state: JobState; feed: FeedItem[] };
type RunState = "idle" | "running" | "failed";

const REASON_TEXT: Record<string, string> = {
  already_running: "이미 측정하고 있습니다.",
  invalid_key: "오더 키가 올바르지 않습니다.",
};

/**
 * 측정 시작·다시 측정 단추와 진행 표시. 작업 이름은 perf-{키}.
 * 끝나면 페이지 데이터를 다시 읽어 보고서로 바뀐다.
 */
function usePerfRun(epicKey: string, job: PerfJob | null) {
  const router = useRouter();
  const jobKey = `perf-${epicKey}`;
  const initial: RunState = job?.state === "running" ? "running" : job?.state === "failed" || job?.state === "stopped" ? "failed" : "idle";
  const [state, setState] = useState<RunState>(initial);
  const [feed, setFeed] = useState<FeedItem[]>(job?.feed ?? []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const poll = useCallback(async () => {
    try {
      const r = await fetch(`/api/orders?key=${encodeURIComponent(jobKey)}`, { cache: "no-store" });
      const st = await r.json();
      if (!st.state || st.state === "none") return;
      setFeed(st.feed ?? []);
      if (st.state === "running") return;
      if (st.state === "done") {
        setState("idle");
        router.refresh();
      } else setState("failed");
    } catch {
      /* 다음 주기에 다시 묻는다 */
    }
  }, [jobKey, router]);

  useEffect(() => {
    if (state !== "running") return;
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [state, poll]);

  const start = async (regen: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ perf: true, key: epicKey, regen }),
      });
      if (r.ok) {
        setFeed([]);
        setState("running");
      } else {
        const reason = (await r.json().catch(() => null))?.error as string | undefined;
        setError((reason && REASON_TEXT[reason]) ?? reason ?? "측정을 시작하지 못했습니다.");
        if (reason === "already_running") setState("running");
      }
    } finally {
      setBusy(false);
    }
  };

  return { state, feed, error, busy, start };
}

function RunPanel({ state, feed }: { state: RunState; feed: FeedItem[] }) {
  if (state === "idle") return null;
  return (
    <div className={`${s.runPanel} ${state === "failed" ? s.runFailed : ""}`}>
      <div className={s.runHead}>
        {state === "running" ? (
          <>
            <span className={s.runDot} /> 측정하고 있습니다. 끝나면 이 화면이 결과로 바뀝니다.
          </>
        ) : (
          "측정하지 못했습니다. 아래 실행 기록을 확인해 주세요."
        )}
      </div>
      <FeedView feed={feed} height={260} alwaysBottom={state === "failed"} />
    </div>
  );
}

function CopyCommand({ cmd }: { cmd: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 복사 권한이 없으면 명령을 직접 선택해 복사한다 */
    }
  };
  return (
    <div className={s.cmdRow}>
      <code className={s.cmd}>{cmd}</code>
      <button type="button" className={s.copyBtn} onClick={copy}>
        {copied ? "복사했습니다" : "복사"}
      </button>
    </div>
  );
}

export default function PerfView({
  epicKey,
  title = null,
  data,
  job = null,
  mode = null,
  worktreeRemoved = false,
  resolved = false,
  hasJira = false,
  hasDesign = false,
  hasQa = false,
  orderKind = null,
}: {
  epicKey: string;
  title?: string | null;
  data: PerfData | null;
  job?: PerfJob | null;
  mode?: string | null;
  worktreeRemoved?: boolean;
  resolved?: boolean;
  hasJira?: boolean;
  hasDesign?: boolean;
  hasQa?: boolean;
  orderKind?: "development" | "deliverable" | "summary" | null;
}) {
  const canAct = useCanAct();
  const run = usePerfRun(epicKey, job);
  const running = run.state === "running";
  const cmd = `/dobby-perf ${epicKey}`;

  return (
    <div>
      <OrderHeader
        epicKey={epicKey}
        title={title}
        mode={mode}
        worktreeRemoved={worktreeRemoved}
        resolved={resolved}
        hasJira={hasJira}
        hasDesign={hasDesign}
        hasQa={hasQa}
        orderKind={orderKind}
      />
      <div className={s.root}>
        {data ? (
          <>
            {canAct && (
              <div className={s.toolbar}>
                {run.error && <span className={s.runError}>{run.error}</span>}
                <button type="button" className={s.ghostBtn} disabled={running || run.busy} onClick={() => run.start(true)}>
                  {running ? "측정 중…" : "다시 측정"}
                </button>
              </div>
            )}
            <RunPanel state={run.state} feed={run.feed} />
            <PerfReport data={data} />
          </>
        ) : (
          <div className={s.empty}>
            <div className={s.emptyTitle}>아직 측정하지 않았습니다</div>
            <p className={s.emptyText}>
              측정하면 이 오더의 단계별 시간과 토큰, 속도 개선마다의 효과를 재서 이 화면에 보여 줍니다.
            </p>
            {canAct && (
              <button type="button" className={s.primaryBtn} disabled={running || run.busy} onClick={() => run.start(false)}>
                {running ? "측정 중…" : "측정 시작"}
              </button>
            )}
            {run.error && <div className={s.runError}>{run.error}</div>}
            <RunPanel state={run.state} feed={run.feed} />
            <div className={s.emptyAlt}>또는 Claude Code 에서 직접 실행할 수 있습니다.</div>
            <CopyCommand cmd={cmd} />
          </div>
        )}
      </div>
    </div>
  );
}
