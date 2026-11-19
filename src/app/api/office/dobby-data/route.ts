import { denyRemote } from "@/lib/localOnly";
import { selfUrl } from "@/lib/office/self";
import { dashboardUrl } from "@/lib/office/office";
import { log } from "@/lib/office/floor";
import { dataJob, isDataKey, listData, readData, runningOf, type DataCmd } from "@/lib/office/data";
import { metaDir } from "@/lib/office/source";

export const dynamic = "force-dynamic";

const REASON: Record<string, string> = { already_running: "이 오더에서 다른 데이터 작업이 돌고 있습니다.", invalid_key: "오더 키가 올바르지 않습니다." };
const CMD_NAME: Record<DataCmd, string> = { spec: "스펙 만들기", run: "데이터 수집" };

// 도비 사무실 오른쪽 모니터: 해결된 오더의 데이터 분석. key 가 없으면 목록, 있으면 그 오더의 결과 한 장
export async function GET(req: Request) {
  const meta = metaDir();
  if (!meta) return Response.json({ error: "도비 사무실에서만 쓸 수 있습니다." }, { status: 404 });
  const key = new URL(req.url).searchParams.get("key") ?? "";
  if (!key) {
    const items = await Promise.all(listData(meta).map(async (i) => ({ ...i, running: await runningOf(i.key) })));
    return Response.json({ items });
  }
  if (!isDataKey(key)) return Response.json({ error: "오더 키가 올바르지 않습니다." }, { status: 400 });
  const [spec, run] = await Promise.all([dataJob(key, "spec"), dataJob(key, "run")]);
  // 도는 작업을 먼저, 없으면 방금 실패한 작업을 보여 준다
  const job = [spec, run].find((j) => j?.state === "running") ?? [run, spec].find((j) => j?.state === "failed") ?? null;
  return Response.json({ ...readData(meta, key), running: job?.state === "running" ? job.cmd : null, job, url: `${dashboardUrl(key)}/data` });
}

// 스펙 만들기와 데이터 수집은 대시보드의 데이터 작업(/dobby-data spec|run {키})으로 넘긴다. 오더의 data/ 만 쓰므로 읽기 전용 사무실에서도 허용한다
export async function POST(req: Request) {
  const denied = denyRemote(req); if (denied) return denied;
  if (!metaDir()) return Response.json({ error: "도비 사무실에서만 쓸 수 있습니다." }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { key?: string; cmd?: string };
  const key = body.key ?? "";
  if (!isDataKey(key) || (body.cmd !== "spec" && body.cmd !== "run")) return Response.json({ error: "오더 키나 명령이 올바르지 않습니다." }, { status: 400 });
  try {
    const r = await fetch(`${selfUrl()}/api/orders`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: body.cmd, key }) });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) return Response.json({ error: REASON[j.error ?? ""] ?? j.error ?? `대시보드가 거절했습니다(${r.status}).` }, { status: 409 });
    log(`${key} 오른쪽 모니터에서 ${CMD_NAME[body.cmd]} 시작`);
    return Response.json({ ok: true }, { status: 202 });
  } catch {
    return Response.json({ error: "mentis 대시보드에 닿지 못했습니다. 대시보드가 켜져 있는지 확인해 주세요." }, { status: 502 });
  }
}
