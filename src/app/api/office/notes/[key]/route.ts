import { denyRemote } from "@/lib/localOnly";
import { DOBBY_OFFICE } from "@/lib/office/office";
import { getBus } from "@/lib/office/core/bus";

export const dynamic = "force-dynamic";

// 완료 게시판의 쪽지를 열어 봤다. 화면 표시만 바꾸므로 도비 사무실에서도 받는다
export async function POST(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const denied = denyRemote(req); if (denied) return denied;
  const { key: raw } = await params;
  const key = decodeURIComponent(raw);
  const bus = getBus(DOBBY_OFFICE);
  const t = bus.current.tasks.find((x) => x.key === key && x.note);
  if (!t) return Response.json({ error: "완료 쪽지가 없습니다." }, { status: 404 });
  if (!t.note!.seen) bus.emit({ type: "note.seen", taskId: t.id });
  return Response.json({ ok: true });
}
