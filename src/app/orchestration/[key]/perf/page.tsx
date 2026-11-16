import fs from "fs";
import path from "path";
import { getEpic } from "@/lib/orchestration";
import { getMetaDir } from "@/lib/issues";
import { getJobStatus } from "@/lib/jobs";
import { ORDER_KEY_RE, isJiraIssueKey } from "@/lib/keys";
import { parsePerfJson } from "@/lib/perf";
import { notFound } from "next/navigation";
import PerfView from "@/components/PerfView";

export const dynamic = "force-dynamic";

function readPerf(key: string): string | null {
  try {
    return fs.readFileSync(path.join(getMetaDir(), key, "perf.json"), "utf8");
  } catch {
    return null;
  }
}

export default async function PerfPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!ORDER_KEY_RE.test(key)) notFound();
  const epic = getEpic(key);
  const job = getJobStatus(`perf-${key}`);
  return (
    <PerfView
      epicKey={key}
      title={epic?.title ?? null}
      data={parsePerfJson(readPerf(key))}
      job={job.state === "none" ? null : { state: job.state, feed: job.feed }}
      mode={epic?.orchestration?.mode ?? null}
      worktreeRemoved={epic?.worktreeRemoved ?? false}
      resolved={epic?.resolved ?? false}
      hasJira={epic?.hasJiraDoc || isJiraIssueKey(key)}
      hasDesign={epic?.hasDesignDoc ?? false}
      hasQa={!!epic?.qa}
      orderKind={epic?.orderKind ?? null}
    />
  );
}
