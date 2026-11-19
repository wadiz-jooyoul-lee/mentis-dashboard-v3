import { denyRemote } from "@/lib/localOnly";
import { selfUrl } from "@/lib/office/self";
import { isDemoMeta as officeDemo } from "@/lib/office/source";

export const dynamic = "force-dynamic";

// 오피스 자신도 데모 메타(.demo-meta, DOBBY_META 로 지정)를 보고 있을 때만 데모 바를 켠다.
// 대시보드만 데모 모드면 두 화면이 서로 다른 오더를 그리게 되므로 여기서 막는다.

// 데모 시나리오의 주인은 대시보드의 /api/demo 하나다 — 오피스는 같은 서버의 그 API 를 대신 불러만 준다.
// 대시보드가 데모 모드가 아니면 demo:false.

export async function GET() {
  if (!officeDemo()) return Response.json({ demo: false });
  try {
    const r = await fetch(`${selfUrl()}/api/demo`, { cache: "no-store" });
    return Response.json(await r.json());
  } catch {
    return Response.json({ demo: false });
  }
}

export async function POST(req: Request) {
  const denied = denyRemote(req); if (denied) return denied;
  if (!officeDemo()) return Response.json({ ok: false, error: "오피스가 데모 메타(DOBBY_META=.demo-meta)로 떠 있지 않습니다" }, { status: 409 });
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  try {
    const r = await fetch(`${selfUrl()}/api/demo`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: body.action }),
    });
    return Response.json(await r.json(), { status: r.status });
  } catch {
    return Response.json({ ok: false, error: "대시보드(/api/demo)에 연결하지 못했습니다" }, { status: 502 });
  }
}
