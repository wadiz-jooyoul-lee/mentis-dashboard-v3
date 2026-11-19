import { popTables, setTables } from "@/lib/office/ui/floorPlan";
import type { OfficeBus } from "@/lib/office/core/bus";

// 하루 넘게 움직임이 없으면 자동 홀딩한다
export const HOLD_MS = 24 * 3600_000;

// 테이블을 걷고 홀딩 게시판에 올린다. 앉아 있던 사람은 쉬러 간다. 이미 홀딩이면 false
export function holdTask(bus: OfficeBus, taskId: string, by: "auto" | "user"): boolean {
  const t = bus.current.tasks.find((x) => x.id === taskId);
  if (!t || t.hold) return false;
  const crew = Object.values(t.table?.crew ?? {});
  bus.emit({ type: "task.held", taskId, hold: { at: Date.now(), by } });
  for (const id of crew) if (bus.current.agents.find((a) => a.id === id)?.status !== "rest") bus.emit({ type: "agent.status", agentId: id!, status: "rest" });
  setTables(popTables(bus.current.tasks));
  return true;
}

export function unholdTask(bus: OfficeBus, taskId: string): boolean {
  if (!bus.current.tasks.find((x) => x.id === taskId)?.hold) return false;
  bus.emit({ type: "task.unheld", taskId });
  return true;
}
