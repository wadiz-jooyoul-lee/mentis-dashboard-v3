"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useCanAct } from "@/components/CanAct";
import { copyText } from "@/lib/clipboard";
import type { AutoDecisionNote, NextAction, NextGroup, NextItem } from "@/lib/nextAction";
import Button from "@/components/ui/Button";
import Confirm from "@/components/ui/Confirm";
import Stack from "@/components/ui/Stack";
import Tag from "@/components/ui/Tag";
import Tip from "@/components/ui/Tip";
import { SearchField, SelectBox } from "@/components/ui/Form";
import { toast } from "@/components/ui/Toaster";
import { Text } from "@/components/ui/Typo";
import { Bell, CircleAlert, CircleHelp, Clock, Copy } from "lucide-react";


export type { AutoDecisionNote, NextItem };

// ── 판정 결과 공유 저장소 — 카드·목록·오더 띠가 한 번의 조회를 함께 쓴다 ──
/** at: 서버가 판정한 시각(ms). 0 이면 아직 모른다. notes: 스스로 정한 결정 알림(오더마다 한 건). */
type State = { items: NextItem[]; notes: AutoDecisionNote[]; error: string | null; loaded: boolean; at: number };
let state: State = { items: [], notes: [], error: null, loaded: false, at: 0 };
const subs = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
const POLL_MS = 10_000;

/** fresh 면 서버 저장분(10초)을 건너뛰고 지금 다시 판정한다. */
export async function refreshNextActions(fresh = false): Promise<void> {
  try {
    const r = await (await fetch(`/api/orders?next=1${fresh ? "&fresh=1" : ""}`, { cache: "no-store" })).json();
    state = { items: r.items ?? [], notes: r.notes ?? [], error: r.error ?? null, loaded: true, at: r.at ?? Date.now() };
  } catch {
    state = { ...state, loaded: true };
  }
  subs.forEach((f) => f());
}

function subscribe(f: () => void) {
  subs.add(f);
  if (!timer) {
    refreshNextActions();
    timer = setInterval(refreshNextActions, POLL_MS);
  }
  return () => {
    subs.delete(f);
    if (subs.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

const EMPTY: State = { items: [], notes: [], error: null, loaded: false, at: 0 };
export function useNextActions(): State {
  return useSyncExternalStore(subscribe, () => state, () => EMPTY);
}

// ── 표시 ──
export const GROUP_LABEL: Record<NextGroup, { label: string; color: string }> = {
  mine: { label: "TODO", color: "volcano" },
  notice: { label: "알림", color: "cyan" },
  auto: { label: "자동 진행", color: "blue" },
  wait: { label: "기다림", color: "default" },
  work: { label: "작업 중", color: "purple" },
};

/** 목록 칸에서 태그 대신 아이콘으로 보이는 묶음 */
const GROUP_ICON: Partial<Record<NextGroup, React.ReactNode>> = {
  mine: <CircleAlert size="1em" style={{ color: "#fa541c" }} />,
  notice: <Bell size="1em" fill="currentColor" style={{ color: "#13c2c2" }} />,
  wait: <Clock size="1em" style={{ color: "var(--fg-soft)" }} />,
};

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** "2026-10-27 08:20" → "10/27(화) 08:20 · 3시간 전" */
export function formatSince(since: string, now = Date.now()): string {
  const m = since.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/);
  if (!m) return "";
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  const min = Math.round((now - d.getTime()) / 60000);
  const ago =
    min < 0 ? "예정" : min < 1 ? "방금" : min < 60 ? `${min}분 전` : min < 1440 ? `${Math.floor(min / 60)}시간 전` : `${Math.floor(min / 1440)}일 전`;
  return `${+m[2]}/${+m[3]}(${DAYS[d.getDay()]}) ${m[4]}:${m[5]} · ${ago}`;
}

/** 묶음 표시. 모르는 묶음 값이 와도(플러그인이 먼저 새 값을 낼 때) 화면이 멈추지 않게 알림으로 그린다. */
const groupLabel = (g: string) => (GROUP_LABEL as Record<string, { label: string; color: string }>)[g] ?? GROUP_LABEL.notice;

/** 질문에 답을 보낸 뒤의 안내. 자동 실행이 살아서 기다리는 중이었는지, 죽어 있어 다시 띄웠는지에 따라 다르다. */
function answerNotice(value: string | undefined, res: { restarted?: boolean; note?: string }): { warn: boolean; text: string } {
  if (value === "멈추기") return { warn: false, text: "자동 실행을 멈춥니다." };
  if (res.restarted) return { warn: false, text: "답을 보냈습니다. 멈춰 있던 자동 실행을 다시 시작해 이어 갑니다." };
  if (res.note) return { warn: true, text: `답은 적어 두었습니다. 자동 실행은 다시 시작하지 못했습니다 — ${res.note}` };
  return { warn: false, text: "답을 보냈습니다. 기다리던 자동 실행이 1분 안에 읽고 이어 갑니다." };
}

/** 다음 할 일 버튼의 요청 — 동작을 서버에 보내고 결과를 알린 뒤 판정을 다시 받는다. 질문 카드도 함께 쓴다. */
export function useNextPost(item: NextItem, onDone?: () => void) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const post = async (action: NextAction, extra: Record<string, string> = {}) => {
    if (typeof Notification !== "undefined" && window.isSecureContext && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    setBusy(true);
    let res: { ok?: boolean; error?: string; restarted?: boolean; note?: string } = {};
    try {
      res = await (
        await fetch("/api/orders", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ next: action, key: item.key, ...extra }),
        })
      ).json();
    } catch {
      /* 아래에서 실패로 알린다 */
    }
    setBusy(false);
    if (res.ok) {
      if (action === "ask") {
        const n = answerNotice(extra.value, res);
        if (n.warn) toast.warning(n.text, 8);
        else toast.success(n.text);
      } else {
        toast.success(action === "resolve" ? "해결 처리를 시작했습니다." : "시작했습니다. 진행은 오더 콘솔에서 볼 수 있습니다.");
      }
      onDone?.();
      refreshNextActions(true);
      router.refresh();
    } else {
      toast.error(res.error === "already_running" ? "이미 실행 중입니다." : res.error || "요청에 실패했습니다.");
    }
  };
  return { busy, post };
}

/** 목록 칸용 — 묶음 표시와 한 줄 설명 */
export function NextActionTag({ item }: { item?: NextItem }) {
  if (!item) return <Text type="secondary">-</Text>;
  const g = groupLabel(item.group);
  const icon = GROUP_ICON[item.group];
  if (icon)
    return (
      <Tip title={[g.label, item.since && formatSince(item.since)].filter(Boolean).join(" · ")}>
        <Stack size={6} align="start">
          {icon}
          <Text style={{ fontSize: 12 }}>{item.text}</Text>
        </Stack>
      </Tip>
    );
  return (
    <Tip title={item.since ? formatSince(item.since) : undefined}>
      <Stack orientation="vertical" size={2}>
        <Tag color={g.color} style={{ marginInlineEnd: 0 }}>
          {g.label}
        </Tag>
        <Text style={{ fontSize: 12 }}>{item.text}</Text>
      </Stack>
    </Tip>
  );
}

const CONFIRM: Partial<Record<NextAction, { title: string; description: string; ok: string }>> = {
  approve: {
    title: "설계를 이대로 승인할까요?",
    description: "승인을 기록하고 구현부터 통합까지 자동 실행을 시작합니다. 통합 단계에서 작업 브랜치에 커밋하고 푸시합니다. TASK- 작업은 통합에서 PR 을 만들고 끝납니다.",
    ok: "이대로 승인",
  },
  autorun: {
    title: "자동 실행을 시작할까요?",
    description: "단계마다 새 세션을 띄워 이어서 진행합니다. 커밋과 푸시도 확인 없이 진행됩니다.",
    ok: "자동 실행",
  },
  drift: {
    title: "단계 밖 수정을 리뷰부터 다시 할까요?",
    description: "단계를 구현으로 돌리고 다음 리뷰 차수를 연 뒤 자동 실행을 시작합니다. 다시 구현하지 않고 들어온 수정만 리뷰합니다.",
    ok: "리뷰부터 다시",
  },
};

/** 개발자 없이 산출물(문서, 조사)만 만드는 오더의 확인 문구. 커밋·배포·검증 대신 산출과 문서 올리기를 말한다. */
const PRODUCT_CONFIRM: Record<"approve" | "autorun", { title: string; description: string; ok: string }> = {
  approve: {
    title: "설계를 이대로 승인할까요?",
    description:
      "승인을 기록하고 산출물 만들기부터 자동 실행을 시작합니다. 리뷰어가 켜져 있으면 리뷰를 받고, 저장소에 넣을 문서나 올릴 곳이 있으면 통합에서 커밋하고 올립니다. 배포와 검증은 하지 않습니다.",
    ok: "이대로 승인",
  },
  autorun: {
    title: "자동 실행을 시작할까요?",
    description:
      "단계마다 새 세션을 띄워 산출물을 끝까지 만듭니다. 저장소에 넣을 문서가 있으면 커밋과 푸시도 확인 없이 진행합니다. 배포와 검증은 하지 않습니다.",
    ok: "자동 실행",
  },
};

/** 버튼 묶음 — 동작 버튼, 명령 복사, 화면 링크, 오더 열기 */
export function NextActionControls({
  item,
  showOpen = false,
  onDone,
}: {
  item: NextItem;
  showOpen?: boolean;
  onDone?: () => void;
}) {
  const canAct = useCanAct();
  const router = useRouter();
  const { busy, post } = useNextPost(item, onDone);
  const [env, setEnv] = useState(item.env || "rc4");

  const copy = async () => {
    if (await copyText(item.command || item.cmd)) toast.success("명령을 복사했습니다. 터미널에 붙여넣으세요.");
    else toast.error("복사하지 못했습니다");
  };

  /** 환경을 골라 배포·검증까지 자동으로 가는 버튼. action 은 deploy 또는 approve-deploy. */
  const deployControl = (action: NextAction, label: string, title: string, description: string, primary: boolean) => (
    <span className="ui-compact">
      <SelectBox size="sm" value={env} onChange={setEnv} options={["dev", "rc1", "rc4"].map((v) => ({ value: v, label: v }))} />
      <Confirm title={title} description={description} okText={label} cancelText="취소" onConfirm={() => post(action, { env })}>
        <Button size="sm" variant={primary ? "solid" : "ghost"} busy={busy}>
          {label}
        </Button>
      </Confirm>
    </span>
  );
  // 설계 확인·설계 확정·구현/리뷰 이어 가기에서는 통합까지만 갈지, 배포·검증까지 갈지 고른다.
  const withDeploy = item.kind === "design-confirm" || item.kind === "run-ready" || item.kind === "resume";

  const buttons: React.ReactNode[] = [];
  if (canAct && item.action === "ask" && item.ask && item.ask.v >= 2) {
    // 새 형식의 질문은 일곱 칸을 다 읽어야 답할 수 있다. 여기(알림 카드)에는 싣지 않고 오더 화면 맨 위의 질문 카드로 보낸다.
    buttons.push(
      <Button
        key="ask"
        size="sm"
        variant="solid"
        icon={<CircleHelp size="1em" />}
        onClick={() => router.push(`/orchestration/${encodeURIComponent(item.key)}#order-question`)}
      >
        질문 보고 답하기
      </Button>
    );
  } else if (canAct && item.action === "ask" && item.ask) {
    const a = item.ask;
    const stopBtn = a.waiting && (
      <Confirm key="stop" title="자동 실행을 멈출까요?" okText="멈추기" cancelText="취소" onConfirm={() => post("ask", { value: "멈추기" })}>
        <Button size="sm" danger busy={busy}>
          멈추기
        </Button>
      </Confirm>
    );
    buttons.push(
      <Stack key="ask" orientation="vertical" size={4} style={{ width: "100%" }}>
        {a.why && <Text style={{ fontSize: 12 }}>{a.why}</Text>}
        {a.todo && (
          <Text style={{ fontSize: 12 }} code copyable={{ text: a.todo.replace(/^[^:]*:\s*/, "") }}>
            {a.todo}
          </Text>
        )}
        {a.note && <Text type="warning" style={{ fontSize: 12 }}>{a.note}</Text>}
        <Stack wrap size={6}>
          {a.kind === "action" && (
            <Tip title="1분마다 저절로 확인합니다. 누르면 지금 다시 확인합니다.">
              <Button size="sm" variant="solid" busy={busy} onClick={() => post("ask", { value: "했어요" })}>
                했어요
              </Button>
            </Tip>
          )}
          {a.kind === "choice" &&
            a.choices
              .filter((c) => c !== "멈추기")
              .map((c, i) => (
                <Button key={c} size="sm" variant={i === 0 ? "solid" : "ghost"} busy={busy} onClick={() => post("ask", { value: c })}>
                  {c}
                </Button>
              ))}
          {a.kind === "input" && (
            <SearchField
              size="sm"
              placeholder="값을 적어 주세요"
              enterButton="보내기"
              busy={busy}
              style={{ width: 260 }}
              onSearch={(v) => v.trim() && post("ask", { value: v.trim() })}
            />
          )}
          {stopBtn}
        </Stack>
      </Stack>
    );
  } else if (canAct && item.action === "deploy") {
    buttons.push(
      deployControl(
        "deploy",
        "자동 배포",
        `${env} 에 자동 배포할까요?`,
        "gh, argocd, 테스트 계정을 먼저 확인한 뒤 PR, 머지, 빌드, 배포, 검증까지 확인 없이 진행합니다.",
        true
      )
    );
  } else if (canAct && withDeploy && (item.action === "approve" || item.action === "autorun")) {
    // 개발자 없이 산출물만 만드는 오더는 배포도 검증도 없다. 끝까지 가는 버튼 하나만 두고 문구를 산출물에 맞춘다.
    const c = item.product ? PRODUCT_CONFIRM[item.action as "approve" | "autorun"] : CONFIRM[item.action]!;
    const label = item.product ? c.ok : `${c.ok} (통합까지)`;
    // TASK- 작업은 배포하지 않고 통합에서 PR 을 만들고 끝난다.
    const isTask = item.key.startsWith("TASK-");
    buttons.push(
      <Confirm key="act" title={c.title} description={c.description} okText={label} cancelText="취소" onConfirm={() => post(item.action)}>
        <Button size="sm" variant="solid" busy={busy}>
          {label}
        </Button>
      </Confirm>,
      !isTask && !item.product && deployControl(
        item.action === "approve" ? "approve-deploy" : "deploy",
        "배포·검증까지",
        item.action === "approve" ? `설계를 승인하고 ${env} 배포·검증까지 진행할까요?` : `${env} 배포·검증까지 진행할까요?`,
        `gh, argocd, 테스트 계정을 먼저 확인한 뒤 ${item.action === "approve" ? "승인을 기록하고 " : ""}구현, 리뷰, 통합, PR, 머지, 빌드, 배포, 검증까지 확인 없이 진행합니다.`,
        false
      )
    );
  } else if (canAct && item.action === "resolve") {
    buttons.push(
      <Confirm key="resolve" title="이 오더를 해결로 표시할까요?" okText="해결 처리" cancelText="취소" onConfirm={() => post("resolve")}>
        <Button size="sm" variant="solid" busy={busy}>
          해결 처리
        </Button>
      </Confirm>
    );
  } else if (canAct && item.action) {
    const c = CONFIRM[item.action];
    if (c) {
      buttons.push(
        <Confirm key="act" title={c.title} description={c.description} okText={c.ok} cancelText="취소" onConfirm={() => post(item.action)}>
          <Button size="sm" variant="solid" busy={busy}>
            {c.ok}
          </Button>
        </Confirm>
      );
    }
  }
  if (item.cmd) {
    buttons.push(
      <Tip key="cmd" title={item.command || item.cmd}>
        <Button size="sm" variant={buttons.length ? "ghost" : "solid"} icon={<Copy size="1em" />} onClick={copy}>
          {item.cmd.split(" ")[0]} 명령 복사
        </Button>
      </Tip>
    );
  }
  if (item.link) {
    const external = /^https?:\/\//.test(item.link);
    buttons.push(
      <Button key="link" size="sm" variant={buttons.length ? "ghost" : "solid"} onClick={() => (external ? window.open(item.link, "_blank", "noopener,noreferrer") : router.push(item.link))}>
        {external ? "PR 열기" : item.link.startsWith("/releases") ? "릴리즈 화면 열기" : "열기"}
      </Button>
    );
  }
  // 새 형식의 질문은 위 "질문 보고 답하기"가 오더 화면을 연다.
  if (showOpen && !(item.action === "ask" && item.ask && item.ask.v >= 2)) {
    buttons.push(
      <Button key="open" size="sm" onClick={() => router.push(`/orchestration/${encodeURIComponent(item.key)}`)}>
        오더 열기
      </Button>
    );
  }
  return buttons.length ? <Stack wrap size={6}>{buttons}</Stack> : null;
}
