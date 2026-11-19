"use client";

import Link from "next/link";
import OrderHeader from "@/components/OrderHeader";
import { ShipProgress } from "@/components/mdview/ShipProgress";
import { jiraUrl } from "@/lib/jira";
import type { QaInfo, QaTriageRow } from "@/lib/parseQa";
import type { ShipRow } from "@/lib/parseOrderStatus";
import Card from "@/components/ui/Card";
import DataTable, { type Column } from "@/components/ui/DataTable";
import Empty from "@/components/ui/Empty";
import Stack from "@/components/ui/Stack";
import Tag from "@/components/ui/Tag";
import Tip from "@/components/ui/Tip";
import { StatusDot } from "@/components/ui/Tag";
import { Paragraph, Text, Title } from "@/components/ui/Typo";


/** 트리아지 판정 → 뱃지 색. 끌어온 것과 아닌 것을 한눈에 가른다. */
const VERDICT_COLOR: Record<string, string> = {
  편입: "processing",
  해결: "success",
  배포완료: "warning",
  문의대기: "default",
  보류: "default",
  무관: "default",
};

/** 처리 상태 → 색. 아직 도는 것은 파랑, 끝난 것은 초록, 검증을 못 한 것은 주황. */
const STATE_COLOR: Record<string, string> = {
  구현: "blue",
  리뷰: "purple",
  머지완료: "cyan",
  배포중: "geekblue",
  검증중: "geekblue",
  배포완료: "orange",
  해결: "green",
};

/** 트리아지 한 줄 + 그 버그의 처리 상태를 합친 행. */
type Row = QaTriageRow & { state: string | null; round: string | null; stateUpdatedAt: string | null };

export default function QaView({
  epicKey,
  title = null,
  qa,
  ship,
  repoUrl = null,
  mode = null,
  worktreeRemoved = false,
  resolved = false,
  hasJira = false,
  hasDesign = false,
  orderKind = null,
}: {
  epicKey: string;
  title?: string | null;
  qa: QaInfo | null;
  ship: ShipRow[];
  repoUrl?: string | null;
  mode?: string | null;
  worktreeRemoved?: boolean;
  resolved?: boolean;
  hasJira?: boolean;
  hasDesign?: boolean;
  orderKind?: "development" | "deliverable" | "summary" | null;
}) {
  const header = (
    <OrderHeader
      epicKey={epicKey}
      title={title}
      mode={mode}
      worktreeRemoved={worktreeRemoved}
      resolved={resolved}
      hasJira={hasJira}
      hasDesign={hasDesign}
      hasQa={!!qa}
      orderKind={orderKind}
    />
  );

  if (!qa) {
    return (
      <div>
        {header}
        <Empty description="이 오더에는 QA 감시 기록이 없습니다." />
      </div>
    );
  }

  const byKey = new Map(qa.rows.map((r) => [r.bugKey, r]));
  const rows: Row[] = qa.triage.map((t) => {
    const s = byKey.get(t.bugKey);
    return { ...t, state: s?.state ?? null, round: s?.round ?? null, stateUpdatedAt: s?.updatedAt ?? null };
  });
  // 상태표에만 있고 트리아지에 없는 버그도 빠뜨리지 않는다(표가 어긋나도 보이게).
  for (const s of qa.rows) {
    if (byKey.has(s.bugKey) && rows.some((r) => r.bugKey === s.bugKey)) continue;
    if (!rows.some((r) => r.bugKey === s.bugKey)) {
      rows.push({
        bugKey: s.bugKey,
        title: null,
        verdict: "편입",
        basis: s.basis,
        slug: s.slug,
        branch: null,
        slackTs: null,
        updatedAt: s.updatedAt,
        state: s.state,
        round: s.round,
        stateUpdatedAt: s.updatedAt,
      });
    }
  }

  const taken = rows.filter((r) => !/무관|보류/.test(r.verdict));
  const done = taken.filter((r) => /해결/.test(r.state ?? r.verdict)).length;
  const shipped = taken.filter((r) => /배포완료/.test(r.state ?? r.verdict)).length;

  const columns: Column<Row>[] = [
    {
      title: "버그",
      dataIndex: "bugKey",
      render: (k: string, r) => (
        <Stack orientation="vertical" size={0}>
          <Link href={jiraUrl(k)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
            <Text strong>{k}</Text>
          </Link>
          {r.title && <Text type="secondary" style={{ fontSize: 12 }}>{r.title}</Text>}
        </Stack>
      ),
    },
    {
      title: "판정",
      dataIndex: "verdict",
      render: (v: string, r) => (
        <Stack size={4}>
          <StatusDot status={(VERDICT_COLOR[v] ?? "default") as "success"} text={v || "-"} />
          {r.basis && <Tag style={{ margin: 0 }}>{r.basis}</Tag>}
        </Stack>
      ),
    },
    {
      title: "처리 상태",
      dataIndex: "state",
      render: (s: string | null, r) =>
        s ? (
          <Stack size={4}>
            <Tag color={STATE_COLOR[s] ?? "default"} style={{ margin: 0 }}>{s}</Tag>
            {r.round && <Text type="secondary" style={{ fontSize: 12 }}>라운드 {r.round}</Text>}
          </Stack>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    { title: "담당", dataIndex: "slug", render: (v: string | null) => v ?? <Text type="secondary">-</Text> },
    {
      title: "브랜치",
      dataIndex: "branch",
      render: (v: string | null) =>
        v ? <Text code style={{ fontSize: 12 }}>{v}</Text> : <Text type="secondary">-</Text>,
    },
    {
      title: "갱신",
      dataIndex: "stateUpdatedAt",
      render: (v: string | null, r) => (
        <Text type="secondary" style={{ fontSize: 12 }}>{v ?? r.updatedAt ?? "-"}</Text>
      ),
    },
  ];

  return (
    <div>
      {header}

      <Title level={4} style={{ marginTop: 16 }}>QA 감시</Title>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Stack size={[20, 8]} wrap>
          <Stack size={6}>
            <Text type="secondary">폴링</Text>
            <Text strong>{qa.interval ?? "-"}</Text>
          </Stack>
          <Stack size={6}>
            <Text type="secondary">마지막 확인</Text>
            <Text strong>{qa.lastPollAt ?? "-"}</Text>
          </Stack>
          <Stack size={6}>
            <Text type="secondary">되돌려 보낼 환경</Text>
            {qa.env ? <Tag color="blue" style={{ margin: 0 }}>{qa.env}</Tag> : <Text type="secondary">미정</Text>}
          </Stack>
          {qa.parent && (
            <Stack size={6}>
              <Tip title="이 이슈의 하위 버그는 묻지 않고 끌어옵니다(기준 ①)">
                <Text type="secondary">부모 QA</Text>
              </Tip>
              <Link href={jiraUrl(qa.parent)} target="_blank" rel="noreferrer">{qa.parent}</Link>
            </Stack>
          )}
          <Stack size={6}>
            <Text type="secondary">처리 대상</Text>
            <Text strong>{taken.length}건</Text>
            <Text type="secondary">· 해결 {done} · 배포만 {shipped}</Text>
          </Stack>
        </Stack>
      </Card>

      <Title level={4}>QA 이슈</Title>
      {rows.length === 0 ? (
        <Empty description="아직 트리아지된 버그가 없습니다." />
      ) : (
        <DataTable<Row>
          rowKey="bugKey"
          size="small"
          columns={columns}
          dataSource={rows}
          pagination={false}
          scroll={{ x: "max-content" }}
          rowClassName={(r) => (/무관|보류/.test(r.verdict) ? "row-resolved" : "")}
        />
      )}
      <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
        <Text strong>배포완료</Text>는 고쳐서 내보냈지만 검증이 어려워 거기서 마친 것입니다 —
        사유는 해당 Jira 이슈 코멘트에 적혀 있습니다.
      </Paragraph>

      {ship.length > 0 && (
        <>
          <Title level={4} style={{ marginTop: 20 }}>배포</Title>
          <Card size="small">
            <ShipProgress rows={ship} repoUrl={repoUrl} />
          </Card>
        </>
      )}
    </div>
  );
}
