import fs from "node:fs";
import path from "node:path";
import { DEFAULT_ACCENT, isHex } from "@/lib/color";

/** 설정 창 대시보드 탭의 값과 바꾼 뒤 할 일 목록. 파일 하나에 두어 서버를 다시 켜도 남는다. */
export const REFRESH_CHOICES = [0, 5, 10, 30, 60] as const;

export type TodoItem = { id: string; label: string; text: string; done: boolean };
export type DashboardSettings = {
  accent: string;
  refreshSec: number;
  todo: TodoItem[];
  /** 이 시각 이후에 서버를 다시 켜야 반영되는 설정을 바꿨다(ISO). */
  restartAfter: string | null;
};

const FILE = path.join(process.cwd(), ".dashboard-settings.json");
const DEFAULTS: DashboardSettings = { accent: DEFAULT_ACCENT, refreshSec: 5, todo: [], restartAfter: null };

const isTodo = (t: unknown): t is TodoItem =>
  !!t && typeof t === "object" && ["id", "label", "text"].every((k) => typeof (t as Record<string, unknown>)[k] === "string");

export function readSettings(): DashboardSettings {
  let raw: Partial<DashboardSettings> = {};
  try {
    raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    /* 파일이 없거나 깨졌으면 기본값 */
  }
  return {
    accent: isHex(raw.accent) ? raw.accent.toLowerCase() : DEFAULTS.accent,
    refreshSec: (REFRESH_CHOICES as readonly number[]).includes(raw.refreshSec as number) ? (raw.refreshSec as number) : DEFAULTS.refreshSec,
    todo: Array.isArray(raw.todo) ? raw.todo.filter(isTodo).map((t) => ({ ...t, done: !!t.done })) : [],
    restartAfter: typeof raw.restartAfter === "string" ? raw.restartAfter : null,
  };
}

export function writeSettings(patch: Partial<DashboardSettings>): DashboardSettings {
  const next = { ...readSettings(), ...patch };
  fs.writeFileSync(`${FILE}.tmp`, `${JSON.stringify(next, null, 2)}\n`);
  fs.renameSync(`${FILE}.tmp`, FILE);
  return next;
}

/** 서버를 켠 뒤에 바뀐 "다시 켜야 하는" 설정이 있는가. */
export function needsRestart(s: DashboardSettings = readSettings()): boolean {
  if (!s.restartAfter) return false;
  const bootAt = Date.now() - process.uptime() * 1000;
  return Date.parse(s.restartAfter) > bootAt;
}
