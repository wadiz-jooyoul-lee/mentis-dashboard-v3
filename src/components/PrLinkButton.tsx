"use client";

import { useState } from "react";
import { copyText } from "@/lib/clipboard";
import { envBranchesOf, type EnvPrs, type ExistingPr } from "@/lib/prEnv";
import Button from "@/components/ui/Button";
import Empty from "@/components/ui/Empty";
import Pop from "@/components/ui/Pop";
import Spinner from "@/components/ui/Spinner";
import Stack from "@/components/ui/Stack";
import Tag from "@/components/ui/Tag";
import Tip from "@/components/ui/Tip";
import { Field } from "@/components/ui/Form";
import { Hr } from "@/components/ui/Misc";
import { toast } from "@/components/ui/Toaster";
import { Text } from "@/components/ui/Typo";
import { ChevronDown, ChevronRight, Copy, ExternalLink, GitBranch } from "lucide-react";


type Target = { repo: string; branch: string; repoUrl: string | null };

/**
 * "Jira" 옆 버튼 — 병합 대상(base) 브랜치를 입력하면,
 * 이 오더의 개발 브랜치를 그 브랜치로 머지하는 GitHub PR 생성 링크를 repo별로 만들어 준다.
 * 아래에는 환경 브랜치(dev·rc1·rc4·stage 등)로 가는 링크를 입력 없이 미리 만들어 두고,
 * 그 환경으로 이미 만들어진 PR 도 함께 보여 준다(?prExisting, 창을 열 때마다 조회).
 * 환경마다 지금 PR(열린 PR, 없으면 가장 최근에 머지된 PR)만 보이고, 그 전의 닫힌 PR 과 머지된 PR 은
 * "이전 PR N개" 한 줄로 접어 둔다. 누르면 번호·상태·닫힌 이유가 펼쳐진다.
 * 대상 브랜치·repo·GitHub 주소는 서버(?prTargets)에서 받아온다.
 */
export default function PrLinkButton({ epicKey }: { epicKey: string }) {
  const [open, setOpen] = useState(false);
  const [base, setBase] = useState("");
  const [targets, setTargets] = useState<Target[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [prs, setPrs] = useState<Record<string, Record<string, EnvPrs>> | null>(null);
  /** 펼쳐 둔 "이전 PR" 묶음 — `{repo}|{branch}|{환경}` */
  const [shown, setShown] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/orders?prTargets=${encodeURIComponent(epicKey)}`, {
        cache: "no-store",
      });
      const j = await r.json();
      setTargets(Array.isArray(j.targets) ? j.targets : []);
    } catch {
      setTargets([]);
    }
    setLoading(false);
  };

  const loadPrs = async () => {
    setPrs(null);
    try {
      const r = await fetch(`/api/orders?prExisting=${encodeURIComponent(epicKey)}`, {
        cache: "no-store",
      });
      const j = await r.json();
      setPrs(j.prs && typeof j.prs === "object" ? j.prs : {});
    } catch {
      setPrs({});
    }
  };

  const onOpenChange = (o: boolean) => {
    setOpen(o);
    if (o && targets === null) load();
    if (o) loadPrs();
  };

  const linkButtons = (url: string) => (
    <>
      <Tip title={url}>
        <Button size="sm" icon={<Copy size="1em" />} onClick={() => copy(url)}>
          복사
        </Button>
      </Tip>
      <Button
        size="sm"
        variant="solid"
        icon={<ExternalLink size="1em" />}
        onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
      >
        열기
      </Button>
    </>
  );

  const STATE_TAG: Record<ExistingPr["state"], { color: string; label: string }> = {
    OPEN: { color: "green", label: "열림" },
    MERGED: { color: "purple", label: "머지됨" },
    CLOSED: { color: "default", label: "닫힘" },
  };
  /** PR 한 줄 — 번호, 상태, (닫힌 PR 이면) 닫힌 이유, 출발 브랜치, 복사·열기 */
  const prRow = (p: ExistingPr, indent: number) => (
    <div key={p.number} data-pr-row={p.state} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, paddingLeft: indent }}>
      <Text style={{ flex: 1, fontSize: 12 }}>
        #{p.number}{" "}
        <Tag color={STATE_TAG[p.state].color} style={{ marginInline: 4 }}>
          {STATE_TAG[p.state].label}
        </Tag>
        {p.state === "CLOSED" && p.reason && p.reason !== "닫힘" && (
          <Tag color="orange" style={{ marginInlineEnd: 4 }}>
            {p.reason}
          </Tag>
        )}
        <Text type="secondary" style={{ fontSize: 12 }}>
          {p.head}
        </Text>
      </Text>
      {linkButtons(p.url)}
    </div>
  );

  const compareUrl = (t: Target, b: string): string | null =>
    t.repoUrl && b ? `${t.repoUrl}/compare/${encodeURIComponent(b)}...${t.branch}?expand=1` : null;
  const prUrl = (t: Target) => compareUrl(t, base.trim());

  const copy = async (url: string) => {
    const ok = await copyText(url);
    if (ok) toast.success("PR 링크를 복사했습니다.");
    else toast.error("복사에 실패했습니다 — 링크를 직접 선택해 복사하세요.");
  };

  const content = (
    <div style={{ width: 480, maxWidth: "82vw" }}>
      <Field
        placeholder="병합 대상(base) 브랜치 — 예: RC, develop"
        value={base}
        onChange={(e) => setBase(e.target.value)}
        allowClear
        autoFocus
      />
      <div style={{ marginTop: 10 }}>
        {loading ? (
          <Spinner size="sm" />
        ) : !targets || targets.length === 0 ? (
          <Empty
            compact
            description="이 오더의 브랜치 정보를 찾을 수 없습니다"
          />
        ) : (
          <Stack orientation="vertical" size={10} style={{ width: "100%" }}>
            {targets.map((t, i) => {
              const url = prUrl(t);
              return (
                <div key={`${t.repo}-${t.branch}-${i}`}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {t.repo || "repo?"} · <Text code>{t.branch}</Text> →{" "}
                    <Text code>{base.trim() || "(base 입력)"}</Text>
                  </Text>
                  {!t.repoUrl ? (
                    <div>
                      <Text type="danger" style={{ fontSize: 12 }}>
                        GitHub 주소를 확인할 수 없습니다 ({t.repo || "repo 미상"})
                      </Text>
                    </div>
                  ) : !base.trim() ? (
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        병합 대상 브랜치를 입력하면 링크가 생성됩니다.
                      </Text>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "stretch", gap: 6, marginTop: 2 }}>
                      <div
                        style={{
                          flex: 1,
                          fontSize: 12,
                          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                          wordBreak: "break-all",
                          userSelect: "all",
                          background: "var(--bg-sunken)",
                          borderRadius: 4,
                          padding: "4px 8px",
                        }}
                      >
                        {url}
                      </div>
                      <Button
                        size="sm"
                        icon={<Copy size="1em" />}
                        onClick={() => copy(url!)}
                        style={{ flexShrink: 0 }}
                      >
                        복사
                      </Button>
                      <Button
                        size="sm"
                        variant="solid"
                        icon={<ExternalLink size="1em" />}
                        onClick={() => window.open(url!, "_blank", "noopener,noreferrer")}
                        style={{ flexShrink: 0 }}
                      >
                        열기
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </Stack>
        )}
      </div>
      {targets && targets.some((t) => t.repoUrl) && (
        <>
          <Hr plain style={{ margin: "12px 0 8px", fontSize: 12 }}>
            환경별 PR {prs === null && <Spinner size="sm" style={{ marginLeft: 6 }} />}
          </Hr>
          <Stack orientation="vertical" size={8} style={{ width: "100%" }}>
            {targets
              .filter((t) => t.repoUrl)
              .map((t, i) => (
                <div key={`env-${t.repo}-${t.branch}-${i}`}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {t.repo || "repo?"} · <Text code>{t.branch}</Text>
                  </Text>
                  {envBranchesOf(t.repo).map((b) => (
                    <div key={b}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                        <Text style={{ flex: 1, fontSize: 12 }}>
                          → <Text code>{b}</Text>
                        </Text>
                        {linkButtons(compareUrl(t, b)!)}
                      </div>
                      {(() => {
                        const env = prs?.[`${t.repo}|${t.branch}`]?.[b];
                        if (!env) return null;
                        const id = `${t.repo}|${t.branch}|${b}`;
                        const open = shown.has(id);
                        return (
                          <>
                            {env.current.map((p) => prRow(p, 18))}
                            {env.previous.length > 0 && (
                              <>
                                <Button
                                  variant="link"
                                  size="sm"
                                  data-pr-previous
                                  icon={open ? <ChevronDown size="1em" /> : <ChevronRight size="1em" />}
                                  style={{ marginTop: 2, marginLeft: 10, paddingInline: 4, fontSize: 12 }}
                                  onClick={() =>
                                    setShown((cur) => {
                                      const next = new Set(cur);
                                      if (next.has(id)) next.delete(id);
                                      else next.add(id);
                                      return next;
                                    })
                                  }
                                >
                                  이전 PR {env.previous.length}개
                                </Button>
                                {open && env.previous.map((p) => prRow(p, 36))}
                              </>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              ))}
          </Stack>
        </>
      )}
    </div>
  );

  return (
    <Pop
      title="PR 생성 링크 (개발 브랜치 → base로 머지)"
      trigger="click"
      open={open}
      onOpenChange={onOpenChange}
      content={content}
      placement="bottomRight"
    >
      <Button variant="link" icon={<GitBranch size="1em" />}>
        PR 링크
      </Button>
    </Pop>
  );
}
