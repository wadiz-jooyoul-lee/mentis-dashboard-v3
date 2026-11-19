"use client";

import { copyText } from "@/lib/clipboard";
import Button from "@/components/ui/Button";
import { toast } from "@/components/ui/Toaster";
import { Copy } from "lucide-react";

/** 모노스페이스 값 한 줄 + 복사 버튼. */
export function CopyRow({ label, value }: { label: string; value: string }) {
  const copy = async () => {
    const ok = await copyText(value);
    if (ok) toast.success(`${label} 복사됨`);
    else toast.error("복사 실패 — 값을 직접 선택해 복사하세요");
  };
  return (
    <div style={{ display: "flex", alignItems: "stretch", gap: 6 }}>
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
        {value}
      </div>
      <Button size="sm" icon={<Copy size="1em" />} onClick={copy} style={{ flexShrink: 0 }}>
        복사
      </Button>
    </div>
  );
}
