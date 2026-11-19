import type { ReactNode } from "react";
import { Poor_Story } from "next/font/google";
import "@/styles/office.css";

// 펼친 책의 종이에 맞춘 손글씨. 책 쪽(.rb-page)만 쓴다(--f-book)
const book = Poor_Story({ weight: "400", subsets: ["latin"], variable: "--f-book" });

// 사무실 화면의 뿌리. 오피스 스타일과 변수는 이 상자 안에서만 걸린다(src/styles/office.css)
export default function OfficeRoot({ children }: { children: ReactNode }) {
  return <div className={`office-root ${book.variable}`}>{children}</div>;
}
