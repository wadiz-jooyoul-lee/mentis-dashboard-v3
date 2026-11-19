import { readCrewDetail } from "@/lib/office/crewDetail";
import { metaDir } from "@/lib/office/source";

export const dynamic = "force-dynamic";

// 탁자 확대 창 카드 보기: 오더 메타에서 역할별 상세를 읽어 준다(읽기만 한다)
export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key: raw } = await params;
  const key = decodeURIComponent(raw), meta = metaDir();
  if (!meta || !/^[\w.-]+$/.test(key)) return Response.json({ error: "도비 오더를 찾지 못했습니다." }, { status: 404 });
  return Response.json(readCrewDetail(meta, key));
}
