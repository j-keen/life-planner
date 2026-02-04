# CLAUDE.md - Life Planner AI 협업 가이드

> 이 문서는 AI 어시스턴트(Claude, GPT, Copilot 등)가 본 프로젝트에 빠르게 기여할 수 있도록 최적화된 단일 진실 공급원(Single Source of Truth)입니다.

---

## 1. 프로젝트 개요

**Life Planner**(라이프 플래너)는 30년 단위의 인생 목표부터 일일 시간대별 할일까지 7단계 프랙탈(fractal) 계층으로 관리하는 한국어 기반 일정/인생 설계 웹앱입니다. 사용자가 상위 기간에서 하위 기간으로 "드릴다운"하며 목표를 세분화하고, 드래그앤드롭으로 할일/루틴을 자식 기간에 배정하는 것이 핵심 인터랙션입니다. 선택적으로 Supabase 클라우드 동기화와 Google Gemini AI 채팅 어시스턴트를 지원합니다.

---

## 2. 빌드 및 실행 명령어

```bash
# 개발 서버 (http://localhost:3000)
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 실행
npm run start

# ESLint 검사
npm run lint

# TypeScript 타입 체크 (빌드 없이)
npx tsc --noEmit
```

> **참고**: 테스트 프레임워크가 설정되어 있지 않습니다. `npm test`는 동작하지 않습니다.

---

## 3. 기술 스택

| 기술 | 버전 | 용도 |
|------|------|------|
| Next.js | 16.1.1 | App Router 기반 프레임워크 |
| React | 19.2.3 | UI 렌더링 |
| TypeScript | ^5 | 타입 시스템 (strict 모드) |
| Zustand | ^5.0.10 | 전역 상태 관리 (미들웨어 없음) |
| @dnd-kit/core | ^6.3.1 | 드래그앤드롭 코어 |
| @dnd-kit/sortable | ^10.0.0 | 정렬 가능 DnD |
| Tailwind CSS | ^4 | 유틸리티 기반 스타일링 |
| @supabase/supabase-js | ^2.89.0 | 클라우드 DB (선택적) |
| @google/genai | ^1.34.0 | Gemini AI 채팅 (선택적) |
| PapaParse | ^5.5.3 | CSV 가져오기/내보내기 |
| lucide-react | ^0.562.0 | 아이콘 라이브러리 |
| @hyunbinseo/holidays-kr | ^3.2026.1 | 한국 공휴일 판별 |
| clsx + tailwind-merge | ^2.1.1 / ^3.4.0 | 조건부 className 결합 |

**TypeScript 설정**: `strict: true`, `target: ES2017`, `moduleResolution: bundler`, 경로 별칭 `@/*` -> `./src/*`

---

## 4. 아키텍처 개요

```
 브라우저 (Client-Side Only - SSR 미사용)
 ================================================
 [Next.js App Router]
      |
      v
 [layout.tsx] -- CloudInitializer (클라우드 부트스트랩)
      |
      +-- [page.tsx]        --> Shell + DashboardView
      +-- [planner/]        --> Shell + FractalView / RecordView 토글
      +-- [dashboard/]      --> Shell + DashboardView
      +-- [routines/]       --> Shell + 루틴 관리
      +-- [events/]         --> Shell + 기념일 관리
      +-- [notepad/]        --> NotepadView (Shell 없음)
      +-- [api/chat/]       --> Gemini AI 프록시 (유일한 서버 엔드포인트)

 [Zustand Store]
   usePlanStore -----> 2139줄 모놀리스: 모든 비즈니스 로직
   useNotepadStore --> 메모장 (zustand/persist + localStorage)

 [클라우드 동기화 레이어]
   Store subscriber --> 2초 디바운스 --> Supabase upsert (LWW)
```

**핵심 데이터 흐름**:
1. 사용자 액션 -> Zustand action 호출
2. Store 상태 변경 -> React 리렌더링
3. Module-level subscriber 감지 -> `autoSyncToCloud()` (2초 디바운스)
4. Supabase upsert (periods, records, annual_events 테이블)

**렌더링 방식**: 전체 CSR(Client-Side Rendering). Next.js App Router를 사용하지만 모든 페이지가 `"use client"` 컴포넌트입니다. SSR/SSG는 활용하지 않습니다.

---

## 5. 프로젝트 구조

```
src/
  app/                              # Next.js App Router
    api/chat/route.ts               # Gemini AI 프록시 (유일한 API Route)
    dashboard/page.tsx              # 대시보드 페이지
    events/page.tsx                 # 기념일 관리 페이지
    notepad/page.tsx                # 메모장 (Shell 미사용)
    planner/page.tsx                # 메인 플래너 (FractalView/RecordView 토글)
    routines/page.tsx               # 루틴 관리 페이지
    layout.tsx                      # 루트 레이아웃 (CloudInitializer 래퍼)
    page.tsx                        # 홈 = Shell + DashboardView
    globals.css                     # 전역 스타일

  components/
    layout/Shell.tsx                # 앱 셸 (헤더, 네비게이션, 설정 패널, 검색, 채팅)
    ChatAssistant.tsx               # 플로팅 AI 채팅 위젯
    CloudInitializer.tsx            # 앱 시작 시 Supabase 데이터 부트스트랩
    CloudSync.tsx                   # 수동 동기화 UI 컴포넌트
    ColorMenu.tsx                   # 항목 색상 선택 메뉴
    NoteModal.tsx                   # 항목 상세 메모 모달
    SearchModal.tsx                 # 전체 텍스트 검색 모달

  hooks/
    useAutoSync.ts                  # 자동 클라우드 동기화 훅 (3초 디바운스)

  lib/
    csvUtils.ts                     # CSV 가져오기/내보내기 (PapaParse, 500자 제한, HTML 이스케이프)
    holidays.ts                     # 한국 공휴일 판별 (@hyunbinseo/holidays-kr)
    search.ts                       # 전체 텍스트 검색 (할일/루틴/메모/기록/기념일)
    settings.ts                     # 설정 관리 (Gemini API 키: localStorage + Supabase)
    supabase.ts                     # Supabase 클라이언트 싱글톤
    sync.ts                         # 클라우드 동기화 엔진 (업로드/다운로드/LWW 병합)

  store/
    useNotepadStore.ts              # 메모장 스토어 (zustand/persist + localStorage)
    usePlanStore.ts                 # 메인 스토어 (2139줄, 모든 상태 + 비즈니스 로직)

  types/
    plan.ts                         # 전체 TypeScript 타입 정의 (402줄)

  views/
    DashboardView.tsx               # 대시보드 (849줄) - 기간별 요약, 통계
    FractalView.tsx                 # 프랙탈 뷰 (2094줄) - 메인 3컬럼 DnD UI
    NotepadView.tsx                 # 메모장 뷰 - 마크다운 메모 CRUD
    RecordView.tsx                  # 레코드 뷰 - 일일 기록/회고 (기분, 하이라이트, 감사)
```

---

## 6. 핵심 도메인 모델

### 6.1 7단계 프랙탈 계층

```
THIRTY_YEAR (30년)
  └── FIVE_YEAR (5년) x6
       └── YEAR (1년) x5
            └── QUARTER (분기) x4
                 └── MONTH (월) x3
                      └── WEEK (주) x5(최대)
                           └── DAY (일) x7
                                └── TimeSlot (시간대) x8
```

| Level | 한글 | 자식 수 | 그리드 배치 | 비고 |
|-------|------|---------|------------|------|
| `THIRTY_YEAR` | 30년 | 6 x FIVE_YEAR | 3x2 | baseYear 기준 |
| `FIVE_YEAR` | 5년 | 5 x YEAR | 5x1 | index 0-5 |
| `YEAR` | 1년 | 4 x QUARTER | 4x1 | |
| `QUARTER` | 분기 | 3 x MONTH | 3x1 | |
| `MONTH` | 월 | 최대5 x WEEK | 5x1 | 월요일 시작 풀 주차 |
| `WEEK` | 주 | 7 x DAY | 7x1 | ISO 주차, 월요일 시작 |
| `DAY` | 일 | 8 x TimeSlot | 4x2 | 최하위 레벨 |

### 6.2 Period ID 체계

Period ID는 문자열 기반 식별자로 계층 정보를 인코딩합니다. `getPeriodId()`와 `parsePeriodId()` 함수로 생성/파싱합니다.

| Level | 형식 | 예시 |
|-------|------|------|
| THIRTY_YEAR | `30y` | `30y` |
| FIVE_YEAR | `5y-{index}` | `5y-0`, `5y-3` |
| YEAR | `y-{year}` | `y-2026` |
| QUARTER | `q-{year}-{1-4}` | `q-2026-2` |
| MONTH | `m-{year}-{01-12}` | `m-2026-07` |
| WEEK (새 형식) | `w-{year}-{month}-{weekInMonth}` | `w-2026-05-2` |
| WEEK (레거시) | `w-{year}-{isoWeek}` | `w-2026-17` |
| DAY | `d-{year}-{mm}-{dd}` | `d-2026-02-03` |

> **주의**: WEEK ID에 두 가지 형식이 공존합니다. `parsePeriodId()`에서 parts 길이로 구분합니다 (4파트 = 새 형식, 3파트 = 레거시).

### 6.3 핵심 데이터 타입 (`src/types/plan.ts`)

```typescript
// 할일/루틴 항목 (공통 엔티티)
interface Item {
  id: string;                    // genId()로 생성된 9자 랜덤 문자열
  content: string;               // 항목 내용
  isCompleted: boolean;          // 완료 여부
  color?: string;                // Tailwind 배경색 클래스 (예: 'bg-red-100')
  category?: Category;           // 루틴 카테고리 (6종)
  todoCategory?: TodoCategory;   // 할일 카테고리 (3종)
  targetCount?: number;          // 루틴 목표 횟수
  currentCount?: number;         // 루틴 현재 횟수
  subContent?: string;           // 세부 내용 (슬롯 배정 시 입력)
  parentId?: string;             // 부모 항목 ID (트리 구조)
  childIds?: string[];           // 자식 항목 ID 배열 (트리 구조)
  isExpanded?: boolean;          // 접기/펼치기 상태
  originPeriodId?: string;       // 원본 기간 ID
  sourceLevel?: Level;           // 출처 레벨
  sourceType?: 'todo' | 'routine'; // 출처 타입
  lastResetDate?: string;        // 루틴 마지막 리셋 날짜 (ISO string)
  note?: string;                 // 상세 메모
}

// 기간 컨테이너
interface Period {
  id: string;                    // Period ID
  level: Level;                  // 계층 레벨
  goal: string;                  // 기간 목표
  motto: string;                 // 좌우명
  memo: string;                  // (deprecated)
  memos: string[];               // (deprecated)
  structuredMemos: Memo[];       // 구조화된 메모 (sourceLevel 포함)
  todos: Item[];                 // 좌측 패널 - 할일 목록
  routines: Item[];              // 우측 패널 - 루틴 목록
  slots: Record<string, Item[]>; // 중앙 그리드 - 자식 기간별 배정 항목
  timeSlots?: Record<TimeSlot, Item[]>; // DAY 레벨 전용 - 시간대별 배정
}

// 일일 기록
interface DailyRecord {
  id: string;
  periodId: string;              // 연결된 DAY 기간 ID
  content: string;               // 마크다운 기록
  mood?: Mood;                   // 오늘의 기분 (5단계)
  highlights: string[];          // 하이라이트/성취
  gratitude: string[];           // 감사한 것들
  createdAt: string;             // ISO date
  updatedAt: string;             // ISO date
}

// 연간 기념일
interface AnnualEvent {
  id: string;
  title: string;                 // 이벤트 제목
  type: AnnualEventType;         // birthday/anniversary/memorial/holiday/other
  month: number;                 // 1-12
  day: number;                   // 1-31
  lunarDate?: boolean;           // 음력 여부
  note?: string;
  reminderDays?: number;         // 며칠 전 알림
  createdAt: string;
}
```

---

## 7. 상태 관리

### 7.1 usePlanStore (`src/store/usePlanStore.ts`)

2139줄의 Zustand 스토어. **미들웨어 없음**, **localStorage 없음**. 브라우저 새로고침 시 Supabase가 없으면 데이터가 소실됩니다.

**초기 상태**: `currentLevel: 'WEEK'`, `currentPeriodId: 현재 ISO 주차`, `periods: {}` (빈 객체)

#### 핵심 액션 목록

| 액션 | 시그니처 | 설명 |
|------|----------|------|
| `navigateTo` | `(periodId: string) => void` | 특정 기간으로 이동 (없으면 자동 생성) |
| `drillDown` | `(childPeriodId: string) => void` | 자식 기간으로 이동 (navigateTo 위임) |
| `drillUp` | `() => void` | 부모 기간으로 이동 |
| `addItem` | `(content, to, targetCount?, category?, todoCategory?) => void` | 할일/루틴 추가 |
| `assignToSlot` | `(itemId, from, targetSlotId, subContent?) => void` | 항목을 자식 기간 슬롯에 배정 (DnD 핵심) |
| `assignToTimeSlot` | `(itemId, from, timeSlot, subContent?) => void` | 항목을 시간대 슬롯에 배정 (DAY 전용) |
| `toggleComplete` | `(itemId, location, slotId?) => void` | 완료 토글 (부모/자식 연쇄) |
| `deleteItem` | `(itemId, from, slotId?) => void` | 항목 삭제 |
| `updateItemContent` | `(itemId, content, location, slotId?) => void` | 항목 내용 수정 |
| `updateItemNote` | `(itemId, note, location, slotId?) => void` | 항목 메모 수정 |
| `resetRoutinesIfNeeded` | `(periodId: string) => void` | sourceLevel 기반 루틴 자동 리셋 |
| `ensurePeriod` | `(periodId: string) => Period` | 기간이 없으면 생성 후 반환 |
| `getInheritedMemos` | `(periodId: string) => Memo[]` | 상위 기간 메모 수집 |
| `getProgress` | `(itemId: string) => number` | 달성률 계산 |

#### assignToSlot 동작 원리 (가장 복잡한 액션)

1. 원본 항목에서 자식 항목 생성 (`genId()`)
2. 자식 항목에 `parentId`, `sourceLevel`, `sourceType`, `originPeriodId` 설정
3. 원본 항목의 `childIds`에 자식 ID 추가
4. 대상 슬롯의 `slots[targetSlotId]`에 자식 항목 추가
5. 대상 자식 기간의 `todos` 또는 `routines`에도 자식 항목 추가 (전파)
6. `allItems` 레지스트리에 등록

#### toggleComplete 연쇄 동작

- 하위 연쇄: 자식 항목들이 있으면 재귀적으로 완료 상태 전파
- 상위 연쇄: 부모 항목이 있으면 모든 형제 완료 시 부모도 완료 처리
- 루틴 카운트: `targetCount`가 있으면 `currentCount` 증감

### 7.2 useNotepadStore (`src/store/useNotepadStore.ts`)

Zustand + persist 미들웨어 + localStorage (`life-planner-notepad`).

### 7.3 자동 동기화 흐름

```
Store 상태 변경
  |
  v
Module-level subscriber (usePlanStore.ts 하단, typeof window !== 'undefined')
  |-- periods/records/annualEvents 변경 감지 (참조 비교)
  |
  v
동적 import('../lib/sync') --> autoSyncToCloud()
  |-- 2초 디바운스
  |-- Supabase upsert (periods, records, annual_events 테이블)
  |-- LWW (Last-Write-Wins) 충돌 해결
```

---

## 8. UI 구조

### 8.1 FractalView 레이아웃 (2094줄, `src/views/FractalView.tsx`)

```
+-------------------------------------------------------------------+
| [기간 헤더: 목표, 좌우명, 메모 (상위 메모 포함)]                    |
+-------------------------------------------------------------------+
|                                                                     |
| [좌측 패널]     | [중앙 그리드]              | [우측 패널]          |
| 할일 (Todos)    | 자식 기간 슬롯들           | 루틴 (Routines)      |
|                 | (드롭 가능)               |                      |
| 카테고리별 분류  |                           | 카테고리별 분류       |
| - 개인(personal)| THIRTY_YEAR: 3x2          | - 업무/학습(work)    |
| - 업무(work)    | FIVE_YEAR: 5x1            | - 건강/운동(health)  |
| - 기타(other)   | YEAR: 4x1                 | - 관계/소통(relation)|
|                 | QUARTER: 3x1              | - 재정/생활(finance) |
| [+ 추가 입력]   | MONTH: 5x1                | - 성장/취미(growth)  |
|                 | WEEK: 7x1                 | - 미분류             |
|                 | DAY: 4x2 (시간대 슬롯)   |                      |
|                 |                           | [+ 추가 입력]        |
+-------------------------------------------------------------------+
```

### 8.2 네비게이션

- **드릴다운**: 중앙 그리드 셀 클릭 -> 해당 자식 기간으로 이동
- **드릴업**: 헤더의 상위 기간 버튼 클릭
- **직접 이동**: `navigateTo(periodId)` 호출

### 8.3 드래그앤드롭 (@dnd-kit)

- **소스**: 좌측 패널(할일) 또는 우측 패널(루틴)의 항목
- **타겟**: 중앙 그리드의 자식 기간 셀 또는 시간대 슬롯
- **센서**: PointerSensor (`@dnd-kit/core`)
- **드롭 결과**: `assignToSlot()` 또는 `assignToTimeSlot()` 호출 -> 자식 항목 생성 + 전파

### 8.4 뷰 모드

`/planner` 페이지에서 두 가지 뷰 토글:
- **plan** (기본): FractalView - 계획 수립
- **record**: RecordView - 일일 기록/회고 (기분, 하이라이트, 감사)

### 8.5 페이지 라우팅

| 경로 | 컴포넌트 | 설명 |
|------|----------|------|
| `/` | Shell + DashboardView | 홈/대시보드 |
| `/planner` | Shell + FractalView/RecordView | 메인 플래너 |
| `/dashboard` | Shell + DashboardView | 대시보드 (별도 경로) |
| `/routines` | Shell + 루틴 관리 | 전체 루틴 관리 |
| `/events` | Shell + 기념일 관리 | 기념일 CRUD + CSV |
| `/notepad` | NotepadView (Shell 없음) | 자유 메모장 |

---

## 9. 카테고리 시스템

### 9.1 루틴 카테고리 (`Category`, 6종)

| key | 한글 | 색상 (Tailwind) | 아이콘 |
|-----|------|-----------------|--------|
| `work` | 업무/학습 | blue (bg-blue-50) | 💼 |
| `health` | 건강/운동 | green (bg-green-50) | 💪 |
| `relationship` | 관계/소통 | rose (bg-rose-50) | 👥 |
| `finance` | 재정/생활 | amber (bg-amber-50) | 💰 |
| `growth` | 성장/취미 | purple (bg-purple-50) | 🌱 |
| `uncategorized` | 미분류 | gray (bg-gray-50) | 📌 |

### 9.2 할일 카테고리 (`TodoCategory`, 3종)

| key | 한글 | 색상 (Tailwind) | 아이콘 |
|-----|------|-----------------|--------|
| `personal` | 개인 | amber (bg-amber-50) | 👤 |
| `work` | 업무 | violet (bg-violet-50) | 💼 |
| `other` | 기타 | slate (bg-slate-50) | 📌 |

> **주의**: `work`라는 key가 루틴 카테고리와 할일 카테고리 양쪽에 존재하지만, 타입이 다릅니다 (`Category` vs `TodoCategory`). Item에서 `category`(루틴용)와 `todoCategory`(할일용) 필드로 구분합니다.

---

## 10. 시간대 슬롯 (DAY 레벨 전용)

| TimeSlot key | 한글 | 시간 범위 | 그리드 위치 |
|-------------|------|-----------|------------|
| `morning_early` | 오전 1 | 6:00-9:00 | 1행 1열 |
| `afternoon_early` | 오후 1 | 12:00-15:00 | 1행 2열 |
| `evening_early` | 저녁 1 | 18:00-21:00 | 1행 3열 |
| `anytime` | 시간무관 | - | 1행 4열 |
| `morning_late` | 오전 2 | 9:00-12:00 | 2행 1열 |
| `afternoon_late` | 오후 2 | 15:00-18:00 | 2행 2열 |
| `evening_late` | 저녁 2 | 21:00-24:00 | 2행 3열 |
| `dawn` | 새벽(야근) | 0:00-6:00 | 2행 4열 |

> **배치 순서**: TIME_SLOTS 배열은 행 우선(row-major)으로 정의되어 있으며, 4x2 그리드로 렌더링됩니다.

---

## 11. 클라우드 동기화

### 11.1 아키텍처

```
[CloudInitializer]          [Module-level Subscriber]
  앱 시작 시                    상태 변경 시
  initializeFromCloud()         autoSyncToCloud()
       |                              |
       v                              v
  syncFromCloud()              2초 디바운스
       |                              |
       v                              v
  Supabase SELECT           Supabase UPSERT (LWW)
```

### 11.2 Supabase 테이블

| 테이블 | PK | 주요 컬럼 |
|--------|-----|-----------|
| `periods` | `id` (Period ID) | level, goal, motto, todos, routines, slots, time_slots, updated_at |
| `records` | `id` | period_id, content, mood, highlights, gratitude, updated_at |
| `annual_events` | `id` | title, type, month, day, lunar_date, note, updated_at |
| `settings` | `key` | value (JSONB), updated_at |

### 11.3 동기화 방식

- **충돌 해결**: LWW (Last-Write-Wins) - `updated_at` 타임스탬프 기준
- **업로드 트리거**: Store subscriber -> 참조 비교 (`!==`) -> 2초 디바운스
- **다운로드 트리거**: 앱 시작 시 CloudInitializer, 수동 CloudSync 버튼
- **병합 전략**: 단순 오버라이드 (`{ ...local, ...cloud }`)

### 11.4 설정 저장

Gemini API 키는 이중 저장: `localStorage('life-planner-settings')` + `Supabase settings 테이블`. 로드 시 Supabase 우선, localStorage 폴백.

---

## 12. AI 어시스턴트

### 12.1 구조

- **프론트엔드**: `ChatAssistant.tsx` - 플로팅 채팅 위젯, 현재 기간 컨텍스트 자동 전달
- **백엔드**: `api/chat/route.ts` - Next.js API Route, Gemini 프록시
- **모델**: `gemini-3-flash-preview`
- **시스템 프롬프트**: 현재 기간 정보(목표, 할일, 루틴, 기록)를 자동 주입

### 12.2 API 키 결정 순서

1. 클라이언트에서 전달한 `apiKey` (설정에서 입력)
2. 환경변수 `GEMINI_API_KEY`
3. 둘 다 없으면 에러 반환

---

## 13. 도메인 용어 사전

| 한글 | 영문 | 설명 |
|------|------|------|
| 기간 | Period | 시간 구간 컨테이너 (7단계 중 하나) |
| 할일 | Todo | 일회성 작업 항목 |
| 루틴 | Routine | 반복 작업 (선택적 목표 횟수: `targetCount`) |
| 슬롯 | Slot | 자식 기간에 배정된 항목 영역 |
| 시간대 | TimeSlot | DAY 레벨의 시간 구간 (8종) |
| 드릴다운 | Drill-down | 부모 -> 자식 기간으로 이동 |
| 드릴업 | Drill-up | 자식 -> 부모 기간으로 이동 |
| 프랙탈 뷰 | FractalView | 메인 3컬럼 계획 인터페이스 |
| 레코드 뷰 | RecordView | 일일 기록/회고 인터페이스 |
| 기념일 | AnnualEvent | 매년 반복되는 이벤트 (생일, 기념일, 기일, 공휴일) |
| 동기화 | Sync | Supabase 클라우드 동기화 |
| 기분 | Mood | 일일 기분 (great/good/okay/bad/terrible) |
| 쪼개기 | Sub-item split | 항목을 하위 항목으로 분해 (parentId/childIds 트리) |
| 배정 | Assign | 항목을 슬롯/시간대에 드래그앤드롭으로 할당 |
| 출처 | Source | 항목이 최초 생성된 기간/타입 추적 (`sourceLevel`, `sourceType`) |
| 리셋 | Reset | 루틴 `currentCount`를 0으로 초기화 (`lastResetDate` 기준) |
| 기준 연도 | baseYear | 30년 계획의 시작 연도 (설정에서 변경 가능) |
| 구조화된 메모 | Structured Memo | sourceLevel과 sourcePeriodId를 포함하는 메모 |

---

## 14. 암묵적 규칙 (Implicit Rules)

AI 어시스턴트가 반드시 알아야 하는, 코드에서만 확인 가능한 규칙들입니다.

### 14.1 ID 생성

- 모든 Item ID: `Math.random().toString(36).substr(2, 9)` - 9자 영숫자
- UUID가 아닙니다. 충돌 가능성이 낮지만 0은 아닙니다.

### 14.2 기간 지연 생성 (Lazy Creation)

- `periods` 객체는 빈 상태(`{}`)로 시작합니다.
- `navigateTo()`나 `ensurePeriod()` 호출 시 해당 기간이 없으면 `createEmptyPeriod()`로 즉시 생성합니다.
- 따라서 `periods[someId]`는 항상 `undefined`일 수 있습니다. 접근 전에 `ensurePeriod()`를 거쳐야 합니다.

### 14.3 주차(Week) 계산

- ISO 주차 기준 (월요일 시작, 목요일 규칙)
- `getISOWeek()`: 날짜 -> ISO 주차 번호
- `getISOWeekYear()`: 날짜 -> ISO 주차 기준 연도 (1월 초/12월 말 주의)
- `getWeeksInMonth()`: 풀 주차 반환 (월요일~일요일, 다른 달 날짜 포함 가능)

### 14.4 루틴 횟수 입력 형식

- 사용자 입력: `"운동 / 3"` -> `content: "운동"`, `targetCount: 3`
- 슬래시(/)로 내용과 횟수를 분리합니다.
- `currentCount`는 0에서 시작, 완료 토글 시 증감합니다.

### 14.5 슬롯 배정과 전파

- `assignToSlot()` 호출 시, 자식 항목은 슬롯(`slots[childPeriodId]`)과 자식 기간의 `todos`/`routines` **양쪽 모두**에 추가됩니다.
- 이 이중 저장이 드릴다운 시 자식 기간에서 배정된 항목을 볼 수 있게 합니다.

### 14.6 완료 연쇄의 방향

- **하향 전파**: 부모 완료 -> 모든 자식 완료
- **상향 전파**: 모든 형제 완료 -> 부모 자동 완료
- 이 연쇄는 `allItems` 레지스트리를 통해 기간을 넘어 동작합니다.

### 14.7 자동 리셋 시점

- `resetRoutinesIfNeeded(periodId)`는 `navigateTo()` 내에서 자동 호출됩니다.
- 새 기간에 진입할 때 `sourceLevel` 기준으로 리셋 여부를 판단합니다.
- `lastResetDate`를 비교하여 중복 리셋을 방지합니다.

### 14.8 메모 구조 진화

- `memo: string` (deprecated) -> `memos: string[]` (deprecated) -> `structuredMemos: Memo[]` (현행)
- 3단계 마이그레이션 경로가 있으므로 기존 데이터에서 세 필드 모두 존재할 수 있습니다.

### 14.9 동기화 트리거 방식

- 컴포넌트 훅(`useAutoSync`)이 아닌, **모듈 레벨 `subscribe()`**가 실제 동기화를 담당합니다.
- `usePlanStore.ts` 파일 하단에 `typeof window !== 'undefined'` 가드와 함께 정의되어 있습니다.
- `useAutoSync` 훅도 별도로 존재하지만 (3초 디바운스), Store subscriber가 주 동기화 경로입니다.

### 14.10 Supabase 컬럼 네이밍

- TypeScript는 camelCase (`structuredMemos`, `timeSlots`)
- Supabase는 snake_case (`structured_memos`, `time_slots`)
- 변환은 `sync.ts`의 각 함수에서 수동으로 처리합니다.

---

## 15. 위험 영역 및 주의사항

### 15.1 치명적 위험 (Critical)

| 위험 | 파일 | 설명 |
|------|------|------|
| **데이터 소실** | `usePlanStore.ts` | localStorage/persist 미들웨어가 없음. Supabase 없이 새로고침하면 모든 데이터 소실 |
| **스토어 모놀리스** | `usePlanStore.ts` (2139줄) | 모든 비즈니스 로직이 단일 파일. 수정 시 연쇄 부작용 가능 |
| **FractalView 복잡도** | `FractalView.tsx` (2094줄) | 렌더링, DnD, 입력, 카테고리 로직이 모두 한 파일 |

### 15.2 높은 위험 (High)

| 위험 | 영역 | 설명 |
|------|------|------|
| **O(n) 스캔** | `toggleComplete` | 완료 연쇄 시 `allItems` 전체를 탐색. 항목이 많아지면 성능 저하 |
| **이중 저장 정합성** | `assignToSlot` | 슬롯과 자식 기간 양쪽에 항목 추가. 한쪽만 삭제하면 불일치 발생 |
| **Week ID 이중 형식** | `parsePeriodId` | 새 형식(w-연-월-주)과 레거시(w-연-주) 공존. 비교 시 주의 |
| **동기화 경쟁 조건** | sync.ts | useAutoSync와 Store subscriber 두 경로 존재. 동시 트리거 가능성 |

### 15.3 중간 위험 (Medium)

| 위험 | 영역 | 설명 |
|------|------|------|
| **테스트 부재** | 전체 | 단위/통합/E2E 테스트 없음. 리팩토링 시 회귀 확인 불가 |
| **CSR 전용** | 전체 | Next.js지만 SSR 미활용. SEO/초기 로딩 성능 제한 |
| **genId 충돌** | usePlanStore | `Math.random()` 기반 9자 ID. 극히 드물지만 충돌 가능 |
| **LWW 데이터 손실** | sync.ts | Last-Write-Wins는 동시 편집 시 한쪽 변경 소실 가능 |

### 15.4 안전한 수정 지점 (Safe Zones)

| 수정 | 위치 | 이유 |
|------|------|------|
| 새 페이지 추가 | `src/app/새폴더/page.tsx` | 기존 코드에 영향 없음 |
| 새 유틸리티 | `src/lib/새파일.ts` | 완전히 분리된 모듈 |
| 새 컴포넌트 | `src/components/새파일.tsx` | 자체 포함(self-contained) |
| 스타일 변경 | Tailwind 클래스 | 클래스 변경은 부작용 없음 |
| 기념일 관련 | `events/`, `AnnualEvent` | 메인 플래너 로직과 독립적 |
| 메모장 관련 | `notepad/`, `useNotepadStore` | 완전히 분리된 기능 |

### 15.5 위험한 수정 지점 (Danger Zones)

| 수정 | 위치 | 위험 |
|------|------|------|
| Store 액션 수정 | `usePlanStore.ts` | 연쇄 부작용, 동기화 파손, 데이터 정합성 |
| Period/Item 타입 변경 | `types/plan.ts` | 전체 앱 + Supabase 스키마에 영향 |
| 동기화 로직 변경 | `sync.ts` | 데이터 소실/중복 위험 |
| DnD 로직 변경 | `FractalView.tsx` | 배정/전파 로직 파손 |

---

## 16. 환경 변수

```bash
# .env.local 파일에 설정

# AI 어시스턴트 (선택적 - 없으면 채팅 기능 비활성화)
GEMINI_API_KEY=your-gemini-api-key

# 클라우드 동기화 (선택적 - 없으면 로컬 전용, 새로고침 시 데이터 소실)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

| 변수 | 필수 | 용도 | 미설정 시 |
|------|------|------|-----------|
| `GEMINI_API_KEY` | 아니오 | Gemini AI 채팅 | 채팅 기능 비활성화 |
| `NEXT_PUBLIC_SUPABASE_URL` | 아니오 | Supabase 프로젝트 URL | 로컬 전용 모드 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 아니오 | Supabase 익명 키 | 로컬 전용 모드 |

> **경고**: `NEXT_PUBLIC_` 접두사 변수는 클라이언트 번들에 포함됩니다. 민감한 키는 서버 전용 변수(`GEMINI_API_KEY`)로 관리합니다.

---

## 17. 개발 현황

### 17.1 완료된 기능

- [x] 7단계 프랙탈 계층 네비게이션 (드릴다운/드릴업)
- [x] 할일/루틴 CRUD (추가, 수정, 삭제, 완료 토글)
- [x] 드래그앤드롭 슬롯 배정 (자식 기간 + 시간대)
- [x] 카테고리 시스템 (루틴 6종, 할일 3종)
- [x] 항목 트리 구조 (쪼개기, 접기/펼치기)
- [x] 루틴 자동 리셋
- [x] 일일 기록/회고 (RecordView: 기분, 하이라이트, 감사)
- [x] 대시보드 (DashboardView: 기간별 요약, 통계)
- [x] 기념일 관리 (생일, 기념일, 기일, 공휴일)
- [x] 한국 공휴일 자동 표시
- [x] Supabase 클라우드 동기화 (자동 + 수동)
- [x] Gemini AI 채팅 어시스턴트
- [x] 전체 텍스트 검색
- [x] CSV 가져오기/내보내기 (루틴, 기념일)
- [x] 메모장 (마크다운, localStorage 영속)
- [x] 구조화된 메모 (상위 기간 메모 상속)
- [x] 항목 색상 지정
- [x] 항목 상세 메모

### 17.2 미완료/개선 필요 항목

- [ ] 테스트 커버리지 (단위/통합/E2E 전무)
- [ ] `usePlanStore.ts` 분리 (2139줄 모놀리스)
- [ ] `FractalView.tsx` 분리 (2094줄 모놀리스)
- [ ] localStorage 퍼시스턴스 (Supabase 없이도 데이터 보존)
- [ ] SSR 활용 (현재 전체 CSR)
- [ ] 접근성(a11y) 개선
- [ ] 모바일 반응형 최적화
- [ ] 에러 바운더리
- [ ] 로딩/스켈레톤 상태
- [ ] PWA 오프라인 지원

---

## 18. MCP 서버 사용 규칙 (Claude Code CLI 전용)

이 프로젝트에는 Claude Code CLI가 Supabase DB를 직접 조작할 수 있는 MCP 서버(`mcp-server/`)가 있습니다. 다음 규칙을 반드시 준수하세요.

### 18.1 저장 전 승인 (Approval Before Save)

**절대 규칙: 사용자 승인 없이 데이터를 저장하지 마세요.**

1. 사용자가 할일/루틴/목표 등을 저장해달라고 요청하면, **먼저 저장할 내용을 제안합니다**:
   - 어느 기간(`period_id`)에 저장할지
   - `content` (짧은 제목)과 `note` (상세 내용)을 어떻게 분리할지
   - `type` (todo/routine), 카테고리 등
2. 사용자가 "좋아", "저장해", "그렇게 해" 등으로 **명시적 승인**을 한 후에만 `add_item`, `update_item` 등 쓰기 도구를 호출합니다.
3. 사용자가 수정을 요청하면 수정된 내용을 다시 제안하고 재승인을 받습니다.

**제안 형식 예시:**

저장 제안:
- 기간: `d-2026-02-04` (오늘)
- 제목: "저녁식사"
- 메모: "윤혁대표님, 재훈이형, 김덕원 국장님과 저녁식사"
- 유형: 할일 (todo)
- 카테고리: work

이렇게 저장할까요?

### 18.2 제목 + 메모 패턴 (Headline + Note)

항목을 저장할 때 반드시 **짧은 제목**과 **상세 내용**을 분리합니다:

- `content`: 짧고 한눈에 파악 가능한 제목 (최대 20자 내외)
- `note`: 구체적인 세부사항, 배경, 참석자, 장소, 시간 등

**예시:**

| 사용자 입력 | content | note |
|------------|---------|------|
| "내일 윤혁대표님이랑 저녁" | 저녁식사 | 윤혁대표님과 저녁. 장소/시간 미정 |
| "매일 영어 공부 30분씩" | 영어 공부 30분 | 매일 Duolingo 3레슨 + 영어 뉴스 기사 1개 읽기 |
| "이번달 책 2권 읽기" | 독서 2권 | 이번 달 목표. 장르 무관, 완독 기준 |

웹 앱에서는 `content`가 목록에 표시되고, `note`는 항목 클릭 시 모달로 확인할 수 있습니다.

### 18.3 검색 (`search_items`)

`search_items`는 `content`와 `note` 양쪽 모두를 검색합니다. 사용자가 특정 내용을 찾을 때 상세 메모에 포함된 내용도 검색됩니다.
