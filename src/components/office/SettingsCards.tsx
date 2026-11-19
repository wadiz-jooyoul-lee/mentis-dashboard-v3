"use client";
import { useState, type FormEvent } from "react";
import { CloseX } from "@/components/office/CloseX";
import { useOffice } from "@/lib/office/ui/store";
import { DOBBY_ALL_ROLES, MODELS, ROLE_NAME, type Model, type TableRole } from "@/lib/office/core/types";

const post = async (url: string, body: unknown) => {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  const j = await r?.json().catch(() => null);
  return r?.ok ? { ok: true as const, message: (j?.message as string) ?? "" } : { ok: false as const, message: (j?.error as string) ?? "보내지 못했습니다." };
};

// 역할별 모델 창(카페 도비를 누르면 열림). 역할마다 세 모델 단추 중 하나를 누른다. 일하는 에이전트는 지금 실행을 마친 뒤 다음 실행부터 새 모델을 쓴다
export function ModelCard({ onClose }: { onClose: () => void }) {
  const cur = useOffice((s) => s.state?.models);
  const roles: TableRole[] = DOBBY_ALL_ROLES;
  const [models, setModels] = useState<Partial<Record<TableRole, Model>>>(() => ({ ...cur }));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!cur) return null;
  const label = (id: string) => MODELS.find((m) => m.id === id)?.name ?? id;
  const changed = roles.filter((k) => (models[k] ?? cur[k]) !== cur[k]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await post(`/api/office/models`, { models: Object.fromEntries(roles.map((k) => [k, models[k] ?? cur![k]])) });
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.message });
    onClose();
  }

  return (
    <div className="art-card model-card" role="dialog" aria-label="역할별 모델" aria-busy={busy}>
      <CloseX onClick={onClose} />
      <div className="kick">카페 도비</div>
      <h4>역할별 모델</h4>
      <p className="done-lead">
        바꾸면 각 역할의 다음 실행부터 새 모델을 씁니다. 지금 하던 실행은 그대로 끝납니다.
        {" go-dobby 자동 실행도 다음 단계부터 이 모델을 씁니다."}
      </p>
      <form className="model-form" noValidate onSubmit={save}>
        {roles.map((k) => {
          const v = models[k] ?? cur[k];
          const diff = v !== cur[k];
          return (
            <fieldset key={k} className={`model-row${diff ? " changed" : ""}`}>
              <legend>
                <span className={`role-dot ${k}`} aria-hidden="true" />
                {ROLE_NAME[k]}
              </legend>
              <div className="model-pick">
                {MODELS.map((m) => (
                  <label key={m.id} className={v === m.id ? "on" : ""}>
                    <input type="radio" name={k} checked={v === m.id} onChange={() => setModels((x) => ({ ...x, [k]: m.id }))} />
                    {m.name}
                  </label>
                ))}
              </div>
              {diff && (
                <span className="model-diff">
                  바뀜: {label(cur[k])} → {label(v)}
                </span>
              )}
            </fieldset>
          );
        })}
        {msg && <p role="alert">{msg.text}</p>}
        <div className="row model-actions">
          <button type="submit" className="primary auto-start" disabled={busy || !changed.length}>
            {changed.length ? `바뀐 ${changed.length}건 저장` : "바뀐 것 없음"}
          </button>
          <button type="button" onClick={onClose}>
            닫기
          </button>
        </div>
      </form>
    </div>
  );
}
