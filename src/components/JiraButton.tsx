"use client";

import { copyText } from "@/lib/clipboard";
import { jiraUrl } from "@/lib/jira";
import Button from "@/components/ui/Button";
import { Menu } from "@/components/ui/Misc";
import { toast } from "@/components/ui/Toaster";
import { ChevronDown, Copy, ExternalLink, Link2 } from "lucide-react";

/**
 * "Jira" 버튼 — 누르면 그 이슈의 Jira 링크 복사·열기 메뉴가 뜬다.
 * 다른 사람에게 이슈를 알려 줄 때 새 탭을 열어 주소창을 긁을 필요가 없게 한다.
 */
export default function JiraButton({ epicKey }: { epicKey: string }) {
  const url = jiraUrl(epicKey);

  const onClick = async (key: string) => {
    if (key === "open") {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    if (await copyText(url)) toast.success(url);
    else toast.error("복사에 실패했습니다.");
  };

  return (
    <Menu
      placement="bottomRight"
      onPick={onClick}
      items={[
        { key: "copy", icon: <Copy size="1em" />, label: "링크 복사" },
        { key: "open", icon: <ExternalLink size="1em" />, label: "열기" },
      ]}
    >
      <Button variant="link" icon={<Link2 size="1em" />}>
        Jira <ChevronDown size="1em" style={{ fontSize: 10 }} />
      </Button>
    </Menu>
  );
}
