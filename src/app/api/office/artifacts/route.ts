import { denyRemote } from "@/lib/localOnly";
import { appendArtifact, isOrderKey, readArtifacts } from "@/lib/office/artifacts";
import { getBus } from "@/lib/office/core/bus";
import { DOBBY_OFFICE } from "@/lib/office/office";
import { metaDir } from "@/lib/office/source";

export const dynamic = "force-dynamic";

const ARTIFACT_URL = /^https:\/\/claude\.ai\/(code\/)?artifact\/[A-Za-z0-9_-]+\/?$/;

// 아티팩트 꽂기. 도비 사무실은 메타 파일에 쓴다. 이슈 키가 없으면 메타 폴더의 모음 파일, 있으면 그 오더의 파일
export async function POST(req: Request) {
  const denied = denyRemote(req); if (denied) return denied;
  const bus = getBus(DOBBY_OFFICE);
  const b = (await req.json().catch(() => ({}))) as { taskKey?: string; title?: string; kind?: string; url?: string };
  const url = (b.url ?? "").trim();
  const title = (b.title ?? "").trim().slice(0, 60);
  if (!ARTIFACT_URL.test(url)) return Response.json({ error: "claude.ai 아티팩트 주소만 등록할 수 있습니다." }, { status: 400 });
  if (!title) return Response.json({ error: "제목을 적어 주세요." }, { status: 400 });
  const meta = metaDir();
  if (!meta) return Response.json({ error: "go-dobby 설정을 찾지 못했습니다." }, { status: 500 });
  const key = (b.taskKey ?? "").trim();
  if (key && !isOrderKey(meta, key)) return Response.json({ error: `${key} 오더 폴더가 없습니다.` }, { status: 400 });
  if (readArtifacts(meta).some((a) => a.url === url)) return Response.json({ error: "이미 등록된 링크입니다." }, { status: 409 });
  const artifact = appendArtifact(meta, key, b.kind ?? "", title, url);
  bus.emit({ type: "artifact.added", artifact });
  return Response.json(artifact);
}
