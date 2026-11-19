"use client";

import type { ReleaseCounts } from "@/lib/releases";
import { Text } from "@/components/ui/Typo";


export const RELEASE_TONE = {
  pass: "var(--ok-fg)",
  fail: "var(--danger-fg)",
  hold: "var(--warn-fg)",
  skip: "var(--line)",
} as const;

/** 핵심 TC 진행 막대. 칸 비율은 전체 대비, 판정 칸이 빈 TC 몫은 비워 둔다. */
export default function ReleaseProgress({ counts, height = 6 }: { counts: ReleaseCounts; height?: number }) {
  const { total, done } = counts;
  const parts = [
    { n: counts.pass, c: RELEASE_TONE.pass },
    { n: counts.fail, c: RELEASE_TONE.fail },
    { n: counts.hold, c: RELEASE_TONE.hold },
    { n: counts.skip, c: RELEASE_TONE.skip },
  ];
  return (
    <div style={{ width: "100%", minWidth: 140 }}>
      <div style={{ display: "flex", height, borderRadius: height / 2, overflow: "hidden", background: "var(--bg-sunken)" }}>
        {total > 0 &&
          parts.map((p, i) => <div key={i} style={{ width: `${(p.n / total) * 100}%`, background: p.c }} />)}
      </div>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {total > 0 ? `${done} / ${total} (${Math.round((done / total) * 100)}%)` : "핵심 TC 없음"}
      </Text>
    </div>
  );
}
