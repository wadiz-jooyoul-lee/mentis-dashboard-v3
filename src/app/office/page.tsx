import type { Metadata } from "next";
import { OfficePage } from "@/components/office/OfficePage";
import OfficeRoot from "./OfficeRoot";

export const metadata: Metadata = { title: "사무실 · Mentis Dashboard" };

// 도비 /do 오더를 사무실 그림으로 보는 화면(agent-office 의 도비 모드를 옮겨 왔다). 사무실은 하나라 이름 세그먼트가 없다
export default function Page() {
  return (
    <OfficeRoot>
      <OfficePage />
    </OfficeRoot>
  );
}
