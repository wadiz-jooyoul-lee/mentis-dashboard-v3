"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import GoDobbyTab from "@/components/settings/GoDobbyTab";
import { SECTIONS, useDashSave, type DashState } from "@/components/settings/sections";
import Button from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Form";
import Note from "@/components/ui/Note";
import Tabs from "@/components/ui/Tabs";
import { toast } from "@/components/ui/Toaster";

type Todo = { id: string; label: string; text: string; done: boolean };
type Full = DashState & { todo: Todo[] };

/** 사마귀 아이콘을 누르면 여는 설정 창. 브라우저 기본 대화 상자라 Esc 로 닫힌다. */
export default function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [st, setSt] = useState<Full | null>(null);
  const [denied, setDenied] = useState(false);
  const save = useDashSave((s) => setSt(s as Full));

  // 다른 기기에서 열면 프록시가 설정 조회를 403 으로 막는다
  const load = useCallback(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then(async (r) => (r.status === 403 ? setDenied(true) : setSt(await r.json())))
      .catch(() => setSt(null));
  }, []);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      load();
    } else if (!open && d.open) d.close();
  }, [open, load]);

  const setTodo = async (todo: Todo[]) => {
    const r = await fetch("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ todo }),
    }).catch(() => null);
    if (r?.ok) setSt(await r.json());
    else toast.error("할 일 목록을 저장하지 못했습니다.");
  };

  const dash = st && (
    <div>
      {!st.canEdit && <Note type="info" title="이 맥에서만 바꿀 수 있습니다" description="다른 기기에서 보는 중이라 지금 값만 보여 줍니다." />}
      {SECTIONS.map(({ key, group, label, Body }, i) => (
        <section key={key} className="set-sec">
          {SECTIONS[i - 1]?.group !== group && <h4 className="set-group">{group}</h4>}
          <div className="set-label">{label}</div>
          <Body st={st} save={save} />
        </section>
      ))}
    </div>
  );

  return (
    <dialog
      ref={ref}
      className="ui-dialog"
      aria-label="설정"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="ui-dialog-head">
        <h3 className="ui-h3">설정</h3>
        <Button variant="text" size="sm" icon={<X size="1em" />} onClick={onClose} title="닫기" />
      </div>
      <div className="ui-dialog-body">
        {st && st.todo.length > 0 && (
          <Note
            type="warning"
            title="설정을 바꾼 뒤 할 일"
            description={
              <div className="set-todo">
                {st.todo.map((t) => (
                  <Checkbox key={t.id} checked={t.done} onChange={(v) => setTodo(st.todo.map((x) => (x.id === t.id ? { ...x, done: v } : x)))}>
                    <b>{t.label}</b> · {t.text}
                  </Checkbox>
                ))}
                <Button size="sm" onClick={() => setTodo([])}>
                  목록 닫기
                </Button>
              </div>
            }
          />
        )}
        {denied && (
          <Note type="info" title="설정은 대시보드가 실행 중인 맥에서만 열 수 있습니다" description="다른 기기에서는 이 맥에서 정한 색과 갱신 간격이 그대로 보입니다." />
        )}
        {open && !denied && (
          <Tabs
            items={[
              { key: "dash", label: "대시보드", children: dash ?? <p className="set-help">설정을 읽는 중입니다.</p> },
              {
                key: "skill",
                label: "스킬 설정",
                children: st?.canEdit === false ? (
                  <Note type="info" title="이 맥에서만 볼 수 있습니다" description="시험 계정과 비밀번호가 들어 있어 다른 기기에는 보여 주지 않습니다." />
                ) : (
                  <GoDobbyTab onSaved={load} />
                ),
              },
            ]}
          />
        )}
      </div>
    </dialog>
  );
}
