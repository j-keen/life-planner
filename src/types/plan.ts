// 7단계 계층
export type Level =
  | 'THIRTY_YEAR'  // 30년
  | 'FIVE_YEAR'    // 5년
  | 'YEAR'         // 1년
  | 'QUARTER'      // 분기
  | 'MONTH'        // 월
  | 'WEEK'         // 주
  | 'DAY';         // 일

// 일 뷰 시간대 슬롯
export type TimeSlot = 'morning' | 'afternoon' | 'evening' | 'anytime';

// 시간대 설정
export const TIME_SLOTS: TimeSlot[] = ['morning', 'afternoon', 'evening', 'anytime'];

export const TIME_SLOT_CONFIG: Record<TimeSlot, {
  label: string;
  timeRange: string;
}> = {
  morning: { label: '오전', timeRange: '6:00 ~ 12:00' },
  afternoon: { label: '오후', timeRange: '12:00 ~ 18:00' },
  evening: { label: '저녁', timeRange: '18:00 ~ 24:00' },
  anytime: { label: '시간무관', timeRange: '' },
};

// 계층 순서 배열
export const LEVELS: Level[] = [
  'THIRTY_YEAR',
  'FIVE_YEAR',
  'YEAR',
  'QUARTER',
  'MONTH',
  'WEEK',
  'DAY',
];

// 출처 태그 접두사 (루틴/할일 공통)
export const SOURCE_TAG_PREFIX: Record<Level, string> = {
  THIRTY_YEAR: '30년',
  FIVE_YEAR: '5년',
  YEAR: '연간',
  QUARTER: '분기',
  MONTH: '월간',
  WEEK: '주간',
  DAY: '일간',
};

// 출처 태그 라벨 (하위 호환성 유지)
export const SOURCE_TAG_LABELS: Record<Level, string> = {
  THIRTY_YEAR: '30년 목표',
  FIVE_YEAR: '5년 목표',
  YEAR: '연간 루틴',
  QUARTER: '분기 루틴',
  MONTH: '월간 루틴',
  WEEK: '주간 루틴',
  DAY: '일간 루틴',
};

// 계층별 설정
export const LEVEL_CONFIG: Record<Level, {
  label: string;
  childLevel: Level | null;
  getChildCount: (id: string) => number;
}> = {
  THIRTY_YEAR: {
    label: '30년',
    childLevel: 'FIVE_YEAR',
    getChildCount: () => 6  // 6개의 5년 구간
  },
  FIVE_YEAR: {
    label: '5년',
    childLevel: 'YEAR',
    getChildCount: () => 5  // 5개 년도
  },
  YEAR: {
    label: '1년',
    childLevel: 'QUARTER',
    getChildCount: () => 4  // 4분기
  },
  QUARTER: {
    label: '분기',
    childLevel: 'MONTH',
    getChildCount: () => 3  // 3개월
  },
  MONTH: {
    label: '월',
    childLevel: 'WEEK',
    getChildCount: () => 5  // 최대 5주
  },
  WEEK: {
    label: '주',
    childLevel: 'DAY',
    getChildCount: () => 7  // 7일
  },
  DAY: {
    label: '일',
    childLevel: null,
    getChildCount: () => 4  // 4개의 시간대 슬롯
  },
};

// 색상 옵션
export const COLORS = [
  'bg-white',
  'bg-red-100',
  'bg-orange-100',
  'bg-yellow-100',
  'bg-green-100',
  'bg-blue-100',
  'bg-purple-100',
];

// 하나의 목표/할일/루틴 항목
export interface Item {
  id: string;
  content: string;
  isCompleted: boolean;
  color?: string;

  // 루틴용 (예: "운동 / 3회")
  targetCount?: number;
  currentCount?: number;

  // 세부 내용 (루틴 드래그 시 입력, 예: "운동" → "복근")
  subContent?: string;

  // 쪼개기용 (상위-하위 연결)
  parentId?: string;
  childIds?: string[];

  // 폴더 트리용
  isExpanded?: boolean;  // 접기/펼치기 상태

  // 원본 기간 ID (어디서 만들어졌는지)
  originPeriodId?: string;

  // 출처 레벨 (어느 레벨에서 왔는지)
  sourceLevel?: Level;

  // 출처 타입 (할일인지 루틴인지)
  sourceType?: 'todo' | 'routine';

  // 마지막 리셋 날짜 (자동 리셋용)
  lastResetDate?: string;  // ISO date string
}

// 각 기간의 데이터
export interface Period {
  id: string;
  level: Level;

  // 헤더
  goal: string;
  motto: string;
  memo: string;

  // 패널
  todos: Item[];        // 좌측 - 할일 목록
  routines: Item[];     // 우측 - 루틴 목록

  // 그리드 (하위 기간에 배정된 항목들)
  // key: 하위 기간의 ID
  slots: Record<string, Item[]>;

  // 시간대 슬롯 (일 뷰 전용)
  timeSlots?: Record<TimeSlot, Item[]>;
}

// 전역 상태
export interface AppState {
  currentLevel: Level;
  currentPeriodId: string;
  baseYear: number;  // 30세 기준 연도
  periods: Record<string, Period>;
  // 모든 항목을 ID로 조회 (달성률 계산용)
  allItems: Record<string, Item>;
}
