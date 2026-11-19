import { denyRemote } from "@/lib/localOnly";
import { selfUrl } from "@/lib/office/self";
import { bus, isFree, log, reserve } from "@/lib/office/floor";
import { KINDS, checkIntake, type IntakeEnv, type IntakeKind } from "@/lib/office/doCommand";

export const dynamic = "force-dynamic";

// 대시보드가 돌려주는 거절 이유를 쉬운 말로 바꾼다
const REASON: Record<string, string> = { already_running: "이미 자동 실행 중인 이슈입니다.", empty: "Jira 이슈나 내용을 적어 주세요." };
// 대시보드가 돌려주는 오더 키(Jira 키 또는 새로 잡은 TASK- 키)
const ORDER_KEY_RE = /^([A-Z][A-Z0-9]*-\d+|TASK-[A-Za-z0-9-]+)$/;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

// 도비 사무실 업무 맡기기: 쉬는 에이전트를 눌러 고른 종류와 입력을 대시보드의 오더 실행으로 넘긴다.
// 대시보드가 받아들이면 그 에이전트를 기획자로 종류에 맞는 곳에 바로 자리를 잡는다(설계 세션이 폴더를 만들기 전에).
// 명령 글은 받지 않는다. 같은 규칙(checkIntake)으로 검사한 값만 넘기고, 대시보드가 명령을 다시 만든다.
// Jira 이슈가 없으면 대시보드가 작업 키를 잡아 돌려준다. 자리는 그 키로 잡는다
export async function POST(req: Request) {
  const denied = denyRemote(req); if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const kind = str(body.kind) as IntakeKind;
  if (!KINDS[kind]) return Response.json({ error: "작업 종류를 골라 주세요." }, { status: 400 });
  const input = { kind, target: str(body.target), env: str(body.env) as IntakeEnv, base: str(body.base), note: str(body.note) };
  const checked = checkIntake(input);
  if (!checked.ok) return Response.json({ error: checked.error }, { status: 400 });
  // 맡을 사람. 없으면(옛 화면) 지금처럼 쉬는 사람 가운데 무작위로 앉힌다
  const agentId = str(body.agentId);
  if (agentId && !bus().current.agents.some((a) => a.id === agentId)) return Response.json({ error: "모르는 에이전트입니다." }, { status: 400 });
  if (agentId && !isFree(agentId)) return Response.json({ error: "agent_busy" }, { status: 409 });
  const f = (body.from ?? {}) as Record<string, unknown>, fx = num(f.x), fy = num(f.y);
  const from = fx != null && fy != null ? { x: Math.max(0, Math.min(1700, fx)), y: Math.max(0, Math.min(850, fy)) } : undefined;
  // 쉬는 사람들의 지금 자리. 가까운 동료부터 고를 때 쓴다
  const near = (Array.isArray(body.near) ? body.near : []).slice(0, 60).flatMap((v: unknown) => {
    const p = (v ?? {}) as Record<string, unknown>, id = str(p.id), x = num(p.x), y = num(p.y);
    return id && x != null && y != null ? [{ id, x: Math.max(0, Math.min(1700, x)), y: Math.max(0, Math.min(850, y)) }] : [];
  });
  try {
    const r = await fetch(`${selfUrl()}/api/orders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ target: checked.jiraKey, env: checked.env, kind, base: checked.base, note: checked.note }),
    });
    const j = (await r.json().catch(() => ({}))) as { error?: string; command?: string; key?: string };
    if (!r.ok) return Response.json({ error: REASON[j.error ?? ""] ?? j.error ?? `대시보드가 거절했습니다(${r.status}).` }, { status: 409 });
    // 대시보드가 옛 판이면 Jira 이슈 없는 접수를 받지 못하고, 키를 돌려주지 않을 수 있다
    const key = j.key && ORDER_KEY_RE.test(j.key) ? j.key : checked.jiraKey;
    if (!key) return Response.json({ error: "대시보드가 오더 키를 돌려주지 않았습니다(대시보드를 새 판으로 올려 주세요)." }, { status: 502 });
    // 대시보드가 옛 판이면 종류 값을 모르고 지나칠 수 있다. 실제로 띄운 명령이 오지 않으면 알린다
    if (!j.command) log(`${key} 업무 맡기기: 대시보드가 실행한 명령을 돌려주지 않았습니다(대시보드를 새 판으로 올려 주세요)`);
    reserve(key, { lead: agentId || undefined, kind, from, near });
    log(`${key} 업무 맡기기로 ${KINDS[kind].name} 자동 실행 시작(${checked.env ? `${checked.env} 배포·검증까지` : kind === "doc" || kind === "research" ? "배포 없음" : checked.jiraKey ? "통합까지" : "PR 만들기까지"})`);
    return Response.json({ ok: true, key, command: j.command ?? "" });
  } catch {
    return Response.json({ error: "mentis 대시보드에 닿지 못했습니다. 대시보드가 켜져 있는지 확인해 주세요." }, { status: 502 });
  }
}
