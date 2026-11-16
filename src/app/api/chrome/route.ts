import { NextResponse } from "next/server";
import { listChrome, killChrome } from "@/lib/chromeProcs";
import { denyRemote } from "@/lib/localOnly";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET: 떠 있는 Chrome for Testing 목록과 상태. */
export async function GET() {
  return NextResponse.json({ list: listChrome() });
}

/** POST { pids }: 쉬는 크롬만 끈다. 일하는 크롬은 서버가 거절한다. */
export async function POST(req: Request) {
  const denied = denyRemote(req);
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  const pids = Array.isArray(body?.pids) ? body.pids.filter((p: unknown) => Number.isInteger(p) && (p as number) > 1) : [];
  if (pids.length === 0) {
    return NextResponse.json({ error: "끌 크롬 번호(pids)가 필요합니다." }, { status: 400 });
  }
  return NextResponse.json({ results: await killChrome(pids) });
}
