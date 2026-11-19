import { denyRemote } from "@/lib/localOnly";
import { fullSync, state } from "@/lib/office/sync";

export const dynamic = "force-dynamic";

// 동기화 버튼. 상태 파일을 모두 다시 읽어 그림을 맞추고 바뀐 오더 수를 돌려준다
export async function POST(req: Request) {
  const denied = denyRemote(req); if (denied) return denied;
  if (!state()) return Response.json({ error: "도비 설정이 없어 동기화를 시작하지 못했습니다." }, { status: 503 });
  return Response.json({ changed: await fullSync() });
}
