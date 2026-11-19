// 서버가 켜질 때 한 번 불린다.
// 오피스 설정을 읽고(틀리면 시작하지 않음), 팀 이슈 조사 예약 확인과 사무실(도비 모드)의 메타 동기화·수신 서버를 시작한다.
// 셋 다 globalThis 표시로 한 번만 돈다(개발 서버가 코드를 다시 읽어도 두 번 시작하지 않는다)
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { loadConfig } = await import("@/lib/office/config");
    loadConfig();
    // 팀 이슈 조사는 대시보드의 것 하나만 부른다(오피스의 조사 티커는 가져오지 않았다)
    const { startJobsScheduler } = await import("@/lib/dobbyJobs");
    startJobsScheduler();
    // 사무실: 5초마다 메타 파일을 맞추고, 플러그인 훅이 보내는 진행 소식을 127.0.0.1:6898 에서 받는다(포트·형식은 그대로)
    const { startSync } = await import("@/lib/office/sync");
    if (startSync()) (await import("@/lib/office/inbox")).startInbox();
  }
}
