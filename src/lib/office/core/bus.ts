import { randomUUID } from "node:crypto";
import { readArtifacts } from "@/lib/office/artifacts";
import { metaDir } from "@/lib/office/source";
import { reduce } from "@/lib/office/core/reduce";
import { agentsOf, emptyOffice } from "@/lib/office/core/seed";
import type { Envelope, OfficeEvent, OfficeState, Snapshot } from "@/lib/office/core/types";

const BUFFER = 500;

type Listener = (env: Envelope) => void;

// 세션 하나의 화면 상태와 최근 이벤트. 서버가 재시작하면 instanceId가 바뀌어 화면이 스냅샷으로 덮어쓴다
export class OfficeBus {
  readonly instanceId = randomUUID();
  private seq = 0;
  private state: OfficeState;
  private buffer: Envelope[] = [];
  private listeners = new Set<Listener>();
  private eventSeq = 0;

  // 오피스 DB(office.db)는 가져오지 않았다. 시드 초기 상태에서 시작하고, 도비 플로어는 sync 티커가 메타 파일에서 다시 그린다
  constructor(readonly name: string) {
    const { models, tasks, books, artifacts } = emptyOffice();
    this.state = { models, agents: agentsOf(), tasks, books, artifacts, log: [] };
  }

  emit(event: OfficeEvent): Envelope {
    const env: Envelope = { seq: ++this.seq, at: Date.now(), event };
    env.eventId = ++this.eventSeq; // DB 적재 번호 대신 메모리 일련번호(이력용, 재시작하면 처음부터)
    this.state = reduce(this.state, env);
    this.buffer.push(env);
    if (this.buffer.length > BUFFER) this.buffer.shift();
    for (const l of this.listeners) l(env);
    return env;
  }

  // 도비 사무실의 아티팩트는 메타 파일(오더별 + 모음 파일)에서 그때그때 읽는다
  snapshot(): Snapshot {
    const meta = metaDir();
    const state = meta ? { ...this.state, artifacts: readArtifacts(meta) } : this.state;
    return { instanceId: this.instanceId, seq: this.seq, state };
  }

  get current(): OfficeState {
    return this.state;
  }

  // since 다음 이벤트를 돌려준다. 버퍼가 그만큼 오래되지 않았으면 null(스냅샷부터 다시)
  since(seq: number): Envelope[] | null {
    if (seq === this.seq) return [];
    if (seq > this.seq) return null;
    const first = this.buffer[0]?.seq ?? this.seq + 1;
    if (seq + 1 < first) return null;
    return this.buffer.filter((e) => e.seq > seq);
  }

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
}

// 개발 서버의 코드 다시 읽기에도 세션이 살아 있게 전역에 둔다
const g = globalThis as unknown as { __officeBuses?: Map<string, OfficeBus> };
export function getBus(name: string): OfficeBus {
  g.__officeBuses ??= new Map();
  let bus = g.__officeBuses.get(name);
  if (!bus) {
    bus = new OfficeBus(name);
    g.__officeBuses.set(name, bus);
  }
  return bus;
}
