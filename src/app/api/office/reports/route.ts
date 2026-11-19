import { dobbyReports } from "@/lib/office/report";

export const dynamic = "force-dynamic";

// 보고서 캐비닛 창. 해결되지 않은 작업마다 처리 결과, 사람이 할 일, 다음 추천과 맨 위의 지금 할 일
export async function GET() {
  return Response.json(dobbyReports());
}
