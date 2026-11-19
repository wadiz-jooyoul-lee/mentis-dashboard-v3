import * as floor from "@/lib/office/floor";
import { DONE, roleOfSlug } from "@/lib/office/floor";
import { HOLD_MS } from "@/lib/office/core/hold";
import { dobbyLib, judge, listKeys, metaDir, mtimeOf, openAsk, readCrew, readDevProgress, readLastTest, readOrder, readProduceProgress, readQaActive, readQaProgress, readShipProgress, readStepProgress, readTestProgress } from "@/lib/office/source";
import { dataMark, isDataKey } from "@/lib/office/data";
import type { Progress, WorkTable } from "@/lib/office/core/types";

const TICK_MS = 5_000; // 바뀐 상태 파일 확인 주기
const JUDGE_GAP_MS = 5_000; // 판정 도구 호출 사이 최소 간격(한 번에 약 4초)
const PUSH_GRACE_MS = 10_000; // 이 시간 안에 받은 API 가 있으면 파일 차이를 '놓침'으로 보지 않는다

// pending: 서류철을 아직 만들지 못한 오더. 파일이 그대로여도 다음 확인에 다시 맞춘다
type St = { meta: string; lib: string | null; mtimes: Map<string, number>; pushed: Map<string, number>; pending: Set<string>; judging: boolean; judgeAt: number; dirty: boolean; data?: Map<string, string> };
const g = globalThis as unknown as { __dobbySync?: St };
export const state = () => g.__dobbySync;

// 수신 API 가 받을 때 부른다. 보정 판단과 판정 도구 재호출에 쓴다
export function touched(key: string) {
  const s = g.__dobbySync;
  if (!s) return;
  s.pushed.set(key, Date.now());
  s.dirty = true;
}

// 오더 하나를 파일대로 맞춘다. 바뀐 것이 있으면 무엇이 바뀌었는지 글로 돌려준다
function applyFile(s: St, key: string): string[] {
  s.pending.delete(key);
  const o = readOrder(s.meta, key);
  const had = floor.known().includes(key);
  if (!o) {
    // 사무실에서 막 맡긴 오더는 설계 세션이 폴더를 만들 때까지(15분) 자리를 둔다
    if (had && floor.reserving(key)) return [];
    if (had && floor.phaseOf(key) === "접수") floor.log(`${key} 설계 세션이 오더를 만들지 않아 접수를 걷었습니다`);
    if (had) floor.finish(key, 0, true);
    return had ? ["폴더 없음"] : [];
  }
  if (DONE.includes(o.phase) || o.ended) {
    if (!had) return [];
    const rounds = Math.max(0, ...readCrew(s.meta, key).filter((r) => r.slug === "review-agent").map((r) => r.round));
    floor.finish(key, rounds, false);
    return [o.ended ? "워크트리 정리됨" : `단계 ${o.phase}`];
  }
  const diff: string[] = [];
  if (!had) diff.push("새 오더");
  floor.ensure(key, o.title);
  if (floor.setTitle(key, o.title)) diff.push("제목");
  if (floor.setPhase(key, o.phase)) diff.push(`단계 ${o.phase}`);
  const rows = readCrew(s.meta, key);
  for (const r of rows) if (floor.setAgent(key, r.slug, r.state)) diff.push(`${r.name} ${r.state}`);
  // 질문이 생기거나 풀리면 사람 차례 판정을 다시 받는다(질문만 바뀌면 상태표가 그대로일 수 있다)
  const ask = openAsk(s.meta, key);
  if (floor.setAsking(key, ask)) diff.push(ask ? "질문 남김" : "질문 닫힘");
  if (floor.syncTable(key, rows, readLastTest(s.meta, key), s.mtimes.get(key), readQaActive(s.meta, key), o.roles, o.product, o.light, o.docs)) diff.push("테이블");
  if (!floor.known().includes(key)) s.pending.add(key);
  return diff;
}

async function runJudge(s: St) {
  if (!s.lib || s.judging || Date.now() - s.judgeAt < JUDGE_GAP_MS) return;
  s.judging = true;
  s.dirty = false;
  try {
    const items = await judge(s.lib, s.meta);
    const by = new Map(items.map((i) => [i.key, i]));
    for (const key of floor.known()) {
      const j = by.get(key);
      floor.setHuman(key, j?.group === "mine", { text: j?.text ?? "", cmd: j?.cmd ?? "", action: j?.action ?? "", env: j?.env ?? "", link: j?.link ?? "", kind: j?.kind ?? "" });
    }
  } catch (e) {
    console.log(`도비 사무실: 사람 차례를 판정하지 못했습니다 — ${(e as Error).message}`);
  } finally {
    s.judging = false;
    s.judgeAt = Date.now();
  }
}

// 전체 맞춤. 서버 시작과 동기화 버튼에서 부른다. 바뀐 오더 수를 돌려준다
export async function fullSync(): Promise<number> {
  const s = g.__dobbySync;
  if (!s) return 0;
  let n = 0;
  const keys = new Set([...listKeys(s.meta), ...floor.known()]);
  for (const key of keys) {
    s.mtimes.set(key, mtimeOf(s.meta, key));
    if (applyFile(s, key).length) n++;
  }
  s.judgeAt = 0;
  await runJudge(s);
  return n;
}

// 5초마다. 수정 시각이 바뀐 오더만 다시 읽고, 받은 API 없이 달라졌으면 보정으로 기록한다
function tick(s: St) {
  floor.expireDoing();
  floor.sweepClosing();
  const keys = new Set([...listKeys(s.meta), ...floor.known()]);
  for (const key of keys) {
    const m = mtimeOf(s.meta, key);
    if (m === (s.mtimes.get(key) ?? -1)) continue;
    s.mtimes.set(key, m);
    const diff = applyFile(s, key);
    if (!diff.length) continue;
    s.dirty = true;
    if (Date.now() - (s.pushed.get(key) ?? 0) > PUSH_GRACE_MS) floor.log(`${key} 동기화로 보정: ${diff.join(", ")}`);
  }
  // 데이터 분석(data/)은 오더 상태 파일과 따로 바뀐다. 스펙이 생기거나 새 회차 결과가 나오면 이벤트로 적어 화면이 오른쪽 모니터를 바로 맞추게 한다. 처음 본 값은 적지 않는다
  const first = !s.data;
  const marks = (s.data ??= new Map());
  for (const key of keys) {
    if (!isDataKey(key)) continue;
    const { sig, text } = dataMark(s.meta, key);
    const before = marks.get(key);
    if (before === sig) continue;
    marks.set(key, sig);
    const line = first || before == null ? "" : text(before);
    if (line) floor.log(line);
  }
  // 서류철을 늦게 만든 오더는 파일이 그대로라 위에서 다시 읽지 않는다. 놓친 호출이 아니므로 보정으로 적지 않는다
  for (const key of [...s.pending]) if (floor.known().includes(key)) applyFile(s, key);
  // 폴더 없이 기다리는 접수는 파일이 그대로라 위에서 다시 읽지 않는다. 유예가 끝나면 걷는다
  for (const key of floor.known()) if (!s.mtimes.get(key) && floor.phaseOf(key) === "접수" && !floor.reserving(key)) applyFile(s, key);
  // 테이블 자리를 기다리는 오더는 다른 테이블이 걷혔을 수 있어 파일이 그대로여도 다시 맞춘다
  for (const t of floor.bus().current.tasks) if (t.waiting) refreshTable(t.key);
  // 파일이 그대로인 채 하루가 지나면 위에서 다시 읽지 않으므로 여기서 홀딩한다. 답을 기다리는 질문이 있으면 하지 않는다
  for (const t of floor.bus().current.tasks) if (!t.hold && !t.note && !floor.asking(t.key) && Date.now() - Math.max(s.mtimes.get(t.key) || Date.now(), t.lastActive ?? 0) > HOLD_MS) refreshTable(t.key);
  for (const t of floor.bus().current.tasks) if (t.table) floor.setProgress(t.key, progressOf(s, t.key, t.table.work));
  if (s.dirty) void runJudge(s);
}

// 이름표 진행: 테스터는 검증, 리뷰어는 리뷰 항목, 배포담당은 배포 단계, 산출자는 산출 기록이 생긴 산출물 수, 개발자는 구현 파일 또는 지적 수정. 구현 진행은 git 을 돌리므로 30초에 한 번만 센다
const DEV_MS = 30_000;
const devCache = new Map<string, { at: number; prog?: Progress }>();
function progressOf(s: St, key: string, work: WorkTable["work"]): Progress | undefined {
  if (work?.tester === "work") return readTestProgress(s.meta, key) ?? undefined;
  const qa = (work?.reviewer === "work" || work?.developer === "work") && readQaActive(s.meta, key);
  if (work?.reviewer === "work") return (qa ? readQaProgress(s.meta, key, "reviewer") : readStepProgress(s.meta, key, "reviewer")) ?? undefined;
  if (work?.deployer === "work") return readShipProgress(s.meta, key) ?? undefined;
  if (work?.producer === "work") return readProduceProgress(s.meta, key) ?? undefined;
  if (work?.developer !== "work") return undefined;
  if (qa) return readQaProgress(s.meta, key, "developer") ?? undefined;
  const fix = readStepProgress(s.meta, key, "developer");
  if (fix) return fix;
  // git 은 비동기로 돈다. 이번 확인에는 지난 값을 쓰고, 다 세면 그 값으로 이름표를 다시 맞춘다
  const c = devCache.get(key);
  if (c && Date.now() - c.at < DEV_MS) return c.prog;
  const row = readCrew(s.meta, key).find((r) => roleOfSlug(r.slug) === "developer" && r.state === "작업중");
  devCache.set(key, { at: Date.now(), prog: c?.prog }); // 세는 동안 같은 오더를 또 세지 않는다
  if (row)
    void readDevProgress(s.meta, key, row.slug).then((p) => {
      const prog = p ?? undefined;
      devCache.set(key, { at: Date.now(), prog });
      const t = floor.bus().current.tasks.find((x) => x.key === key);
      if (t?.table?.work?.developer === "work") floor.setProgress(key, prog);
    });
  else devCache.set(key, { at: Date.now(), prog: undefined });
  return row ? c?.prog : undefined;
}

// 수신 API 가 상태를 받은 뒤 테이블을 파일대로 다시 맞춘다
export function refreshTable(key: string) {
  const s = g.__dobbySync;
  if (!s) return;
  floor.setAsking(key, openAsk(s.meta, key));
  const o = readOrder(s.meta, key);
  floor.syncTable(key, readCrew(s.meta, key), readLastTest(s.meta, key), s.mtimes.get(key) ?? mtimeOf(s.meta, key), readQaActive(s.meta, key), o?.roles ?? null, o?.product, o?.light, o?.docs);
}

// 서버를 켤 때 한 번. 메타 폴더를 모르면 시작하지 않는다
export function startSync(): boolean {
  if (g.__dobbySync) return true;
  const meta = metaDir();
  if (!meta) {
    console.log("도비 사무실: go-dobby 설정(config.env)이 없어 시작하지 않습니다");
    return false;
  }
  const s: St = (g.__dobbySync = { meta, lib: dobbyLib(), mtimes: new Map(), pushed: new Map(), pending: new Set(), judging: false, judgeAt: 0, dirty: false });
  floor.adopt();
  void fullSync();
  setInterval(() => tick(s), TICK_MS).unref();
  return true;
}
