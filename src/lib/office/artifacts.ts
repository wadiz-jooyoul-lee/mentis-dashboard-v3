import { existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Artifact } from "@/lib/office/core/types";

// 오더마다 있는 아티팩트 표 파일. 메타 폴더 바로 아래 같은 이름 파일은 오더에 연결되지 않은 아티팩트 모음이다
const FILE = "artifact-share.md";
const KEY_RE = /^([A-Za-z][A-Za-z0-9]*-\d+|TASK-[A-Za-z0-9-]+)$/; // 대시보드 오더 키 규칙과 같다
const HEAD = ["| 슬러그 | 제목 | 링크 | 생성 | 갱신 |", "|--------|------|------|------|------|"];
// 사무실 꽂기 창의 종류를 표의 슬러그로 옮긴다. 같은 슬러그가 있으면 -2, -3 을 붙인다
const SLUG: Record<string, string> = { "구현 설명": "explainer", "데이터 분석": "data", 설계: "design", "원인 분석": "cause", 기타: "artifact" };

const read = (f: string) => {
  try {
    return readFileSync(f, "utf8");
  } catch {
    return null;
  }
};
const pad = (n: number) => String(n).padStart(2, "0");
const stamp = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
const urlOf = (s: string) => s.match(/https?:\/\/[^\s)>\]|]+/)?.[0] ?? "";
const fieldLine = (md: string, label: string) => md.match(new RegExp(`\\*\\*${label}\\*\\*\\s*[:：]?\\s*(.+)`))?.[1].trim().replace(/^`|`$/g, "").trim() || "";

type Row = { slug: string; title: string; url: string; created: string; updated: string };

// '슬러그' 칸이 있는 첫 표의 행. 대시보드와 같이 칸 위치는 머리줄 이름으로 찾는다
function tableRows(md: string): Row[] | null {
  const lines = md.split("\n");
  const h = lines.findIndex((l) => /^\s*\|/.test(l) && cells(l).some((c) => c.replace(/\*/g, "").includes("슬러그")));
  if (h < 0) return null;
  const head = cells(lines[h]).map((c) => c.replace(/\*/g, ""));
  const col = (k: string) => head.findIndex((c) => c.includes(k));
  const [cs, ct, cu, cc, cd] = ["슬러그", "제목", "링크", "생성", "갱신"].map(col);
  const out: Row[] = [];
  for (const l of lines.slice(h + 1)) {
    if (!/^\s*\|/.test(l)) break;
    const r = cells(l);
    if (r.every((c) => /^-*$/.test(c))) continue;
    const at = (i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
    const url = urlOf(at(cu));
    if (!url) continue; // 링크 없는 행은 아직 게시 전
    const slug = at(cs) || "artifact";
    out.push({ slug, title: at(ct) || slug, url, created: at(cc), updated: at(cd) });
  }
  return out;
}

// 표가 있으면 표만, 없으면 옛 불릿 형식(`- **링크**: …`) 한 건
function rowsOf(md: string, key: string): Row[] {
  const t = tableRows(md);
  if (t?.length) return t;
  const url = urlOf(md);
  return url ? [{ slug: "legacy", title: fieldLine(md, "제목") || `${key} 구현 내용`, url, created: fieldLine(md, "생성"), updated: fieldLine(md, "갱신") }] : [];
}

// 대시보드 아티팩트 화면과 같은 대상: 키 모양이고 status.md 나 orchestration.md 가 있는 오더 폴더
function orderKeys(meta: string): string[] {
  try {
    return readdirSync(meta, { withFileTypes: true })
      .filter((d) => d.isDirectory() && KEY_RE.test(d.name) && (existsSync(join(meta, d.name, "status.md")) || existsSync(join(meta, d.name, "orchestration.md"))))
      .map((d) => d.name);
  } catch {
    return [];
  }
}

const sortAt = (v: string) => v.match(/^\s*(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?/)?.slice(1, 3).join(" ").trim() ?? "";

// 오더들과 모음 파일의 아티팩트 전부. 오래된 것부터 놓아 책꽂이 맨 뒤가 최신이 된다
export function readArtifacts(meta: string): Artifact[] {
  const list: (Artifact & { sort: string })[] = [];
  const add = (key: string, file: string) => {
    const md = read(file);
    if (!md) return;
    let mtime = "";
    try {
      mtime = stamp(statSync(file).mtime);
    } catch {}
    for (const r of rowsOf(md, key)) {
      const sort = sortAt(r.updated) || sortAt(r.created) || mtime;
      list.push({ id: `${key || "unlinked"}:${r.slug}`, taskKey: key, title: r.title, kind: r.slug, url: r.url, at: sort.slice(5, 10), sort });
    }
  };
  for (const key of orderKeys(meta)) add(key, join(meta, key, FILE));
  add("", join(meta, FILE));
  return list.sort((a, b) => a.sort.localeCompare(b.sort)).map(({ sort: _, ...a }) => a);
}

export const isOrderKey = (meta: string, key: string) => orderKeys(meta).includes(key);

// 표에 한 행을 더한다. key 가 비면 모음 파일, 있으면 그 오더 파일. 옛 불릿만 있는 파일은 그 링크를 첫 행으로 옮겨 사라지지 않게 한다
export function appendArtifact(meta: string, key: string, kind: string, title: string, url: string): Artifact {
  const file = key ? join(meta, key, FILE) : join(meta, FILE);
  const md = read(file) ?? "";
  const lines = md.split("\n");
  const now = stamp(new Date());
  const base = SLUG[kind] ?? "artifact";
  const t = tableRows(md);
  const taken = new Set((t ?? rowsOf(md, key)).map((r) => r.slug));
  let slug = base;
  for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;
  const row = `| ${slug} | ${title.replace(/\|/g, "/")} | ${url} | ${now} |  |`;
  if (t) {
    const h = lines.findIndex((l) => /^\s*\|/.test(l) && cells(l).some((c) => c.includes("슬러그")));
    let end = h + 1;
    while (end < lines.length && /^\s*\|/.test(lines[end])) end++;
    lines.splice(end, 0, row);
  } else {
    const legacy = rowsOf(md, key)[0];
    const old = legacy ? [`| legacy | ${legacy.title} | ${legacy.url} | ${legacy.created} | ${legacy.updated} |`] : [];
    if (lines.length && lines[lines.length - 1] === "") lines.pop();
    lines.push(...(lines.length ? [""] : []), "## 아티팩트", "", ...HEAD, ...old, row, "");
  }
  writeFileSync(`${file}.tmp`, lines.join("\n"));
  renameSync(`${file}.tmp`, file);
  return { id: `${key || "unlinked"}:${slug}`, taskKey: key, title, kind: slug, url, at: now.slice(5, 10) };
}
