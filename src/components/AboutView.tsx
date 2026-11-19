"use client";

import Crumbs from "@/components/ui/Crumbs";
import MarkdownDoc from "@/components/MarkdownDoc";

/** ABOUT.md(저장소 루트)를 그대로 렌더하는 소개 페이지. mermaid·표는 MarkdownDoc이 그린다. */
export default function AboutView({ md }: { md: string }) {
  return (
    <div>
      <Crumbs items={[{ href: "/", label: "홈" }, { label: "소개" }]} />
      <MarkdownDoc md={md} />
    </div>
  );
}
