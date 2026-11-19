import { dobbyRecord } from "@/lib/office/record";

export const dynamic = "force-dynamic";

// 펼친 책 내용. 도비 메타 문서로 책을 만든다(오피스 DB 의 책과 목업 책은 가져오지 않았다)
export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const rec = dobbyRecord(decodeURIComponent(key));
  if (!rec) return Response.json({ error: "기록이 없습니다." }, { status: 404 });
  return Response.json(rec);
}
