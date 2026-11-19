import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { metaDir, readOrder } from "@/lib/office/source";

export const dynamic = "force-dynamic";

const TYPE: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };

// 작업 책 화면 장의 갈무리 그림. 오더의 test-runs/{회차}/ 바로 아래 그림 파일만 준다
export async function GET(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key: raw } = await params;
  const key = decodeURIComponent(raw);
  const q = new URL(req.url).searchParams;
  const run = q.get("run") ?? "", file = q.get("f") ?? "";
  const ext = file.split(".").pop()?.toLowerCase() ?? "";
  const meta = metaDir();
  const ok = meta && readOrder(meta, key) && run === basename(run) && file === basename(file) && !run.startsWith(".") && TYPE[ext];
  if (!ok) return Response.json({ error: "그림을 찾지 못했습니다." }, { status: 404 });
  try {
    return new Response(readFileSync(join(meta, key, "test-runs", run, file)), { headers: { "content-type": TYPE[ext], "cache-control": "private, max-age=300" } });
  } catch {
    return Response.json({ error: "그림을 찾지 못했습니다." }, { status: 404 });
  }
}
