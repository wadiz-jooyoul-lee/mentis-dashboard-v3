import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { denyRemote } from "@/lib/localOnly";
import { getBus } from "@/lib/office/core/bus";
import { roleModelsFile } from "@/lib/office/core/seed";
import { MODELS, ROLE_NAME, type Model, type TableRole } from "@/lib/office/core/types";
import { DOBBY_OFFICE } from "@/lib/office/office";

export const dynamic = "force-dynamic";

// 역할별 모델 창의 저장. 역할마다 모델을 바꾼다. 바꾼 모델은 다음 실행부터 쓴다
export async function POST(req: Request) {
  const denied = denyRemote(req); if (denied) return denied;
  const { models } = (await req.json().catch(() => ({}))) as { models?: Record<string, string> };
  if (!models || typeof models !== "object") return Response.json({ error: "바꿀 모델이 없습니다." }, { status: 400 });
  for (const [role, model] of Object.entries(models)) {
    if (!(role in ROLE_NAME)) return Response.json({ error: `없는 역할입니다: ${role}` }, { status: 400 });
    if (!MODELS.some((m) => m.id === model)) return Response.json({ error: `고를 수 없는 모델입니다: ${model}` }, { status: 400 });
  }
  const bus = getBus(DOBBY_OFFICE);
  bus.emit({ type: "models.changed", models: { ...bus.current.models, ...(models as Record<TableRole, Model>) } });
  writeRoleModels(bus.current.models);
  return Response.json({ ok: true });
}

// 역할 모델은 go-dobby 자동 실행(run.sh)이 읽는 파일에도 쓴다. 서버를 다시 켜면 이 파일에서 다시 읽는다(seed 의 emptyOffice)
function writeRoleModels(models: Record<TableRole, Model>) {
  const file = roleModelsFile();
  const { planner, developer, producer, reviewer, deployer, tester } = models;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(`${file}.tmp`, `${JSON.stringify({ planner, developer, producer, reviewer, deployer, tester }, null, 2)}\n`);
  renameSync(`${file}.tmp`, file);
}
