import type { Metadata } from "next";
import { OfficePage } from "@/components/office/OfficePage";
import OfficeRoot from "../../OfficeRoot";

export const metadata: Metadata = { title: "사무실 · Mentis Dashboard" };

// 작업 책을 펼친 채로 여는 주소. 책을 펼치고 닫으면 사무실 화면이 주소를 이 꼴로 맞춘다
export default async function Page({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return (
    <OfficeRoot>
      <OfficePage initialTask={decodeURIComponent(key)} />
    </OfficeRoot>
  );
}
