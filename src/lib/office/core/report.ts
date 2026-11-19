import type { TaskState } from "@/lib/office/core/types";

// 보고서 캐비닛 창에 보이는 작업 한 줄
export interface ReportItem {
  key: string;
  title: string;
  color: number;
  phase: string;
  where: "floor" | "cabinet" | "board"; // 서류철이 지금 어디 있나
  result: string; // "자동 실행 · 11-06 09:12 · 통합까지 끝났습니다" 꼴. 아직 없으면 "아직 끝난 실행이 없습니다"
  human: string; // 사람이 할 일. 없으면 ""
  humanKind?: "human" | "confirm"; // 물음표(사람 확인) 또는 느낌표(완료 확인) 단추
  next: string; // 다음 추천 한 줄
  cmd?: string; // 칠 명령(도비 사무실)
}
export interface Reports {
  items: ReportItem[];
  top: string; // 창 맨 위의 "지금 할 일" 한 줄
}

export const whereOf = (t: TaskState): ReportItem["where"] => (t.folder.kind === "agent" ? "floor" : t.folder.kind);
const pad = (n: number) => String(n).padStart(2, "0");
export const stamp = (at: number) => {
  const d = new Date(at);
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// 지금 할 일: 사람이 할 일이 있는 것 중 가장 오래된 것 → 캐비닛에 있고 칠 명령이 있는 것 중 가장 오래된 것 → 기다리기
export function reportsOf(rows: { item: ReportItem; at: number }[]): Reports {
  const old = (xs: typeof rows) => [...xs].sort((a, b) => a.at - b.at)[0]?.item;
  const h = old(rows.filter((r) => r.item.human));
  const c = old(rows.filter((r) => r.item.where === "cabinet" && r.item.cmd));
  const top = h ? `${h.key} — ${h.human}` : c ? `${c.key} — ${c.next}` : "지금은 기다리면 됩니다. 진행 중인 작업이 끝나면 여기에 알려 드립니다.";
  // 사람이 할 일이 있는 것 → 서류철이 바닥에 있는 것 → 나머지, 같은 묶음 안에서는 키 순서
  const rank = (i: ReportItem) => (i.human ? 0 : i.where !== "cabinet" ? 1 : 2);
  const items = rows.map((r) => r.item).sort((a, b) => rank(a) - rank(b) || a.key.localeCompare(b.key));
  return { items, top };
}
