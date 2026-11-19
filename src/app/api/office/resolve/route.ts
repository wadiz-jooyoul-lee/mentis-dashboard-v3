import { denyRemote } from "@/lib/localOnly";
import { selfUrl } from "@/lib/office/self";
import { log } from "@/lib/office/floor";

export const dynamic = "force-dynamic";

const KEY_RE = /^[A-Z][A-Z0-9]+-\d+$|^TASK-[A-Za-z0-9-]+$/;

// 완료 게시판의 해결 처리: 대시보드의 해결 표시(/dobby-resolve {키})를 부르고 결과를 돌려준다
export async function POST(req: Request) {
  const denied = denyRemote(req); if (denied) return denied;
  const { key = "" } = (await req.json().catch(() => ({}))) as { key?: string };
  if (!KEY_RE.test(key)) return Response.json({ error: "이슈 키가 올바르지 않습니다." }, { status: 400 });
  try {
    const r = await fetch(`${selfUrl()}/api/orders`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ resolve: true, key }) });
    const j = (await r.json().catch(() => ({}))) as { key?: string; error?: string };
    if (!r.ok || !j.key) return Response.json({ error: j.error === "already_running" ? "이미 해결 처리 중입니다." : `대시보드가 거절했습니다(${j.error ?? r.status}).` }, { status: 409 });
    const st = (await (await fetch(`${selfUrl()}/api/orders?jobResult=${encodeURIComponent(j.key)}`, { cache: "no-store" })).json().catch(() => ({}))) as { state?: string; result?: string };
    if (st.state === "failed" || st.result?.startsWith("❌")) return Response.json({ error: st.result?.replace(/^❌\s*/, "") || "해결 처리에 실패했습니다." }, { status: 500 });
    log(`${key} 완료 게시판에서 해결 처리`);
    return Response.json({ ok: true, key });
  } catch {
    return Response.json({ error: "mentis 대시보드에 닿지 못했습니다. 대시보드가 켜져 있는지 확인해 주세요." }, { status: 502 });
  }
}
