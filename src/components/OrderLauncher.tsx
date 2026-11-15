"use client";
import { useCanAct } from "@/components/CanAct";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card, Input, Button, Space, Collapse, Badge, Typography, message, Empty, Segmented, Radio, Checkbox } from "antd";
import { PlayCircleOutlined, RightOutlined, FileAddOutlined } from "@ant-design/icons";
import JobConsole from "@/components/JobConsole";
import type { JobWithKey, JobState } from "@/lib/jobs";
import { FIELDS, INTAKE_ENVS, KINDS, KIND_ORDER, LIGHT_NOTE_MAX, NOTE_MAX, checkIntake, hasContent, intakeCommand, jiraKeyOf, type IntakeEnv, type IntakeKind } from "@/lib/intake";

const { TextArea } = Input;

const LAST_KIND = "dashboard.intake.kind";
const ENV_LABEL = (e: IntakeEnv) => (e ? `${e} 배포·검증` : "통합까지");

const { Text, Paragraph } = Typography;

const BADGE: Record<Exclude<JobState, "none">, { status: "processing" | "success" | "error" | "default"; text: string }> = {
  running: { status: "processing", text: "실행 중" },
  done: { status: "success", text: "완료" },
  failed: { status: "error", text: "실패" },
  stopped: { status: "default", text: "정지됨" },
};

/** 끝난 시각 표시: 10/16 14:20 */
const endedText = (ms: number) => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

function loadKind(): IntakeKind {
  try {
    const v = localStorage.getItem(LAST_KIND) as IntakeKind | null;
    return v && KIND_ORDER.includes(v) ? v : "dev";
  } catch {
    return "dev";
  }
}

export default function OrderLauncher({ initialJobs }: { initialJobs: JobWithKey[] }) {
  const canAct = useCanAct();
  const [kind, setKind] = useState<IntakeKind>("dev");
  const [target, setTarget] = useState("");
  const [env, setEnv] = useState<IntakeEnv>("");
  const [base, setBase] = useState("");
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [jobs, setJobs] = useState<JobWithKey[]>(initialJobs);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => setKind(loadKind()), []);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/orders", { cache: "no-store" });
      const data = await r.json();
      setJobs(data.jobs ?? []);
    } catch {
      /* 무시 */
    }
  }, []);

  // 실행 중인 것은 펼쳐 보는 콘솔로, 끝난 것(최근 7일)은 콘솔 탭 링크 한 줄로 보여 준다.
  const running = jobs.filter((j) => j.state === "running");
  const finished = jobs.filter((j) => j.state !== "running").sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0));
  const anyRunning = running.length > 0;
  useEffect(() => {
    if (anyRunning) {
      timer.current = setInterval(refresh, 2500);
      return () => {
        if (timer.current) clearInterval(timer.current);
      };
    }
  }, [anyRunning, refresh]);

  const f = FIELDS[kind];
  const copy = KINDS[kind];
  const issue = !!jiraKeyOf(target);
  const shownEnv: IntakeEnv = f.env && issue ? env : "";
  const input = { kind, target, env: shownEnv, base: f.base ? base : "", note };
  const checked = checkIntake(input);
  const noteMax = kind === "light" ? LIGHT_NOTE_MAX : NOTE_MAX;
  const targetBad = touched && !!target.trim() && !issue;
  // 미리 보기: 빈 칸은 자리표시로 채워 명령의 모양을 보여 준다(Jira 이슈가 없으면 작업 키는 시작할 때 정해진다)
  const shape = checkIntake({ ...input, target: f.issueRequired && !issue ? "XX-0" : target, note: hasContent(note) ? note : "{내용}" });
  const preview = checked.ok ? intakeCommand(checked) : shape.ok ? intakeCommand(shape).replace("XX-0", "{이슈 키}") : "";

  const pick = (k: IntakeKind) => {
    setKind(k);
    setAgree(false);
    try {
      localStorage.setItem(LAST_KIND, k);
    } catch {
      /* 무시 */
    }
  };

  const launch = async () => {
    if (!checked.ok) {
      message.error(checked.error);
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await r.json().catch(() => ({}));
      if (r.ok) {
        message.success(`실행 시작 (${body?.key ?? "잡"})`);
        setTarget("");
        setNote("");
        setAgree(false);
        setTouched(false);
        await refresh();
      } else {
        message.error(body?.error === "already_running" ? "이미 실행 중" : body?.error ?? "실패");
      }
    } finally {
      setBusy(false);
    }
  };

  const jobPanels = running.map((j) => ({
    key: j.key,
    label: (
      <Space>
        <Text strong>{j.key}</Text>
        <Badge {...BADGE[j.state]} />
      </Space>
    ),
    children: <JobConsole orderKey={j.key} initial={j} onChange={refresh} />,
  }));

  // 다른 기기 열람: 오더 실행은 이 맥의 Claude를 띄우는 것이라 화면 자체를 읽기 전용 안내로 대체
  if (!canAct) {
    return (
      <Card size="small" title={<Space><PlayCircleOutlined />오더 실행 (/do 자동)</Space>}>
        <Text type="secondary">
          읽기 전용 화면입니다 — 오더 실행·정지는 대시보드가 실행 중인 맥에서만 할 수 있습니다.
        </Text>
      </Card>
    );
  }
  return (
    <Card size="small" title={<Space><PlayCircleOutlined />오더 실행 (/do 자동)</Space>}>
      <Space orientation="vertical" size={12} style={{ width: "100%" }}>
        <Paragraph type="secondary" style={{ margin: 0 }}>
          일의 종류를 고르고, Jira 이슈가 있으면 이슈를 넣고 없으면 내용만 적어 맡깁니다. Jira 이슈가 없으면 작업 키(TASK-1, TASK-2처럼 차례로 이어지는 번호)를 새로 만듭니다.
          설계 세션이 설계를 스스로 확정하고, 이어서 같은 잡이 단계마다 새 세션으로 진행합니다. 사람 판단이 필요하면 질문을 남긴 채 답을 기다리며, 질문은 알림 카드와 오더 화면 맨 위에 뜹니다.
          <br />
          <Text type="warning">주의: 헤드리스 claude를 bypassPermissions로 실행합니다(로컬 신뢰 환경 전용).</Text>
        </Paragraph>

        <div>
          <Text strong>어떤 일인가요</Text>
          <Radio.Group
            value={kind}
            onChange={(e) => pick(e.target.value as IntakeKind)}
            disabled={busy}
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, marginTop: 6 }}
          >
            {KIND_ORDER.map((k) => (
              <Radio.Button key={k} value={k} style={{ height: "auto", padding: "8px 12px", lineHeight: 1.4, borderRadius: 6, borderInlineStartWidth: 1 }}>
                <div style={{ fontWeight: 600 }}>{KINDS[k].name}</div>
                <div style={{ fontSize: 12 }}>{KINDS[k].line}</div>
                <div style={{ fontSize: 12, opacity: 0.65 }}>{KINDS[k].end}</div>
              </Radio.Button>
            ))}
          </Radio.Group>
        </div>

        <div>
          <Text strong>Jira 이슈{f.issueRequired ? "" : " (선택)"}</Text>
          <Input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder={f.issueRequired ? "FE1-1234 또는 https://…/browse/FE1-1234" : "FE1-1234 또는 이슈 주소 · 이슈가 없으면 비워 두세요(작업 키를 새로 만듭니다)"}
            maxLength={200}
            status={targetBad ? "error" : undefined}
            disabled={busy}
            style={{ marginTop: 6 }}
          />
          {targetBad && <Text type="danger" style={{ fontSize: 12 }}>Jira 이슈 키(FE1-1234)나 이슈 주소가 아닙니다. 이슈가 없으면 비워 두세요.</Text>}
        </div>

        <div>
          <Space style={{ width: "100%", justifyContent: "space-between" }}>
            <Text strong>
              {copy.noteLabel}
              {kind !== "light" && issue ? " (선택 · 덧붙일 말)" : ""}
            </Text>
            <Button size="small" icon={<FileAddOutlined />} onClick={() => setNote((n) => (n.trim() ? `${n.trimEnd()}\n\n${copy.template}` : copy.template))} disabled={busy}>
              양식 넣기
            </Button>
          </Space>
          <TextArea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={copy.notePlaceholder}
            autoSize={{ minRows: 8, maxRows: 20 }}
            maxLength={noteMax}
            disabled={busy}
            style={{ marginTop: 6 }}
            onPressEnter={(e) => {
              // Ctrl/⌘+Enter로 실행(줄바꿈은 그냥 Enter)
              if ((e.ctrlKey || e.metaKey) && agree) {
                e.preventDefault();
                launch();
              }
            }}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {note.length.toLocaleString()}/{noteMax.toLocaleString()}자
            {kind === "light" ? " · 원인을 새로 찾지 않으므로 고칠 곳이 분명할수록 좋습니다" : " · 오더 폴더의 request.md 로 넘겨 설계 세션이 이슈 본문처럼 읽습니다"}
          </Text>
        </div>

        {f.env && (
          <div>
            <Text strong>어디까지 진행할까요</Text>
            <div style={{ marginTop: 6 }}>
              <Segmented
                options={INTAKE_ENVS.map((e) => ({ label: ENV_LABEL(e), value: e, disabled: !!e && !issue }))}
                value={shownEnv}
                onChange={(v) => {
                  setEnv(v as IntakeEnv);
                  setAgree(false);
                }}
                disabled={busy}
              />
            </div>
            {!issue && !f.issueRequired && <Text type="secondary" style={{ fontSize: 12 }}>Jira 이슈가 없는 작업은 배포하지 않습니다. 통합에서 기준 브랜치로 PR 까지 만듭니다.</Text>}
          </div>
        )}

        {f.base && (
          <Collapse
            size="small"
            items={[
              {
                key: "base",
                label: "고급: 기준 브랜치",
                children: <Input value={base} onChange={(e) => setBase(e.target.value)} placeholder="비우면 설정의 기본 브랜치 (예: master)" maxLength={100} disabled={busy} />,
              },
            ]}
          />
        )}

        {/* 입력할 때마다 읽어 주지 않도록 알림(role=alert)이 아닌 일반 상자로 둔다 */}
        <Card size="small" title="진행 순서" styles={{ body: { paddingTop: 8 } }}>
          <ol style={{ margin: "0 0 4px", paddingInlineStart: 20 }}>
            {copy.steps(shownEnv, issue).map((s) => (
              <li key={s.text} style={s.off ? { opacity: 0.4, textDecoration: "line-through" } : undefined}>
                {s.text}
              </li>
            ))}
          </ol>
          {copy.note && <Text type="secondary">{copy.note}</Text>}
        </Card>

        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            실행할 명령
          </Text>
          <pre style={{ margin: "4px 0", whiteSpace: "pre-wrap", wordBreak: "break-all", opacity: checked.ok ? 1 : 0.5 }}>{preview || "—"}</pre>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {copy.done(shownEnv, issue)}
          </Text>
        </div>

        <Checkbox checked={agree} onChange={(e) => setAgree(e.target.checked)} disabled={busy}>
          {copy.agree(shownEnv, issue)}
        </Checkbox>
        {!checked.ok && (touched || note.trim()) && <Text type="danger">{checked.error}</Text>}
        <Button type="primary" icon={<PlayCircleOutlined />} onClick={launch} loading={busy} disabled={!agree || !checked.ok}>
          맡기기 (⌘/Ctrl+Enter)
        </Button>

        {running.length > 0 && <Collapse items={jobPanels} defaultActiveKey={[running[0].key]} />}

        {finished.length > 0 && (
          <Space orientation="vertical" size={4} style={{ width: "100%" }}>
            <Text type="secondary">최근 7일 동안 끝난 실행 — 로그는 오더 콘솔 탭에서 볼 수 있습니다.</Text>
            {finished.map((j) => (
              <Link key={j.key} href={`/orchestration/console/${j.key}`}>
                <Space>
                  <Text strong>{j.key}</Text>
                  <Badge {...BADGE[j.state]} />
                  {j.endedAt && <Text type="secondary">{endedText(j.endedAt)} 종료</Text>}
                  <RightOutlined />
                </Space>
              </Link>
            ))}
          </Space>
        )}

        {jobs.length === 0 && (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="실행 중이거나 최근 7일 안에 끝난 실행이 없습니다" />
        )}
      </Space>
    </Card>
  );
}
