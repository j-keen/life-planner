# Life Planner - 프로젝트 컨텍스트

> 이 파일은 새 AI 세션에서 작업을 이어가기 위한 프로젝트 전체 맥락을 담고 있습니다.

---

## 1. 프로젝트 개요

**Life Planner**는 프랙탈 구조의 인생 계획 앱입니다.

### 핵심 컨셉: 7단계 계층 구조
```
30년 → 5년 → 1년 → 분기 → 월 → 주 → 일
```

### 주요 기능
- **프랙탈 뷰**: 상위 계획을 하위 기간에 드래그&드롭으로 배정
- **쪼개기**: 큰 목표를 작은 단위로 분할 (폴더 트리 구조)
- **할일/루틴 분리**: 좌측 패널(할일), 우측 패널(루틴)
- **루틴 카운트**: "운동 / 3" 형식으로 반복 횟수 지정
- **자동 리셋**: 일간/주간/월간 루틴이 주기별로 자동 초기화
- **출처 태그**: 배정된 항목에 "주간 루틴", "월간 할일" 등 뱃지 표시
- **시간대 슬롯**: 일(DAY) 뷰에서 오전/오후/저녁/시간무관 4개 슬롯

---

## 2. 기술 스택

| 분류 | 기술 | 버전 |
|------|------|------|
| 프레임워크 | Next.js (App Router) | 16.1.1 |
| 언어 | TypeScript | 5.x |
| UI | React | 19.2.3 |
| 스타일링 | Tailwind CSS | 4.x |
| 상태관리 | Zustand (persist) | 5.0.9 |
| 드래그앤드롭 | @dnd-kit/core | 6.3.1 |
| 아이콘 | lucide-react | 0.562.0 |

---

## 3. 폴더 구조

```
life-planner/
├── src/
│   ├── app/
│   │   ├── layout.tsx        # 루트 레이아웃
│   │   ├── page.tsx          # 메인 페이지 (FractalView 렌더링)
│   │   ├── globals.css       # 전역 스타일
│   │   └── routines/
│   │       └── page.tsx      # 루틴 관리 페이지
│   ├── components/
│   │   └── layout/
│   │       └── Shell.tsx     # 앱 쉘 (사이드바 + 헤더)
│   ├── store/
│   │   └── usePlanStore.ts   # Zustand 스토어 (핵심 로직)
│   ├── types/
│   │   └── plan.ts           # 타입 정의 (Level, Item, Period 등)
│   └── views/
│       └── FractalView.tsx   # 메인 뷰 컴포넌트
├── package.json
├── tsconfig.json
└── PROJECT_CONTEXT.md        # 이 파일
```

---

## 4. 핵심 데이터 구조

### Level (7단계 계층)
```typescript
type Level = 'THIRTY_YEAR' | 'FIVE_YEAR' | 'YEAR' | 'QUARTER' | 'MONTH' | 'WEEK' | 'DAY';
```

### Item (할일/루틴 항목)
```typescript
interface Item {
  id: string;
  content: string;
  isCompleted: boolean;
  color?: string;

  // 루틴 카운트
  targetCount?: number;    // 목표 횟수 (예: 3)
  currentCount?: number;   // 남은 횟수

  // 트리 구조 (쪼개기)
  parentId?: string;       // 부모 항목 ID
  childIds?: string[];     // 자식 항목 ID 배열
  isExpanded?: boolean;    // 펼침/접힘 상태

  // 출처 추적
  sourceLevel?: Level;     // 어느 레벨에서 왔는지
  sourceType?: 'todo' | 'routine';
  originPeriodId?: string;

  // 자동 리셋
  lastResetDate?: string;
}
```

### Period (기간 데이터)
```typescript
interface Period {
  id: string;              // 예: "y-2025", "m-2025-01"
  level: Level;
  goal: string;            // 목표
  motto: string;           // 다짐
  memo: string;            // 메모
  todos: Item[];           // 좌측 패널 - 할일
  routines: Item[];        // 우측 패널 - 루틴
  slots: Record<string, Item[]>;  // 중앙 그리드 셀들
  timeSlots?: Record<TimeSlot, Item[]>;  // DAY 전용 시간대
}
```

### Period ID 체계
```
30년:    "30y"
5년:     "5y-0" ~ "5y-5"
연도:    "y-2025"
분기:    "q-2025-1" ~ "q-2025-4"
월:      "m-2025-01" ~ "m-2025-12"
주:      "w-2025-01" ~ "w-2025-53"
일:      "d-2025-01-15"
```

---

## 5. 완료된 작업

### Phase 1-5 (이전 세션)
- [x] 기본 프랙탈 뷰 구현
- [x] 7단계 계층 네비게이션
- [x] 할일/루틴 패널
- [x] 드래그&드롭으로 슬롯 배정
- [x] 루틴 카운트 기능
- [x] 자동 리셋 기능
- [x] 출처 태그 표시
- [x] 루틴 관리 페이지 (`/routines`)

### Phase 6 (현재 세션)
- [x] **쪼개기 기능 개선**: 폴더 트리 구조로 변경
  - `+` 버튼으로 하위 항목 추가
  - `▼/▶` 버튼으로 접기/펼치기
  - 들여쓰기로 계층 표시
- [x] **루틴 뱃지 수정**: "일간 루틴", "주간 할일" 형식으로 표시
- [x] **전체 드래그**: 아이템 전체 영역 드래그 가능
- [x] **진행률 동기화**: 하위 항목 체크 시 부모 진행률 업데이트
- [x] **연쇄 삭제**: 부모 삭제 시 자식들도 함께 삭제

---

## 6. 진행 중인 작업

현재 진행 중인 작업 없음.

---

## 7. 남은 작업 (TODO)

### 우선순위 높음
- [ ] 루틴 관리 페이지 개선: 계층 구조 시각화
- [ ] 데이터 백업/복원 기능
- [ ] 다크 모드

### 우선순위 중간
- [ ] 통계/대시보드 페이지
- [ ] 알림/리마인더
- [ ] 검색 기능
- [ ] 필터링 (완료/미완료, 색상별)

### 우선순위 낮음
- [ ] 모바일 반응형 최적화
- [ ] PWA 지원
- [ ] 클라우드 동기화 (Firebase 등)
- [ ] 다국어 지원

---

## 8. 환경변수 및 API 키

현재 외부 API 사용 없음. 모든 데이터는 LocalStorage에 저장됨.

```
저장소 키: 'life-planner-storage'
```

---

## 9. 실행 방법

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 빌드
npm run build

# 프로덕션 실행
npm start
```

기본 URL: `http://localhost:3000`

---

## 10. 알려진 이슈

### 해결됨
- ~~하위 항목 체크 시 부모 진행률 미반영~~ → `allItems` 구독으로 해결
- ~~삭제 시 연관 항목 미삭제~~ → 연쇄 삭제 구현

### 미해결
1. **Hydration 경고**: 서버/클라이언트 렌더링 불일치 (기능에는 영향 없음)
2. **루틴 관리 페이지**: 루틴 간 계층 관계가 명확하지 않음

---

## 11. 주요 파일 설명

### `src/store/usePlanStore.ts`
**핵심 상태 관리 파일**. 주요 함수:
- `navigateTo(periodId)`: 기간 이동
- `drillDown/drillUp`: 계층 이동
- `addItem(content, to, targetCount?)`: 할일/루틴 추가
- `deleteItem(itemId, from, slotId?)`: 삭제 (연쇄 삭제 포함)
- `assignToSlot(itemId, from, targetSlotId)`: 슬롯에 배정
- `assignToTimeSlot(itemId, from, timeSlot)`: 시간대 슬롯 배정 (DAY 전용)
- `addSubItem(parentId, content, location)`: 하위 항목 추가 (쪼개기)
- `toggleExpand(itemId, location)`: 접기/펼치기
- `toggleComplete(itemId, location, slotId?)`: 완료 토글
- `getProgress(itemId)`: 진행률 계산
- `resetRoutinesIfNeeded(periodId)`: 루틴 자동 리셋

### `src/views/FractalView.tsx`
**메인 UI 컴포넌트**. 포함 요소:
- `DraggableItem`: 드래그 가능한 할일/루틴 항목 (트리 구조 지원)
- `GridCell`: 중앙 그리드 셀 (하위 기간 슬롯)
- `TimeSlotCell`: 시간대 슬롯 (DAY 전용)
- `AddItemInput`: 항목 추가 입력 필드
- `ColorMenu`: 색상 선택 메뉴
- `EditableText`: 인라인 편집 컴포넌트

### `src/types/plan.ts`
**타입 정의**. 주요 타입:
- `Level`: 7단계 계층
- `TimeSlot`: 시간대 (morning/afternoon/evening/anytime)
- `Item`: 할일/루틴 항목
- `Period`: 기간 데이터
- `LEVEL_CONFIG`: 계층별 설정
- `SOURCE_TAG_PREFIX`: 출처 태그 라벨

---

## 12. 작업 이어가기 체크리스트

새 세션 시작 시:
1. 이 파일(`PROJECT_CONTEXT.md`)을 AI에게 보여주기
2. `npm run dev`로 개발 서버 실행
3. 브라우저에서 `http://localhost:3000` 확인
4. 필요한 파일 읽기 요청

**예시 프롬프트:**
```
PROJECT_CONTEXT.md 파일을 읽어줘. 그리고 이어서 [작업 내용] 해줘.
```

---

## 13. 코드 컨벤션

- **컴포넌트**: PascalCase (`FractalView`, `DraggableItem`)
- **함수/변수**: camelCase (`addItem`, `currentLevel`)
- **상수**: UPPER_SNAKE_CASE (`LEVEL_CONFIG`, `TIME_SLOTS`)
- **타입**: PascalCase (`Level`, `Item`, `Period`)
- **파일명**: 컴포넌트는 PascalCase, 나머지는 camelCase

---

*마지막 업데이트: 2025-12-31*
