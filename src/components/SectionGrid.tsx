"use client";

import Link from "next/link";
import Card from "@/components/ui/Card";
import Chip from "@/components/ui/Chip";
import { ICONS } from "@/components/ui/icons";
import type { Section } from "@/lib/sections";
import { AREA_LABELS, AREA_ORDER } from "@/lib/sections";
import type { Metric, CardStats } from "@/lib/lifecycle";

/** 지표 색 이름 → 토큰 의미색. */
const METRIC_COLOR: Record<string, string> = {
  blue: "var(--info-fg)",
  green: "var(--ok-fg)",
  red: "var(--danger-fg)",
  orange: "var(--warn-fg)",
};

function MetricRow({ metrics, size = 22 }: { metrics: Metric[]; size?: number }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: "4px 18px" }}>
      {metrics.map((m) => (
        <div key={m.label} style={{ lineHeight: 1.2 }}>
          <span
            style={{
              fontSize: size,
              fontWeight: 600,
              color: m.color ? METRIC_COLOR[m.color] : undefined,
            }}
          >
            {m.value}
          </span>{" "}
          <span className="ui-sm">{m.label}</span>
        </div>
      ))}
    </div>
  );
}

/** 카드 지표 영역: 위=전체 통계, 아래=오늘의 통계(구획 분리). */
function Metrics({ stats }: { stats: CardStats }) {
  return (
    <div style={{ marginTop: 14 }}>
      <MetricRow metrics={stats.overall} />
      {stats.today.length > 0 && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 10,
            borderTop: "1px solid var(--line)",
          }}
        >
          <span className="ui-sm" style={{ fontSize: 11, display: "block", marginBottom: 4 }}>
            오늘
          </span>
          <MetricRow metrics={stats.today} size={18} />
        </div>
      )}
    </div>
  );
}

function SectionCard({
  section,
  stats,
}: {
  section: Section;
  stats?: CardStats;
}) {
  const Icon = ICONS[section.icon];
  const body = (
    <Card
      hover={section.enabled}
      style={{ height: "100%", boxSizing: "border-box", opacity: section.enabled ? 1 : 0.55 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="ui-card-icon">
          <Icon size={26} />
        </span>
        <h3 className="ui-h3">
          {section.title}
          {!section.enabled && <Chip tone="neutral">준비 중</Chip>}
        </h3>
      </div>
      <p className="ui-sub" style={{ marginTop: 12, marginBottom: 0 }}>
        {section.description}
      </p>
      {stats && stats.overall.length > 0 ? (
        <Metrics stats={stats} />
      ) : (
        section.enabled && (
          <span className="ui-sm" style={{ marginTop: 14, display: "block" }}>
            아직 기록 없음
          </span>
        )
      )}
    </Card>
  );

  if (!section.enabled) return body;

  return (
    <Link href={section.path} style={{ display: "block", height: "100%", color: "inherit", textDecoration: "none" }}>
      {body}
    </Link>
  );
}

export default function SectionGrid({
  sections,
  stats,
}: {
  sections: Section[];
  stats: Record<string, CardStats>;
}) {
  return (
    <div>
      {AREA_ORDER.map((area) => {
        const items = sections.filter((s) => s.area === area);
        if (items.length === 0) return null;
        return (
          <div key={area} style={{ marginTop: 24 }}>
            <h2 className="ui-label">{AREA_LABELS[area]}</h2>
            <div className="ui-grid">
              {items.map((s) => (
                <SectionCard key={s.key} section={s} stats={stats[s.key]} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
