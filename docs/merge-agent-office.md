# 설계: agent-office(도비 모드) → mentis-dashboard-v3 통합

> 실행: 새 세션에서 이 문서만 읽고 진행 가능하도록 작성됨. `/dobby-order {이 문서 경로}` 또는 `/do` 오더의 설계 입력으로 사용.
> 작성: 2026-11-14 · 갱신: 2026-11-19(최신 소스로 전 항목 재검증). 아래 "검증된 사실"은 그 시점 코드 실측 — 착수 시 §8 체크로 재확인만 하면 됨.

## 1. 목표 / 비목표

**목표**: 서버를 하나(:7253, mentis-dashboard-v3)로 통합한다.
- 대시보드 전 화면(39개 라우트) 유지
- agent-office의 **도비 모드만** 이식: 사무실 플로어 화면(`/office`), 메타 sync 티커, inbox(:6898), 보고서/회고/작업 책 뷰
- agent-office의 자체 오케스트레이터 등 비도비 부분은 **폐기** (§7)
- 완료 후 agent-office 저장소는 아카이브, :6897 종료

**비목표(이번에 하지 않음)**: SQLite 도입(orders·events 인덱스), inbox의 API 라우트 흡수, 멀티유저/인증 본격 구현, antd 제거(별도 설계 `docs/antd-removal.md`).

## 2. 대상 저장소와 전제

- 뼈대: `~/work/mentis-dashboard-v3` (Next 16.4.6 · React 19.3 · antd v6 · pnpm, 포트 7253)
- 이식원: `~/work/agent-office` (Next 16.4.6 · React 19.3 · 자체 CSS · pnpm, 포트 6897 + inbox 6898)
- 두 앱의 Next/React/pnpm 버전이 동일 → 스택 마찰 없음
- 메타 경로 규약은 양쪽 모두 `ORCHESTRATION_*` + `~/.config/go-dobby/config.env`

## 3. 검증된 사실 (2026-11-19 재실측 — 설계의 근거)

1. **`agent-office/lib/dobby/*`(14개 파일)는 `lib/orch`·`lib/agent`·`lib/db`·`lib/jira`·`lib/git`에 의존하지 않는다.** (grep으로 import 전수 확인) → 도비 모드는 외과적으로 분리 가능.
2. 도비 모드의 데이터 흐름: **메타 파일이 원본** → sync 티커(5초, `lib/dobby/sync.ts`)와 inbox 푸시 → 메모리 floor(`lib/dobby/floor.ts`, globalThis Map) → UI. floor 주석: "그림만 바꾼다". 서버 재시작 시 sync가 메타에서 재구성.
3. **bus의 DB 의존은 2곳뿐**: `lib/office/bus.ts`의 `loadOffice(name)`(부팅 1회)·`persist(name, env)`(이벤트당 1회, eventId 반환). 도비 사무실 아티팩트는 DB가 아니라 메타에서 읽음(bus.ts snapshot 참조).
4. **CSS 충돌 실재**: `agent-office/app/globals.css` 835줄이 `html,body` 배경·폰트와 `:root` 테마 변수를 전역 선언. 대시보드는 루트 layout에서 `AntdRegistry`+`ConfigProvider(koKR)` 래핑. 같은 루트 레이아웃에 공존 불가.
5. **inbox 클라이언트는 go-dobby 플러그인**: `hooks/post-tool-office.sh`, `hooks/session-end-office.sh`, `reference/dobby-lib.sh`가 `127.0.0.1:6898`(env `DOBBY_INBOX_PORT`)로 푸시. 포트·메시지 포맷을 바꾸면 플러그인 배포가 같이 필요.
6. **dobby-jobs 스케줄러가 양쪽에 중복**: 대시보드 `src/lib/dobbyJobs.ts`(풍부: triesToday·log 등), office `lib/dobby/jobs.ts`(얇음). 실행 판정·중복 방지는 플러그인의 `schedule.py`가 담당하므로 이중 호출도 사고는 없으나 통합 시 하나로.
7. **동기 블로킹 1곳**: `lib/dobby/source.ts`(현재 256행 부근)에 `execFileSync("git", …, timeout 5000)` — 티커 경로에서 최대 5초 이벤트 루프 정지 가능. 판정(judge)은 `execFile` 비동기(60s 타임아웃)라 안전.
8. 도비 사무실 쓰기 차단 가드가 이미 존재: `lib/dobby/office.ts`의 `isDobbyOffice` → 403 "도비 사무실은 읽기 전용입니다".
9. office의 `office.db`(`~/.agent-office/office.db`, node:sqlite)는 스키마가 자체 오케스트레이터(tasks·pr_contexts) 모양 → orch 폐기와 함께 **폐기**. node:sqlite 요구(Node ≥22.13)는 당장 사라지지만 후속 SQLite 도입 대비 engines에 명시.
10. 대시보드에 없는 office 의존성: **zustand, yaml, zod** 3개 (react-markdown·remark-gfm은 공유).
11. 규모: office에서 가져올 파일 57개(lib/dobby 14 + 공용 + 컴포넌트 23개 + 화면), 폐기 42개. 대시보드 182개 파일·39개 라우트는 전부 그대로.
12. (11-19 갱신) 양 저장소 모두 11-14 이후 활발히 변경 — 대시보드에 성능 탭·테스트 브라우저(Chrome for Testing) 관리·릴리즈 일간배포 등 신규 화면, 오피스 도비 모드에 카드 보기·탁자 확대·작업 책 개편 추가. **설계 구조에 영향 없음**(사실 1·2·3·5~8·10 모두 유지 재확인, 수치만 갱신). 단 변경 속도가 빠르므로 착수 직전 §8 체크 필수.

## 4. 타깃 구조

```
mentis-dashboard-v3/src/
├── app/
│   ├── (dashboard)/            ← 기존 화면 전부 이동. 루트 layout = 기존 layout.tsx(antd)
│   │   ├── layout.tsx
│   │   └── page.tsx, orchestration/…, releases/…, chrome/… (내용 무변경)
│   ├── (office)/               ★ 신설. 루트 layout = office globals.css + 테마
│   │   ├── layout.tsx
│   │   └── office/page.tsx     ← agent-office app/office/[name] 에서 [name] 제거, /office 고정
│   └── api/
│       ├── orders/…            (기존 그대로)
│       └── office/…            ★ 이식 — [name] 세그먼트 제거, 도비 화면이 실제 쓰는 라우트만
├── lib/
│   ├── (기존)
│   └── office/                 ★ 이식: lib/dobby/* + lib/office 공용부 + lib/office-ui
├── components/office/          ★ 이식: 오피스 컴포넌트 23개
└── instrumentation.ts          ★ 병합 (§5-F)
```

- **루트 레이아웃 2개**(route group별 독립 `<html>`)가 CSS 충돌(사실 4)의 해법. Next App Router는 그룹별 루트 레이아웃을 지원. 두 영역 간 이동은 풀 페이지 로드(수용). 레이아웃 1개로 합치는 것은 antd-removal 설계의 1단계에서.
- `[name]` 동적 세그먼트 제거: 사무실이 도비 하나뿐 → `isDobbyOffice` 분기 전부 삭제(비도비 가지째).

## 5. 모듈별 이식 설계

**A. UI**: 컴포넌트 23개 + `app/office` 화면 → `(office)` 그룹. `globals.css`는 `(office)/layout.tsx`에서만 import. zustand 스토어 그대로.

**B. bus 심(shim)**: `lib/db`를 가져오지 않는다. `bus.ts`의 `loadOffice` → 시드 초기 상태 반환, `persist` → 메모리 일련번호만 반환하는 심으로 대체(사실 2·3: floor는 메타에서 재구성되므로 유실 없음). `lib/office/seed.ts`는 도비에 필요한 부분(아바타·자리)만 남기고 정리. `getBus`의 `watchHolds`(비도비 전용) 분기 삭제.

**C. sync·source**: `lib/dobby/*` 14개 → `src/lib/office/`. 수정 2건만:
  1. `source.ts`의 `execFileSync(git…)` → async 전환 (사실 7 블로킹 제거)
  2. 플러그인 경로 해석을 대시보드 `goDobbyLib`(src/lib/jobs) 하나로 통일 (현재 같은 로직 두 벌)

**D. inbox**: `startInbox()`를 instrumentation에서 기동. **:6898 · 127.0.0.1 · 메시지 포맷 불변** (사실 5 — 플러그인 훅이 무수정으로 동작하는 것이 호환성 기준). API 라우트 흡수는 후속.

**E. jobs 단일화**: office `lib/dobby/jobs.ts` 폐기, 대시보드 `src/lib/dobbyJobs.ts`를 유일 호출부로. office floor의 `JobsSummary` 소비부를 대시보드 타입에 어댑트.

**F. instrumentation 병합**:
```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    loadConfig();                       // office 것 채택: 설정 오류 시 기동 중단
    startJobsScheduler();               // 대시보드 것 (유일)
    if (startSync()) startInbox();      // office 도비 모드
  }
}
```
office의 `recover()`는 lib/orch 소속 → 가져오지 않음(잡 복구는 대시보드 PID 추적이 담당). dev HMR 대비 globalThis 가드 패턴 유지.

**G. 의존성·빌드**: package.json에 zustand·yaml·zod 추가, `engines.node: ">=22.13"` 명시, eslint-config-next를 16대로 정리. `scripts/check-api-guard.mjs` 검사 대상에 `api/office/*` 포함.

**H. 보안**: ① 도비 읽기 전용 403 가드를 `api/office/*` 공통으로 승격. ② 쓰기 능력이 있는 `api/orders`(claude spawn)는 localhost 요청만 허용 또는 고정 토큰 헤더 요구(`-H 0.0.0.0` 유지 시에도 외부에서 실행 불가). 이것이 멀티유저 로그인의 자리표시자.

## 6. 실행 계획 (각 단계 독립 검증, 커밋 분리)

| # | 작업 | 검증 |
|---|---|---|
| 1 | 기존 화면을 `(dashboard)` 그룹으로 이동 (루트 레이아웃 분리 준비) | 기존 39개 라우트 전부 응답·화면 스냅샷 동일, `pnpm typecheck` |
| 2 | lib 이식(§5-B·C): dobby+공용부, bus 심, execFileSync 제거 | `.demo-meta`로 sync가 floor 구성하는 단위 확인 |
| 3 | `(office)` 그룹 + 컴포넌트 + `/office` 화면 (§5-A) | `pnpm demo`로 사무실 렌더. antd 화면과 상호 CSS 오염 없음(두 영역 왕복 육안+스타일 검사) |
| 4 | instrumentation 병합(§5-D·E·F) | ① `curl 127.0.0.1:6898`에 훅 포맷 푸시 → floor 반영 ② `schedule.py status`에 호출 기록이 1계통 |
| 5 | 보안 가드 + api guard 확장 (§5-G·H) | 외부 IP에서 쓰기 API 403/401, `pnpm build` 게이트 통과 |
| 6 | 전환: agent-office 중지(:6897·:6898 해제) → 통합 서버 기동 → 실오더 1일 병행 관찰 | 훅 푸시 수신·9시 jobs 1회·플로어/대시보드 화면 정상 |
| 7 | agent-office 저장소 태그 후 아카이브 | — |

**롤백**: 6단계 전까지 agent-office 원본 무수정 → "통합 서버 끄고 agent-office 재기동"으로 즉시 복귀. 7단계는 6단계 관찰 통과 후에만.

## 7. 폐기 목록 (agent-office 쪽 — 이식하지 않음)

`lib/orch` · `lib/agent` · `prompts/`(자체 오케스트레이터, claude-agent-sdk 의존 포함) · `lib/db` + `~/.agent-office/office.db` · `lib/git` `github` `jira` `release` `review` `record` · `api/office`의 orch성 라우트(mock·demo·resume·stream·hold 등 — 도비 화면이 쓰는 것만 선별 이식) · `isDobbyOffice` 분기 전부.

## 8. 착수 시 재확인 체크리스트 (코드가 변했을 수 있는 부분)

- [ ] `lib/dobby/*`의 import에 orch/db/agent 의존이 생기지 않았는지 (`grep -rn "from \"../orch\|../db\|../agent" lib/dobby/*.ts`)
- [ ] inbox 포트·메시지 필드가 플러그인 훅과 일치하는지 (플러그인 버전 확인)
- [ ] 대시보드 라우트 수·antd registry 위치 (`src/app/layout.tsx`)
- [ ] 양쪽 Next/React 버전이 여전히 일치하는지
- [ ] 이식 파일 수 재집계 (양 저장소 변경 속도가 빠름 — 사실 12)

## 9. 후속 로드맵 연결 (이 설계의 비목표, 자리만 확보)

- SQLite(orders·events) 저장소 모듈 → `src/lib/` 아래, 쓰기는 이 서버만
- sync 티커가 인덱서 겸임 → 대시보드 화면의 FS 직접 읽기를 점차 구독으로
- §5-H의 토큰 가드 → 멀티유저 로그인으로, `api/orders` spawn → 유저별 러너(CLAUDE_CONFIG_DIR 격리)로
- antd 제거/디자인 단일화 → `docs/antd-removal.md` — **이 통합보다 먼저 진행하기로 결정(2026-11-19)**. 통합 착수 시점에 antd 제거가 끝나 있다면: §4의 루트 레이아웃 2개 분리 대신, 오피스 globals.css를 대시보드 tokens.css 소비로 맞춰 **레이아웃 1개**로 바로 합치는 쪽을 택한다(그 경우 §6-1·3의 검증 기준도 그에 맞게 조정)

> ⚠️ 이 문서는 git에 커밋해 보존할 것 (11-14 작성본이 untracked 상태로 유실된 적 있음).
