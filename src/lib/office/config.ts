import { homedir } from "node:os";
import { join } from "node:path";

// 오피스 폴더. 도비 답변(dobby-answers)을 예전 오피스 DB 옆 자리(~/.agent-office)에 둔다
export const officeHome = () => process.env.AGENT_OFFICE_HOME || join(homedir(), ".agent-office");
