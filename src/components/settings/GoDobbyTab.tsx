"use client";

import { useCallback, useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { Checkbox, Field } from "@/components/ui/Form";
import Note from "@/components/ui/Note";
import Tag from "@/components/ui/Tag";
import { toast } from "@/components/ui/Toaster";

type Item = {
  key: string;
  label: string;
  group: string;
  tier: "danger" | "caution" | "normal";
  secret?: boolean;
  def: string | null;
  applies: string;
  cautions: string[];
  before?: string[];
  after: string[];
  set: boolean;
  raw: string | null;
  expanded: string | null;
  lock: { locked: boolean; reasons: string[] };
};
type St = { file: string; exists: boolean; busy: { key: string; what: string }[]; items: Item[] };
type Check = { errors: string[]; info: string[] };

const TIER: Record<Item["tier"], { label: string; color: string }> = {
  danger: { label: "위험", color: "error" },
  caution: { label: "주의", color: "warning" },
  normal: { label: "일반", color: "default" },
};

function List({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="set-notes">
      <b>{title}</b>
      <ul className="set-list">
        {items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

/** 스킬 설정 파일(config.env) 탭. 위험·주의 항목은 돌고 있는 일이 없을 때만 열린다. */
export default function GoDobbyTab({ onSaved }: { onSaved: () => void }) {
  const [st, setSt] = useState<St | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [checks, setChecks] = useState<Record<string, Check>>({});
  const [confirm, setConfirm] = useState(false);
  const [terminalOk, setTerminalOk] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/settings/go-dobby", { cache: "no-store" }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (!r?.ok) return setErr(j?.error || "스킬 설정을 읽지 못했습니다.");
    setErr(null);
    setSt(j);
  }, []);

  // 잠금 상태는 돌고 있는 일에 따라 바뀌므로 10초마다 다시 읽는다
  useEffect(() => {
    load();
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, [load]);

  const changed = st ? st.items.filter((i) => edits[i.key] !== undefined && (i.secret ? edits[i.key] !== "" : edits[i.key] !== i.raw)) : [];

  // 바뀐 값은 입력을 멈추고 0.4초 뒤 서버에서 검사한다
  useEffect(() => {
    const t = setTimeout(() => {
      for (const i of changed) {
        const v = edits[i.key].trim();
        fetch(`/api/settings/go-dobby?check=${i.key}&value=${encodeURIComponent(v)}`, { cache: "no-store" })
          .then((r) => r.json())
          .then((c: Check) => setChecks((x) => ({ ...x, [i.key]: c })))
          .catch(() => {});
      }
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(edits)]);

  if (err) return <Note type="warning" title={err} />;
  if (!st) return <p className="set-help">스킬 설정을 읽는 중입니다.</p>;
  if (!st.exists) return <Note type="warning" title="스킬 설정 파일이 없습니다." description="먼저 터미널에서 /dobby-init 을 실행해 주세요. 설정 창은 파일을 새로 만들지 않습니다." />;

  const hasErrors = changed.some((i) => checks[i.key]?.errors.length);
  const hasDanger = changed.some((i) => i.tier === "danger");

  const save = async () => {
    setBusy(true);
    const r = await fetch("/api/settings/go-dobby", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ changes: Object.fromEntries(changed.map((i) => [i.key, edits[i.key].trim()])), confirmTerminal: terminalOk }),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setBusy(false);
    if (!r?.ok) return toast.error(j?.error || "저장하지 못했습니다.");
    toast.success(`저장했습니다. 이전 파일은 ${j.backup} 에 남겼습니다.`, 8);
    setEdits({});
    setChecks({});
    setConfirm(false);
    setTerminalOk(false);
    setSt(j);
    onSaved();
  };

  if (confirm) {
    return (
      <div className="set-confirm">
        <h4 className="set-title">바뀌는 설정 {changed.length}건을 확인해 주세요</h4>
        {changed.map((i) => (
          <div key={i.key} className="set-item">
            <div className="set-item-head">
              <Tag color={TIER[i.tier].color}>{TIER[i.tier].label}</Tag>
              <b>{i.label}</b>
            </div>
            <p className="set-diff">
              {i.secret ? "(비밀번호)" : i.raw || "(없음)"} → {i.secret ? "새 비밀번호" : edits[i.key].trim() || `(지움, 기본값 ${i.def ?? "없음"})`}
            </p>
            <p className="set-help">반영: {i.applies}</p>
            <List title="주의사항" items={i.cautions} />
            <List title="바꾸기 전에 할 일" items={i.before} />
            <List title="바꾼 뒤 할 일" items={i.after} />
          </div>
        ))}
        {hasDanger && (
          <Checkbox checked={terminalOk} onChange={setTerminalOk}>
            터미널에서 도비 스킬(/do 말고 dobby-order 등)을 쓰는 창이 없습니다. 대시보드는 이런 창을 알아내지 못합니다.
          </Checkbox>
        )}
        <div className="set-actions">
          <Button onClick={() => setConfirm(false)}>돌아가기</Button>
          <Button variant="solid" danger={hasDanger} busy={busy} disabled={hasDanger && !terminalOk} onClick={save}>
            이대로 저장
          </Button>
        </div>
      </div>
    );
  }

  const groups = [...new Set(st.items.map((i) => i.group))];
  return (
    <div>
      <p className="set-help">
        파일: <code>{st.file}</code>. 바뀐 줄만 고치고 주석과 순서는 그대로 둡니다. 저장하기 전에 같은 폴더에 백업을 남깁니다.
      </p>
      {st.busy.length > 0 && (
        <Note
          type="warning"
          title={`지금 돌고 있는 일 ${st.busy.length}건 때문에 위험·주의 항목이 잠겨 있습니다`}
          description="끝나면 10초 안에 저절로 열립니다. 지금 바꾸면 한 오더 안에서 옛 값과 새 값이 섞입니다."
        />
      )}
      {groups.map((g) => (
        <section key={g} className="set-sec">
          <h4 className="set-group">{g}</h4>
          {st.items
            .filter((i) => i.group === g)
            .map((i) => {
              const c = checks[i.key];
              const isChanged = changed.includes(i);
              return (
                <div key={i.key} className={`set-item${isChanged ? " is-changed" : ""}`}>
                  <div className="set-item-head">
                    <Tag color={TIER[i.tier].color}>{TIER[i.tier].label}</Tag>
                    <b>{i.label}</b>
                    <code className="set-key">{i.key}</code>
                  </div>
                  <Field
                    size="sm"
                    type={i.secret ? "password" : "text"}
                    disabled={i.lock.locked}
                    placeholder={i.secret ? (i.set ? "설정됨. 바꾸려면 새 값을 적으세요" : "없음") : i.def ? `비어 있음. 기본값 ${i.def}` : "비어 있음"}
                    value={edits[i.key] ?? (i.secret ? "" : (i.raw ?? ""))}
                    status={isChanged && c?.errors.length ? "error" : ""}
                    onChange={(e) => setEdits((x) => ({ ...x, [i.key]: e.target.value }))}
                    aria-label={i.label}
                  />
                  {i.expanded && i.expanded !== i.raw && <p className="set-help">실제 경로: {i.expanded}</p>}
                  {isChanged && c?.errors.map((t) => <p key={t} className="set-error">✕ {t}</p>)}
                  {isChanged && c?.info.map((t) => <p key={t} className="set-help">✓ {t}</p>)}
                  {i.lock.locked && (
                    <Note type="warning" title="지금은 바꿀 수 없습니다" description={<List title="막고 있는 것" items={i.lock.reasons} />} />
                  )}
                  <p className="set-help">반영: {i.applies}</p>
                  <List title="주의사항" items={i.cautions} />
                  <List title="바꾸기 전에 할 일" items={i.before} />
                  <List title="바꾼 뒤 할 일" items={i.after} />
                </div>
              );
            })}
        </section>
      ))}
      <div className="set-actions set-sticky">
        {changed.length > 0 && <Button onClick={() => (setEdits({}), setChecks({}))}>바꾼 것 되돌리기</Button>}
        <Button variant="solid" disabled={!changed.length || hasErrors} onClick={() => setConfirm(true)}>
          {changed.length ? `바뀐 ${changed.length}건 확인하고 저장` : "바뀐 것 없음"}
        </Button>
      </div>
    </div>
  );
}
