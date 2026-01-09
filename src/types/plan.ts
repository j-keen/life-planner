// 7단계 계층
export type Level =
  | 'THIRTY_YEAR'  // 30년
  | 'FIVE_YEAR'    // 5년
  | 'YEAR'         // 1년
  | 'QUARTER'      // 분기
  | 'MONTH'        // 월
  | 'WEEK'         // 주
  | 'DAY';         // 일

// 일 뷰 시간대 슬롯 (8칸, 3시간 단위)
export type TimeSlot =
  | 'morning_early'    // 오전 6-9시
  | 'morning_late'     // 오전 9-12시
  | 'afternoon_early'  // 오후 12-15시
  | 'afternoon_late'   // 오후 15-18시
  | 'evening_early'    // 저녁 18-21시
  | 'evening_late'     // 저녁 21-24시
  | 'anytime'          // 시간무관
  | 'dawn';            // 새벽 0-3시

// 시간대 설정 (4열 x 2행 배치)
export const TIME_SLOTS: TimeSlot[] = [
  // 1행: 오전① 오후① 저녁① 시간무관
  'morning_early',
  'afternoon_early',
  'evening_early',
  'anytime',
  // 2행: 오전② 오후② 저녁② 새벽(야근)
  'morning_late',
  'afternoon_late',
  'evening_late',
  'dawn',
];

export const TIME_SLOT_CONFIG: Record<TimeSlot, {
  label: string;
  timeRange: string;
}> = {
  morning_early: { label: '오전①', timeRange: '6:00 ~ 9:00' },
  morning_late: { label: '오전②', timeRange: '9:00 ~ 12:00' },
  afternoon_early: { label: '오후①', timeRange: '12:00 ~ 15:00' },
  afternoon_late: { label: '오후②', timeRange: '15:00 ~ 18:00' },
  evening_early: { label: '저녁①', timeRange: '18:00 ~ 21:00' },
  evening_late: { label: '저녁②', timeRange: '21:00 ~ 24:00' },
  anytime: { label: '시간무관', timeRange: '' },
  dawn: { label: '새벽(야근)', timeRange: '0:00 ~ 6:00' },
};

// ═══════════════════════════════════════════════════════════════
// 카테고리 (5대 영역 + 미분류)
// ═══════════════════════════════════════════════════════════════
export type Category =
  | 'work'        // 업무/학습
  | 'health'      // 건강/운동
  | 'relationship'// 관계/소통
  | 'finance'     // 재정/생활
  | 'growth'      // 성장/취미
  | 'uncategorized'; // 미분류

export const CATEGORIES: Category[] = [
  'work',
  'health',
  'relationship',
  'finance',
  'growth',
  'uncategorized',
];

export const CATEGORY_CONFIG: Record<Category, {
  label: string;
  icon: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  dotColor: string;
}> = {
  work: {
    label: '업무/학습',
    icon: '💼',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
    dotColor: 'bg-blue-500',
  },
  health: {
    label: '건강/운동',
    icon: '💪',
    bgColor: 'bg-green-50',
    textColor: 'text-green-700',
    borderColor: 'border-green-200',
    dotColor: 'bg-green-500',
  },
  relationship: {
    label: '관계/소통',
    icon: '👥',
    bgColor: 'bg-rose-50',
    textColor: 'text-rose-700',
    borderColor: 'border-rose-200',
    dotColor: 'bg-rose-500',
  },
  finance: {
    label: '재정/생활',
    icon: '💰',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200',
    dotColor: 'bg-amber-500',
  },
  growth: {
    label: '성장/취미',
    icon: '🌱',
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-200',
    dotColor: 'bg-purple-500',
  },
  uncategorized: {
    label: '미분류',
    icon: '📌',
    bgColor: 'bg-gray-50',
    textColor: 'text-gray-600',
    borderColor: 'border-gray-200',
    dotColor: 'bg-gray-400',
  },
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
  category?: Category;  // 5대 카테고리

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

  // 상세 메모 (더블클릭으로 입력)
  note?: string;
}

// 메모 항목 (출처 레벨 포함)
export interface Memo {
  id: string;
  content: string;
  sourceLevel: Level;      // 어느 레벨에서 작성되었는지
  sourcePeriodId: string;  // 원본 기간 ID
}

// 각 기간의 데이터
export interface Period {
  id: string;
  level: Level;

  // 헤더
  goal: string;
  motto: string;
  memo: string;     // deprecated: 하위호환용
  memos: string[];  // deprecated: 하위호환용 (기존 string 배열)
  structuredMemos: Memo[];  // 새로운 구조화된 메모 배열

  // 패널
  todos: Item[];        // 좌측 - 할일 목록
  routines: Item[];     // 우측 - 루틴 목록

  // 그리드 (하위 기간에 배정된 항목들)
  // key: 하위 기간의 ID
  slots: Record<string, Item[]>;

  // 시간대 슬롯 (일 뷰 전용)
  timeSlots?: Record<TimeSlot, Item[]>;
}

// ═══════════════════════════════════════════════════════════════
// 기록 (Record) - 일지/회고
// ═══════════════════════════════════════════════════════════════
export type Mood = 'great' | 'good' | 'okay' | 'bad' | 'terrible';

export const MOOD_CONFIG: Record<Mood, {
  label: string;
  emoji: string;
  color: string;
}> = {
  great: { label: '최고', emoji: '😆', color: 'text-yellow-500' },
  good: { label: '좋음', emoji: '😊', color: 'text-green-500' },
  okay: { label: '보통', emoji: '😐', color: 'text-gray-500' },
  bad: { label: '별로', emoji: '😔', color: 'text-blue-500' },
  terrible: { label: '최악', emoji: '😢', color: 'text-purple-500' },
};

export const MOODS: Mood[] = ['great', 'good', 'okay', 'bad', 'terrible'];

export interface DailyRecord {
  id: string;
  periodId: string;        // 연결된 기간 ID (d-2025-01-05 등)
  content: string;         // 마크다운 기록 내용
  mood?: Mood;             // 오늘의 기분
  highlights: string[];    // 하이라이트/성취
  gratitude: string[];     // 감사한 것들
  createdAt: string;       // ISO date string
  updatedAt: string;       // ISO date string
}

// ═══════════════════════════════════════════════════════════════
// 연간 기념일/이벤트
// ═══════════════════════════════════════════════════════════════
export type AnnualEventType = 'birthday' | 'anniversary' | 'memorial' | 'holiday' | 'other';

export const ANNUAL_EVENT_TYPE_CONFIG: Record<AnnualEventType, {
  label: string;
  icon: string;
  color: string;
}> = {
  birthday: { label: '생일', icon: '🎂', color: 'bg-pink-100 text-pink-700 border-pink-300' },
  anniversary: { label: '기념일', icon: '💑', color: 'bg-red-100 text-red-700 border-red-300' },
  memorial: { label: '기일', icon: '🕯️', color: 'bg-gray-100 text-gray-700 border-gray-300' },
  holiday: { label: '공휴일', icon: '🎉', color: 'bg-amber-100 text-amber-700 border-amber-300' },
  other: { label: '기타', icon: '📅', color: 'bg-blue-100 text-blue-700 border-blue-300' },
};

export const ANNUAL_EVENT_TYPES: AnnualEventType[] = ['birthday', 'anniversary', 'memorial', 'holiday', 'other'];

export interface AnnualEvent {
  id: string;
  title: string;              // 이벤트 제목 (예: "엄마 생신", "결혼기념일")
  type: AnnualEventType;      // 이벤트 유형
  month: number;              // 월 (1-12)
  day: number;                // 일 (1-31)
  lunarDate?: boolean;        // 음력 여부
  note?: string;              // 메모
  reminderDays?: number;      // 며칠 전 알림 (0: 당일만)
  createdAt: string;          // ISO date string
}

// 전역 상태
export interface AppState {
  currentLevel: Level;
  currentPeriodId: string;
  baseYear: number;  // 30세 기준 연도
  periods: Record<string, Period>;
  // 모든 항목을 ID로 조회 (달성률 계산용)
  allItems: Record<string, Item>;
  // 기록 데이터
  records: Record<string, DailyRecord>;
  // 현재 뷰 모드
  viewMode: 'plan' | 'record';
  // 연간 기념일 목록
  annualEvents: AnnualEvent[];
}
