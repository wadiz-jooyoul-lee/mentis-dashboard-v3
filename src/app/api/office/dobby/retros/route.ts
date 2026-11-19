import { readRetros } from "@/lib/office/retro";
import { metaDir } from "@/lib/office/source";

export const dynamic = "force-dynamic";

// 회고 책장: 회고록이 있는 오더 목록
export async function GET() {
  const meta = metaDir();
  if (!meta) return Response.json({ error: "도비 사무실에서만 볼 수 있습니다." }, { status: 404 });
  return Response.json({ items: readRetros(meta) });
}
