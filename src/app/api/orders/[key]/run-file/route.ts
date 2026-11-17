import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { ORDER_KEY_RE } from "@/lib/keys";
import { getMetaDir } from "@/lib/issues";

export const dynamic = "force-dynamic";

const IMAGE_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

/** 회차 폴더의 그림 파일을 내려 준다. 결과 문서가 그림을 파일 이름만으로 적기 때문이다. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const run = (req.nextUrl.searchParams.get("run") ?? "").trim();
  const name = (req.nextUrl.searchParams.get("name") ?? "").trim();
  if (!ORDER_KEY_RE.test(key)) return new NextResponse("invalid key", { status: 400 });
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(run) || run.includes("..")) {
    return new NextResponse("invalid run", { status: 400 });
  }
  const type = IMAGE_TYPES[path.extname(name).toLowerCase()];
  if (!name || name.includes("..") || /[\\/]/.test(name) || !type) {
    return new NextResponse("invalid name", { status: 400 });
  }

  let buf: Buffer;
  try {
    buf = fs.readFileSync(path.join(getMetaDir(), key, "test-runs", run, name));
  } catch {
    return new NextResponse("not found", { status: 404 });
  }
  return new NextResponse(new Uint8Array(buf), {
    headers: { "content-type": type, "cache-control": "no-store" },
  });
}
