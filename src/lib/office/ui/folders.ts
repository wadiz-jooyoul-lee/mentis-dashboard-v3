import type { TaskState } from "@/lib/office/core/types";

// 서류철 색. 사무실 안의 작업끼리는 겹치지 않게 앞 번호부터 쓴다
export const FOLDER_COLORS = ["#3f6fd8", "#d8453f", "#2f9e5b", "#e0a21b", "#8a4fd0", "#1fa3a8", "#e06a1f", "#c23f87", "#5a7d2a", "#6b4a2f", "#2b4d8c", "#b8323a", "#3d8f8a", "#9a7b16", "#5d3a9b", "#c76a4b", "#4c6b73", "#8c8c3a"];
export function nextColor(tasks: { color: number }[]) {
  const used = new Set(tasks.map((t) => t.color));
  const free = FOLDER_COLORS.findIndex((_, i) => !used.has(i));
  if (free >= 0) return free;
  const n = FOLDER_COLORS.map((_, i) => tasks.filter((t) => t.color === i).length);
  return n.indexOf(Math.min(...n));
}

// 서류철에 모래시계를 붙이는 단계: PR 리뷰 대기와 머지 뒤 빌드 대기
export const isReviewWait = (t: TaskState) => t.phase.includes("리뷰 대기") || t.phase.includes("빌드 대기");
