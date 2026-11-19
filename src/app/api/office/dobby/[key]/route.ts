import { denyRemote } from "@/lib/localOnly";
import { selfUrl } from "@/lib/office/self";
import { spawn } from "node:child_process";
import { mkdirSync, openSync } from "node:fs";
import { join } from "node:path";
import { officeHome } from "@/lib/office/config";
import { decisionDetail, readOpenAsk } from "@/lib/office/ask";
import { dashboardUrl } from "@/lib/office/office";
import { log, notice } from "@/lib/office/floor";
import { metaDir, openAsk, orderDir } from "@/lib/office/source";
import { touched } from "@/lib/office/sync";

export const dynamic = "force-dynamic";

// 대시보드의 다음 할 일 버튼과 같은 동작. 배포가 붙은 둘은 환경을 함께 보낸다. ask 는 질문에 답하기다(답을 value 로 함께 보낸다)
const ACTIONS = ["resolve", "approve", "approve-deploy", "autorun", "deploy", "drift", "ask"];
const ENVS = ["dev", "rc1", "rc4"];
const UNREACHABLE = "mentis 대시보드에 닿지 못했습니다. 대시보드가 켜져 있는지 확인해 주세요.";

// 도비 사무실 물음표 창의 안내: 할 일 문구, 칠 명령, 누를 버튼, 링크, 대시보드 주소
// ask: 답을 기다리는 질문(질문 파일을 읽기만 한다). detail: 옛 오더의 판단 요청이면 설계 문서에 적힌 "확인이 필요했던 것"
export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key: raw } = await params;
  const key = decodeURIComponent(raw);
  const n = notice(key);
  if (!n) return Response.json({ error: "도비 오더를 찾지 못했습니다." }, { status: 404 });
  const meta = metaDir();
  const ask = meta ? readOpenAsk(meta, key, n.text) : null;
  return Response.json({ key, ...n, asking: !!ask, ask, detail: meta && !ask && n.kind === "decision" ? decisionDetail(meta, key) : "", url: dashboardUrl(key) });
}

// 물음표에 답한다. 오피스는 도비 메타를 쓰지 않는다. 상태를 바꾸는 일은 대시보드에 넘긴다
// { action, env } 는 대시보드에 그대로 넘긴다. { action: "ask", value } 는 질문의 답으로 넘긴다
// { answer } 는 옛 오더의 판단 요청(단계가 보류)에만 받아 오더 폴더에서 /do {키} 답 "…" 을 백그라운드로 돌린다
export async function POST(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const denied = denyRemote(req); if (denied) return denied;
  const { key: raw } = await params;
  const key = decodeURIComponent(raw);
  const n = notice(key);
  if (!n) return Response.json({ error: "도비 오더를 찾지 못했습니다." }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { action?: string; env?: string; answer?: string; value?: string };
  const meta = metaDir();
  // 판정이 한발 늦을 수 있어 질문이 열려 있는지는 질문 파일로 본다
  const asking = !!meta && openAsk(meta, key);
  if (body.action === "ask") {
    if (!asking) return Response.json({ error: "답을 기다리는 질문이 없습니다. 이미 답했거나 질문이 닫혔습니다." }, { status: 409 });
    const value = (typeof body.value === "string" ? body.value : "").trim();
    if (!value || value.length > 2000) return Response.json({ error: "답을 1~2000자로 적어 주세요." }, { status: 400 });
    try {
      const r = await fetch(`${selfUrl()}/api/orders`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ next: "ask", key, value }) });
      const j = (await r.json().catch(() => ({}))) as { error?: string; restarted?: boolean; note?: string };
      if (!r.ok) return Response.json({ error: j.error ?? `대시보드가 거절했습니다(${r.status}).` }, { status: 409 });
      touched(key);
      log(`${key} 물음표 답: ${value === "멈추기" ? "자동 실행 멈추기" : "질문에 답함"}${j.restarted ? " (자동 실행 다시 시작)" : ""}`);
      // restarted: 멈춰 있던 자동 실행을 다시 띄웠다. note: 답은 적혔지만 다시 띄우지 못한 이유
      return Response.json({ ok: true, restarted: j.restarted === true, note: typeof j.note === "string" ? j.note : "" });
    } catch {
      return Response.json({ error: UNREACHABLE }, { status: 502 });
    }
  }
  if (body.action) {
    if (!ACTIONS.includes(body.action) || body.action !== n.action) return Response.json({ error: "지금 누를 수 있는 버튼이 아닙니다." }, { status: 400 });
    const needEnv = body.action === "approve-deploy" || body.action === "deploy";
    if (needEnv && !ENVS.includes(body.env ?? "")) return Response.json({ error: "배포 환경은 dev, rc1, rc4 중 하나입니다." }, { status: 400 });
    try {
      const r = await fetch(`${selfUrl()}/api/orders`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ next: body.action, key, env: needEnv ? body.env : undefined }) });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) return Response.json({ error: j.error ?? `대시보드가 거절했습니다(${r.status}).` }, { status: 409 });
      log(`${key} 물음표 답: ${body.action}${needEnv ? ` ${body.env}` : ""}`);
      return Response.json({ ok: true });
    } catch {
      return Response.json({ error: UNREACHABLE }, { status: 502 });
    }
  }
  const answer = (body.answer ?? "").trim();
  if (!answer || answer.length > 2000) return Response.json({ error: "답을 1~2000자로 적어 주세요." }, { status: 400 });
  // 답 없는 질문이 있으면 자동 실행이 그 답을 기다리는 중이다. 여기서 세션을 따로 띄우면 둘이 된다
  if (asking) return Response.json({ error: "답을 기다리는 질문이 있습니다. 질문 창에서 답해 주세요." }, { status: 409 });
  if (n.kind !== "decision" || n.action || !n.cmd.startsWith("/do ")) return Response.json({ error: "이 할 일은 글로 답하지 않습니다." }, { status: 400 });
  if (!meta) return Response.json({ error: "go-dobby 설정을 찾지 못했습니다." }, { status: 500 });
  const dir = join(officeHome(), "dobby-answers");
  mkdirSync(dir, { recursive: true });
  const out = openSync(join(dir, `${key}-${Date.now()}.log`), "a");
  const prompt = `/do ${key} 답 "${answer.replace(/["\\]/g, "\\$&")}"`;
  spawn("claude", ["-p", prompt, "--permission-mode", "auto"], { cwd: orderDir(meta, key), detached: true, stdio: ["ignore", out, out] }).unref();
  log(`${key} 물음표 답을 /do 로 넘김`);
  return Response.json({ ok: true });
}
