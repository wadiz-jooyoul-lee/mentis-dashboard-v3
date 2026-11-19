# 설계: antd 제거 — 아티팩트풍 디자인 시스템으로 재설계

> 실행: 새 세션에서 이 문서만 읽고 진행 가능하도록 작성됨. `/dobby-order {이 문서 경로}` 또는 `/do` 오더의 설계 입력으로 사용.
> **전제 변경(2026-11-19)**: agent-office 통합(merge-agent-office.md)보다 **먼저** 실행한다. 이 설계는 대시보드(mentis-dashboard-v2) 단독으로 완결되며, 오피스 테마와의 토큰 통일·루트 레이아웃 합치기는 통합 쪽 후속 작업으로 미룬다(§3 참조).
> 작성: 2026-11-14 · 갱신: 2026-11-19(최신 소스 재실측, 통합보다 선행하도록 전제 변경). §2 수치는 그 시점 기준.

## 1. 목적 — 왜 제거하는가

antd 제거는 기술 정리가 아니라 **디자인 품질 개선**이 목적이다:

1. **antd 기본 룩이 만족스럽지 않다.** 목표는 claude.ai 아티팩트 같은 디자인 — 부드러운 모서리, 절제된 색, 타이포그래피 중심, 가벼운 전환 애니메이션, 라이트/다크 자연 대응.
2. **md를 그대로 출력하지 않는다.** 지금은 status.md·analysis.md·리뷰 등을 react-markdown으로 원문 렌더하는 화면이 많다. 목표는 md를 **구조화 데이터로 파싱해 목적에 맞는 UI로 가공**해 보여주는 것 (리뷰 → 심각도 칩이 달린 카드, 이벤트 로그 → 타임라인, 상태표 → 보드). md 원문 렌더는 자유 산문의 폴백으로만.

따라서 이 작업의 산출은 "antd 없는 같은 화면"이 아니라 **더 나은 화면**이다. 화면별 수용 기준은 §6.

## 2. 실측 현황 (2026-11-19)

- tsx 109개 중 **61개 파일이 antd 사용**, 사용처 330+.
- 컴포넌트 빈도: Typography 41 · Tag 33 · Space 32 · Button 24 · message(토스트) 18 · Card 18 · Tooltip 17 · Empty 16 · Table 12 · Collapse 11 · Breadcrumb 10 · Badge 8 · Alert 8 · Popconfirm 7 · Input 7 · Tabs 5 · Popover 5 · Select 3 · Segmented 3 · Row/Col 3 · Spin 2.
- 무거운 의존: antd v6 + @ant-design/icons + @ant-design/nextjs-registry(CSS-in-JS SSR 수집) — 제거 시 번들·빌드 경량화.
- 화면 규모: 39개 라우트(2026-11-19). 11-14 이후 성능 탭·테스트 브라우저(chrome)·릴리즈 일간배포·team-jobs 등이 추가되는 등 **화면이 빠르게 늘고 있음** → §6 이주 목록은 착수 시 재열거.
- 참고: agent-office(별도 저장소, 통합 예정)는 자체 CSS 변수 시스템(835줄, `:root` 토큰 + `data-theme` 다크모드)을 보유 — 토큰 설계 시 **변수 명명·다크모드 방식(`data-theme`)을 그쪽과 호환되게** 잡아, 통합 때 한 체계로 합치기 쉽게 한다.

## 3. 디자인 시스템 기반 (1단계)

`src/styles/tokens.css` + `src/components/ui/` 를 신설한다. 아티팩트 디자인 문법을 따른다:

**토큰 (라이트 기본, `:root[data-theme="dark"]`에서 재정의)**
- 색: 배경은 순백이 아닌 종이톤(`--bg: #faf9f7`급), 전경은 순흑이 아닌 잉크톤, 포인트 1색 + 의미색(성공/경고/위험/정보)은 채도 낮은 파스텔 배경 + 진한 텍스트 조합(칩·배지용)
- 모서리: `--r-sm 8px / --r-md 12px / --r-lg 16px`
- 그림자: 테두리 위주(`1px solid` 저대비) + 아주 옅은 elevation 1단계만
- 타이포: 시스템 스택 + Pretendard(로컬 설치 시), 본문 14–15px/1.6, 숫자는 tabular-nums
- 모션: `--t: 160ms ease` — hover·열림/닫힘·탭 전환에만, 과한 애니메이션 금지
- 다크모드: 오피스 테마의 `data-theme` 방식 승계, `color-scheme` 동기화

**오피스 테마와의 관계(통합 이후로 연기)**: 토큰은 이 설계에서 아티팩트 문법으로 새로 정의하되, 변수 명명과 `data-theme` 다크모드 방식을 오피스 CSS와 호환되게 잡는다. 통합(merge-agent-office.md) 시 오피스 globals.css가 이 tokens.css를 소비하도록 맞추면 루트 레이아웃도 하나로 합쳐져 대시보드↔사무실 SPA 전환을 얻는다 — 그 작업은 통합 오더의 몫이고 여기서는 하지 않는다.

## 4. 프리미티브 구축 (2단계) — antd 대체표

`src/components/ui/`에 아래를 만든다. 외부 UI 라이브러리를 새로 들이지 않는다(목적이 디자인 통제권이므로). 단 포털·포지셔닝만 `@floating-ui/dom` 1개 허용.

| antd (사용처) | 대체 | 구현 메모 |
|---|---|---|
| Typography(41) | 전역 prose 스타일 + `<Txt>` 헬퍼 | 대부분 CSS로 흡수, 컴포넌트 불필요한 곳은 시맨틱 태그로 |
| Tag(33)·Badge(8) | `<Chip>` | 의미색 토큰, 라운드 full, 저채도 배경+진한 글자 |
| Space(32)·Row/Col(3) | 제거 | flex/grid gap 유틸 클래스로 대체 (컴포넌트 불필요) |
| Button(24) | `<Button>` | variant: solid/soft/ghost/danger, 로딩 스피너 내장 |
| message(18) | `<Toaster>` + `toast()` | 전역 1포털, 자동 소멸, 아티팩트풍 미니멀 |
| Card(18) | `<Card>` | 테두리+radius-lg, 호버 시 옅은 elevation |
| Tooltip(17)·Popover(5) | `<Tip>`/`<Pop>` | floating-ui, 지연 200ms, 다크 대응 |
| Empty(16) | `<Empty>` | 아이콘+한 줄 안내, 일러스트 없음 |
| Table(12) | `<DataTable>` | **가장 큰 작업.** 정렬·고정 헤더·행 호버만 구현(페이지네이션·필터는 실사용 없음 — 착수 시 재확인). 밀도 낮은 곳은 Card 리스트로 전환 검토 |
| Collapse(11) | `<Disclosure>` | details/summary 기반 + 높이 트랜지션 |
| Breadcrumb(10) | `<Crumbs>` | 단순 링크 나열 |
| Input(7)·Select(3) | `<Field>`·`<SelectBox>` | 네이티브 요소 + 토큰 스타일 |
| Alert(8) | `<Note>` | 의미색 soft 배경 |
| Popconfirm(7) | `<Confirm>` | Pop + Button 조합 |
| Tabs(5)·Segmented(3) | `<Tabs>` | 밑줄 인디케이터 슬라이드 |
| Spin(2) | `<Spinner>` | Button 내장 스피너와 공유 |
| @ant-design/icons | lucide-react 또는 인라인 SVG 세트 | 아이콘 두께 일관(1.5px stroke) |

## 5. md 가공 레이어 (3단계) — "원문 렌더"에서 "화면"으로

`src/lib/mdview/` 신설: 메타 md를 **알려진 구조별로 파싱**해 전용 뷰에 공급한다. go-dobby 산출 md는 형식이 정해져 있으므로(상태표·리뷰 라운드·이벤트 로그·해결 근거) 파싱 가능하다.

| 원본 | 파서 산출 | 전용 뷰 |
|---|---|---|
| status.md 에이전트 상태표 | `{slug, role, state, round}[]` | 좌석 보드(사무실 플로어와 톤 통일) |
| status.md 단계/해결 절 | `{stage, at, basis[]}` | 단계 스테퍼 + 근거 체크리스트 |
| orchestration.md 이벤트 로그 | `{ts, text}[]` | 타임라인(시간 간격 시각화) |
| reviews/round-n/*.md | `{severity, file, claim}[]` | 심각도 칩 카드 + 파일 링크, 라운드 탭 |
| test-runs/*/result.md | `{tc, verdict}[]` | 판정 그리드(통과/실패/보류 색) — 결과 그림(스크린샷) 썸네일·확대는 기존 기능 유지 |
| perf.json (성능 탭) | 이미 구조화 — 파서 불필요 | 수치 카드·추이 — 토큰 스타일만 적용 |
| analysis.md·explainer.md 등 자유 산문 | — | **폴백**: react-markdown 유지하되 prose 토큰 스타일 적용(가공 아님, 보기 좋은 조판) |

원칙: 파싱 실패 시 조용히 폴백(prose 렌더)으로 떨어진다 — md 형식 변화가 화면을 깨지 않게. 파서는 순수 함수로 두고 단위 테스트를 붙인다(실제 메타 샘플을 픽스처로).

## 6. 화면 이주 (4단계) — 쉬운 것부터, 화면 단위 커밋

| 순서 | 화면 | 난도 | 수용 기준 |
|---|---|---|---|
| 1 | 허브 `/` | 하 | 카드+지표 — 새 토큰 첫 적용, 디자인 리뷰 기준점 |
| 2 | `/agents` 소개 · `/about` | 하 | 정적 콘텐츠 |
| 3 | 오더 목록 `/orchestration` | 중 | DataTable 첫 실전 + 실행 패널(Field·Button·toast) |
| 4 | 릴리즈 `/releases` (일간배포 포함) | 중 | 판정 그리드 |
| 5 | 그 외 보조 화면: team-jobs·chrome(테스트 브라우저)·backup·map·avatars·artifacts·data | 중 | 11-19 기준 목록 — **착수 시 `ls src/app`로 재열거** |
| 6 | 오더 보드 `/orchestration/[key]` (성능 탭 포함) | 상 | md 가공 레이어 총동원(스테퍼·타임라인·리뷰 카드·판정 그리드) |
| 7 | 코드 변경 `/changes` | 상 | diff 뷰 — 기존 diff 렌더 유지, 껍데기만 교체 |
| 8 | 실행 콘솔 | 중 | 로그 스트림 — 모노스페이스 조판 정비 |
| 9 | **antd 패키지 제거** | — | `grep "from \"antd\""` 0건 → antd·icons·registry 삭제, 번들 크기 전후 기록 (루트 레이아웃 합치기는 통합 오더에서) |

각 화면 완료 기준: ① 기존 기능 전부 동작(기능 체크리스트를 화면별로 먼저 작성) ② 라이트/다크 모두 점검 ③ 400px 폭에서 깨지지 않음 ④ 사용자(디자인 결정권자) 육안 승인 — **이 작업은 디자인이 산출물이므로 화면마다 사용자 확인 게이트를 둔다.** 어느 화면에서든 중단 가능(antd와 신규 UI가 다른 화면에 공존해도 무방 — 단계 9 전까지 antd는 남아 있음).

## 7. 하지 않는 것

- 외부 UI 킷(shadcn, MUI 등) 도입 — 목적이 "우리 디자인"이므로
- 기능 추가·정보 구조 변경(메뉴 재편 등) — 디자인 교체와 섞지 않는다
- 오피스 플로어 화면의 재디자인 — 이미 자체 디자인, 토큰 통일만

## 8. 착수 시 재확인

- [ ] 통합(merge-agent-office.md)은 **미완료가 정상** — `(office)` 그룹이 없어야 하며, 있다면 통합이 먼저 진행된 것이므로 §3의 연기 항목(토큰 통일)을 이 오더 범위에 포함할지 재판단
- [ ] antd 사용처 재실측: `grep -rl "from \"antd\"" src | wc -l` 및 컴포넌트 빈도 (§2와 비교 — 화면이 빠르게 늘고 있어 수치 변동 전제)
- [ ] 화면 목록 재열거(`ls src/app`, 라우트 수) → §6 표 갱신
- [ ] Table 사용처 12곳의 실제 기능(정렬·페이지네이션 사용 여부) 확인 → DataTable 스펙 확정
- [ ] 메타 md 샘플 수집(파서 픽스처용): status.md·reviews·test-runs 각 2~3건

> ⚠️ 이 문서는 git에 커밋해 보존할 것 (11-14 작성본이 untracked 상태로 유실된 적 있음).
