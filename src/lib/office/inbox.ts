import { createServer, type Server } from "node:http";
import * as floor from "@/lib/office/floor";
import { DONE, roleOfStage } from "@/lib/office/floor";
import { readCrew, readOrder } from "@/lib/office/source";
import { refreshTable, state, touched } from "@/lib/office/sync";

// 도비가 상태를 알리는 수신 API. 127.0.0.1 에만 열어 같은 컴퓨터에서만 부를 수 있다
const PORT = Number(process.env.DOBBY_INBOX_PORT) || 6898;
const KEY = /^([A-Za-z][A-Za-z0-9]*-[0-9]+|TASK-[A-Za-z0-9-]+)$/;
const g = globalThis as unknown as { __dobbyInbox?: Server };

type Msg = { kind?: string; key?: string; phase?: string; slug?: string; state?: string; title?: string; text?: string; session?: string; op?: "start" | "end"; by?: string; unit?: string; result?: string };

function handle(m: Msg): boolean {
  const s = state();
  if (!s || !m.key || !KEY.test(m.key)) return false;
  const key = m.key;
  // doing 은 판정에 쓰는 파일을 바꾸지 않는다. 받을 때마다 판정 도구를 다시 돌리지 않도록 빼 둔다
  if (m.kind !== "doing") touched(key);
  floor.beat(key);
  const order = () => readOrder(s.meta, key);
  switch (m.kind) {
    case "phase": {
      if (!m.phase) return false;
      if (DONE.includes(m.phase) || order()?.ended) {
        const rounds = Math.max(0, ...readCrew(s.meta, key).filter((r) => r.slug === "review-agent").map((r) => r.round));
        floor.finish(key, rounds, false);
        return true;
      }
      // /do 오더가 아니거나 아직 세션 표가 없으면 서류철을 만들지 않는다. 표가 생기면 5초 확인이 맞춘다
      const o = order();
      if (!o) return true;
      floor.ensure(key, o.title);
      floor.setPhase(key, m.phase);
      refreshTable(key);
      return true;
    }
    case "agent": {
      if (!m.slug || !m.state) return false;
      const o = order();
      if (!o) return true;
      floor.ensure(key, o.title);
      floor.setAgent(key, m.slug, m.state);
      refreshTable(key);
      return true;
    }
    case "title":
      if (!m.title) return false;
      if (!order()) return true;
      floor.ensure(key, m.title);
      floor.setTitle(key, m.title);
      return true;
    case "event":
      if (!m.text) return false;
      if (floor.known().includes(key)) floor.log(`${key} ${m.text.slice(0, 120)}`);
      return true;
    case "doing": {
      if (!m.session || !m.text) return false;
      const o = order();
      if (!o || DONE.includes(o.phase) || o.ended) return true;
      // 시작 알림 없이 도구 사용이 먼저 오면(이 판보다 앞서 시작된 세션) 그 세션으로 수동 단위를 연다
      if (!floor.unitOf(key)) floor.unitStart(key, "do", `do:${m.session}`, o.title, true);
      floor.setDoing(key, m.text, roleOfStage(o.sessions.get(m.session) ?? ""));
      return true;
    }
    case "retro": {
      // 회고는 끝난 오더에서도 한다. 오더 폴더만 있으면 받는다
      const o = order();
      if (!o) return true;
      if (m.op === "start") floor.retroStart(key, o.title, o.roles);
      else if (m.op === "end") floor.retroEnd(key, m.result);
      else return false;
      return true;
    }
    case "unit": {
      if (m.op === "start") {
        if (!m.by || !m.unit) return false;
        const o = order();
        if (!o || DONE.includes(o.phase) || o.ended) return true;
        floor.unitStart(key, m.by, m.unit, o.title);
        refreshTable(key);
        return true;
      }
      if (m.op === "end") {
        if (!m.unit && !m.session) return false;
        if (!order()) return true;
        floor.unitEnd(key, { unit: m.unit, session: m.session, result: m.result });
        refreshTable(key);
        return true;
      }
      return false;
    }
  }
  return false;
}

export function startInbox() {
  if (g.__dobbyInbox) return;
  const server = createServer((req, res) => {
    if (req.method !== "POST" || req.url !== "/dobby") {
      res.writeHead(404).end();
      return;
    }
    // 헬퍼와 훅은 curl 이라 Origin 을 보내지 않는다. 브라우저에 열린 다른 사이트의 요청은 끊는다
    if (req.headers.origin) {
      res.writeHead(403).end();
      return;
    }
    let body = "";
    req.on("data", (c) => {
      body += c;
      if (body.length > 16_384) req.destroy();
    });
    req.on("end", () => {
      let ok = false;
      try {
        ok = handle(JSON.parse(body) as Msg);
      } catch {}
      res.writeHead(ok ? 202 : 400).end();
    });
  });
  // 다른 오피스 서버가 이미 열었으면(시험 서버 등) 수신 없이 파일 동기화만 한다
  server.on("error", (e) => console.log(`도비 사무실: 수신 API(127.0.0.1:${PORT})를 열지 못했습니다 — ${e.message}`));
  server.listen(PORT, "127.0.0.1");
  g.__dobbyInbox = server;
}
