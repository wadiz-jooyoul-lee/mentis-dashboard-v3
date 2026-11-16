import { listChrome } from "@/lib/chromeProcs";
import ChromeProcView from "@/components/ChromeProcView";

export const dynamic = "force-dynamic";

export default function ChromePage() {
  return <ChromeProcView list={listChrome()} />;
}
