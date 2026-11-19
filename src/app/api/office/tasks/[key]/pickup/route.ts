import { denyRemote } from "@/lib/localOnly";
import { pickup } from "@/lib/office/floor";

export const dynamic = "force-dynamic";

// 화면의 도비가 완성 테이블에서 책을 집었다. 정리 중인 테이블을 걷는다(이미 걷혔으면 아무것도 하지 않는다)
export async function POST(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const denied = denyRemote(req); if (denied) return denied;
  const { key } = await params;
  return Response.json({ ok: true, cleared: pickup(decodeURIComponent(key)) });
}
