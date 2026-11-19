import { denyRemote } from "@/lib/localOnly";
import { refreshTable } from "@/lib/office/sync";
import { DOBBY_OFFICE } from "@/lib/office/office";
import { getBus } from "@/lib/office/core/bus";
import { holdTask, unholdTask } from "@/lib/office/core/hold";

export const dynamic = "force-dynamic";

// 작업 테이블의 홀딩 단추와 홀딩 게시판의 다시 시작. 화면에서만 홀딩하며 진행 중인 일은 멈추지 않는다
export async function POST(req: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const denied = denyRemote(req); if (denied) return denied;
  const { taskId } = await params;
  const { hold } = (await req.json().catch(() => ({}))) as { hold?: boolean };
  if (typeof hold !== "boolean") return Response.json({ error: "hold 값이 없습니다." }, { status: 400 });
  const bus = getBus(DOBBY_OFFICE);
  const t = bus.current.tasks.find((x) => x.id === taskId);
  if (!t) return Response.json({ error: "없는 작업입니다." }, { status: 404 });
  if (hold) return Response.json({ ok: holdTask(bus, taskId, "user") });
  if (!unholdTask(bus, taskId)) return Response.json({ ok: false });
  refreshTable(t.key);
  return Response.json({ ok: true });
}
