import { denyRemote } from "@/lib/localOnly";
import { selfUrl } from "@/lib/office/self";
import { dashboardUrl } from "@/lib/office/office";
import { log } from "@/lib/office/floor";
import { readRetro } from "@/lib/office/retro";
import { metaDir, readOrder } from "@/lib/office/source";

export const dynamic = "force-dynamic";

const REASON: Record<string, string> = { already_running: "이미 회고 중입니다.", invalid_key: "오더 키가 올바르지 않습니다." };

// 회고록 한 권: retro.json 과 오더 제목, 대시보드 회고 탭 주소
export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key: raw } = await params;
  const key = decodeURIComponent(raw);
  const meta = metaDir();
  const retro = meta ? readRetro(meta, key) : null;
  if (!meta || !retro) return Response.json({ error: "회고록을 찾지 못했습니다." }, { status: 404 });
  return Response.json({ key, title: readOrder(meta, key)?.title ?? key, retro, url: `${dashboardUrl(key)}/retro` });
}

// 펼친 책의 회고하기: 대시보드의 회고 생성(/dobby-retro {키})으로 넘긴다
export async function POST(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const denied = denyRemote(req); if (denied) return denied;
  const { key: raw } = await params;
  const key = decodeURIComponent(raw);
  const meta = metaDir();
  if (!meta || !readOrder(meta, key)) return Response.json({ error: "도비 사무실의 오더에서만 회고할 수 있습니다." }, { status: 404 });
  try {
    const r = await fetch(`${selfUrl()}/api/orders`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ retro: true, key }) });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) return Response.json({ error: REASON[j.error ?? ""] ?? j.error ?? `대시보드가 거절했습니다(${r.status}).` }, { status: 409 });
    log(`${key} 책에서 회고 시작`);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "mentis 대시보드에 닿지 못했습니다. 대시보드가 켜져 있는지 확인해 주세요." }, { status: 502 });
  }
}
