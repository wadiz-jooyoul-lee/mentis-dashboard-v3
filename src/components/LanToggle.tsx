"use client";

import { useState, useSyncExternalStore } from "react";
import Tip from "@/components/ui/Tip";
import { Switch } from "@/components/ui/Form";
import { Globe, Lock } from "lucide-react";

type State = { on: boolean; canToggle: boolean; host: string | null };

// 머리말 단추와 설정 창이 같은 상태를 본다. 한쪽에서 바꾸면 다른 쪽도 함께 바뀐다
let lan: State | null = null;
let loading = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
function load() {
  if (loading) return;
  loading = true;
  fetch("/api/lan")
    .then((r) => r.json())
    .then((d: State) => (lan = d))
    .catch(() => (lan = null))
    .finally(() => {
      loading = false;
      emit();
    });
}
function subscribe(f: () => void) {
  subs.add(f);
  if (!lan) load();
  return () => subs.delete(f);
}

export function useLan() {
  const s = useSyncExternalStore(subscribe, () => lan, () => null);
  const [busy, setBusy] = useState(false);
  async function toggle(next: boolean) {
    setBusy(true);
    try {
      const r = await fetch("/api/lan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ on: next }),
      });
      if (r.ok) {
        lan = await r.json();
        emit();
      }
    } finally {
      setBusy(false);
    }
  }
  return { s, busy, toggle };
}

/** 공개 상태 설명. 머리말 말풍선과 설정 창이 같이 쓴다. */
export function lanTip(s: State): string {
  return !s.canToggle
    ? "공개 여부는 대시보드가 실행 중인 맥에서만 바꿀 수 있습니다."
    : s.on
      ? s.host
        ? `다른 기기에서 접속 가능: http://${s.host}:${location.port || 7253}`
        : "같은 네트워크의 다른 기기에서 접속 가능합니다."
      : "이 맥에서만 열립니다. 켜면 같은 네트워크의 다른 기기에서도 열립니다.";
}

/**
 * 헤더의 "외부 공개" 토글. 켜면 같은 네트워크의 다른 기기에서도 대시보드가 열린다.
 *
 * 서버는 항상 열려 있고 `src/proxy.ts`가 이 값을 보고 막으므로, 재기동 없이 즉시 바뀐다.
 * 다른 기기에서 볼 때는 스위치가 잠긴다(끄고 켜는 건 이 맥에서만).
 */
export default function LanToggle() {
  const { s, busy, toggle } = useLan();
  if (!s) return null;
  const tip = lanTip(s);

  return (
    <Tip title={tip}>
      <span
        style={{
          // 밝은 머리띠 위 글자색 — 켜짐은 경고 성격이라 경고색, 꺼짐은 보조 글색(토큰).
          color: s.on ? "var(--warn-fg)" : "var(--fg-soft)",
          fontSize: 13,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {s.on ? <Globe size="1em" /> : <Lock size="1em" />}
        외부 공개
        <Switch
          checked={s.on}
          disabled={!s.canToggle || busy}
          onChange={toggle}
          size="sm"
          aria-label="외부 공개"
        />
      </span>
    </Tip>
  );
}
