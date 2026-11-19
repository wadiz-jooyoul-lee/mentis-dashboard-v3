"use client";

import { useCanAct } from "@/components/CanAct";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Chip from "@/components/ui/Chip";
import Button from "@/components/ui/Button";
import { IconSave, IconCloudUpload, IconCheckCircle, IconChevronRight } from "@/components/ui/icons";

type Status = {
  lastBackupAt: string | null;
  pending: number;
  running: boolean;
  buttonThreshold: number;
  autoThreshold: number;
};

function fmt(iso: string | null): string {
  if (!iso) return "없음";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "없음";
  return d.toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * 홈 상단 백업 상태 카드.
 * - 마지막 백업 시각 + 미백업(마지막 백업 이후 새/수정) 세션 수 표시.
 * - 미백업 ≥ 버튼임계(10): "백업하기" 버튼 노출(수동).
 * - 미백업 ≥ 자동임계(20): 페이지 진입 시 1회 백그라운드 자동 백업.
 */
export default function BackupStatus({ initial = null }: { initial?: Status | null }) {
  const canAct = useCanAct();
  const [st, setSt] = useState<Status | null>(initial);
  const [busy, setBusy] = useState(false);
  const autoFired = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  // 전역 토스트(antd message) 대신 카드 안 인라인 문구. 4초 뒤 사라진다.
  const [note, setNote] = useState<{ text: string; tone: "ok" | "danger" } | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = useCallback((text: string, tone: "ok" | "danger") => {
    if (noteTimer.current) clearTimeout(noteTimer.current);
    setNote({ text, tone });
    noteTimer.current = setTimeout(() => setNote(null), 4000);
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/backup", { cache: "no-store" });
      setSt(await r.json());
    } catch {
      /* 무시 */
    }
  }, []);

  const run = useCallback(
    async (auto: boolean) => {
      setBusy(true);
      try {
        const r = await fetch("/api/backup", { method: "POST" });
        if (r.ok) {
          if (!auto) flash("백업을 시작했습니다", "ok");
          await load();
        } else if (!auto) {
          flash("백업 시작 실패", "danger");
        }
      } finally {
        setBusy(false);
      }
    },
    [load, flash]
  );

  // 최초 로드
  useEffect(() => {
    load();
  }, [load]);

  // 자동 백업(진입 시 1회): 미백업이 자동임계 이상이고 진행 중이 아니면.
  useEffect(() => {
    if (!st || autoFired.current) return;
    if (!st.running && st.pending >= st.autoThreshold) {
      autoFired.current = true;
      run(true);
    }
  }, [st, run]);

  // 진행 중이면 폴링(끝나면 최종 상태 반영).
  useEffect(() => {
    if (st?.running) {
      timer.current = setInterval(load, 3000);
      return () => {
        if (timer.current) clearInterval(timer.current);
      };
    }
  }, [st?.running, load]);

  if (!st) return null;

  const showButton = st.pending >= st.buttonThreshold;
  const upToDate = st.pending === 0;

  return (
    <Card style={{ marginBottom: 16, padding: "10px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
            <span style={{ color: "var(--fg-soft)", display: "inline-flex" }}>
              <IconCloudUpload size={16} />
            </span>
            세션 백업
          </span>
          <span className="ui-sub">마지막 백업: {fmt(st.lastBackupAt)}</span>
          {st.running ? (
            <Chip tone="info">백업 중…</Chip>
          ) : upToDate ? (
            <Chip tone="ok">
              <IconCheckCircle size={12} />
              최신
            </Chip>
          ) : (
            <Chip tone={showButton ? "warn" : "neutral"}>미백업 {st.pending}개</Chip>
          )}
          {note && <span className={`ui-note tone-${note.tone}`} role="status">{note.text}</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {canAct && showButton && !st.running && (
            <Button variant="solid" size="sm" busy={busy} onClick={() => run(false)}>
              {!busy && <IconSave size={14} />}
              백업하기
            </Button>
          )}
          <Link
            href="/backup"
            className="ui-link"
            style={{ fontSize: 12, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 2 }}
          >
            목록·히스토리 <IconChevronRight size={12} />
          </Link>
        </div>
      </div>
      {st.pending >= st.autoThreshold && st.running && (
        <span className="ui-sm" style={{ fontSize: 12, display: "block", marginTop: 6 }}>
          미백업이 {st.autoThreshold}개를 넘어 자동으로 백업하고 있습니다.
        </span>
      )}
    </Card>
  );
}
