import { NextResponse } from "next/server";
import { busyWork, lockFor, unfinishedWorktrees } from "@/lib/configGuard";
import { readSettings, writeSettings } from "@/lib/dashboardSettings";
import { SPECS, applyChanges, checkValue, configFile, expandHome, readConfig, specOf } from "@/lib/goDobbyConfig";
import { denyRemote } from "@/lib/localOnly";

export const dynamic = "force-dynamic";

// 스킬 설정 탭. 계정과 비밀번호가 들어 있어 보기와 바꾸기 모두 이 맥에서만 된다.

function state() {
  const { exists, values } = readConfig();
  const busy = busyWork();
  const worktrees = unfinishedWorktrees();
  return {
    file: configFile(),
    exists,
    busy,
    items: SPECS.map((s) => {
      const raw = values.get(s.key);
      return {
        ...s,
        set: raw !== undefined && raw !== "",
        // 비밀번호는 브라우저로 보내지 않는다
        raw: s.secret ? null : (raw ?? ""),
        expanded: !s.secret && raw && s.kind === "path" ? expandHome(raw) : null,
        lock: lockFor(s.key, s.tier, busy, worktrees),
      };
    }),
  };
}

/** ?check=키&value=값 이면 그 값만 검사한다. 아니면 전체 상태. */
export async function GET(req: Request) {
  const denied = denyRemote(req);
  if (denied) return denied;
  const u = new URL(req.url);
  const key = u.searchParams.get("check");
  if (key) return NextResponse.json(await checkValue(key, u.searchParams.get("value") ?? "", readConfig().values));
  return NextResponse.json(state());
}

/** { changes: {키: 새 값}, confirmTerminal } — 잠금과 값 검사를 서버에서 한 번 더 한 뒤 쓴다. */
export async function POST(req: Request) {
  const denied = denyRemote(req);
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as { changes?: Record<string, unknown>; confirmTerminal?: boolean } | null;
  const changes = body?.changes;
  if (!changes || typeof changes !== "object" || !Object.keys(changes).length)
    return NextResponse.json({ error: "바꿀 값이 없습니다." }, { status: 400 });
  const { exists, values } = readConfig();
  if (!exists) return NextResponse.json({ error: "설정 파일이 없습니다. 먼저 /dobby-init 을 실행해 주세요." }, { status: 400 });

  const busy = busyWork();
  const worktrees = unfinishedWorktrees();
  const clean: Record<string, string> = {};
  for (const [key, v] of Object.entries(changes)) {
    const s = specOf(key);
    if (!s || typeof v !== "string") return NextResponse.json({ error: `바꿀 수 없는 항목입니다: ${key}` }, { status: 400 });
    const lock = lockFor(key, s.tier, busy, worktrees);
    if (lock.locked) return NextResponse.json({ error: `「${s.label}」 항목은 지금 바꿀 수 없습니다. ${lock.reasons.join(" / ")}` }, { status: 409 });
    if (s.tier === "danger" && !body?.confirmTerminal)
      return NextResponse.json({ error: `「${s.label}」 항목을 바꾸려면 터미널에서 도비 스킬을 쓰는 창이 없는지 확인해 주세요.` }, { status: 400 });
    const c = await checkValue(key, v.trim(), values);
    if (c.errors.length) return NextResponse.json({ error: `${s.label}: ${c.errors.join(" ")}` }, { status: 400 });
    clean[key] = v.trim();
  }

  const backup = applyChanges(clean);
  // 바꾼 뒤 할 일을 설정 창 맨 위 목록에 남긴다
  const now = Date.now();
  const cur = readSettings();
  const todo = [
    ...cur.todo,
    ...Object.keys(clean).flatMap((k) => specOf(k)!.after.map((text, i) => ({ id: `${k}-${now}-${i}`, label: specOf(k)!.label, text, done: false }))),
  ];
  const restart = Object.keys(clean).some((k) => specOf(k)!.restart || (k === "ORCHESTRATION_WORKSPACE" && !values.get("ORCHESTRATION_META_PATH")));
  writeSettings({ todo, ...(restart ? { restartAfter: new Date(now).toISOString() } : {}) });
  return NextResponse.json({ ok: true, backup, ...state() });
}
