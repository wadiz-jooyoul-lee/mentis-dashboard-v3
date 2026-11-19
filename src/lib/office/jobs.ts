// 서버 전용. 왼쪽 모니터(팀 이슈 현황)에 보일 요약.
// 조사 예약과 실행은 대시보드 dobbyJobs 하나가 맡는다(오피스의 따로 돌던 조사 티커는 가져오지 않았다). 여기서는 그 상태와 결과를 줄여 보여 주기만 한다
import { jobsStatus, readJobsData, type JobsStatus } from "@/lib/dobbyJobs";

export type JobsSummary = {
  status: JobsStatus | null;
  until?: string;
  mode?: string;
  counts?: Record<string, number>;
  crit?: { issue: string; summary: string; assignee: string; order: string }[];
};

// 바뀐 종류별 수와, 내 오더와 같은 파일을 고친 남의 이슈("충돌 주의")
export async function jobsSummary(): Promise<JobsSummary> {
  const status = await jobsStatus();
  const d = readJobsData();
  if (!d) return { status };
  const kind = (i: (typeof d.issues)[number]) => ({ "진행 중": "진행 시작", 해결됨: "해결됨", 종료: "종료" })[i.changes?.at(-1)?.to ?? ""] ?? "새로 생김";
  const picked = d.issues.filter((i) => i.picked);
  const counts = Object.fromEntries(["새로 생김", "진행 시작", "해결됨", "종료"].map((k) => [k, picked.filter((i) => kind(i) === k).length]));
  const by = new Map(d.issues.map((i) => [i.key, i]));
  const crit = d.overlaps.flatMap((o) => {
    const i = o.level === "충돌 주의" ? by.get(o.issue) : undefined;
    return i ? [{ issue: o.issue, summary: i.summary, assignee: i.assignee, order: o.order }] : [];
  });
  return { status, until: d.until, mode: d.mode, counts: d.mode === "daily" ? counts : undefined, crit };
}
