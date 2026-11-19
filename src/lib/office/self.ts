// 서버 전용. 오피스 API 가 대시보드의 오더 실행 API(/api/orders)를 부를 때 쓰는 주소.
// 합치기 전에는 다른 서버(:7253)였고, 지금은 같은 서버라 자기 포트의 루프백으로 부른다(로컬 전용 가드도 그대로 통과한다).
// Next 가 띄울 때 PORT 를 적어 둔다. 따로 띄운 대시보드를 가리켜야 하면 MENTIS_URL 로 바꾼다
export const selfUrl = () => process.env.MENTIS_URL || `http://127.0.0.1:${process.env.PORT || 7253}`;
