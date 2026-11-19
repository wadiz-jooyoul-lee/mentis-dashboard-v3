import type { Persona } from "@/lib/office/core/types";

// 성격별 코멘트 템플릿. 실제 멤버별 템플릿(quips/{group}/{member}.json)이 생기기 전까지 쓰는 기본 문장이다
type Table = Record<string, Partial<Record<Persona, string[]>>>;

const Q: Table = {
  assigned: { calm: ["{task} 맡았습니다. 자료부터 읽고 갈게요."], sunny: ["{task}! 좋아요, 바로 갑니다!"], cool: ["{task}. 알겠어, 가 볼게."], perfect: ["{task} 배정 확인. 체크리스트부터 펼칠게요."], elf: ["도비가 {task}에 갑니다! 도비는 기뻐요!"] },
  planning: { calm: ["호출부가 {n}곳이네요. 하나씩 실제 경로를 확인 중입니다."], perfect: ["{n}곳 전부 확인하기 전엔 지시서에 안 써요."] },
  spec_done: { calm: ["구현 지시서 v{v} 완성. 개발자가 바로 시작할 수 있어요."], perfect: ["확인 못 한 칸 0개. 이제 넘겨도 됩니다."] },
  dev_start: { sunny: ["{file}부터 고칩니다, 신난다!"], cool: ["{file}. 지시서대로 하면 금방이야."], calm: ["{file} 수정 시작. 작업 순서대로 갈게요."] },
  gate_fail: { sunny: ["타입체크 {c}건… 괜찮아요, 금방 고쳐요!"], cool: ["{c}건? 방금 돌렸는데. 다시 본다."], calm: ["타입체크 {c}건 실패. 원인부터 확인하죠."] },
  review_start: { perfect: ["{task} diff 열었습니다. 깨뜨릴 곳부터 찾을게요."], cool: ["브리프 받았어. 소비처 표부터 볼게."] },
  review_findings: { perfect: ["major {c}건. 빈 값이 들어오면 여기서 깨져요."], cool: ["{c}건. 고치고 다시 와."] },
  fixing: { sunny: ["{c}건 반영 중! 다시 리뷰 받으러 갈게요!"], cool: ["알았어, {c}건 고친다."], calm: ["지적 {c}건, 전부 반영합니다."] },
  review_pass: { perfect: ["blocker·major 0건. 통과입니다."], cool: ["통과. 이번엔 깔끔하네."] },
  approved: { sunny: ["#{pr} 승인! 코멘트만 정리하고 머지 가요!"], cool: ["#{pr} 승인. 지적한 범위만 손볼게."], calm: ["#{pr} 승인. 코멘트별로 판정하겠습니다."] },
  test_start: { sunny: ["{env}에서 테스트 케이스 {c}개 돌려 볼게요!"], perfect: ["{env} 환경, 기대 결과와 한 글자씩 대조합니다."] },
  test_pass: { sunny: ["{c}개 전부 통과! 최고예요!"], perfect: ["{c}개 통과. 근거 화면도 남겼습니다."] },
  back: { calm: ["{task} 끝. 자리에서 정리하겠습니다."], sunny: ["다녀왔어요! 다음 일 주세요!"], cool: ["끝. 좀 쉰다."], perfect: ["마무리 확인했어요. 잠깐 쉴게요."], elf: ["도비는 일을 마쳤어요. 도비는 자유예요!"] },
  tea: { calm: ["차 한 잔 하면서 다음 일을 기다려요."], sunny: ["티타임! 일 오면 바로 뛰어갈게요!"], cool: ["차 맛 괜찮네."], perfect: ["찻잔 손잡이 방향까지 맞췄어요."], elf: ["도비도 차를 마셔도 되나요? 도비는 감동이에요!"] },
  tea_called: { calm: ["찻잔 내려놓고 {task}로 갑니다."], sunny: ["출동! {task} 갑니다!"], cool: ["차 식겠네. {task} 간다."], perfect: ["{task} 배정 확인. 찻잔은 제자리에 두고 갈게요."], elf: ["도비가 차를 두고 {task}에 달려가요!"] },
  meeting: { calm: ["이 수치, 지난주와 비교해 보죠."], sunny: ["오, 그래프가 올라가요! 좋아요!"], cool: ["요점만 보자."], perfect: ["이 장 숫자, 합계가 안 맞아요."], elf: ["도비도 회의에 끼워 주셨어요!"] },
  presenting: { calm: ["다음 장 보시죠. 원인부터 설명할게요."], sunny: ["자, 이번 주 하이라이트 갑니다!"], cool: ["한 장만 더. 금방 끝나."], perfect: ["근거는 다음 장에 전부 있습니다."], elf: ["도비가 발표해요! 도비는 떨려요!"] },
  table_work: { calm: ["{stage}, 하나씩 확인하고 있어요."], sunny: ["{stage} 열심히 하는 중이에요!"], cool: ["{stage}. 금방 끝나."], perfect: ["{stage}, 빠진 곳 없게 보는 중."], elf: ["도비가 {stage}을(를) 하고 있어요!"] },
  table_wait: { calm: ["{stage}, 결과를 기다리는 중이에요."], sunny: ["{stage} 결과 두근두근!"], cool: ["{stage}. 기다리는 수밖에."], perfect: ["{stage} 결과가 오면 바로 대조할게요."], elf: ["도비는 {stage} 결과를 기다려요."] },
  table_idle: { calm: ["{who}님, 천천히 하셔도 돼요.", "다음 차례 준비해 둘게요."], sunny: ["{who}님 화이팅!", "쿠키 하나 드실래요?"], cool: ["{who}, 잘 되고 있지?", "내 차례 오면 불러."], perfect: ["{who}님 결과 나오면 바로 볼게요.", "간식 부스러기는 노트북 밖으로."], elf: ["도비는 {who}님을 응원해요!", "도비가 간식을 나눠 드려요!"] },
  idle: { calm: ["다음 작업을 기다리는 중입니다."], sunny: ["심심해요… 일 없나요?"], cool: ["조용하네. 나쁘지 않아."], perfect: ["책상 정리 세 번째 하는 중."], elf: ["도비는 기다릴 수 있어요."] },
};
const GENERIC: Record<string, string> = { assigned: "{task}로 갑니다.", back: "자리로 돌아갑니다.", idle: "쉬는 중입니다." };

export const PERSONA_LABEL: Record<Persona, string> = {
  calm: "차분한 분석가",
  sunny: "초긍정 에너지",
  cool: "시크한 현실주의",
  perfect: "꼼꼼한 완벽주의",
  elf: "충직한 도비 말투",
};

const lastUsed = new Map<string, string>();

// 성격 → 같은 상황의 다른 성격 → 기본 문장 순서로 찾고, 같은 에이전트가 직전에 쓴 문장은 피한다
export function quipText(agentId: string, persona: Persona, situation: string, vars: Record<string, string | number>): string {
  const set = Q[situation] ?? {};
  const pool = set[persona] ?? Object.values(set)[0] ?? [GENERIC[situation] ?? "…"];
  const prev = lastUsed.get(agentId);
  const choices = pool.length > 1 ? pool.filter((t) => t !== prev) : pool;
  const t = choices[Math.floor(Math.random() * choices.length)];
  lastUsed.set(agentId, t);
  return t.replace(/\{(\w+)\}/g, (m, k: string) => (vars[k] != null ? String(vars[k]).slice(0, 20) : m));
}
