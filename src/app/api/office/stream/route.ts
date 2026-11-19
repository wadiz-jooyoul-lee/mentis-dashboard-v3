import { DOBBY_OFFICE } from "@/lib/office/office";
import { getBus } from "@/lib/office/core/bus";
import type { Envelope } from "@/lib/office/core/types";

export const dynamic = "force-dynamic";

// 화면 실시간 연결. 마지막으로 받은 번호(id = 인스턴스:번호) 다음 것만 보내고, 이어 줄 수 없으면 reset을 보낸다
export async function GET(req: Request) {
  const bus = getBus(DOBBY_OFFICE);
  const url = new URL(req.url);
  const last = req.headers.get("last-event-id") ?? `${url.searchParams.get("instance") ?? ""}:${url.searchParams.get("since") ?? ""}`;
  const [instance, sinceText] = last.split(":");
  const since = Number(sinceText);
  const missed = instance === bus.instanceId && Number.isFinite(since) ? bus.since(since) : null;

  const enc = new TextEncoder();
  let unsubscribe = () => {};
  let ping: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream({
    start(controller) {
      const send = (env: Envelope) => controller.enqueue(enc.encode(`id: ${bus.instanceId}:${env.seq}\ndata: ${JSON.stringify(env)}\n\n`));
      if (missed === null) {
        controller.enqueue(enc.encode(`event: reset\ndata: {}\n\n`));
        controller.close();
        return;
      }
      controller.enqueue(enc.encode(`retry: 2000\n\n`));
      missed.forEach(send);
      unsubscribe = bus.subscribe(send);
      ping = setInterval(() => controller.enqueue(enc.encode(`: ping\n\n`)), 15000);
      req.signal.addEventListener("abort", () => {
        unsubscribe();
        clearInterval(ping);
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      unsubscribe();
      clearInterval(ping);
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
