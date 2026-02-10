# Architecture Decision Records (ADR)

> Life Planner - 7단계 프랙탈 계층 인생 설계 시스템

이 문서는 Life Planner 프로젝트의 주요 기술적 의사결정을 기록합니다.
각 결정의 배경, 검토했던 대안, 최종 결정 이유, 그리고 결과적 트레이드오프를 솔직하게 기술합니다.

---

## 요약 테이블

| ADR | 제목 | 상태 | 핵심 결정 | 주요 트레이드오프 |
|-----|------|------|-----------|-------------------|
| 001 | 7단계 프랙탈 계층 구조 | 승인됨 | 30년~일 7단계 재귀적 시간 계층 | 직관적 계획 분해 vs. 깊은 트리 복잡성 |
| 002 | Next.js App Router (CSR 전용) | 승인됨 | Next.js를 SPA 프레임워크로 사용 | 배포/라우팅 편의 vs. SSR 불활용 |
| 003 | Zustand 단일 모놀리식 스토어 | 승인됨 | 2100줄 단일 스토어에 모든 로직 | 즉각적 개발 속도 vs. 유지보수 병목 |
| 004 | Supabase 클라우드 동기화 | 승인됨 | PostgreSQL + REST API 기반 동기화 | 빠른 구축 vs. 실시간 동기화 미지원 |
| 005 | LWW 충돌 해결 전략 | 승인됨 | Last-Write-Wins 병합 | 단순한 구현 vs. 데이터 유실 가능성 |
| 006 | @dnd-kit 드래그 앤 드롭 | 승인됨 | @dnd-kit/core + sortable | 모던 API + 접근성 vs. 생태계 규모 |
| 007 | Google Gemini AI 통합 | 승인됨 | Gemini API 프록시 라우트 | 비용 효율 vs. API 성숙도 |
| 008 | Tailwind CSS 스타일링 | 승인됨 | 유틸리티 퍼스트 CSS | 빠른 프로토타이핑 vs. 디자인 시스템 부재 |
| 009 | localStorage 미사용 (메인 스토어) | 승인됨 | Supabase를 유일한 영속성으로 사용 | 깨끗한 상태 관리 vs. 오프라인 미지원 |
| 010 | 지연 생성 (Lazy Period Creation) | 승인됨 | ensurePeriod()로 온디맨드 생성 | 메모리 효율 vs. 초기 로드 불완전성 |
| 011 | 테스트 부재 | 인지됨 | 테스트 프레임워크 미도입 | 빠른 이터레이션 vs. 리팩토링 위험 |
| 012 | 한국 공휴일 라이브러리 | 승인됨 | @hyunbinseo/holidays-kr 의존성 | 정확한 현지화 vs. 국제화 제약 |
| 013 | View-Store-Lib 아키텍처 | 승인됨 | MVC/MVVM이 아닌 실용적 React 패턴 | React 생태계 친화적 vs. 관심사 분리 미흡 |

---

## ADR-001: 7단계 프랙탈 계층 구조 설계

### 상태
승인됨

### 배경 (Context)
인생 계획은 본질적으로 다중 시간 스케일에 걸쳐 있다. "30년 비전"부터 "오늘 할 일"까지 일관된 구조로 연결하려면 계층적 분해가 필요하다. 기존의 할일 앱(Todoist, TickTick 등)은 플랫한 리스트 구조이고, 갠트 차트 도구(Notion, Asana)는 프로젝트 단위에 머물러 인생 전체의 시간 축을 다루지 못한다.

핵심 문제: 30년이라는 대시간 범위를 사용자가 직관적으로 탐색하면서, 각 시간 단위에서 목표를 하위 단위로 쪼갤 수 있어야 한다.

### 고려한 대안 (Alternatives Considered)

1. **플랫 리스트 + 태그 필터링**: 단순하지만 시간적 계층 관계를 표현할 수 없음
2. **3단계 구조 (연-월-일)**: 구현이 단순하지만 장기 비전과 분기/주간 계획을 담지 못함
3. **자유 형식 트리 (무한 깊이)**: 유연하지만 시간 단위와의 1:1 매핑이 불가능
4. **7단계 고정 계층 (30Y-5Y-Y-Q-M-W-D)**: 실세계 시간 구조와 정확히 매핑

### 결정 (Decision)
7단계 고정 프랙탈 계층을 채택한다. `types/plan.ts`에 `Level` 타입으로 정의:
- `THIRTY_YEAR` > `FIVE_YEAR` > `YEAR` > `QUARTER` > `MONTH` > `WEEK` > `DAY`

각 레벨은 `LEVEL_CONFIG`를 통해 하위 레벨과 자식 개수가 결정된다. 이 구조는 프랙탈(자기유사)적이어서 모든 레벨에서 동일한 UI 패턴(좌측 할일 / 중앙 그리드 / 우측 루틴)을 재사용할 수 있다.

Period ID 체계(`getPeriodId`, `parsePeriodId`)를 통해 각 기간을 문자열 ID로 고유하게 식별한다:
- `30y`, `5y-0`, `y-2025`, `q-2025-1`, `m-2025-01`, `w-2025-01-3`, `d-2025-01-06`

### 결과 (Consequences)

**장점:**
- 인생 전체를 하나의 통합된 뷰로 관리할 수 있음
- 모든 레벨에서 동일한 UI 컴포넌트(`FractalView`)를 재사용 가능
- 상위 목표에서 하위 할일로의 자연스러운 드릴다운 네비게이션
- 할일/루틴의 "쪼개기"를 통해 상위-하위 연결이 자동화됨

**단점:**
- 7단계 깊이의 트리는 `allItems` 딕셔너리를 통한 `parentId`/`childIds` 추적이 복잡함
- 주차 시스템에서 ISO 주차와 월 기준 주차 간 변환이 복잡함 (`getWeeksInMonth`, `getISOWeek`)
- Period ID 파싱/생성 로직이 `usePlanStore.ts`에서 약 400줄을 차지
- 30년 계획이라는 시간 범위는 이론적으로 최대 약 11,000개의 DAY 기간을 생성할 수 있음

---

## ADR-002: Next.js App Router를 CSR 전용으로 사용

### 상태
승인됨

### 배경 (Context)
프론트엔드 프레임워크 선택이 필요했다. 프로젝트는 본질적으로 클라이언트 사이드 인터랙션이 핵심인 SPA이다 -- 드래그 앤 드롭, 실시간 상태 변경, 복잡한 UI 조작이 대부분이고, SEO나 서버 사이드 데이터 페칭 요구사항은 없다.

### 고려한 대안 (Alternatives Considered)

1. **Vite + React**: 순수 SPA에 최적. 빌드 빠르고 설정 단순. 그러나 API 라우트, 파일 기반 라우팅 등을 직접 구축해야 함
2. **Next.js App Router (SSR 활용)**: Server Components로 초기 로드 최적화. 그러나 모든 주요 컴포넌트가 `"use client"`를 필요로 함
3. **Next.js App Router (CSR 전용)**: 파일 기반 라우팅, API 라우트 등 프레임워크 편의성만 활용
4. **Remix**: 서버 중심 접근. 이 프로젝트의 클라이언트 중심 특성과 맞지 않음

### 결정 (Decision)
Next.js 16 App Router를 채택하되, 모든 페이지에 `"use client"` 지시어를 사용하여 사실상 CSR 전용으로 운용한다.

실제 코드 증거:
- `src/app/page.tsx`: `"use client"` 최상단 선언
- `src/app/planner/page.tsx`, `src/app/routines/page.tsx` 등: 모두 `"use client"`
- Server Component 활용: 0건
- 유일한 서버 코드: `/api/chat/route.ts` (Gemini API 프록시)

### 결과 (Consequences)

**장점:**
- 파일 기반 라우팅으로 페이지 구조 명확 (`/`, `/planner`, `/routines`, `/events`, `/dashboard`, `/notepad`)
- API Route로 AI 프록시를 간단히 구현 (API 키 노출 방지)
- Vercel 배포 원클릭 지원
- 프레임워크 생태계의 미들웨어, 이미지 최적화 등 잠재적 활용 가능

**단점:**
- Next.js의 핵심 가치인 SSR/RSC를 전혀 활용하지 않아, 프레임워크 오버헤드만 부담
- `"use client"` 바운더리 관리가 불필요한 복잡성 추가
- 빌드 시간이 Vite 대비 상당히 느림
- 번들 크기에 Next.js 런타임이 불필요하게 포함됨
- API Route가 단 1개(`/api/chat`)여서 Express/Hono 같은 경량 대안도 충분했음

---

## ADR-003: Zustand 단일 모놀리식 스토어

### 상태
승인됨

### 배경 (Context)
상태 관리는 이 앱의 핵심이다. 7단계 계층의 모든 Period, Item, Record, AnnualEvent를 관리하면서 드래그 앤 드롭, 완료 토글, 진행률 계산, 부모-자식 연쇄 업데이트 등의 복잡한 비즈니스 로직을 처리해야 한다.

### 고려한 대안 (Alternatives Considered)

1. **Redux Toolkit**: 성숙한 생태계, DevTools 우수. 그러나 보일러플레이트가 많고 소규모 프로젝트에 과도
2. **Jotai**: 원자적 상태 관리로 세밀한 리렌더링 제어 가능. 그러나 복잡한 파생 상태 관리가 어려움
3. **Recoil**: Facebook 출신이지만 유지보수 불확실
4. **Zustand**: 최소한의 API, 보일러플레이트 없음, React 외부에서도 접근 가능
5. **React Context + useReducer**: 외부 의존성 없음. 그러나 리렌더링 최적화가 어렵고 로직이 분산됨

### 결정 (Decision)
Zustand v5를 채택하고, `usePlanStore.ts` 단일 파일에 모든 상태와 액션을 집중한다.

실제 규모:
- `usePlanStore.ts`: 2,140줄 (ID 체계 유틸리티 ~400줄, 스토어 인터페이스 ~90줄, 구현 ~1,650줄)
- 액션 수: 약 35개 (네비게이션 4, 헤더 3, CRUD 7, 드래그 6, 트리 3, 완료/진행률 3, 기록 6, 이벤트 4)
- 상태 필드: `currentLevel`, `currentPeriodId`, `baseYear`, `periods`, `allItems`, `records`, `viewMode`, `annualEvents`

### 결과 (Consequences)

**장점:**
- 단일 진입점으로 모든 상태 접근이 가능 (`usePlanStore`)
- `get()`, `set()`만으로 상태 변이가 직관적
- Zustand의 `subscribe()`를 활용한 자동 클라우드 동기화가 간결함 (라인 2109-2138)
- React 외부에서 `usePlanStore.getState()`로 접근 가능 (sync 모듈에서 활용)
- 별도의 미들웨어 없이 간단한 구조

**단점:**
- 2,100줄 단일 파일은 가독성과 유지보수에 심각한 병목
- `toggleComplete` 같은 단일 액션이 모든 Period를 순회하며 JSON.stringify로 비교 (라인 1724 등) -- O(n*m) 복잡도
- `assignToSlot` 로직이 원본 업데이트 + 슬롯 추가 + 하위 기간 전파를 한 함수에서 처리 (~120줄)
- Zustand의 슬라이스 패턴이나 immer 미들웨어를 적용하면 분리 가능하지만, 현재 미적용
- `allItems` 딕셔너리와 각 Period 내 Item 배열 간의 이중 관리로 동기화 버그 가능성 존재

---

## ADR-004: Supabase 클라우드 데이터베이스

### 상태
승인됨

### 배경 (Context)
사용자 데이터의 영속성이 필요하다. 개인 사용 목적의 앱이지만 기기 간 동기화와 데이터 유실 방지가 요구된다. 인증 시스템은 불필요하며(개인용), 복잡한 관계형 쿼리보다는 JSON 덩어리의 저장/조회가 핵심이다.

### 고려한 대안 (Alternatives Considered)

1. **Firebase Firestore**: 실시간 동기화 내장, 오프라인 지원. 그러나 NoSQL 쿼리 제약, vendor lock-in
2. **AWS Amplify + DynamoDB**: 확장성 우수. 그러나 설정 복잡, 개인 프로젝트에 과도
3. **Supabase**: PostgreSQL 기반, REST API 자동 생성, 무료 티어 관대, 오픈소스
4. **로컬 SQLite (sql.js)**: 서버 불필요. 그러나 기기 간 동기화 불가
5. **IndexedDB만**: 클라이언트 전용. 데이터 유실 위험 높음

### 결정 (Decision)
Supabase를 채택한다. PostgreSQL에 4개 테이블을 생성:
- `periods` (JSONB 컬럼으로 todos/routines/slots 저장)
- `records` (일일 기록)
- `settings` (API 키 등 설정)
- `annual_events` (기념일)

특이사항: RLS(Row Level Security) 비활성화 상태 -- 개인용이므로 익명 키로 전체 접근 허용.

실제 스키마(`supabase-schema.sql`):
```sql
-- todos, routines, slots을 JSONB로 저장
todos JSONB DEFAULT '[]',
routines JSONB DEFAULT '[]',
slots JSONB DEFAULT '{}',
```

### 결과 (Consequences)

**장점:**
- 무료 티어로 개인 사용에 충분 (500MB DB, 1GB 전송)
- PostgreSQL의 JSONB 타입으로 복잡한 중첩 데이터를 그대로 저장
- REST API 자동 생성으로 별도 백엔드 코드 불필요
- `supabase-js` 클라이언트가 가볍고 타입 안전
- 환경변수만 설정하면 즉시 작동 (graceful degradation: 미설정 시 로컬 전용)

**단점:**
- 실시간 구독(Realtime) 미사용 -- 다른 기기에서의 변경이 실시간으로 반영되지 않음
- JSONB에 전체 Item 배열을 저장하므로, 단일 항목 변경에도 전체 Period를 덮어쓰기
- `syncToCloud()`가 모든 Period를 순차적으로 upsert (라인 299-302) -- 대량 데이터 시 느림
- RLS 비활성화는 보안 위험 (Supabase anon key 노출 시 전체 데이터 접근 가능)
- 오프라인 작업 후 재접속 시 데이터 유실 가능 (LWW 병합의 한계)

---

## ADR-005: Last-Write-Wins (LWW) 충돌 해결 전략

### 상태
승인됨

### 배경 (Context)
클라우드 동기화에서 피할 수 없는 문제가 충돌 해결이다. 사용자가 두 기기에서 동시에 같은 Period를 수정하면 어느 쪽을 우선할 것인가? 오프라인 작업 후 재접속 시 로컬 데이터와 클라우드 데이터가 다를 수 있다.

### 고려한 대안 (Alternatives Considered)

1. **CRDT (Conflict-free Replicated Data Types)**: 수학적으로 보장된 무충돌 병합. 그러나 구현 복잡도 매우 높음
2. **서버 권위적 (Server-Authoritative)**: 서버가 항상 정답. 오프라인 작업 전부 유실 가능
3. **필드 레벨 병합**: 각 필드별 타임스탬프 비교. 정밀하지만 구현 복잡
4. **LWW (Last-Write-Wins)**: 마지막 쓰기가 승리. 단순하지만 데이터 유실 가능

### 결정 (Decision)
LWW 전략을 채택한다. `sync.ts`의 `initSyncFromCloud()`에서 구현:

```typescript
// Period 병합: 클라우드 데이터가 있으면 사용 (초기 로드 시)
// 로컬에 이미 있으면 로컬 우선 (사용자가 마지막으로 작업한 기기)
for (const [id, cloudPeriod] of Object.entries(cloudData.periods)) {
  if (!mergedPeriods[id]) {
    mergedPeriods[id] = cloudPeriod;
  }
}
```

자동 동기화는 2초 디바운스(`autoSyncToCloud`, 라인 376-378)로 상태 변경마다 클라우드에 업로드한다. 별도의 `useAutoSync` 훅은 3초 디바운스를 사용하며, 페이지 이탈 시 `beforeunload` 이벤트로 즉시 동기화를 시도한다.

### 결과 (Consequences)

**장점:**
- 구현이 극도로 단순 (약 30줄)
- 단일 사용자 시나리오에서는 거의 문제 없음
- 디바운스 동기화로 API 호출 최소화
- 초기 로드 시 클라우드 데이터를 로컬에 병합하여 기기 전환 지원

**단점:**
- 두 기기에서 동시 수정 시 나중 기기의 데이터가 이전 기기 변경을 덮어씀
- `updated_at` 필드가 스키마에 있지만 병합 로직에서 타임스탬프 비교를 하지 않음
- `syncToCloud()`의 순차적 upsert에서 중간 실패 시 부분 동기화 발생 가능
- 오프라인 상태에서의 작업이 재접속 시 조용히 유실될 수 있음 (사용자 알림 없음)
- `beforeunload`에서의 비동기 동기화는 브라우저가 보장하지 않음 -- 실패 가능

---

## ADR-006: @dnd-kit 드래그 앤 드롭 라이브러리

### 상태
승인됨

### 배경 (Context)
이 앱의 핵심 인터랙션은 드래그 앤 드롭이다. 사용자는 좌측 할일/우측 루틴 패널에서 항목을 중앙 그리드(하위 기간 셀)로 드래그하여 "쪼개기"(하위 기간 배정)를 수행한다. DAY 레벨에서는 8개의 시간대 슬롯으로도 드래그가 가능하다. 터치 기기 지원도 필요하다.

### 고려한 대안 (Alternatives Considered)

1. **react-beautiful-dnd**: Atlassian 제작. 리스트 정렬에 최적화. 그러나 2023년부터 유지보수 중단, React 18+ 호환 문제
2. **react-dnd**: HTML5 드래그 API 기반. 유연하지만 터치 지원 미흡, API가 복잡 (Backend 패턴)
3. **@dnd-kit**: 모던 React 훅 기반, 접근성 우수, 터치/포인터 통합 지원
4. **네이티브 HTML5 Drag API**: 라이브러리 불필요. 그러나 터치 미지원, 스타일링 제약

### 결정 (Decision)
@dnd-kit을 채택한다. `@dnd-kit/core` v6.3.1 + `@dnd-kit/sortable` v10.0.0 + `@dnd-kit/utilities` v3.2.2.

실제 사용 패턴 (`FractalView.tsx`):
- `PointerSensor`와 `TouchSensor` 동시 등록
- `closestCorners` 충돌 감지 알고리즘
- `DragOverlay`로 드래그 중 미리보기 (포탈 렌더링)
- `useDraggable` + `useDroppable` 훅 조합

### 결과 (Consequences)

**장점:**
- React 19과 호환 (훅 기반 설계)
- `PointerSensor` + `TouchSensor`로 데스크탑/모바일 통합 지원
- `DragOverlay`의 포탈 렌더링으로 드래그 중 Z-index 문제 해결
- 접근성 (키보드 드래그, 스크린리더) 기본 지원
- 경량 번들 (core ~12KB gzip)

**단점:**
- `react-beautiful-dnd` 대비 생태계 규모가 작고 문서/예제가 적음
- 현재 `closestCorners` 알고리즘이 8개 시간대 슬롯에서 가끔 잘못된 드롭 타겟을 감지할 수 있음
- `@dnd-kit/sortable`을 의존성으로 포함하지만 리스트 내 순서 변경은 미구현
- 드래그 시작 시 원본 항목과 오버레이 간의 스타일 동기화를 수동 관리

---

## ADR-007: Google Gemini AI 통합

### 상태
승인됨

### 배경 (Context)
AI 어시스턴트를 통해 사용자의 계획을 분석하고 조언을 제공하려 한다. 현재 기간의 목표/할일/루틴/기록 데이터를 AI에 전달하여 개인화된 피드백을 받는 기능이다.

### 고려한 대안 (Alternatives Considered)

1. **OpenAI GPT-4**: 가장 성숙한 API. 그러나 비용 높음, 한국어 성능은 Gemini과 유사
2. **Anthropic Claude**: 긴 컨텍스트 지원, 안전성 우수. 그러나 가격 대비 성능에서 Flash 모델 부재
3. **Google Gemini**: 무료 티어 관대, Flash 모델 비용 매우 저렴, 한국어 품질 양호
4. **로컬 LLM (Ollama)**: 무료, 프라이버시. 그러나 품질 낮고 사용자 환경 의존

### 결정 (Decision)
Google Gemini API를 `@google/genai` SDK로 통합한다. Next.js API Route(`/api/chat/route.ts`)를 통해 프록시하여 클라이언트에서 API 키를 노출하지 않는다.

실제 구현:
- 모델: `gemini-3-flash-preview` (가장 저렴한 Flash 모델)
- 시스템 프롬프트에 현재 기간의 전체 컨텍스트 주입 (목표, 할일, 루틴, 기록)
- 대화 히스토리 유지 (클라이언트 측)
- API 키 이중 관리: 환경변수 또는 사용자 설정(`settings.ts`의 localStorage + Supabase)

### 결과 (Consequences)

**장점:**
- Gemini Flash의 가격 대비 성능이 탁월 (Flash는 GPT-4 대비 ~1/10 비용)
- 한국어 시스템 프롬프트로 자연스러운 한국어 응답
- API 키를 사용자가 직접 입력할 수 있어 서버 비용 부담 없음
- 컨텍스트 기반 개인화 조언 가능

**단점:**
- Gemini API의 안정성이 OpenAI 대비 낮음 (프리뷰 모델 사용 중)
- `maxOutputTokens: 1024` 제한으로 긴 조언이 잘릴 수 있음
- API 키를 Supabase `settings` 테이블에 평문 저장 -- 보안 위험
- 사용자 데이터(할일, 목표, 기분 등)가 Google 서버로 전송되는 프라이버시 우려
- 오프라인 시 AI 기능 완전 불가

---

## ADR-008: Tailwind CSS 유틸리티 퍼스트 스타일링

### 상태
승인됨

### 배경 (Context)
UI 스타일링 접근법을 선택해야 한다. 한국어 UI에 맞는 타이포그래피, 6가지 카테고리 색상 시스템, 7단계 계층별 시각적 차별화, 드래그 앤 드롭 시각적 피드백 등 다양한 스타일링 요구사항이 있다.

### 고려한 대안 (Alternatives Considered)

1. **CSS Modules**: 컴포넌트별 스코프. 타입 안전하지 않음
2. **styled-components / Emotion**: CSS-in-JS. 런타임 오버헤드, React 19와의 호환 불확실
3. **Tailwind CSS**: 유틸리티 퍼스트. 빠른 프로토타이핑, 일관된 디자인 토큰
4. **Vanilla Extract**: 제로 런타임 CSS-in-TS. 설정 복잡

### 결정 (Decision)
Tailwind CSS v4를 채택하고, `clsx` + `tailwind-merge`로 조건부 클래스 관리를 보조한다.

카테고리 시스템에서의 활용 예시 (`types/plan.ts`):
```typescript
work: { bgColor: 'bg-blue-50', textColor: 'text-blue-700', borderColor: 'border-blue-200' },
health: { bgColor: 'bg-green-50', textColor: 'text-green-700', borderColor: 'border-green-200' },
```

### 결과 (Consequences)

**장점:**
- 빠른 프로토타이핑 -- 별도 CSS 파일 없이 JSX 안에서 스타일 완성
- 6가지 카테고리 색상이 Tailwind 색상 팔레트와 자연스럽게 매핑
- `tailwind-merge`로 동적 클래스 충돌 해결
- Tailwind v4의 JIT 모드로 번들 크기 최소화

**단점:**
- JSX에 긴 클래스 문자열이 쌓여 가독성 저하 (FractalView.tsx 등)
- 디자인 시스템/토큰이 공식적으로 정의되지 않아 색상/간격의 일관성이 개발자 기억에 의존
- `CATEGORY_CONFIG`에 Tailwind 클래스를 하드코딩하여 타입 안전하지 않음 (문자열)
- 복잡한 애니메이션이나 glassmorphism은 커스텀 CSS 필요 (task.md에 남은 작업으로 기록됨)

---

## ADR-009: 메인 스토어의 localStorage 미사용

### 상태
승인됨

### 배경 (Context)
Zustand는 `persist` 미들웨어를 통해 localStorage 자동 저장을 지원한다. 초기 개발에서 localStorage를 사용했으나, Supabase 동기화 도입 후 이중 영속성의 복잡성이 문제가 되었다.

### 고려한 대안 (Alternatives Considered)

1. **localStorage + Supabase 이중 저장**: 오프라인 지원 가능. 그러나 두 소스 간 충돌 해결이 복잡
2. **localStorage만**: 서버 불필요, 즉각 저장. 그러나 기기 간 동기화 불가, 브라우저 데이터 삭제 시 유실
3. **Supabase만 (현재 결정)**: 단일 진실 소스. 오프라인 미지원
4. **IndexedDB + Supabase**: 오프라인 지원 + 동기화. 구현 복잡

### 결정 (Decision)
메인 스토어(`usePlanStore`)에는 Zustand `persist` 미들웨어를 사용하지 않고, Supabase를 유일한 영속성 계층으로 사용한다.

단, `settings.ts`의 앱 설정(API 키 등)은 localStorage를 백업으로 사용한다:
```typescript
const SETTINGS_STORAGE_KEY = 'life-planner-settings';
localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged));
```

앱 시작 시 `initializeFromCloud()`가 Supabase에서 데이터를 로드하여 Zustand 스토어에 주입한다.

### 결과 (Consequences)

**장점:**
- 단일 진실 소스(Supabase)로 데이터 일관성 보장
- localStorage와 클라우드 간 충돌 해결 로직 불필요
- 클라이언트 측 저장소 용량 제한(5MB)에 구애받지 않음
- 브라우저 캐시 삭제가 데이터 유실로 이어지지 않음

**단점:**
- Supabase 미설정 시 앱을 닫으면 모든 데이터 유실 -- 콘솔에 경고만 출력
- 네트워크 불안정 시 작업 중인 데이터가 저장되지 않을 수 있음
- 앱 시작마다 Supabase에서 전체 데이터를 로드해야 하므로 초기 로딩 지연
- 오프라인 환경에서의 사용이 완전히 불가능

---

## ADR-010: 지연 생성 패턴 (Lazy Period Creation)

### 상태
승인됨

### 배경 (Context)
7단계 계층을 모두 미리 생성하면 엄청난 양의 빈 Period 객체가 생긴다. 30년 = 6 x 5년 = 30년 = 120분기 = 360개월 = 약 1,565주 = 약 10,950일. 모든 기간을 미리 생성하면 약 13,000개의 Period 객체가 필요하다.

### 고려한 대안 (Alternatives Considered)

1. **전체 사전 생성**: 앱 시작 시 모든 기간 생성. 메모리 과다, 초기 로드 느림
2. **레벨별 사전 생성**: 상위 레벨만 미리 생성. 중간 지점이지만 기준이 모호
3. **완전 지연 생성 (현재 결정)**: `ensurePeriod()`로 접근 시점에 생성
4. **가상화 + 지연 생성**: 뷰포트에 보이는 것만 생성. 가장 효율적이나 구현 복잡

### 결정 (Decision)
`ensurePeriod(periodId)` 함수를 통해 기간이 필요한 시점에 생성한다:

```typescript
ensurePeriod: (periodId) => {
  const state = get();
  if (state.periods[periodId]) {
    return state.periods[periodId];
  }
  const parsed = parsePeriodId(periodId);
  const newPeriod = createEmptyPeriod(periodId, parsed.level);
  set({ periods: { ...state.periods, [periodId]: newPeriod } });
  return newPeriod;
},
```

`navigateTo()`, `assignToSlot()`, `addItem()` 등 모든 기간 접근 경로에서 `ensurePeriod()`를 호출한다.

### 결과 (Consequences)

**장점:**
- 메모리 효율적 -- 사용자가 실제로 방문하거나 할일을 배정한 기간만 존재
- 초기 로드 시간 최소화 -- 빈 `periods: {}`로 시작
- Supabase 저장량 최소화 -- 데이터가 있는 기간만 저장

**단점:**
- `ensurePeriod()` 호출마다 `set()` 트리거 가능 -- 불필요한 리렌더링 발생
- 상위 기간에서 하위 기간의 진행률을 집계하려면 하위 기간이 생성되어 있어야 함
- 클라우드에서 로드한 데이터와 새로 생성된 빈 기간 간의 구분이 모호
- `freshState = get()` 패턴이 `ensurePeriod()` 호출 후 반복적으로 사용됨 -- 코드 복잡성

---

## ADR-011: 테스트 프레임워크 미도입

### 상태
인지됨 (기술 부채)

### 배경 (Context)
현재 프로젝트에는 단위 테스트, 통합 테스트, E2E 테스트가 전무하다. `package.json`에 Jest, Vitest, Playwright, Cypress 등 어떤 테스트 도구도 포함되어 있지 않다.

### 고려한 대안 (Alternatives Considered)

1. **Vitest + Testing Library**: Vite 기반 빠른 단위 테스트. Zustand 스토어 테스트에 적합
2. **Jest + Testing Library**: 가장 범용적. Next.js 공식 문서 추천
3. **Playwright**: E2E 테스트. 드래그 앤 드롭 시나리오 검증에 유용
4. **테스트 미도입 (현재 상태)**: 개발 속도 우선

### 결정 (Decision)
MVP 단계에서 테스트를 도입하지 않고, 수동 테스트와 빠른 이터레이션에 의존한다.

### 결과 (Consequences)

**장점:**
- 초기 개발 속도 극대화 -- 테스트 작성/유지에 시간 불소요
- 보일러플레이트 없이 기능 구현에 집중

**단점:**
- `usePlanStore`의 2,100줄 비즈니스 로직이 무방비 상태
- `toggleComplete`의 재귀적 부모-자식 연쇄 업데이트가 올바른지 검증 불가
- `assignToSlot`의 아이템 전파 로직에 엣지 케이스 누락 가능
- ISO 주차 계산(`getISOWeek`, `getWeeksInMonth`)의 경계 조건 미검증
- LWW 병합 로직의 데이터 무결성 미검증
- 리팩토링(ADR-003의 스토어 분리 등) 시 회귀 버그 탐지 불가
- 향후 테스트 도입 시 기존 2,100줄 스토어에 대한 테스트 작성 부담이 매우 큼

---

## ADR-012: 한국 공휴일 전용 라이브러리

### 상태
승인됨

### 배경 (Context)
일간 뷰에서 공휴일/주말을 시각적으로 구분해야 한다. 한국의 공휴일은 음력 기반(설날, 추석)과 양력 기반(광복절, 한글날)이 혼재하여 단순 계산이 불가능하다.

### 고려한 대안 (Alternatives Considered)

1. **직접 구현**: 음력 변환 알고리즘 직접 작성. 극도로 복잡하고 오류 가능성 높음
2. **범용 holidays 라이브러리 (date-holidays)**: 다국가 지원. 번들 크기 큼, 한국 데이터 정확도 불확실
3. **@hyunbinseo/holidays-kr**: 한국 전용, 경량, 법정 공휴일만 정확하게 제공
4. **공공 API (data.go.kr)**: 실시간 데이터. 네트워크 의존, 오프라인 불가

### 결정 (Decision)
`@hyunbinseo/holidays-kr` v3.2026.1을 채택한다. `src/lib/holidays.ts`에서 공휴일 판별에 사용.

### 결과 (Consequences)

**장점:**
- 법정 공휴일(대체공휴일 포함) 정확도 높음
- 경량 패키지 -- 번들 영향 최소
- 오프라인에서도 작동 (내장 데이터)
- 한국 맥락에 최적화된 DX

**단점:**
- 한국 공휴일만 지원 -- 국제화(i18n) 확장 시 별도 라이브러리 필요
- 연도별 업데이트가 필요 (v3.2026.1은 2026년까지 데이터 포함)
- 사용자 개인 기념일은 별도 `AnnualEvent` 시스템으로 관리해야 함
- 임시공휴일(대통령 지정 등)은 라이브러리 업데이트 전까지 반영 불가

---

## ADR-013: View-Store-Lib (VSL) 아키텍처 패턴

### 상태
승인됨

### 배경 (Context)
프로젝트의 코드 구조를 어떤 아키텍처 패턴으로 조직할 것인가? 전통적인 MVC, MVVM은 React 생태계와 맞지 않고, Clean Architecture는 이 규모에 과도하다.

### 고려한 대안 (Alternatives Considered)

1. **MVC**: Model-View-Controller. React에서는 Controller 개념이 모호
2. **MVVM**: Model-View-ViewModel. React 훅이 ViewModel 역할을 부분적으로 수행하지만 공식적이지 않음
3. **Feature-based 폴더 구조**: 기능별 모듈. 이 앱은 기능 간 경계가 불분명 (계층 네비게이션이 모든 곳에서 사용)
4. **View-Store-Lib (VSL)**: React 생태계의 관행에 맞는 실용적 3계층

### 결정 (Decision)
View-Store-Lib 패턴을 암묵적으로 채택한다:

```
src/
├── views/          # View 계층: UI 렌더링 + 사용자 인터랙션
│   ├── FractalView.tsx    (메인 계획 UI)
│   ├── RecordView.tsx     (기록/회고 UI)
│   ├── DashboardView.tsx  (대시보드)
│   └── NotepadView.tsx    (메모장)
├── store/          # Store 계층: 상태 + 비즈니스 로직
│   ├── usePlanStore.ts    (핵심 스토어)
│   └── useNotepadStore.ts (메모장 스토어)
├── lib/            # Lib 계층: 유틸리티 + 외부 서비스 연동
│   ├── supabase.ts        (DB 클라이언트)
│   ├── sync.ts            (동기화 로직)
│   ├── holidays.ts        (공휴일)
│   ├── settings.ts        (설정 관리)
│   ├── search.ts          (검색)
│   └── csvUtils.ts        (CSV 처리)
├── components/     # 공유 컴포넌트 (레이아웃, 모달)
├── types/          # 타입 정의
└── hooks/          # 커스텀 훅 (useAutoSync)
```

### 결과 (Consequences)

**장점:**
- React 개발자에게 직관적인 구조
- `views/`가 페이지 단위 UI, `store/`가 비즈니스 로직, `lib/`가 인프라로 깔끔하게 분리
- 파일 수가 적어(전체 약 30개) 탐색이 용이

**단점:**
- View와 Store의 경계가 명확하지 않음 -- `FractalView.tsx`가 `usePlanStore`의 세부 구현에 강하게 결합
- `usePlanStore.ts`에 비즈니스 로직과 도메인 모델(ID 생성/파싱)이 혼재
- `components/` vs `views/` 구분 기준이 모호 -- `Shell.tsx`는 레이아웃인데 `components/layout/`에 위치
- `types/plan.ts`에 타입과 상수(`CATEGORY_CONFIG` 등 UI 설정)가 함께 정의되어 도메인 모델과 표현 계층이 혼합됨
- `hooks/`에 단 1개 훅(`useAutoSync`)만 있어 별도 디렉토리의 의미 의문

---

## 부록: 향후 검토가 필요한 기술 부채

| 영역 | 현재 상태 | 권장 개선 방향 |
|------|-----------|---------------|
| 스토어 크기 | 2,100줄 단일 파일 | Zustand 슬라이스 패턴으로 분리 |
| 테스트 | 0% 커버리지 | Vitest + Store 단위 테스트 우선 |
| 동기화 | 전체 덮어쓰기 | 변경된 Period만 delta sync |
| 보안 | RLS 비활성, API 키 평문 | RLS 활성화, 키 암호화 |
| 오프라인 | 미지원 | IndexedDB 캐시 계층 추가 |
| 번들 | Next.js 런타임 포함 | Vite 마이그레이션 또는 RSC 활용 검토 |
| 성능 | toggleComplete O(n*m) | 이벤트 기반 부분 업데이트 |
