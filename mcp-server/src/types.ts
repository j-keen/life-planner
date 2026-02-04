// 7단계 계층
export type Level =
  | 'THIRTY_YEAR'
  | 'FIVE_YEAR'
  | 'YEAR'
  | 'QUARTER'
  | 'MONTH'
  | 'WEEK'
  | 'DAY';

// 일 뷰 시간대 슬롯
export type TimeSlot =
  | 'morning_early'
  | 'morning_late'
  | 'afternoon_early'
  | 'afternoon_late'
  | 'evening_early'
  | 'evening_late'
  | 'anytime'
  | 'dawn';

export const TIME_SLOTS: TimeSlot[] = [
  'morning_early', 'afternoon_early', 'evening_early', 'anytime',
  'morning_late', 'afternoon_late', 'evening_late', 'dawn',
];

export const TIME_SLOT_CONFIG: Record<TimeSlot, { label: string; timeRange: string }> = {
  morning_early: { label: '오전①', timeRange: '6:00 ~ 9:00' },
  morning_late: { label: '오전②', timeRange: '9:00 ~ 12:00' },
  afternoon_early: { label: '오후①', timeRange: '12:00 ~ 15:00' },
  afternoon_late: { label: '오후②', timeRange: '15:00 ~ 18:00' },
  evening_early: { label: '저녁①', timeRange: '18:00 ~ 21:00' },
  evening_late: { label: '저녁②', timeRange: '21:00 ~ 24:00' },
  anytime: { label: '시간무관', timeRange: '' },
  dawn: { label: '새벽(야근)', timeRange: '0:00 ~ 6:00' },
};

export type TodoCategory = 'personal' | 'work' | 'other';

export type Category =
  | 'work'
  | 'health'
  | 'relationship'
  | 'finance'
  | 'growth'
  | 'uncategorized';

export const LEVELS: Level[] = [
  'THIRTY_YEAR', 'FIVE_YEAR', 'YEAR', 'QUARTER', 'MONTH', 'WEEK', 'DAY',
];

export const LEVEL_CONFIG: Record<Level, {
  label: string;
  childLevel: Level | null;
  getChildCount: (id: string) => number;
}> = {
  THIRTY_YEAR: { label: '30년', childLevel: 'FIVE_YEAR', getChildCount: () => 6 },
  FIVE_YEAR: { label: '5년', childLevel: 'YEAR', getChildCount: () => 5 },
  YEAR: { label: '1년', childLevel: 'QUARTER', getChildCount: () => 4 },
  QUARTER: { label: '분기', childLevel: 'MONTH', getChildCount: () => 3 },
  MONTH: { label: '월', childLevel: 'WEEK', getChildCount: () => 5 },
  WEEK: { label: '주', childLevel: 'DAY', getChildCount: () => 7 },
  DAY: { label: '일', childLevel: null, getChildCount: () => 4 },
};

export interface Item {
  id: string;
  content: string;
  isCompleted: boolean;
  color?: string;
  category?: Category;
  todoCategory?: TodoCategory;
  targetCount?: number;
  currentCount?: number;
  subContent?: string;
  parentId?: string;
  childIds?: string[];
  isExpanded?: boolean;
  originPeriodId?: string;
  sourceLevel?: Level;
  sourceType?: 'todo' | 'routine';
  lastResetDate?: string;
  note?: string;
}

export interface Memo {
  id: string;
  content: string;
  sourceLevel: Level;
  sourcePeriodId: string;
}

export interface Period {
  id: string;
  level: Level;
  goal: string;
  motto: string;
  memo: string;
  memos: string[];
  structuredMemos: Memo[];
  todos: Item[];
  routines: Item[];
  slots: Record<string, Item[]>;
  timeSlots?: Record<TimeSlot, Item[]>;
}

export type Mood = 'great' | 'good' | 'okay' | 'bad' | 'terrible';

export interface DailyRecord {
  id: string;
  periodId: string;
  content: string;
  mood?: Mood;
  highlights: string[];
  gratitude: string[];
  createdAt: string;
  updatedAt: string;
}

export type AnnualEventType = 'birthday' | 'anniversary' | 'memorial' | 'holiday' | 'other';

export interface AnnualEvent {
  id: string;
  title: string;
  type: AnnualEventType;
  month: number;
  day: number;
  lunarDate?: boolean;
  note?: string;
  reminderDays?: number;
  createdAt: string;
}
