import { reportsOf, stamp, whereOf, type ReportItem, type Reports } from "@/lib/office/core/report";
import { autoDecisionCount } from "@/lib/office/ask";
import { bus, notice, phaseName, rolesOf, UNIT_NAME, unitOf } from "@/lib/office/floor";
import { metaDir } from "@/lib/office/source";

// 도비 사무실의 보고서. 항목은 사무실의 작업 전부이고, 동기화가 판정 헬퍼의 진행 중 오더와 맞춰 둔다
export function dobbyReports(): Reports {
  const meta = metaDir();
  return reportsOf(
    bus().current.tasks.map((t) => {
      const n = notice(t.key) ?? { text: "", cmd: `/do ${t.key}`, action: "", kind: "", asking: false };
      const u = unitOf(t.key);
      const last = t.report ? `${t.report.by} · ${stamp(t.report.at)} · ${t.report.result}` : "아직 끝난 실행이 없습니다";
      const result = u ? `진행 중(${UNIT_NAME[u.by] ?? u.by}) — ${last}` : last;
      const mine = !!t.human; // 판정 헬퍼의 mine 이 참이면 물음표가 떠 있다
      // 사람 차례의 안내는 답하는 길에 따라 다르다: 질문 창, 버튼, 글 답(옛 보류), 터미널 명령(명령은 아래에 따로 보인다)
      const todo = n.asking
        ? "물음표를 눌러 질문에 답해 주세요. 답하면 이어서 진행합니다"
        : n.action
          ? "물음표를 눌러 버튼으로 진행해 주세요"
          : n.kind === "decision"
            ? "물음표를 눌러 답을 적거나, 터미널에서 아래 명령으로 답해 주세요"
            : n.cmd
              ? "위 할 일을 한 뒤 터미널에서 아래 명령으로 이어 가 주세요"
              : "물음표를 눌러 할 일을 확인해 주세요";
      const step = mine ? todo : u ? "진행 중입니다. 끝나면 캐비닛에 들어옵니다" : n.text || n.cmd;
      // 사람의 확정 없이 기획자가 정한 것이 있으면 한 번 보라고 알린다
      const auto = meta && !t.retroOf ? autoDecisionCount(meta, t.key) : 0;
      const next = auto ? `${step} · 스스로 정한 결정 ${auto}건(대시보드에서 볼 수 있습니다)` : step;
      const item: ReportItem = { key: t.key, title: t.title, color: t.color, phase: phaseName(t.phase, rolesOf(t.key)), where: whereOf(t), result, human: mine ? n.text : "", humanKind: mine ? "human" : undefined, next, cmd: n.cmd };
      return { item, at: t.report?.at ?? t.createdAt };
    }),
  );
}
