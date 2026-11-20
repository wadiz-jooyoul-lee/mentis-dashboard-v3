import { NextResponse } from "next/server";
import { isHex } from "@/lib/color";
import { REFRESH_CHOICES, readSettings, writeSettings, type DashboardSettings } from "@/lib/dashboardSettings";
import { isSelfRequest } from "@/lib/lanToggle";
import { denyRemote } from "@/lib/localOnly";

export const dynamic = "force-dynamic";

/** 대시보드 탭 설정. 보기는 누구나, 바꾸기는 이 맥에서만. */
export async function GET(req: Request) {
  return NextResponse.json({ ...readSettings(), canEdit: isSelfRequest(req) });
}

/** { accent?, refreshSec?, todo? } 중 온 것만 바꾼다. todo 는 완료 표시·목록 닫기에 쓴다. */
export async function POST(req: Request) {
  const denied = denyRemote(req);
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as Partial<DashboardSettings> | null;
  if (!body || typeof body !== "object") return NextResponse.json({ error: "바꿀 값이 없습니다." }, { status: 400 });
  const patch: Partial<DashboardSettings> = {};
  if ("accent" in body) {
    if (!isHex(body.accent)) return NextResponse.json({ error: "색은 #과 16진수 6자리로 적어 주세요." }, { status: 400 });
    patch.accent = body.accent.toLowerCase();
  }
  if ("refreshSec" in body) {
    if (!(REFRESH_CHOICES as readonly number[]).includes(body.refreshSec as number))
      return NextResponse.json({ error: `자동 갱신 간격은 ${REFRESH_CHOICES.join(", ")}초 중 하나입니다.` }, { status: 400 });
    patch.refreshSec = body.refreshSec;
  }
  if ("todo" in body) {
    if (!Array.isArray(body.todo)) return NextResponse.json({ error: "할 일 목록 형식이 틀렸습니다." }, { status: 400 });
    // 화면은 기존 항목의 완료 표시만 바꾼다. 새 항목은 스킬 설정 저장만 넣는다.
    const done = new Map(body.todo.map((t) => [t?.id, !!t?.done]));
    patch.todo = readSettings().todo.filter((t) => done.has(t.id)).map((t) => ({ ...t, done: done.get(t.id)! }));
    if (patch.todo.length === 0) patch.restartAfter = null;
  }
  return NextResponse.json({ ...writeSettings(patch), canEdit: true });
}
