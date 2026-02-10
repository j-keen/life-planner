# Life Planner - 아키텍처 다이어그램

이 문서는 Life Planner 프로젝트의 전체 아키텍처를 Mermaid.js 다이어그램으로 설명합니다.
7단계 프랙탈 계층형 인생 계획 시스템의 구조, 데이터 흐름, 상태 관리, 동기화 메커니즘을 시각적으로 표현합니다.

---

## 목차

1. [전체 시스템 아키텍처](#1-전체-시스템-아키텍처)
2. [폴더 및 모듈 구조](#2-폴더-및-모듈-구조)
3. [7단계 프랙탈 계층 구조](#3-7단계-프랙탈-계층-구조)
4. [데이터 흐름](#4-데이터-흐름)
5. [상태 관리 아키텍처](#5-상태-관리-아키텍처)
6. [드래그앤드롭 흐름](#6-드래그앤드롭-흐름)
7. [클라우드 동기화 흐름](#7-클라우드-동기화-흐름)

---

## 1. 전체 시스템 아키텍처

C4 Context 수준의 시스템 개요입니다.
브라우저 클라이언트, Next.js App Router 서버, 외부 서비스(Supabase, Google Gemini AI)의 관계를 보여줍니다.
클라이언트는 Zustand 스토어를 통해 상태를 관리하고, Supabase와 실시간 동기화하며, AI 어시스턴트를 위해 Gemini API와 통신합니다.

```mermaid
graph TB
    subgraph 사용자["사용자 (브라우저)"]
        UI["React 19 SPA<br/>Tailwind CSS 4"]
        DnD["@dnd-kit<br/>드래그앤드롭"]
        Store["Zustand 스토어<br/>클라이언트 상태"]
    end

    subgraph NextJS["Next.js 16 App Router"]
        Pages["페이지 라우트<br/>/, /planner, /dashboard,<br/>/events, /routines, /notepad"]
        API["API Route<br/>/api/chat"]
        Layout["RootLayout<br/>CloudInitializer 래퍼"]
    end

    subgraph 외부서비스["외부 서비스"]
        Supabase["Supabase<br/>PostgreSQL + REST API"]
        Gemini["Google Gemini AI<br/>gemini-3-flash-preview"]
    end

    UI -->|"사용자 인터랙션"| Store
    DnD -->|"드래그 이벤트"| Store
    Store -->|"상태 구독"| UI
    UI --> Pages
    Pages --> Layout

    Store -->|"autoSyncToCloud()<br/>2초 디바운스"| Supabase
    Layout -->|"initializeFromCloud()<br/>앱 시작 시"| Supabase
    Supabase -->|"periods, records,<br/>annual_events, settings"| Store

    API -->|"POST /api/chat<br/>현재 기간 컨텍스트 전달"| Gemini
    Gemini -->|"AI 응답<br/>계획 조언/분석"| API
    UI -->|"채팅 메시지"| API

    style 사용자 fill:#dbeafe,stroke:#3b82f6,stroke-width:2px
    style NextJS fill:#fef3c7,stroke:#f59e0b,stroke-width:2px
    style 외부서비스 fill:#dcfce7,stroke:#22c55e,stroke-width:2px
```

---

## 2. 폴더 및 모듈 구조

프로젝트의 소스 코드 구조와 모듈 간 의존 관계입니다.
`app/` 디렉토리는 Next.js App Router 페이지를, `views/`는 실제 뷰 컴포넌트를, `components/`는 재사용 UI를, `store/`는 전역 상태를, `lib/`는 유틸리티를, `types/`는 타입 정의를 담당합니다.
화살표는 import 의존 방향을 나타냅니다.

```mermaid
graph LR
    subgraph app["app/ (라우트)"]
        PageHome["page.tsx<br/>홈 (Shell + DashboardView)"]
        PagePlanner["planner/page.tsx"]
        PageDashboard["dashboard/page.tsx"]
        PageEvents["events/page.tsx"]
        PageRoutines["routines/page.tsx"]
        PageNotepad["notepad/page.tsx"]
        APIChat["api/chat/route.ts<br/>Gemini AI 엔드포인트"]
        AppLayout["layout.tsx<br/>CloudInitializer 래퍼"]
    end

    subgraph views["views/ (뷰 컴포넌트)"]
        FractalView["FractalView.tsx<br/>3컬럼 프랙탈 뷰 (1000+줄)"]
        DashboardView["DashboardView.tsx"]
        RecordView["RecordView.tsx<br/>일일 기록/회고"]
        NotepadView["NotepadView.tsx"]
    end

    subgraph components["components/ (UI)"]
        Shell["layout/Shell.tsx<br/>헤더, 네비, 설정, 검색"]
        Chat["ChatAssistant.tsx<br/>AI 채팅 위젯"]
        CloudInit["CloudInitializer.tsx<br/>클라우드 데이터 부트스트랩"]
        CloudSyncUI["CloudSync.tsx<br/>수동 동기화 UI"]
        SearchModal["SearchModal.tsx<br/>Cmd+K 검색"]
        NoteModal["NoteModal.tsx"]
        ColorMenu["ColorMenu.tsx"]
    end

    subgraph store["store/ (상태)"]
        PlanStore["usePlanStore.ts<br/>메인 Zustand 스토어 (2100+줄)"]
        NotepadStore["useNotepadStore.ts<br/>메모장 스토어"]
    end

    subgraph lib["lib/ (유틸리티)"]
        SyncLib["sync.ts<br/>클라우드 동기화 엔진"]
        SupabaseLib["supabase.ts<br/>Supabase 클라이언트 싱글톤"]
        SearchLib["search.ts<br/>전문 검색"]
        CSVLib["csvUtils.ts<br/>CSV 가져오기/내보내기"]
        HolidaysLib["holidays.ts<br/>한국 공휴일"]
        SettingsLib["settings.ts<br/>앱 설정 (API 키)"]
    end

    subgraph hooks["hooks/"]
        AutoSync["useAutoSync.ts<br/>자동 클라우드 동기화 훅"]
    end

    subgraph types["types/"]
        PlanTypes["plan.ts<br/>TypeScript 타입 (400+줄)"]
    end

    %% 의존 관계
    PageHome --> Shell
    PageHome --> DashboardView
    PagePlanner --> FractalView
    AppLayout --> CloudInit

    FractalView --> PlanStore
    FractalView --> PlanTypes
    FractalView --> HolidaysLib
    DashboardView --> PlanStore
    RecordView --> PlanStore

    Shell --> AutoSync
    Shell --> Chat
    Shell --> CloudSyncUI
    Shell --> SearchModal
    Shell --> PlanStore

    CloudInit --> PlanStore
    AutoSync --> PlanStore
    AutoSync --> SyncLib
    AutoSync --> SupabaseLib

    PlanStore --> PlanTypes
    PlanStore --> SyncLib
    SyncLib --> SupabaseLib
    SearchModal --> SearchLib
    SearchLib --> PlanTypes

    Chat --> APIChat

    style app fill:#fef3c7,stroke:#f59e0b
    style views fill:#dbeafe,stroke:#3b82f6
    style components fill:#fce7f3,stroke:#ec4899
    style store fill:#dcfce7,stroke:#22c55e
    style lib fill:#e0e7ff,stroke:#6366f1
    style hooks fill:#fef9c3,stroke:#eab308
    style types fill:#f3e8ff,stroke:#a855f7
```

---

## 3. 7단계 프랙탈 계층 구조

Life Planner의 핵심 개념인 7단계 프랙탈 계층입니다.
각 레벨은 상위 레벨의 하위 기간으로 구성되며, 최상위 30년 계획부터 최하위 일간 시간대 슬롯까지 드릴다운할 수 있습니다.
각 노드에는 하위 기간 개수와 그리드 레이아웃, Period ID 형식을 표기합니다.

```mermaid
graph TD
    L1["30년 (THIRTY_YEAR)<br/>ID: 30y<br/>그리드: 3x2"]
    L2["5년 (FIVE_YEAR)<br/>ID: 5y-{0~5}<br/>그리드: 5x1"]
    L3["1년 (YEAR)<br/>ID: y-{연도}<br/>그리드: 4x1"]
    L4["분기 (QUARTER)<br/>ID: q-{연도}-{1~4}<br/>그리드: 3x1"]
    L5["월 (MONTH)<br/>ID: m-{연도}-{01~12}<br/>그리드: 5x1"]
    L6["주 (WEEK)<br/>ID: w-{연도}-{월}-{주차}<br/>그리드: 7x1"]
    L7["일 (DAY)<br/>ID: d-{연도}-{월}-{일}<br/>그리드: 4x2 시간대 슬롯"]

    L1 -->|"6개의 5년 구간"| L2
    L2 -->|"5개 연도"| L3
    L3 -->|"4분기"| L4
    L4 -->|"3개월"| L5
    L5 -->|"4~5주"| L6
    L6 -->|"7일 (월~일)"| L7

    subgraph 시간대슬롯["일(DAY) 레벨 - 8개 시간대 슬롯"]
        TS1["새벽(야근)<br/>0:00~6:00"]
        TS2["오전1<br/>6:00~9:00"]
        TS3["오전2<br/>9:00~12:00"]
        TS4["오후1<br/>12:00~15:00"]
        TS5["오후2<br/>15:00~18:00"]
        TS6["저녁1<br/>18:00~21:00"]
        TS7["저녁2<br/>21:00~24:00"]
        TS8["시간무관"]
    end

    L7 --> 시간대슬롯

    style L1 fill:#fef3c7,stroke:#f59e0b,stroke-width:3px
    style L2 fill:#fef9c3,stroke:#eab308,stroke-width:2px
    style L3 fill:#dcfce7,stroke:#22c55e,stroke-width:2px
    style L4 fill:#d1fae5,stroke:#10b981,stroke-width:2px
    style L5 fill:#dbeafe,stroke:#3b82f6,stroke-width:2px
    style L6 fill:#e0e7ff,stroke:#6366f1,stroke-width:2px
    style L7 fill:#f3e8ff,stroke:#a855f7,stroke-width:2px
    style 시간대슬롯 fill:#fce7f3,stroke:#ec4899,stroke-width:1px
```

### 기간 내부 데이터 구조

각 기간(Period)은 다음 구조를 가집니다.

```mermaid
classDiagram
    class Period {
        +string id
        +Level level
        +string goal
        +string motto
        +string memo
        +Memo[] structuredMemos
        +Item[] todos
        +Item[] routines
        +Record~string, Item[]~ slots
        +Record~TimeSlot, Item[]~ timeSlots
    }

    class Item {
        +string id
        +string content
        +boolean isCompleted
        +string color
        +Category category
        +TodoCategory todoCategory
        +number targetCount
        +number currentCount
        +string subContent
        +string parentId
        +string[] childIds
        +boolean isExpanded
        +string originPeriodId
        +Level sourceLevel
        +string sourceType
        +string lastResetDate
        +string note
    }

    class DailyRecord {
        +string id
        +string periodId
        +string content
        +Mood mood
        +string[] highlights
        +string[] gratitude
        +string createdAt
        +string updatedAt
    }

    class AnnualEvent {
        +string id
        +string title
        +AnnualEventType type
        +number month
        +number day
        +boolean lunarDate
        +string note
        +number reminderDays
        +string createdAt
    }

    class Memo {
        +string id
        +string content
        +Level sourceLevel
        +string sourcePeriodId
    }

    Period "1" *-- "0..*" Item : todos
    Period "1" *-- "0..*" Item : routines
    Period "1" *-- "0..*" Memo : structuredMemos
    Item "1" o-- "0..*" Item : parentId/childIds 트리
```

---

## 4. 데이터 흐름

### 4-1. 앱 초기화 흐름

앱이 시작될 때의 데이터 로딩 시퀀스입니다.
`layout.tsx`가 `CloudInitializer`를 래핑하고, `CloudInitializer`는 `initializeFromCloud()`를 호출하여 Supabase에서 데이터를 가져온 뒤 Zustand 스토어에 주입합니다.
데이터 로딩이 완료될 때까지 로딩 스피너가 표시됩니다.

```mermaid
sequenceDiagram
    participant 브라우저
    participant Layout as layout.tsx
    participant CI as CloudInitializer
    participant Store as usePlanStore
    participant Sync as sync.ts
    participant SB as Supabase

    브라우저->>Layout: 페이지 접속
    Layout->>CI: children을 CloudInitializer로 래핑
    CI->>CI: useState(isReady=false)<br/>로딩 스피너 표시

    CI->>Store: initializeFromCloud() 호출
    Store->>Sync: syncFromCloud()
    Sync->>SB: isSupabaseConfigured() 확인

    alt Supabase 설정됨
        Sync->>SB: Promise.all([<br/>  loadPeriodsFromCloud(),<br/>  loadRecordsFromCloud(),<br/>  loadAnnualEventsFromCloud()<br/>])
        SB-->>Sync: { periods, records, annualEvents }
        Sync-->>Store: 클라우드 데이터 반환
        Store->>Store: usePlanStore.setState({<br/>  periods, records, annualEvents<br/>})
    else Supabase 미설정
        Sync-->>Store: null 반환
        Store->>Store: 로컬 빈 상태 유지
    end

    Store-->>CI: initializeFromCloud() 완료
    CI->>CI: setIsReady(true)
    CI->>브라우저: children 렌더링 (앱 UI)
```

### 4-2. 사용자 액션 -> 자동 동기화 흐름

사용자가 할일 추가, 완료 토글 등 액션을 수행하면 Zustand 스토어가 업데이트되고,
모듈 레벨 구독자가 변경을 감지하여 2초 디바운스 후 Supabase에 자동 업로드합니다.

```mermaid
sequenceDiagram
    participant 사용자
    participant UI as FractalView
    participant Store as usePlanStore
    participant Sub as 모듈 레벨 구독자<br/>(subscribe)
    participant Sync as autoSyncToCloud()
    participant SB as Supabase

    사용자->>UI: 할일 추가 / 완료 토글 / 드래그앤드롭
    UI->>Store: addItem() / toggleComplete() / assignToSlot()
    Store->>Store: set({ periods, allItems, ... })

    Store-->>UI: 상태 변경 알림 -> UI 리렌더

    Store-->>Sub: subscribe() 콜백 트리거
    Sub->>Sub: 변경 감지<br/>(periods !== prevState.periods)

    Sub->>Sync: autoSyncToCloud(periods, records, annualEvents)
    Sync->>Sync: clearTimeout(이전 타이머)
    Sync->>Sync: setTimeout(2000ms)

    Note over Sync,SB: 2초 디바운스 대기

    Sync->>SB: syncToCloud()
    loop 각 Period에 대해
        Sync->>SB: supabase.from('periods').upsert({<br/>  id, level, goal, motto,<br/>  todos, routines, slots,<br/>  time_slots, updated_at<br/>})
    end
    loop 각 Record에 대해
        Sync->>SB: supabase.from('records').upsert({...})
    end
    loop 각 AnnualEvent에 대해
        Sync->>SB: supabase.from('annual_events').upsert({...})
    end
    SB-->>Sync: 성공
    Sync->>Sync: notifySyncStatus('success')
```

---

## 5. 상태 관리 아키텍처

`usePlanStore`는 Zustand로 구현된 메인 스토어로, 2100줄 이상의 코드를 포함합니다.
상태 슬라이스(state slices)와 액션 그룹을 아래 다이어그램으로 분류합니다.
스토어는 localStorage에 persist되지 않고 Supabase 동기화에 의존하며,
모듈 레벨 `subscribe()`로 변경 감지 후 자동 클라우드 동기화를 수행합니다.

```mermaid
graph TB
    subgraph 상태슬라이스["상태 슬라이스 (State)"]
        S1["currentLevel: Level<br/>(현재 계층)"]
        S2["currentPeriodId: string<br/>(현재 기간 ID)"]
        S3["baseYear: number<br/>(30년 기준 연도)"]
        S4["periods: Record&lt;string, Period&gt;<br/>(모든 기간 데이터)"]
        S5["allItems: Record&lt;string, Item&gt;<br/>(전체 아이템 인덱스)"]
        S6["records: Record&lt;string, DailyRecord&gt;<br/>(일일 기록)"]
        S7["viewMode: 'plan' | 'record'<br/>(뷰 모드)"]
        S8["annualEvents: AnnualEvent[]<br/>(연간 기념일)"]
    end

    subgraph 네비게이션["네비게이션 액션"]
        N1["navigateTo(periodId)"]
        N2["drillDown(childPeriodId)"]
        N3["drillUp()"]
        N4["setBaseYear(year)"]
        N5["setViewMode(mode)"]
    end

    subgraph 항목CRUD["항목 CRUD 액션"]
        C1["addItem(content, to, targetCount?, category?)"]
        C2["deleteItem(itemId, from, slotId?)"]
        C3["updateItemContent(itemId, content, location)"]
        C4["updateItemColor(itemId, color, location)"]
        C5["updateItemNote(itemId, note, location)"]
        C6["updateItemCategory / updateTodoCategory"]
        C7["toggleComplete(itemId, location, slotId?)"]
    end

    subgraph 슬롯배정["슬롯 배정 액션 (핵심)"]
        A1["assignToSlot(itemId, from, targetSlotId)<br/>하위 기간 그리드에 배정"]
        A2["assignToTimeSlot(itemId, from, timeSlot)<br/>DAY 시간대 슬롯 배정"]
        A3["moveSlotItem(itemId, fromSlotId, toSlotId)<br/>슬롯 간 이동"]
        A4["moveTimeSlotItem(itemId, from, to)<br/>시간대 슬롯 간 이동"]
    end

    subgraph 트리관리["트리 구조 관리"]
        T1["addSubItem(parentId, content, location)<br/>하위 항목 추가"]
        T2["toggleExpand(itemId, location)<br/>접기/펼치기"]
        T3["getProgress(itemId)<br/>달성률 계산"]
    end

    subgraph 기간관리["기간 관리"]
        P1["ensurePeriod(periodId)<br/>기간 확보 (없으면 생성)"]
        P2["updatePeriodHeader(field, value)"]
        P3["addMemo / removeMemo"]
        P4["getInheritedMemos(periodId)<br/>상위 메모 수집"]
        P5["resetRoutinesIfNeeded(periodId)<br/>루틴 자동 리셋"]
    end

    subgraph 기록관리["기록 관리 액션"]
        R1["getRecord / updateRecordContent"]
        R2["updateRecordMood"]
        R3["addHighlight / removeHighlight"]
        R4["addGratitude / removeGratitude"]
    end

    subgraph 이벤트관리["기념일 관리 액션"]
        E1["addAnnualEvent / updateAnnualEvent"]
        E2["deleteAnnualEvent"]
        E3["getUpcomingEvents(days)"]
    end

    subgraph 동기화["클라우드 동기화"]
        SYNC1["initializeFromCloud()<br/>앱 시작 시 Supabase 로드"]
        SYNC2["모듈 레벨 subscribe()<br/>상태 변경 감지"]
        SYNC3["autoSyncToCloud()<br/>2초 디바운스 업로드"]
    end

    상태슬라이스 --> 네비게이션
    상태슬라이스 --> 항목CRUD
    상태슬라이스 --> 슬롯배정
    상태슬라이스 --> 트리관리
    상태슬라이스 --> 기간관리
    상태슬라이스 --> 기록관리
    상태슬라이스 --> 이벤트관리
    상태슬라이스 --> 동기화

    style 상태슬라이스 fill:#dcfce7,stroke:#22c55e,stroke-width:2px
    style 슬롯배정 fill:#fef3c7,stroke:#f59e0b,stroke-width:2px
    style 동기화 fill:#dbeafe,stroke:#3b82f6,stroke-width:2px
```

---

## 6. 드래그앤드롭 흐름

FractalView의 3컬럼 레이아웃에서 드래그앤드롭이 어떻게 동작하는지 보여줍니다.
좌측 패널(할일)과 우측 패널(루틴)에서 아이템을 중앙의 하위 기간 그리드 셀이나 시간대 슬롯으로 드래그합니다.
`assignToSlot`은 아이템을 슬롯에 배정하면서 하위 기간에도 전파(propagation)하는 핵심 로직입니다.

```mermaid
graph TB
    subgraph 좌측패널["좌측 패널 (할일)"]
        TC1["개인 할일"]
        TC2["업무 할일"]
        TC3["기타 할일"]
    end

    subgraph 중앙그리드["중앙 (하위 기간 그리드)"]
        SLOT1["하위 기간 슬롯 1"]
        SLOT2["하위 기간 슬롯 2"]
        SLOT3["하위 기간 슬롯 N"]
    end

    subgraph 중앙시간대["중앙 (DAY 시간대 슬롯)"]
        TS1["오전1 (6~9시)"]
        TS2["오전2 (9~12시)"]
        TS3["오후1 (12~15시)"]
        TSN["... (8개 슬롯)"]
    end

    subgraph 우측패널["우측 패널 (루틴)"]
        RC1["업무/학습"]
        RC2["건강/운동"]
        RC3["관계/소통"]
        RC4["재정/생활"]
        RC5["성장/취미"]
        RC6["미분류"]
    end

    TC1 -->|"드래그"| SLOT1
    TC2 -->|"드래그"| SLOT2
    RC2 -->|"드래그"| TS1
    RC1 -->|"드래그"| SLOT3

    SLOT1 -->|"클릭 시 drillDown()"| 하위기간이동["하위 기간으로 이동"]

    style 좌측패널 fill:#dbeafe,stroke:#3b82f6,stroke-width:2px
    style 중앙그리드 fill:#fef3c7,stroke:#f59e0b,stroke-width:2px
    style 중앙시간대 fill:#f3e8ff,stroke:#a855f7,stroke-width:2px
    style 우측패널 fill:#dcfce7,stroke:#22c55e,stroke-width:2px
```

### assignToSlot 전파 상세 흐름

`assignToSlot`이 호출되면 단순히 슬롯에 아이템을 추가하는 것이 아니라,
하위 기간의 할일 목록에도 전파(propagation)합니다. 이로써 상위 계획이 하위 실행 단위까지 연결됩니다.

```mermaid
sequenceDiagram
    participant 사용자
    participant DnD as @dnd-kit DndContext
    participant Store as usePlanStore
    participant 현재기간 as 현재 Period
    participant 하위기간 as 하위 Period

    사용자->>DnD: 할일을 슬롯으로 드래그
    DnD->>Store: assignToSlot(itemId, 'todo', targetSlotId)

    Store->>현재기간: 원본 아이템 찾기<br/>(period.todos에서)

    Store->>Store: 새 아이템 생성<br/>{id: genId(), parentId: 원본.id,<br/>sourceLevel, sourceType}
    Store->>현재기간: 원본의 childIds에 새 아이템 추가
    Store->>현재기간: slots[targetSlotId]에 새 아이템 추가

    Note over Store,하위기간: 전파 (Propagation)

    Store->>하위기간: ensurePeriod(targetSlotId)
    Store->>Store: 전파용 아이템 생성<br/>{id: genId(), parentId: 슬롯아이템.id,<br/>category 복사}
    Store->>하위기간: todos[]에 전파 아이템 추가

    Store->>Store: allItems 업데이트<br/>(원본, 슬롯아이템, 전파아이템)

    Note over 사용자,하위기간: 결과: 원본 -> 슬롯아이템 -> 전파아이템<br/>(3단계 부모-자식 체인)
```

### toggleComplete 연쇄 업데이트

완료 토글은 단순하지 않습니다. 자식 항목들을 재귀적으로 같은 상태로 변경하고,
부모 체인의 달성률을 재계산합니다. 모든 기간에 걸쳐 동기화됩니다.

```mermaid
graph TD
    Toggle["toggleComplete(itemId)"] --> ToggleItem["대상 아이템 상태 반전"]
    ToggleItem --> Children["자식들 재귀 업데이트<br/>(같은 완료 상태로)"]
    Children --> Parent["부모 체인 업데이트<br/>(달성률 재계산)"]
    Parent --> AllPeriods["모든 기간에서<br/>해당 ID의 아이템 동기화"]
    AllPeriods --> SyncTodos["todos 동기화"]
    AllPeriods --> SyncRoutines["routines 동기화"]
    AllPeriods --> SyncSlots["slots 동기화"]
    AllPeriods --> SyncTimeSlots["timeSlots 동기화"]

    style Toggle fill:#fef3c7,stroke:#f59e0b,stroke-width:2px
    style AllPeriods fill:#dbeafe,stroke:#3b82f6,stroke-width:2px
```

---

## 7. 클라우드 동기화 흐름

Supabase를 이용한 클라우드 동기화의 전체 사이클입니다.
동기화는 두 가지 경로로 이루어집니다:
1) 앱 시작 시 `initializeFromCloud` -> `syncFromCloud`으로 클라우드 데이터를 로드하고 LWW(Last-Write-Wins) 병합
2) 상태 변경 시 모듈 레벨 `subscribe`가 감지하여 `autoSyncToCloud` (2초 디바운스)로 업로드

### Supabase 테이블 구조

```mermaid
erDiagram
    periods {
        text id PK "Period ID (30y, 5y-0, y-2025, ...)"
        text level "THIRTY_YEAR | FIVE_YEAR | ... | DAY"
        text goal "기간 목표"
        text motto "기간 다짐"
        text memo "메모 (deprecated)"
        jsonb memos "문자열 배열 (deprecated)"
        jsonb structured_memos "Memo 객체 배열"
        jsonb todos "Item 배열"
        jsonb routines "Item 배열"
        jsonb slots "Record<string, Item[]>"
        jsonb time_slots "Record<TimeSlot, Item[]>"
        timestamptz updated_at "마지막 수정 시각"
    }

    records {
        text id PK "Record ID"
        text period_id "연결된 기간 ID"
        text content "마크다운 기록 내용"
        text mood "great|good|okay|bad|terrible"
        jsonb highlights "하이라이트 배열"
        jsonb gratitude "감사 배열"
        timestamptz created_at
        timestamptz updated_at
    }

    annual_events {
        text id PK "이벤트 ID"
        text name "이벤트 제목"
        text type "birthday|anniversary|memorial|holiday|other"
        integer month "월 (1-12)"
        integer day "일 (1-31)"
        boolean is_lunar "음력 여부"
        text note "메모"
        timestamptz created_at
    }

    settings {
        text key PK "설정 키"
        text value "설정 값"
    }
```

### 동기화 상태 머신

`sync.ts`의 동기화 상태(SyncStatus)는 4개의 상태를 순환합니다.
리스너 패턴으로 UI에 실시간으로 동기화 상태를 알립니다.

```mermaid
stateDiagram-v2
    [*] --> idle : 앱 시작

    idle --> syncing : syncToCloud() 또는\nsyncFromCloud() 호출
    syncing --> success : 동기화 성공
    syncing --> error : 동기화 실패

    success --> syncing : 다음 동기화 트리거
    error --> syncing : 재시도

    success --> idle : 대기
    error --> idle : 대기

    note right of syncing
        notifySyncStatus() 호출
        syncStatusListeners에 알림
    end note

    note right of success
        lastSyncTime 갱신
        toLocaleTimeString('ko-KR')
    end note
```

### initSyncFromCloud LWW 병합 전략

앱 시작 시 로컬과 클라우드 데이터가 모두 존재할 때의 병합 전략입니다.
LWW(Last-Write-Wins) 원칙을 따르되, Period와 Record는 로컬 우선, AnnualEvent는 클라우드 우선입니다.

```mermaid
flowchart TD
    Start["initSyncFromCloud() 시작"] --> CheckConfig{"Supabase<br/>설정됨?"}

    CheckConfig -->|"아니오"| LocalOnly["로컬 스토리지만 사용<br/>null 반환"]

    CheckConfig -->|"예"| FetchCloud["syncFromCloud()<br/>클라우드 데이터 로드"]

    FetchCloud --> CheckCloud{"클라우드 데이터<br/>존재?"}

    CheckCloud -->|"없음"| UploadLocal["로컬 데이터를<br/>클라우드에 업로드<br/>syncToCloud()"]

    CheckCloud -->|"있음"| MergePeriods["Period 병합<br/>기본: 로컬 유지<br/>로컬에 없는 클라우드 데이터만 추가"]

    MergePeriods --> MergeRecords["Record 병합<br/>기본: 로컬 유지<br/>로컬에 없는 클라우드 데이터만 추가"]

    MergeRecords --> MergeEvents["AnnualEvent 병합<br/>클라우드 > 0이면 클라우드 우선<br/>아니면 로컬 사용"]

    MergeEvents --> Return["병합 결과 반환<br/>{periods, records, annualEvents}"]

    style Start fill:#dbeafe,stroke:#3b82f6,stroke-width:2px
    style MergePeriods fill:#dcfce7,stroke:#22c55e
    style MergeRecords fill:#dcfce7,stroke:#22c55e
    style MergeEvents fill:#fef3c7,stroke:#f59e0b
    style Return fill:#f3e8ff,stroke:#a855f7,stroke-width:2px
```

### 자동 동기화 구독 메커니즘 상세

스토어의 모듈 레벨 `subscribe`가 어떻게 변경을 감지하고 동기화를 트리거하는지 보여줍니다.
이 구독은 브라우저 환경(`typeof window !== 'undefined'`)에서만 활성화됩니다.

```mermaid
flowchart TD
    StoreChange["Zustand set() 호출<br/>(상태 변경)"]

    StoreChange --> Subscribe["usePlanStore.subscribe() 콜백"]

    Subscribe --> FirstCall{"prevState<br/>== null?"}
    FirstCall -->|"예 (초기)"| SavePrev["prevState에 현재 상태 저장<br/>(초기 로드 스킵)"]
    FirstCall -->|"아니오"| DetectChange{"변경 감지"}

    DetectChange --> CheckP{"periods<br/>!== prevState.periods"}
    DetectChange --> CheckR{"records<br/>!== prevState.records"}
    DetectChange --> CheckE{"annualEvents<br/>!== prevState.annualEvents"}

    CheckP --> AnyChange{"하나라도<br/>변경?"}
    CheckR --> AnyChange
    CheckE --> AnyChange

    AnyChange -->|"예"| DynImport["dynamic import('../lib/sync')"]
    DynImport --> AutoSync["autoSyncToCloud(<br/>  periods, records, annualEvents<br/>)"]
    AutoSync --> ClearTimer["clearTimeout(이전 타이머)"]
    ClearTimer --> SetTimer["setTimeout(2000ms)"]
    SetTimer --> Upload["syncToCloud() 실행"]

    AnyChange -->|"아니오"| NoOp["동기화 스킵"]

    style StoreChange fill:#fef3c7,stroke:#f59e0b,stroke-width:2px
    style Upload fill:#dbeafe,stroke:#3b82f6,stroke-width:2px
    style SetTimer fill:#dcfce7,stroke:#22c55e
```

---

## 부록: 카테고리 시스템

### 할일 카테고리 (TodoCategory)

| 카테고리 | 라벨 | 색상 |
|---------|------|------|
| `personal` | 개인 | amber |
| `work` | 업무 | violet |
| `other` | 기타 | slate |

### 루틴 카테고리 (Category)

| 카테고리 | 라벨 | 색상 |
|---------|------|------|
| `work` | 업무/학습 | blue |
| `health` | 건강/운동 | green |
| `relationship` | 관계/소통 | rose |
| `finance` | 재정/생활 | amber |
| `growth` | 성장/취미 | purple |
| `uncategorized` | 미분류 | gray |

### 기분 (Mood)

| 값 | 라벨 | 이모지 |
|---|------|--------|
| `great` | 최고 | :grinning_squinting_face: |
| `good` | 좋음 | :smiling_face_with_smiling_eyes: |
| `okay` | 보통 | :neutral_face: |
| `bad` | 별로 | :pensive_face: |
| `terrible` | 최악 | :crying_face: |

### 기념일 유형 (AnnualEventType)

| 값 | 라벨 | 이모지 |
|---|------|--------|
| `birthday` | 생일 | :birthday_cake: |
| `anniversary` | 기념일 | :couple_with_heart: |
| `memorial` | 기일 | :candle: |
| `holiday` | 공휴일 | :party_popper: |
| `other` | 기타 | :calendar: |
