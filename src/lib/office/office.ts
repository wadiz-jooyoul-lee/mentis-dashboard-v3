// 도비 /do 오더를 그리는 사무실 이름. 대시보드에 합친 뒤로 사무실은 이것 하나뿐이다(버스·로그 이름으로만 쓴다)
export const DOBBY_OFFICE = "go-dobby";
// 책과 물음표 카드에서 여는 대시보드 오더 화면. 같은 서버라 상대 주소로 연다
export const dashboardUrl = (key: string) => `/orchestration/${encodeURIComponent(key)}`;
// 대시보드가 띄운 자동 실행의 진행 로그 화면
export const consoleUrl = (key: string) => `/orchestration/console/${encodeURIComponent(key)}`;
