"use client";
import { useCallback, useEffect, useState } from "react";

type DemoState = { step: number; total: number; label: string };

/**
 * 도비 사무실의 데모 컨트롤 바 — 대시보드가 데모 모드(.demo-meta)일 때만 우하단에 뜬다.
 * 진행(다음/리셋/삭제)은 전부 대시보드 /api/demo 가 처리하고, 이 화면은 5초 틱이 파일을 읽어 따라온다.
 */
export function DobbyDemoBar({ name }: { name: string }) {
  const [state, setState] = useState<DemoState | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const api = `/api/office/demo`;

  const load = useCallback(async () => {
    const j = await fetch(api, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    setState(j?.demo ? (j.state as DemoState) : null);
  }, [api]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const act = useCallback(
    async (action: "start" | "next" | "reset" | "clean") => {
      if (action === "clean" && !window.confirm("데모 데이터(.demo-meta)를 삭제할까요?")) return;
      setBusy(true);
      setErr("");
      const j = await fetch(api, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      }).then((r) => r.json()).catch(() => null);
      setBusy(false);
      if (!j?.ok) return setErr(j?.error ?? "실패");
      setState((j.state as DemoState) ?? null);
    },
    [api]
  );

  if (!state) return null;
  const started = state.step >= 0;
  const ended = started && state.step >= state.total;

  const btn: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.12)", color: "#fff",
    borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontSize: 12,
  };
  return (
    <div
      style={{
        position: "fixed", right: 16, bottom: 16, zIndex: 60, display: "flex", alignItems: "center", gap: 8,
        background: "rgba(30, 20, 60, 0.88)", color: "#fff", borderRadius: 10, padding: "8px 12px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.35)", fontSize: 12,
      }}
    >
      <span style={{ fontWeight: 700, color: "#d3adf7" }}>데모</span>
      <span>{started ? `${state.step}/${state.total} · ${state.label}` : "시작 전"}</span>
      {!started || ended ? (
        <button style={btn} disabled={busy} onClick={() => act("start")}>▶ 시작</button>
      ) : (
        <button style={{ ...btn, background: "#531dab", borderColor: "#531dab" }} disabled={busy} onClick={() => act("next")}>⏭ 다음</button>
      )}
      <button style={btn} disabled={busy} onClick={() => act("reset")} title="처음부터">⟲</button>
      <button style={btn} disabled={busy} onClick={() => act("clean")} title="데모 데이터 삭제">🗑</button>
      {err && <span style={{ color: "#ff9c9c" }}>{err}</span>}
    </div>
  );
}
