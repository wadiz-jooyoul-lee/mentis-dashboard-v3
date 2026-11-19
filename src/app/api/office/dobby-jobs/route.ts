import { denyRemote } from "@/lib/localOnly";
import { jobsInstalled, jobsRun } from "@/lib/dobbyJobs";
import { jobsSummary } from "@/lib/office/jobs";

export const dynamic = "force-dynamic";

// 도비 사무실 왼쪽 모니터: 팀 이슈 조사 요약
export async function GET() {
  return Response.json(await jobsSummary());
}

// 지금 조사. 이미 돌고 있으면 시작하지 않는다(판정은 플러그인의 schedule.py). 조사는 오더를 바꾸지 않아 읽기 전용 사무실에서도 허용
export async function POST(req: Request) {
  const denied = denyRemote(req); if (denied) return denied;
  if (!jobsInstalled()) return Response.json({ error: "설치된 go-dobby 에 dobby-jobs 가 없습니다." }, { status: 501 });
  return Response.json({ result: await jobsRun() }, { status: 202 });
}
