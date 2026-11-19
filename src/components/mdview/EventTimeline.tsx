"use client";

import { timelineOf, type Tick } from "@/lib/mdview";
import type { EventRow } from "@/lib/parseOrchestration";
import { Text } from "@/components/ui/Typo";

/*
 * 이벤트 타임라인 — orchestration.md 이벤트 로그를 세로 줄로 그린다.
 * 항목 사이 간격을 시간 차이에 맞춰 벌린다(로그 눈금 — 몇 분과 몇 시간이 한눈에 갈리도록).
 * 30분 넘게 비면 "N시간 M분 뒤" 를 적어 멈췄던 구간이 보이게 한다.
 * 항목을 못 읽으면(null) 아무것도 그리지 않는다 — 호출부가 원문 렌더로 대신한다.
 */
function gapText(min: number): string {
  if (min < 60) return `${min}분`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}시간 ${m}분` : `${h}시간`;
}

export default function EventTimeline({ events }: { events: EventRow[] }) {
  const ticks: Tick[] | null = timelineOf(events);
  if (!ticks) return null;
  return (
    <ol className="mv-timeline">
      {ticks.map((t, i) => {
        const gap = t.gapMin ?? 0;
        // 0분 → 4px, 10분 → 약 14px, 1시간 → 약 22px, 하루 → 약 40px
        const space = i === 0 ? 0 : Math.round(4 + Math.log2(1 + gap) * 2.6);
        return (
          <li key={`${t.ts}-${i}`} style={{ paddingTop: space }}>
            {i > 0 && gap >= 30 && <div className="mv-timeline-gap">{gapText(gap)} 사이</div>}
            <span className="mv-timeline-dot" aria-hidden />
            <div className="mv-timeline-text">
              <Text>{t.text}</Text>
              <Text type="secondary" style={{ fontSize: 12, marginLeft: 8, whiteSpace: "nowrap" }}>
                {t.ts}
              </Text>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
