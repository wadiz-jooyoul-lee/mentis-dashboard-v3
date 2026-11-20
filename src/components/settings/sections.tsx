"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { HexColorInput, HexColorPicker } from "react-colorful";
import { lanTip, useLan } from "@/components/LanToggle";
import Button from "@/components/ui/Button";
import { RadioGroup, Switch } from "@/components/ui/Form";
import { Seg } from "@/components/ui/Tabs";
import { toast } from "@/components/ui/Toaster";
import { ACCENT_PRESETS, DEFAULT_ACCENT, accentFg, contrast, tooLight } from "@/lib/color";

export type DashState = { accent: string; refreshSec: number; canEdit: boolean };
export type SectionProps = { st: DashState; save: (patch: Partial<DashState>) => Promise<boolean> };

/** 저장 전 미리 보기 — 화면 맨 위 요소의 포인트 색 변수만 바꾼다. */
function preview(c: string) {
  document.documentElement.style.setProperty("--accent", c);
  document.documentElement.style.setProperty("--accent-fg", accentFg(c));
}

function AccentSetting({ st, save }: SectionProps) {
  const [color, setColor] = useState(st.accent);
  const latest = useRef(st.accent); // 끌기를 놓는 순간의 색. 상태 값은 한 박자 늦을 수 있다
  useEffect(() => {
    setColor(st.accent);
    latest.current = st.accent;
  }, [st.accent]);
  const pick = (c: string) => {
    latest.current = c;
    setColor(c);
    preview(c);
  };
  const commit = async (c: string) => {
    if (c.toLowerCase() === st.accent) return;
    if (!(await save({ accent: c.toLowerCase() }))) preview(st.accent);
  };
  const off = !st.canEdit;
  return (
    <div className="set-accent">
      <div className="set-swatches">
        {ACCENT_PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            className={`set-swatch${color.toLowerCase() === p.value ? " is-on" : ""}`}
            style={{ background: p.value }}
            title={p.name}
            aria-label={p.name}
            disabled={off}
            onClick={() => {
              pick(p.value);
              commit(p.value);
            }}
          />
        ))}
      </div>
      <div className={`set-picker${off ? " is-off" : ""}`} onPointerUp={() => commit(latest.current)}>
        <HexColorPicker color={color} onChange={pick} />
      </div>
      <div className="set-hex">
        #
        <HexColorInput color={color} onChange={pick} onBlur={() => commit(latest.current)} disabled={off} aria-label="색 값" />
        <Button size="sm" disabled={off || st.accent === DEFAULT_ACCENT} onClick={() => (pick(DEFAULT_ACCENT), commit(DEFAULT_ACCENT))}>
          기본으로 되돌리기
        </Button>
      </div>
      {tooLight(color) && (
        <p className="set-warn">
          ⚠ 글자로 쓰기엔 흐립니다 (흰 바탕 대비 {contrast(color, "#ffffff").toFixed(1)}:1). 강조 글자와 테두리가 잘 안 보일 수 있습니다.
        </p>
      )}
    </div>
  );
}

const REFRESH_OPTS = [
  { value: "0", label: "끄기" },
  { value: "5", label: "5초" },
  { value: "10", label: "10초" },
  { value: "30", label: "30초" },
  { value: "60", label: "60초" },
];

function RefreshSetting({ st, save }: SectionProps) {
  return (
    <>
      <Seg size="sm" options={REFRESH_OPTS} value={String(st.refreshSec)} disabled={!st.canEdit} onChange={(v) => save({ refreshSec: Number(v) })} />
      <p className="set-help">
        서버에 저장해서 다른 기기에서 보는 화면도 같은 간격으로 갱신됩니다. 끄면 머리말의 새로고침 아이콘으로만 갱신합니다.
      </p>
    </>
  );
}

function LanSetting() {
  const { s, busy, toggle } = useLan();
  if (!s) return <p className="set-help">상태를 읽는 중입니다.</p>;
  return (
    <>
      <Switch checked={s.on} disabled={!s.canToggle || busy} onChange={toggle} aria-label="외부 공개" />
      <p className="set-help">{lanTip(s)} 머리말의 외부 공개 단추와 같은 설정입니다.</p>
    </>
  );
}

type Models = { models: Record<string, string>; roles: { id: string; name: string }[]; choices: { id: string; name: string }[] };

function ModelSetting({ st }: SectionProps) {
  const [data, setData] = useState<Models | null>(null);
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const load = () =>
    fetch("/api/office/models", { cache: "no-store" })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  useEffect(() => {
    load();
  }, []);
  if (!data) return <p className="set-help">모델 설정을 읽는 중입니다.</p>;
  const changed = data.roles.filter((r) => edit[r.id] && edit[r.id] !== data.models[r.id]);
  const saveModels = async () => {
    setBusy(true);
    const r = await fetch("/api/office/models", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ models: { ...data.models, ...edit } }),
    }).catch(() => null);
    setBusy(false);
    if (!r?.ok) return toast.error(((await r?.json().catch(() => null))?.error as string) || "저장하지 못했습니다.");
    toast.success("역할별 모델을 저장했습니다. 각 역할의 다음 실행부터 씁니다.");
    setEdit({});
    load();
  };
  return (
    <>
      <div className="set-models">
        {data.roles.map((r) => (
          <div key={r.id} className={`set-model-row${changed.includes(r) ? " is-changed" : ""}`}>
            <span className="set-model-name">{r.name}</span>
            <RadioGroup
              name={`model-${r.id}`}
              button
              disabled={!st.canEdit}
              value={edit[r.id] ?? data.models[r.id]}
              options={data.choices.map((c) => ({ value: c.id, label: c.name }))}
              onChange={(v) => setEdit((e) => ({ ...e, [r.id]: v }))}
            />
          </div>
        ))}
      </div>
      <p className="set-help">
        바꾸면 각 역할의 다음 실행부터 새 모델을 씁니다. 지금 하던 실행은 그대로 끝납니다. 사무실의 카페 도비 창과 같은 설정입니다.
      </p>
      <Button size="sm" variant="solid" busy={busy} disabled={!changed.length || !st.canEdit} onClick={saveModels}>
        {changed.length ? `바뀐 ${changed.length}건 저장` : "바뀐 것 없음"}
      </Button>
    </>
  );
}

function NotifySetting() {
  const [perm, setPerm] = useState<string>("unknown");
  useEffect(() => {
    setPerm(typeof Notification === "undefined" ? "unsupported" : !window.isSecureContext ? "insecure" : Notification.permission);
  }, []);
  const text: Record<string, string> = {
    granted: "허용됨. 할 일이 생기면 이 브라우저가 운영체제 알림을 띄웁니다.",
    denied: "막혀 있음. 브라우저 주소창 왼쪽의 사이트 설정에서 알림을 허용으로 바꿔야 합니다.",
    default: "아직 정하지 않음. 아래 단추를 누르면 브라우저가 허용할지 묻습니다.",
    insecure: "이 주소에서는 알림을 쓸 수 없습니다. 브라우저는 localhost 나 https 주소에서만 알림을 허락합니다.",
    unsupported: "이 브라우저는 알림을 지원하지 않습니다.",
    unknown: "확인 중입니다.",
  };
  return (
    <>
      <p className="set-help">{text[perm]} 보는 사람의 브라우저마다 따로 정합니다.</p>
      {perm === "default" && (
        <Button size="sm" variant="solid" onClick={() => Notification.requestPermission().then(setPerm)}>
          허용 요청
        </Button>
      )}
    </>
  );
}

/** 대시보드 탭의 묶음 목록. 새 설정은 여기에 한 줄 더한다. */
export const SECTIONS: { key: string; group: string; label: string; Body: (p: SectionProps) => ReactNode }[] = [
  { key: "accent", group: "화면", label: "포인트 색", Body: AccentSetting },
  { key: "refresh", group: "화면", label: "자동 갱신 간격", Body: RefreshSetting },
  { key: "lan", group: "접속", label: "외부 공개", Body: LanSetting },
  { key: "models", group: "자동 실행", label: "역할별 모델", Body: ModelSetting },
  { key: "notify", group: "알림", label: "데스크톱 알림", Body: NotifySetting },
];

/** 저장 요청. 성공하면 서버 화면을 다시 받아 레이아웃의 색과 갱신 간격을 맞춘다. */
export function useDashSave(setSt: (s: DashState) => void) {
  const router = useRouter();
  return async (patch: Partial<DashState>) => {
    const r = await fetch("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (!r?.ok) {
      toast.error(j?.error || "저장하지 못했습니다.");
      return false;
    }
    setSt(j);
    router.refresh();
    return true;
  };
}
