"use client";
import { useEffect } from "react";
import { useOffice } from "@/lib/office/ui/store";
import type { Envelope, Snapshot } from "@/lib/office/core/types";

// 스냅샷을 받은 뒤 그 번호 다음 이벤트부터 이어 받는다. 번호가 비거나 서버가 reset을 보내면 스냅샷부터 다시
export function useOfficeStream(name: string) {
  useEffect(() => {
    let es: EventSource | null = null;
    let closed = false;
    const store = useOffice.getState;

    async function load() {
      es?.close();
      store().setConn("connecting");
      let snap: Snapshot;
      try {
        snap = await (await fetch(`/api/office/snapshot`, { cache: "no-store" })).json();
      } catch {
        if (!closed) setTimeout(load, 2000);
        return;
      }
      if (closed) return;
      store().loadSnapshot(snap);
      connect();
    }

    function connect() {
      const { instanceId, seq } = store();
      es = new EventSource(`/api/office/stream?instance=${instanceId}&since=${seq}`);
      es.onopen = () => store().setConn("live");
      es.onerror = () => store().setConn("reconnecting");
      es.addEventListener("reset", () => load());
      es.onmessage = (m) => {
        const env = JSON.parse(m.data) as Envelope;
        const { seq: cur } = store();
        if (env.seq <= cur) return;
        if (env.seq !== cur + 1) return void load();
        store().apply(env);
      };
    }

    load();
    return () => {
      closed = true;
      es?.close();
    };
  }, [name]);
}
