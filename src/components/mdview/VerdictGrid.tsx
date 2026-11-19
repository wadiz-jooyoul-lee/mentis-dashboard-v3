"use client";

import { verdictsOf, type VerdictCell } from "@/lib/mdview";
import Tip from "@/components/ui/Tip";

/*
 * 판정 그리드 — 회차 결과(result.md)의 시나리오를 칸 하나씩 판정 색으로 깐다.
 * 칸에 마우스를 올리면 확인 항목과 근거가 뜬다. 표를 읽기 전에 어디가 빨간지 먼저 보이게 하는 자리다.
 * 시나리오 표를 못 읽으면(null) 아무것도 그리지 않는다 — 아래 표·상세 문서가 그대로 있다.
 */
const LABEL: Record<VerdictCell["verdict"], string> = {
  pass: "통과",
  fail: "실패",
  skip: "보류",
  warn: "주의",
  unknown: "판정 없음",
};

export default function VerdictGrid({ md, cells: given }: { md?: string; cells?: VerdictCell[] }) {
  const cells = given ?? (md ? verdictsOf(md) : null);
  if (!cells || cells.length === 0) return null;
  return (
    <div className="mv-verdicts" role="list" aria-label="시나리오 판정">
      {cells.map((c, i) => (
        <Tip
          key={`${c.tc}-${i}`}
          title={
            <span>
              <b>
                {c.tc} · {LABEL[c.verdict]}
              </b>
              {c.check && <><br />{c.check}</>}
              {c.basis && <><br />근거: {c.basis.length > 160 ? `${c.basis.slice(0, 160)}…` : c.basis}</>}
            </span>
          }
        >
          <span role="listitem" className={`mv-verdict v-${c.verdict}`}>
            {c.tc}
          </span>
        </Tip>
      ))}
    </div>
  );
}
