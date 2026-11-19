"use client";

import MarkdownDoc from "@/components/MarkdownDoc";
import { reviewOf, type Finding } from "@/lib/mdview";
import type { Severity } from "@/lib/reviewCards";
import Chip, { type ChipTone } from "@/components/ui/Chip";
import Stack from "@/components/ui/Stack";
import Tabs from "@/components/ui/Tabs";
import Tip from "@/components/ui/Tip";
import { Text } from "@/components/ui/Typo";
import "../markdown.css";

/*
 * 리뷰 카드 — reviews/round-N/*.md 를 심각도 칩 카드로 그린다(예전 ReviewCards 를 흡수).
 * 지적 머리글(## [blocker] …)이 없는 리뷰는 reviewOf 가 null 이라 원래 문서 렌더로 떨어진다.
 */
const SEVERITY: Record<Severity, { label: string; tone: ChipTone; help: string }> = {
  blocker: { label: "막는 지적 · blocker", tone: "danger", help: "고치기 전에는 다음 단계로 가지 못합니다." },
  major: { label: "막는 지적 · major", tone: "danger", help: "고치기 전에는 다음 단계로 가지 못합니다." },
  minor: { label: "가벼운 지적 · minor", tone: "warn", help: "고치면 좋지만 다음 단계를 막지는 않습니다." },
  nit: { label: "사소한 지적 · nit", tone: "neutral", help: "취향에 가까운 의견입니다." },
};

/** "설계와 구현" 줄 — 누가 이어받는지를 가르는 사실이라 카드 머리에 눈에 띄게 둔다. */
function FitChip({ f }: { f: Finding }) {
  if (!f.fitText) return null;
  const next = !f.blocking ? "" : f.fit === "same" ? "기획자가 설계를 다시 봅니다" : f.fit === "diff" ? "만든 담당자가 고칩니다" : "";
  return (
    <Tip
      title={
        f.fit === "same"
          ? "설계대로 만들었는데 결함이 있습니다. 설계를 고쳐야 풀립니다."
          : f.fit === "diff"
            ? "설계가 정한 것과 다르게 만들었습니다."
            : undefined
      }
    >
      <Chip tone={f.fit === "same" ? "accent" : f.fit === "diff" ? "info" : "neutral"}>
        설계와 구현: {f.fitText}
        {next && ` → ${next}`}
      </Chip>
    </Tip>
  );
}

function FindingCard({ f }: { f: Finding }) {
  const s = SEVERITY[f.severity];
  return (
    <div data-review-card={f.severity} className={`mv-finding sev-${f.severity}`}>
      <Stack size={[6, 6]} wrap style={{ marginBottom: f.body ? 6 : 0 }}>
        <Tip title={s.help}>
          <Chip tone={s.tone}>{s.label}</Chip>
        </Tip>
        <Text strong>{f.claim || "(제목 없음)"}</Text>
        <FitChip f={f} />
      </Stack>
      {f.file && (
        <div style={{ marginBottom: 6 }}>
          <Text code style={{ fontSize: 12 }}>
            {f.file}
          </Text>
        </div>
      )}
      {f.body && <MarkdownDoc md={f.body} bare />}
    </div>
  );
}

/** 리뷰 결과 한 파일. */
export default function ReviewFindings({ md }: { md: string }) {
  const r = reviewOf(md);
  if (!r) return <MarkdownDoc md={md} bare />;
  const n = (sev: Severity) => r.findings.filter((f) => f.severity === sev).length;
  const blocking = r.findings.filter((f) => f.blocking).length;
  const toPlanner = r.findings.filter((f) => f.blocking && f.fit === "same").length;
  let k = 0;
  return (
    <Stack vertical size={10} style={{ width: "100%" }}>
      <Stack size={[6, 6]} wrap>
        <Chip tone={blocking ? "danger" : "ok"}>{blocking ? `막는 지적 ${blocking}건` : "막는 지적 없음"}</Chip>
        {(["blocker", "major", "minor", "nit"] as const).map((sev) =>
          n(sev) ? (
            <Chip key={sev}>
              {sev} {n(sev)}
            </Chip>
          ) : null,
        )}
        {toPlanner > 0 && <Chip tone="accent">설계를 다시 봐야 하는 지적 {toPlanner}건</Chip>}
      </Stack>
      {/* 지적 카드와 그 사이의 글(머리말·"확인함" 절)을 원래 순서대로 */}
      {r.doc.blocks.map((b, i) =>
        b.type === "finding" ? <FindingCard key={i} f={r.findings[k++]} /> : <MarkdownDoc key={i} md={b.md} bare />,
      )}
    </Stack>
  );
}

/** 한 담당자의 리뷰 여러 차수 — 차수 탭으로 넘겨 본다(최신 차수가 먼저). */
export function ReviewRounds({ rounds }: { rounds: { round: string | number; content: string }[] }) {
  if (rounds.length === 1) return <ReviewFindings md={rounds[0].content} />;
  return (
    <Tabs
      size="sm"
      items={rounds.map((rv) => {
        const r = reviewOf(rv.content);
        const blocking = r?.findings.filter((f) => f.blocking).length ?? 0;
        return {
          key: String(rv.round),
          label: (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {rv.round}차
              {r && <Chip count={blocking} tone={blocking ? "danger" : "ok"} />}
            </span>
          ),
          children: <ReviewFindings md={rv.content} />,
        };
      })}
    />
  );
}
