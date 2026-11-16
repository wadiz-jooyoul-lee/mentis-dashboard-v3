"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Breadcrumb, Button, Empty, Popconfirm, Space, Table, Tag, Typography, message } from "antd";
import { useCanAct } from "@/components/CanAct";
import type { ChromeProc, ChromeState, KillResult } from "@/lib/chromeProcs";

const { Title, Text } = Typography;

const STATE: Record<ChromeState, { label: string; color: string; hint: string }> = {
  auto: { label: "자동 실행", color: "purple", hint: "대시보드가 맡긴 자동 실행이 쓰는 중이라 끌 수 없습니다" },
  active: { label: "사용 중", color: "blue", hint: "CPU 를 1% 이상 쓰고 있어 끌 수 없습니다" },
  idle: { label: "쉬는 중", color: "default", hint: "띄운 세션은 열려 있지만 지금 일하지 않습니다" },
  orphan: { label: "주인 없음", color: "orange", hint: "띄운 세션이 이미 닫혔습니다" },
};

const hm = (iso: string) => {
  if (!iso) return "-";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export default function ChromeProcView({ list }: { list: ChromeProc[] }) {
  const router = useRouter();
  const canAct = useCanAct();
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  const killable = list.filter((c) => c.killable).map((c) => c.pid);
  const picked = selected.filter((p) => killable.includes(p));

  async function kill(pids: number[]) {
    setBusy(true);
    try {
      const r = await fetch("/api/chrome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pids }),
      });
      const d = await r.json();
      if (!r.ok) {
        message.error(d?.error ?? "끄기 요청에 실패했습니다");
        return;
      }
      const res = d.results as KillResult[];
      const done = res.filter((x) => x.result === "종료됨").length;
      const rest = res.filter((x) => x.result !== "종료됨").map((x) => `${x.pid} ${x.result}`);
      (rest.length ? message.warning : message.success)(
        `${done}개 종료됨${rest.length ? ` · ${rest.join(", ")}` : ""}`,
      );
      setSelected([]);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Breadcrumb items={[{ title: <Link href="/">홈</Link> }, { title: "테스트 브라우저" }]} style={{ marginBottom: 12 }} />
      <Title level={3} style={{ marginTop: 0, marginBottom: 4 }}>
        테스트 브라우저
      </Title>
      <Text type="secondary">
        세션들이 브라우저 연결 도구로 띄운 Chrome for Testing 목록입니다. 일하는 크롬(자동 실행·사용 중)은 끌 수 없습니다.
      </Text>

      {canAct && (
        <Space style={{ display: "flex", justifyContent: "flex-end", margin: "16px 0 12px" }}>
          <Popconfirm
            title={`쉬는 크롬 ${killable.length}개를 끌까요?`}
            description="띄운 세션은 닫히지 않고 크롬만 꺼집니다."
            onConfirm={() => kill(killable)}
            disabled={killable.length === 0}
          >
            <Button disabled={killable.length === 0} loading={busy}>
              쉬는 것 모두 끄기 ({killable.length})
            </Button>
          </Popconfirm>
          <Popconfirm title={`선택한 크롬 ${picked.length}개를 끌까요?`} onConfirm={() => kill(picked)} disabled={picked.length === 0}>
            <Button type="primary" danger disabled={picked.length === 0} loading={busy}>
              선택한 것 끄기 ({picked.length})
            </Button>
          </Popconfirm>
        </Space>
      )}

      <Table<ChromeProc>
        rowKey="pid"
        size="middle"
        pagination={false}
        dataSource={list}
        style={{ marginTop: canAct ? 0 : 16 }}
        locale={{ emptyText: <Empty description="떠 있는 테스트 브라우저가 없습니다" /> }}
        rowSelection={
          canAct
            ? {
                selectedRowKeys: picked,
                onChange: (keys) => setSelected(keys.map(Number)),
                getCheckboxProps: (c) => ({ disabled: !c.killable }),
              }
            : undefined
        }
        columns={[
          { title: "번호", dataIndex: "pid", width: 80 },
          {
            title: "상태",
            width: 110,
            render: (_, c) => (
              <Tag color={STATE[c.state].color} title={STATE[c.state].hint}>
                {STATE[c.state].label}
              </Tag>
            ),
          },
          { title: "헤드리스", width: 90, render: (_, c) => (c.headless ? "예" : "아니오") },
          { title: "시작", width: 110, render: (_, c) => hm(c.startedAt) },
          { title: "CPU", width: 80, render: (_, c) => `${c.cpu}%` },
          {
            title: "띄운 세션",
            render: (_, c) =>
              c.session ? (
                <div style={{ lineHeight: 1.5 }}>
                  <Text code>{c.session.command}</Text>
                  {c.orderKey && (
                    <Link href={`/orchestration/${c.orderKey}`} style={{ marginLeft: 8 }}>
                      {c.orderKey} ↗
                    </Link>
                  )}
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {c.session.cwd ?? "작업 폴더 확인 불가"} · 세션 {c.session.pid} · {hm(c.session.startedAt)} 시작
                    </Text>
                  </div>
                </div>
              ) : (
                <Text type="secondary">세션이 이미 닫힘</Text>
              ),
          },
          ...(canAct
            ? [
                {
                  title: "",
                  width: 90,
                  render: (_: unknown, c: ChromeProc) =>
                    c.killable ? (
                      <Popconfirm title={`크롬 ${c.pid}를 끌까요?`} onConfirm={() => kill([c.pid])}>
                        <Button size="small" danger loading={busy}>
                          끄기
                        </Button>
                      </Popconfirm>
                    ) : (
                      <Text type="secondary" style={{ fontSize: 12 }} title={STATE[c.state].hint}>
                        끄기 막힘
                      </Text>
                    ),
                },
              ]
            : []),
        ]}
      />
    </div>
  );
}
