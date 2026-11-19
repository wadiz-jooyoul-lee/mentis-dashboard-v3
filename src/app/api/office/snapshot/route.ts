import { DOBBY_OFFICE } from "@/lib/office/office";
import { getBus } from "@/lib/office/core/bus";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(getBus(DOBBY_OFFICE).snapshot());
}
