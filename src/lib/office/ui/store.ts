import { create } from "zustand";
import { reduce } from "@/lib/office/core/reduce";
import type { Envelope, OfficeState, Snapshot } from "@/lib/office/core/types";

type Conn = "connecting" | "live" | "reconnecting";
type Listener = (env: Envelope) => void;

interface OfficeStore {
  conn: Conn;
  instanceId: string;
  seq: number;
  epoch: number; // 스냅샷으로 덮어쓸 때마다 올라간다. 화면은 이때 걷지 않고 제자리에 놓는다
  state: OfficeState | null;
  setConn: (c: Conn) => void;
  loadSnapshot: (s: Snapshot) => void;
  apply: (env: Envelope) => void;
}

const listeners = new Set<Listener>();
export const onOfficeEvent = (l: Listener) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export const useOffice = create<OfficeStore>((set, get) => ({
  conn: "connecting",
  instanceId: "",
  seq: 0,
  epoch: 0,
  state: null,
  setConn: (conn) => set({ conn }),
  loadSnapshot: (s) => set({ instanceId: s.instanceId, seq: s.seq, state: s.state, epoch: get().epoch + 1 }),
  apply: (env) => {
    const { state } = get();
    if (!state) return;
    set({ seq: env.seq, state: reduce(state, env) });
    for (const l of listeners) l(env);
  },
}));
