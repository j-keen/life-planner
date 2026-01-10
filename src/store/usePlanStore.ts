import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Level, Item, Period, LEVEL_CONFIG, LEVELS, TimeSlot, TIME_SLOTS, Category, TodoCategory, DailyRecord, Mood, AnnualEvent, AnnualEventType, Memo } from '../types/plan';

// ═══════════════════════════════════════════════════════════════
// 유틸리티 함수들
// ═══════════════════════════════════════════════════════════════

// 고유 ID 생성
const genId = () => Math.random().toString(36).substr(2, 9);

// 빈 기간 생성
const createEmptyPeriod = (id: string, level: Level): Period => {
  const base: Period = {
    id,
    level,
    goal: '',
    motto: '',
    memo: '',
    memos: [],  // deprecated: 하위호환용
    structuredMemos: [],  // 새로운 구조화된 메모 배열
    todos: [],
    routines: [],
    slots: {},
  };

  // DAY 레벨은 timeSlots 초기화 (8칸)
  if (level === 'DAY') {
    base.timeSlots = {
      dawn: [],
      morning_early: [],
      morning_late: [],
      afternoon_early: [],
      afternoon_late: [],
      evening_early: [],
      evening_late: [],
      anytime: [],
    };
  }

  return base;
};

// ═══════════════════════════════════════════════════════════════
// 주간 헬퍼 함수 (ISO 주차, 월요일 시작)
// ═══════════════════════════════════════════════════════════════

// 특정 날짜의 ISO 주차 계산
export const getISOWeek = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // 일요일=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // 목요일 기준
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

// ISO 주차의 연도 (1월 초가 전년도 52/53주, 12월 말이 다음해 1주일 수 있음)
export const getISOWeekYear = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // 목요일 기준
  return d.getUTCFullYear();
};

// 특정 연도의 특정 ISO 주차의 월요일 날짜 계산
const getMondayOfWeek = (year: number, week: number): Date => {
  // 1월 4일은 항상 첫 번째 ISO 주에 포함됨
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7; // 일요일=7
  // 첫 번째 주의 월요일
  const firstMonday = new Date(jan4);
  firstMonday.setDate(jan4.getDate() - jan4Day + 1);
  // 원하는 주의 월요일
  const targetMonday = new Date(firstMonday);
  targetMonday.setDate(firstMonday.getDate() + (week - 1) * 7);
  return targetMonday;
};

// 특정 날짜가 속한 주의 월요일 계산
const getMondayOfDate = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay() || 7; // 일요일=7
  d.setDate(d.getDate() - day + 1); // 월요일로 이동
  return d;
};

// ═══════════════════════════════════════════════════════════════
// ID 체계 (실제 날짜 기반)
// ═══════════════════════════════════════════════════════════════
// THIRTY_YEAR: "30y"
// FIVE_YEAR:   "5y-0" ~ "5y-5" (0번째~5번째 5년 구간)
// YEAR:        "y-2025"
// QUARTER:     "q-2025-1" ~ "q-2025-4"
// MONTH:       "m-2025-01" ~ "m-2025-12"
// WEEK:        "w-2025-01" ~ "w-2025-53" (ISO 주차)
// DAY:         "d-2025-01-01"

export const getPeriodId = (level: Level, baseYear: number, params?: {
  fiveYearIndex?: number;  // 0-5
  year?: number;
  quarter?: number;  // 1-4
  month?: number;    // 1-12
  week?: number;     // 1-53
  day?: number;      // 1-31
}): string => {
  const p = params || {};
  const year = p.year || baseYear;

  switch (level) {
    case 'THIRTY_YEAR':
      return '30y';
    case 'FIVE_YEAR':
      return `5y-${p.fiveYearIndex ?? 0}`;
    case 'YEAR':
      return `y-${year}`;
    case 'QUARTER':
      return `q-${year}-${p.quarter ?? 1}`;
    case 'MONTH':
      return `m-${year}-${String(p.month ?? 1).padStart(2, '0')}`;
    case 'WEEK':
      return `w-${year}-${String(p.week ?? 1).padStart(2, '0')}`;
    case 'DAY':
      return `d-${year}-${String(p.month ?? 1).padStart(2, '0')}-${String(p.day ?? 1).padStart(2, '0')}`;
    default:
      return '30y';
  }
};

// ID에서 정보 파싱
export const parsePeriodId = (id: string): {
  level: Level;
  fiveYearIndex?: number;
  year?: number;
  quarter?: number;
  month?: number;
  week?: number;
  day?: number;
} => {
  if (id === '30y') return { level: 'THIRTY_YEAR' };

  const parts = id.split('-');
  const prefix = parts[0];

  switch (prefix) {
    case '5y':
      return { level: 'FIVE_YEAR', fiveYearIndex: parseInt(parts[1]) };
    case 'y':
      return { level: 'YEAR', year: parseInt(parts[1]) };
    case 'q':
      return { level: 'QUARTER', year: parseInt(parts[1]), quarter: parseInt(parts[2]) };
    case 'm':
      return { level: 'MONTH', year: parseInt(parts[1]), month: parseInt(parts[2]) };
    case 'w':
      return { level: 'WEEK', year: parseInt(parts[1]), week: parseInt(parts[2]) };
    case 'd':
      return { level: 'DAY', year: parseInt(parts[1]), month: parseInt(parts[2]), day: parseInt(parts[3]) };
    default:
      return { level: 'THIRTY_YEAR' };
  }
};

// 하위 기간 ID들 생성
export const getChildPeriodIds = (parentId: string, baseYear: number): string[] => {
  const parsed = parsePeriodId(parentId);
  const { level } = parsed;
  const childLevel = LEVEL_CONFIG[level].childLevel;
  if (!childLevel) return [];

  const ids: string[] = [];

  switch (level) {
    case 'THIRTY_YEAR':
      // 6개의 5년 구간
      for (let i = 0; i < 6; i++) {
        ids.push(getPeriodId('FIVE_YEAR', baseYear, { fiveYearIndex: i }));
      }
      break;

    case 'FIVE_YEAR': {
      // 5개 년도 (fiveYearIndex를 0-5로 제한)
      const validIndex = Math.max(0, Math.min(5, parsed.fiveYearIndex || 0));
      const startYear = baseYear + validIndex * 5;
      for (let i = 0; i < 5; i++) {
        ids.push(getPeriodId('YEAR', baseYear, { year: startYear + i }));
      }
      break;
    }

    case 'YEAR':
      // 4분기
      for (let q = 1; q <= 4; q++) {
        ids.push(getPeriodId('QUARTER', baseYear, { year: parsed.year, quarter: q }));
      }
      break;

    case 'QUARTER':
      // 3개월
      const startMonth = ((parsed.quarter || 1) - 1) * 3 + 1;
      for (let i = 0; i < 3; i++) {
        ids.push(getPeriodId('MONTH', baseYear, { year: parsed.year, month: startMonth + i }));
      }
      break;

    case 'MONTH':
      // 5주 (간단하게)
      for (let w = 1; w <= 5; w++) {
        const weekNum = ((parsed.month || 1) - 1) * 4 + w;
        ids.push(getPeriodId('WEEK', baseYear, { year: parsed.year, week: weekNum }));
      }
      break;

    case 'WEEK':
      // 7일 (월요일 ~ 일요일)
      const monday = getMondayOfWeek(parsed.year || baseYear, parsed.week || 1);
      for (let d = 0; d < 7; d++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + d);
        ids.push(getPeriodId('DAY', baseYear, {
          year: date.getFullYear(),
          month: date.getMonth() + 1,
          day: date.getDate()
        }));
      }
      break;
  }

  return ids;
};

// 슬롯 라벨 생성 (각 레벨별 상세 날짜 정보 포함)
export const getSlotLabel = (childId: string, baseYear: number): string => {
  const parsed = parsePeriodId(childId);

  switch (parsed.level) {
    case 'FIVE_YEAR': {
      // fiveYearIndex를 0-5로 제한
      const validIndex = Math.max(0, Math.min(5, parsed.fiveYearIndex || 0));
      const startYear = baseYear + validIndex * 5;
      const endYear = startYear + 4;
      return `${startYear}~${endYear}년`;
    }
    case 'YEAR':
      return `${parsed.year}년`;
    case 'QUARTER': {
      // Q1 (1~3월) 형식으로 상세 표시
      const q = parsed.quarter || 1;
      const startMonth = (q - 1) * 3 + 1;
      const endMonth = startMonth + 2;
      return `Q${q} (${startMonth}~${endMonth}월)`;
    }
    case 'MONTH':
      // 연도와 함께 표시: "2026년 1월"
      return `${parsed.year}년 ${parsed.month}월`;
    case 'WEEK':
      return `${parsed.week}주차`;
    case 'DAY': {
      // "1월 6일 (월)" 형식으로 더 읽기 쉽게
      const date = new Date(parsed.year!, parsed.month! - 1, parsed.day);
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      return `${parsed.month}월 ${parsed.day}일 (${days[date.getDay()]})`;
    }
    default:
      return childId;
  }
};

// 간단한 슬롯 라벨 (공간이 좁을 때 사용)
export const getSlotLabelShort = (childId: string, baseYear: number): string => {
  const parsed = parsePeriodId(childId);

  switch (parsed.level) {
    case 'FIVE_YEAR': {
      const validIndex = Math.max(0, Math.min(5, parsed.fiveYearIndex || 0));
      const startYear = baseYear + validIndex * 5;
      return `${startYear}~`;
    }
    case 'YEAR':
      return `${parsed.year}`;
    case 'QUARTER':
      return `Q${parsed.quarter}`;
    case 'MONTH':
      return `${parsed.month}월`;
    case 'WEEK':
      return `${parsed.week}주`;
    case 'DAY': {
      const date = new Date(parsed.year!, parsed.month! - 1, parsed.day);
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      return `${parsed.day}(${days[date.getDay()]})`;
    }
    default:
      return childId;
  }
};

// 시간대 슬롯 ID 생성 (일 뷰 전용)
export const getTimeSlotId = (periodId: string, timeSlot: TimeSlot): string => {
  return `ts-${periodId}-${timeSlot}`;
};

// 시간대 슬롯 ID 파싱
export const parseTimeSlotId = (slotId: string): { periodId: string; timeSlot: TimeSlot } | null => {
  if (!slotId.startsWith('ts-')) return null;
  const parts = slotId.split('-');
  // ts-d-2025-01-06-morning -> periodId: d-2025-01-06, timeSlot: morning
  const timeSlot = parts[parts.length - 1] as TimeSlot;
  const periodId = parts.slice(1, -1).join('-');
  return { periodId, timeSlot };
};

// 리셋 키 생성 (같은 키면 같은 리셋 주기)
export const getResetKey = (periodId: string, sourceLevel: Level): string => {
  const parsed = parsePeriodId(periodId);

  // 출처 레벨에 따라 리셋 주기 결정
  switch (sourceLevel) {
    case 'DAY':
      // 일간 루틴: 날짜가 바뀌면 리셋
      if (parsed.level === 'DAY') {
        return `day-${parsed.year}-${parsed.month}-${parsed.day}`;
      }
      return periodId;

    case 'WEEK':
      // 주간 루틴: 주가 바뀌면 리셋
      if (parsed.level === 'DAY') {
        // 일에서 주차 계산
        const date = new Date(parsed.year!, parsed.month! - 1, parsed.day);
        const startOfYear = new Date(parsed.year!, 0, 1);
        const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
        const weekNum = Math.ceil((days + 1) / 7);
        return `week-${parsed.year}-${weekNum}`;
      }
      return `week-${parsed.year}-${parsed.week}`;

    case 'MONTH':
      // 월간 루틴: 월이 바뀌면 리셋
      if (parsed.level === 'DAY') {
        return `month-${parsed.year}-${parsed.month}`;
      }
      if (parsed.level === 'WEEK') {
        const month = Math.ceil(parsed.week! / 4);
        return `month-${parsed.year}-${month}`;
      }
      return `month-${parsed.year}-${parsed.month}`;

    case 'QUARTER':
      // 분기 루틴: 분기가 바뀌면 리셋
      if (parsed.level === 'MONTH') {
        const quarter = Math.ceil(parsed.month! / 3);
        return `quarter-${parsed.year}-${quarter}`;
      }
      return `quarter-${parsed.year}-${parsed.quarter}`;

    case 'YEAR':
      // 연간 루틴: 연도가 바뀌면 리셋
      return `year-${parsed.year}`;

    case 'FIVE_YEAR':
      // 5년 루틴: 5년 구간이 바뀌면 리셋
      return `5year-${parsed.fiveYearIndex}`;

    default:
      // 기본값: 기간 ID 자체
      return periodId;
  }
};

// 이전/다음 기간 ID 찾기
export const getAdjacentPeriodId = (
  currentId: string,
  direction: 'prev' | 'next',
  baseYear: number
): string | null => {
  const parsed = parsePeriodId(currentId);
  const delta = direction === 'next' ? 1 : -1;

  switch (parsed.level) {
    case 'THIRTY_YEAR':
      // 30년은 이동 없음
      return null;

    case 'FIVE_YEAR': {
      const newIndex = (parsed.fiveYearIndex || 0) + delta;
      if (newIndex < 0 || newIndex > 5) return null;
      return getPeriodId('FIVE_YEAR', baseYear, { fiveYearIndex: newIndex });
    }

    case 'YEAR': {
      const newYear = (parsed.year || baseYear) + delta;
      return getPeriodId('YEAR', baseYear, { year: newYear });
    }

    case 'QUARTER': {
      let newQuarter = (parsed.quarter || 1) + delta;
      let newYear = parsed.year || baseYear;
      if (newQuarter < 1) {
        newQuarter = 4;
        newYear--;
      } else if (newQuarter > 4) {
        newQuarter = 1;
        newYear++;
      }
      return getPeriodId('QUARTER', baseYear, { year: newYear, quarter: newQuarter });
    }

    case 'MONTH': {
      let newMonth = (parsed.month || 1) + delta;
      let newYear = parsed.year || baseYear;
      if (newMonth < 1) {
        newMonth = 12;
        newYear--;
      } else if (newMonth > 12) {
        newMonth = 1;
        newYear++;
      }
      return getPeriodId('MONTH', baseYear, { year: newYear, month: newMonth });
    }

    case 'WEEK': {
      let newWeek = (parsed.week || 1) + delta;
      let newYear = parsed.year || baseYear;
      if (newWeek < 1) {
        newWeek = 52;
        newYear--;
      } else if (newWeek > 52) {
        newWeek = 1;
        newYear++;
      }
      return getPeriodId('WEEK', baseYear, { year: newYear, week: newWeek });
    }

    case 'DAY': {
      const currentDate = new Date(parsed.year!, parsed.month! - 1, parsed.day);
      currentDate.setDate(currentDate.getDate() + delta);
      return getPeriodId('DAY', baseYear, {
        year: currentDate.getFullYear(),
        month: currentDate.getMonth() + 1,
        day: currentDate.getDate(),
      });
    }

    default:
      return null;
  }
};

// 부모 기간 ID 찾기
export const getParentPeriodId = (childId: string, baseYear: number): string | null => {
  const parsed = parsePeriodId(childId);

  switch (parsed.level) {
    case 'THIRTY_YEAR':
      return null;
    case 'FIVE_YEAR':
      return '30y';
    case 'YEAR': {
      // fiveYearIndex를 0-5 범위로 제한 (30년 내)
      const rawIndex = Math.floor((parsed.year! - baseYear) / 5);
      const fiveYearIndex = Math.max(0, Math.min(5, rawIndex));
      return `5y-${fiveYearIndex}`;
    }
    case 'QUARTER':
      return `y-${parsed.year}`;
    case 'MONTH': {
      const quarter = Math.ceil(parsed.month! / 3);
      return `q-${parsed.year}-${quarter}`;
    }
    case 'WEEK': {
      // 주차에서 월 추정 (간단하게)
      const month = Math.ceil(parsed.week! / 4);
      return `m-${parsed.year}-${String(month).padStart(2, '0')}`;
    }
    case 'DAY': {
      // ISO 주차 계산 (월요일 시작)
      const date = new Date(parsed.year!, parsed.month! - 1, parsed.day);
      const weekNum = getISOWeek(date);
      // ISO 주차의 연도 (12월 말이 1주차일 수 있고, 1월 초가 52/53주차일 수 있음)
      const thursday = new Date(date);
      thursday.setDate(date.getDate() + 4 - (date.getDay() || 7));
      const weekYear = thursday.getFullYear();
      return `w-${weekYear}-${String(weekNum).padStart(2, '0')}`;
    }
    default:
      return null;
  }
};

// ═══════════════════════════════════════════════════════════════
// 스토어 인터페이스
// ═══════════════════════════════════════════════════════════════
interface PlanStore {
  // 상태
  currentLevel: Level;
  currentPeriodId: string;
  baseYear: number;
  periods: Record<string, Period>;
  allItems: Record<string, Item>;
  records: Record<string, DailyRecord>;
  viewMode: 'plan' | 'record';

  // 네비게이션
  setBaseYear: (year: number) => void;
  navigateTo: (periodId: string) => void;
  drillDown: (childPeriodId: string) => void;
  drillUp: () => void;

  // 뷰 모드 토글
  setViewMode: (mode: 'plan' | 'record') => void;
  toggleViewMode: () => void;

  // 기간 헤더 수정
  updatePeriodHeader: (field: 'goal' | 'motto' | 'memo', value: string) => void;
  addMemo: (text: string) => void;
  removeMemo: (index: number) => void;
  getInheritedMemos: (periodId: string) => Memo[];  // 상위 기간 메모 수집

  // 항목 CRUD
  addItem: (content: string, to: 'todo' | 'routine', targetCount?: number, category?: Category, todoCategory?: TodoCategory) => void;
  updateItemCategory: (itemId: string, category: Category | undefined, location: 'todo' | 'routine' | 'slot', slotId?: string) => void;
  deleteItem: (itemId: string, from: 'todo' | 'routine' | 'slot', slotId?: string) => void;
  updateItemContent: (itemId: string, content: string, location: 'todo' | 'routine' | 'slot', slotId?: string) => void;
  updateItemColor: (itemId: string, color: string, location: 'todo' | 'routine' | 'slot', slotId?: string) => void;
  updateItemNote: (itemId: string, note: string, location: 'todo' | 'routine' | 'slot', slotId?: string) => void;

  // 드래그 → 슬롯 배정 (핵심!)
  assignToSlot: (itemId: string, from: 'todo' | 'routine', targetSlotId: string, subContent?: string) => void;

  // 시간대 슬롯 배정 (일 뷰 전용)
  assignToTimeSlot: (itemId: string, from: 'todo' | 'routine', timeSlot: TimeSlot, subContent?: string) => void;

  // 슬롯 간 아이템 이동
  moveSlotItem: (itemId: string, fromSlotId: string, toSlotId: string) => void;

  // 시간대 슬롯 간 아이템 이동
  moveTimeSlotItem: (itemId: string, fromSlotId: string, toSlotId: string) => void;

  // 쪼개기: 하위 항목 추가
  addSubItem: (parentId: string, content: string, location: 'todo' | 'routine') => void;

  // 접기/펼치기 토글
  toggleExpand: (itemId: string, location: 'todo' | 'routine') => void;

  // 완료 토글
  toggleComplete: (itemId: string, location: 'todo' | 'routine' | 'slot', slotId?: string) => void;

  // 달성률 계산
  getProgress: (itemId: string) => number;

  // 기간 확보 (없으면 생성)
  ensurePeriod: (periodId: string) => Period;

  // 현재 기간 가져오기
  getCurrentPeriod: () => Period;

  // 루틴 자동 리셋 (새 기간 진입 시)
  resetRoutinesIfNeeded: (periodId: string) => void;

  // ═══════════════════════════════════════════════════════════════
  // 기록 (Record) 관련
  // ═══════════════════════════════════════════════════════════════
  getRecord: (periodId: string) => DailyRecord | null;
  updateRecordContent: (periodId: string, content: string) => void;
  updateRecordMood: (periodId: string, mood: Mood | undefined) => void;
  addHighlight: (periodId: string, text: string) => void;
  removeHighlight: (periodId: string, index: number) => void;
  addGratitude: (periodId: string, text: string) => void;
  removeGratitude: (periodId: string, index: number) => void;

  // ═══════════════════════════════════════════════════════════════
  // 연간 기념일 관련
  // ═══════════════════════════════════════════════════════════════
  annualEvents: AnnualEvent[];
  addAnnualEvent: (event: Omit<AnnualEvent, 'id' | 'createdAt'>) => void;
  updateAnnualEvent: (id: string, updates: Partial<Omit<AnnualEvent, 'id' | 'createdAt'>>) => void;
  deleteAnnualEvent: (id: string) => void;
  getUpcomingEvents: (days?: number) => Array<AnnualEvent & { daysUntil: number; nextDate: Date }>;
}

// ═══════════════════════════════════════════════════════════════
// 스토어 구현
// ═══════════════════════════════════════════════════════════════
const currentYear = new Date().getFullYear();
const now = new Date();
const initialWeekNum = getISOWeek(now);
const initialWeekYear = getISOWeekYear(now);

export const usePlanStore = create<PlanStore>()(
  persist(
    (set, get) => ({
      currentLevel: 'WEEK',
      currentPeriodId: `w-${initialWeekYear}-${String(initialWeekNum).padStart(2, '0')}`,
      baseYear: currentYear,
      periods: {},
      allItems: {},
      records: {},
      viewMode: 'plan' as const,
      annualEvents: [],

      setBaseYear: (year) => {
        set({ baseYear: year });
      },

      navigateTo: (periodId) => {
        const parsed = parsePeriodId(periodId);
        const state = get();

        // 기간이 없으면 생성
        if (!state.periods[periodId]) {
          set({
            periods: {
              ...state.periods,
              [periodId]: createEmptyPeriod(periodId, parsed.level),
            },
          });
        }

        set({
          currentLevel: parsed.level,
          currentPeriodId: periodId,
        });

        // 루틴 자동 리셋 체크
        get().resetRoutinesIfNeeded(periodId);
      },

      drillDown: (childPeriodId) => {
        get().navigateTo(childPeriodId);
      },

      drillUp: () => {
        const state = get();
        const parentId = getParentPeriodId(state.currentPeriodId, state.baseYear);
        if (parentId) {
          get().navigateTo(parentId);
        }
      },

      setViewMode: (mode) => {
        set({ viewMode: mode });
      },

      toggleViewMode: () => {
        const state = get();
        set({ viewMode: state.viewMode === 'plan' ? 'record' : 'plan' });
      },

      updatePeriodHeader: (field, value) => {
        const { currentPeriodId, ensurePeriod } = get();
        const period = ensurePeriod(currentPeriodId);

        // ensurePeriod 후 fresh state 사용
        const freshState = get();

        set({
          periods: {
            ...freshState.periods,
            [currentPeriodId]: { ...period, [field]: value },
          },
        });
      },

      addMemo: (text) => {
        const { currentPeriodId, currentLevel, ensurePeriod } = get();
        const period = ensurePeriod(currentPeriodId);
        const freshState = get();
        const currentMemos = period.structuredMemos || [];

        const newMemo: Memo = {
          id: genId(),
          content: text,
          sourceLevel: currentLevel,
          sourcePeriodId: currentPeriodId,
        };

        set({
          periods: {
            ...freshState.periods,
            [currentPeriodId]: {
              ...period,
              structuredMemos: [...currentMemos, newMemo],
            },
          },
        });
      },

      removeMemo: (index) => {
        const { currentPeriodId, ensurePeriod } = get();
        const period = ensurePeriod(currentPeriodId);
        const freshState = get();
        const currentMemos = period.structuredMemos || [];

        set({
          periods: {
            ...freshState.periods,
            [currentPeriodId]: {
              ...period,
              structuredMemos: currentMemos.filter((_, i) => i !== index),
            },
          },
        });
      },

      // 상위 기간 메모 수집 (현재 기간 포함)
      getInheritedMemos: (periodId: string) => {
        const state = get();
        const allMemos: Memo[] = [];
        let currentId: string | null = periodId;

        // 부모 체인을 따라 올라가며 메모 수집
        while (currentId) {
          const period = state.periods[currentId];
          if (period) {
            // 구조화된 메모 추가
            const structuredMemos = period.structuredMemos || [];
            allMemos.push(...structuredMemos);

            // 기존 string 배열 메모도 변환하여 추가 (하위호환)
            const oldMemos = period.memos || [];
            oldMemos.forEach((content, idx) => {
              // 이미 structuredMemos에 같은 내용이 있으면 스킵
              if (!structuredMemos.some(m => m.content === content)) {
                allMemos.push({
                  id: `legacy-${currentId}-${idx}`,
                  content,
                  sourceLevel: period.level,
                  sourcePeriodId: currentId!,
                });
              }
            });
          }

          // 부모 기간으로 이동
          currentId = getParentPeriodId(currentId, state.baseYear);
        }

        // 상위 레벨이 먼저 오도록 정렬 (THIRTY_YEAR → DAY 순서)
        const levelOrder: Record<Level, number> = {
          THIRTY_YEAR: 0,
          FIVE_YEAR: 1,
          YEAR: 2,
          QUARTER: 3,
          MONTH: 4,
          WEEK: 5,
          DAY: 6,
        };
        allMemos.sort((a, b) => levelOrder[a.sourceLevel] - levelOrder[b.sourceLevel]);

        return allMemos;
      },

      addItem: (content, to, targetCount, category, todoCategory) => {
        const { currentPeriodId, currentLevel, ensurePeriod } = get();
        const period = ensurePeriod(currentPeriodId);

        // ensurePeriod 후 fresh state 사용
        const freshState = get();

        // 루틴의 경우 초기 리셋 키 설정
        const initialResetKey = targetCount !== undefined
          ? getResetKey(currentPeriodId, currentLevel)
          : undefined;

        const newItem: Item = {
          id: genId(),
          content,
          isCompleted: false,
          targetCount,
          currentCount: targetCount,
          category: to === 'routine' ? category : undefined,  // 루틴만 category 사용
          todoCategory: to === 'todo' ? todoCategory : undefined,  // 할일만 todoCategory 사용
          originPeriodId: currentPeriodId,
          sourceLevel: to === 'routine' ? currentLevel : undefined,
          sourceType: to === 'routine' ? 'routine' : undefined,  // 뱃지 표시용
          lastResetDate: initialResetKey,
        };

        const updatedPeriod = { ...period };
        if (to === 'todo') {
          updatedPeriod.todos = [...period.todos, newItem];
        } else {
          updatedPeriod.routines = [...period.routines, newItem];
        }

        set({
          periods: { ...freshState.periods, [currentPeriodId]: updatedPeriod },
          allItems: { ...freshState.allItems, [newItem.id]: newItem },
        });
      },

      updateItemCategory: (itemId, category, location, slotId) => {
        const state = get();
        const period = state.periods[state.currentPeriodId];
        if (!period) return;

        const updateItem = (item: Item) =>
          item.id === itemId ? { ...item, category } : item;

        const updatedPeriod = { ...period };
        if (location === 'todo') {
          updatedPeriod.todos = period.todos.map(updateItem);
        } else if (location === 'routine') {
          updatedPeriod.routines = period.routines.map(updateItem);
        } else if (location === 'slot' && slotId) {
          if (slotId.includes('_timeslot_')) {
            // 시간대 슬롯
            const timeSlot = slotId.split('_timeslot_')[1] as TimeSlot;
            if (period.timeSlots?.[timeSlot]) {
              updatedPeriod.timeSlots = {
                ...period.timeSlots,
                [timeSlot]: period.timeSlots[timeSlot].map(updateItem),
              };
            }
          } else {
            // 일반 슬롯
            if (period.slots[slotId]) {
              updatedPeriod.slots = {
                ...period.slots,
                [slotId]: period.slots[slotId].map(updateItem),
              };
            }
          }
        }

        // allItems 업데이트
        const currentItem = state.allItems[itemId];
        const newAllItems = currentItem
          ? { ...state.allItems, [itemId]: { ...currentItem, category } }
          : state.allItems;

        set({
          periods: { ...state.periods, [state.currentPeriodId]: updatedPeriod },
          allItems: newAllItems,
        });
      },

      deleteItem: (itemId, from, slotId) => {
        const state = get();
        const period = state.periods[state.currentPeriodId];
        if (!period) return;

        // 삭제할 모든 ID 수집 (연쇄 삭제)
        const idsToDelete = new Set<string>();
        const collectChildIds = (id: string) => {
          idsToDelete.add(id);
          const item = state.allItems[id];
          if (item?.childIds) {
            item.childIds.forEach(collectChildIds);
          }
        };
        collectChildIds(itemId);

        // 모든 기간에서 관련 항목 삭제
        const updatedPeriods = { ...state.periods };

        Object.keys(updatedPeriods).forEach((periodId) => {
          const p = updatedPeriods[periodId];
          if (!p) return;

          let needsUpdate = false;
          const updatedP = { ...p };

          // todos에서 삭제
          const filteredTodos = p.todos.filter((i) => !idsToDelete.has(i.id));
          if (filteredTodos.length !== p.todos.length) {
            updatedP.todos = filteredTodos;
            needsUpdate = true;
          }

          // routines에서 삭제
          const filteredRoutines = p.routines.filter((i) => !idsToDelete.has(i.id));
          if (filteredRoutines.length !== p.routines.length) {
            updatedP.routines = filteredRoutines;
            needsUpdate = true;
          }

          // slots에서 삭제
          const updatedSlots: Record<string, Item[]> = {};
          let slotsChanged = false;
          Object.keys(p.slots).forEach((slotKey) => {
            const filtered = p.slots[slotKey].filter((i) => !idsToDelete.has(i.id));
            updatedSlots[slotKey] = filtered;
            if (filtered.length !== p.slots[slotKey].length) {
              slotsChanged = true;
            }
          });
          if (slotsChanged) {
            updatedP.slots = updatedSlots;
            needsUpdate = true;
          }

          // timeSlots에서 삭제 (일 뷰)
          if (p.timeSlots) {
            const updatedTimeSlots: Record<TimeSlot, Item[]> = {
              dawn: [],
              morning_early: [],
              morning_late: [],
              afternoon_early: [],
              afternoon_late: [],
              evening_early: [],
              evening_late: [],
              anytime: [],
            };
            let timeSlotsChanged = false;
            (Object.keys(p.timeSlots) as TimeSlot[]).forEach((ts) => {
              const filtered = (p.timeSlots![ts] || []).filter((i) => !idsToDelete.has(i.id));
              updatedTimeSlots[ts] = filtered;
              if (filtered.length !== (p.timeSlots![ts] || []).length) {
                timeSlotsChanged = true;
              }
            });
            if (timeSlotsChanged) {
              updatedP.timeSlots = updatedTimeSlots;
              needsUpdate = true;
            }
          }

          if (needsUpdate) {
            updatedPeriods[periodId] = updatedP;
          }
        });

        // allItems에서 삭제 및 부모 관계 정리
        const newAllItems = { ...state.allItems };
        const item = newAllItems[itemId];
        let parentIdToUpdate: string | null = null;

        // 부모의 childIds에서 제거
        if (item?.parentId) {
          const parent = newAllItems[item.parentId];
          if (parent?.childIds) {
            parentIdToUpdate = item.parentId;
            newAllItems[item.parentId] = {
              ...parent,
              childIds: parent.childIds.filter((id) => id !== itemId),
            };
          }
        }

        // 모든 관련 항목 삭제
        idsToDelete.forEach((id) => {
          delete newAllItems[id];
        });

        // 부모의 childIds 변경을 모든 기간에 동기화
        if (parentIdToUpdate) {
          const updatedParent = newAllItems[parentIdToUpdate];
          Object.keys(updatedPeriods).forEach((periodId) => {
            const p = updatedPeriods[periodId];
            if (!p) return;

            const updatedP = { ...p };
            let needsParentSync = false;

            // todos에서 부모 업데이트
            const parentInTodos = p.todos.findIndex((i) => i.id === parentIdToUpdate);
            if (parentInTodos !== -1) {
              updatedP.todos = p.todos.map((i) =>
                i.id === parentIdToUpdate ? { ...i, childIds: updatedParent.childIds } : i
              );
              needsParentSync = true;
            }

            // routines에서 부모 업데이트
            const parentInRoutines = p.routines.findIndex((i) => i.id === parentIdToUpdate);
            if (parentInRoutines !== -1) {
              updatedP.routines = p.routines.map((i) =>
                i.id === parentIdToUpdate ? { ...i, childIds: updatedParent.childIds } : i
              );
              needsParentSync = true;
            }

            if (needsParentSync) {
              updatedPeriods[periodId] = updatedP;
            }
          });
        }

        set({
          periods: updatedPeriods,
          allItems: newAllItems,
        });
      },

      updateItemContent: (itemId, content, location, slotId) => {
        const state = get();
        const period = state.periods[state.currentPeriodId];
        if (!period) return;

        const updater = (item: Item): Item =>
          item.id === itemId ? { ...item, content } : item;

        const updatedPeriod = { ...period };

        if (location === 'todo') {
          updatedPeriod.todos = period.todos.map(updater);
        } else if (location === 'routine') {
          updatedPeriod.routines = period.routines.map(updater);
        } else if (location === 'slot' && slotId) {
          // 시간대 슬롯 체크
          const parsedTimeSlot = parseTimeSlotId(slotId);
          if (parsedTimeSlot && period.timeSlots) {
            const { timeSlot } = parsedTimeSlot;
            updatedPeriod.timeSlots = {
              ...period.timeSlots,
              [timeSlot]: (period.timeSlots[timeSlot] || []).map(updater),
            };
          } else {
            updatedPeriod.slots = {
              ...period.slots,
              [slotId]: (period.slots[slotId] || []).map(updater),
            };
          }
        }

        // allItems도 업데이트
        const newAllItems = { ...state.allItems };
        if (newAllItems[itemId]) {
          newAllItems[itemId] = { ...newAllItems[itemId], content };
        }

        set({
          periods: { ...state.periods, [state.currentPeriodId]: updatedPeriod },
          allItems: newAllItems,
        });
      },

      updateItemColor: (itemId, color, location, slotId) => {
        const state = get();
        const period = state.periods[state.currentPeriodId];
        if (!period) return;

        const colorizer = (item: Item): Item =>
          item.id === itemId ? { ...item, color } : item;

        const updatedPeriod = { ...period };

        if (location === 'todo') {
          updatedPeriod.todos = period.todos.map(colorizer);
        } else if (location === 'routine') {
          updatedPeriod.routines = period.routines.map(colorizer);
        } else if (location === 'slot' && slotId) {
          // 시간대 슬롯 체크
          const parsedTimeSlot = parseTimeSlotId(slotId);
          if (parsedTimeSlot && period.timeSlots) {
            const { timeSlot } = parsedTimeSlot;
            updatedPeriod.timeSlots = {
              ...period.timeSlots,
              [timeSlot]: (period.timeSlots[timeSlot] || []).map(colorizer),
            };
          } else {
            updatedPeriod.slots = {
              ...period.slots,
              [slotId]: (period.slots[slotId] || []).map(colorizer),
            };
          }
        }

        set({
          periods: { ...state.periods, [state.currentPeriodId]: updatedPeriod },
        });
      },

      updateItemNote: (itemId, note, location, slotId) => {
        const state = get();
        const period = state.periods[state.currentPeriodId];
        if (!period) return;

        const updater = (item: Item): Item =>
          item.id === itemId ? { ...item, note } : item;

        const updatedPeriod = { ...period };

        if (location === 'todo') {
          updatedPeriod.todos = period.todos.map(updater);
        } else if (location === 'routine') {
          updatedPeriod.routines = period.routines.map(updater);
        } else if (location === 'slot' && slotId) {
          // 시간대 슬롯 체크
          const parsedTimeSlot = parseTimeSlotId(slotId);
          if (parsedTimeSlot && period.timeSlots) {
            const { timeSlot } = parsedTimeSlot;
            updatedPeriod.timeSlots = {
              ...period.timeSlots,
              [timeSlot]: (period.timeSlots[timeSlot] || []).map(updater),
            };
          } else {
            updatedPeriod.slots = {
              ...period.slots,
              [slotId]: (period.slots[slotId] || []).map(updater),
            };
          }
        }

        // allItems도 업데이트
        const newAllItems = { ...state.allItems };
        if (newAllItems[itemId]) {
          newAllItems[itemId] = { ...newAllItems[itemId], note };
        }

        set({
          periods: { ...state.periods, [state.currentPeriodId]: updatedPeriod },
          allItems: newAllItems,
        });
      },

      // ═══════════════════════════════════════════════════════════
      // 핵심: 슬롯 배정 (쪼개기)
      // ═══════════════════════════════════════════════════════════
      assignToSlot: (itemId, from, targetSlotId, subContent) => {
        const { currentPeriodId, currentLevel, ensurePeriod } = get();
        const period = ensurePeriod(currentPeriodId);

        // ensurePeriod 후 fresh state 사용
        const freshState = get();

        // 원본 아이템 찾기
        const sourceList = from === 'todo' ? period.todos : period.routines;
        const originalItem = sourceList.find((i) => i.id === itemId);
        if (!originalItem) return;

        // 새 아이템 생성 (부모 연결)
        // subContent가 있으면 "원본: 세부내용" 형식으로 표시
        const displayContent = subContent
          ? `${originalItem.content}: ${subContent}`
          : originalItem.content;

        const newItem: Item = {
          id: genId(),
          content: displayContent,
          isCompleted: false,
          color: originalItem.color,
          category: originalItem.category,  // 카테고리 복사
          parentId: originalItem.id,
          originPeriodId: currentPeriodId,
          subContent: subContent,
          // 출처 정보 저장
          sourceLevel: currentLevel,
          sourceType: from,
        };

        // 부모에 자식 ID 추가
        const updatedOriginal: Item = {
          ...originalItem,
          childIds: [...(originalItem.childIds || []), newItem.id],
        };

        // 기간 업데이트
        const updatedPeriod = { ...period };

        // 원본 리스트 업데이트
        if (from === 'todo') {
          updatedPeriod.todos = period.todos.map((i) =>
            i.id === itemId ? updatedOriginal : i
          );
        } else {
          // 루틴: targetCount가 있는 경우 카운트 감소 (0이 되어도 유지)
          if (originalItem.targetCount !== undefined) {
            const newCount = (originalItem.currentCount ?? originalItem.targetCount) - 1;
            const updatedRoutine: Item = {
              ...updatedOriginal,
              currentCount: Math.max(0, newCount),
            };
            // 카운트가 0이 되어도 부모는 유지 (진행률 표시용)
            updatedPeriod.routines = period.routines.map((i) =>
              i.id === itemId ? updatedRoutine : i
            );
          } else {
            // targetCount가 없으면 할일처럼 그냥 유지
            updatedPeriod.routines = period.routines.map((i) =>
              i.id === itemId ? updatedOriginal : i
            );
          }
        }

        // 슬롯에 추가
        const slotItems = period.slots[targetSlotId] || [];
        updatedPeriod.slots = {
          ...period.slots,
          [targetSlotId]: [...slotItems, newItem],
        };

        // 하위 기간에도 할일로 추가 (전파!)
        const updatedPeriods = { ...freshState.periods, [currentPeriodId]: updatedPeriod };

        // 하위 기간 확보 및 할일 추가
        const childPeriod = freshState.periods[targetSlotId] || createEmptyPeriod(targetSlotId, LEVEL_CONFIG[currentLevel].childLevel!);
        const propagatedItem: Item = {
          ...newItem,
          id: genId(), // 새 ID
          parentId: newItem.id, // 슬롯 아이템이 부모
          category: originalItem.category,  // 카테고리 복사
        };

        // 슬롯 아이템에 전파된 아이템을 자식으로 추가 (체인 연결)
        const newItemWithChild: Item = {
          ...newItem,
          childIds: [propagatedItem.id],
        };

        // 슬롯의 아이템도 업데이트
        updatedPeriod.slots = {
          ...updatedPeriod.slots,
          [targetSlotId]: updatedPeriod.slots[targetSlotId].map(item =>
            item.id === newItem.id ? newItemWithChild : item
          ),
        };
        updatedPeriods[currentPeriodId] = updatedPeriod;

        updatedPeriods[targetSlotId] = {
          ...childPeriod,
          todos: [...childPeriod.todos, propagatedItem],
        };

        set({
          periods: updatedPeriods,
          allItems: {
            ...freshState.allItems,
            [newItem.id]: newItemWithChild,  // 자식 ID 포함된 버전 저장
            [propagatedItem.id]: propagatedItem,
            [updatedOriginal.id]: updatedOriginal,
          },
        });
      },

      // ═══════════════════════════════════════════════════════════
      // 시간대 슬롯 배정 (일 뷰 전용)
      // ═══════════════════════════════════════════════════════════
      assignToTimeSlot: (itemId, from, timeSlot, subContent) => {
        const { currentPeriodId, currentLevel, ensurePeriod } = get();

        // DAY 레벨에서만 작동
        if (currentLevel !== 'DAY') return;

        const period = ensurePeriod(currentPeriodId);
        const freshState = get();

        // 원본 아이템 찾기
        const sourceList = from === 'todo' ? period.todos : period.routines;
        const originalItem = sourceList.find((i) => i.id === itemId);
        if (!originalItem) return;

        // subContent가 있으면 "원본: 세부내용" 형식으로 표시
        const displayContent = subContent
          ? `${originalItem.content}: ${subContent}`
          : originalItem.content;

        // 시간대 슬롯용 새 아이템 생성
        const newItem: Item = {
          id: genId(),
          content: displayContent,
          isCompleted: false,
          color: originalItem.color,
          category: originalItem.category,  // 카테고리 복사
          subContent: subContent,
          // 출처 정보 (원본의 출처 유지 또는 현재 레벨)
          sourceLevel: originalItem.sourceLevel || currentLevel,
          sourceType: originalItem.sourceType || from,
          parentId: originalItem.id,
          originPeriodId: currentPeriodId,
        };

        // 부모에 자식 ID 추가
        const updatedOriginal: Item = {
          ...originalItem,
          childIds: [...(originalItem.childIds || []), newItem.id],
        };

        // 기간 업데이트
        const updatedPeriod = { ...period };

        // timeSlots 초기화 (없을 경우)
        if (!updatedPeriod.timeSlots) {
          updatedPeriod.timeSlots = {
            dawn: [],
            morning_early: [],
            morning_late: [],
            afternoon_early: [],
            afternoon_late: [],
            evening_early: [],
            evening_late: [],
            anytime: [],
          };
        }

        // 원본 리스트 업데이트
        if (from === 'todo') {
          updatedPeriod.todos = period.todos.map((i) =>
            i.id === itemId ? updatedOriginal : i
          );
        } else {
          // 루틴: targetCount가 있는 경우 카운트 감소 (0이 되어도 유지)
          if (originalItem.targetCount !== undefined) {
            const newCount = (originalItem.currentCount ?? originalItem.targetCount) - 1;
            const updatedRoutine: Item = {
              ...updatedOriginal,
              currentCount: Math.max(0, newCount),
            };
            // 카운트가 0이 되어도 부모는 유지 (진행률 표시용)
            updatedPeriod.routines = period.routines.map((i) =>
              i.id === itemId ? updatedRoutine : i
            );
          } else {
            updatedPeriod.routines = period.routines.map((i) =>
              i.id === itemId ? updatedOriginal : i
            );
          }
        }

        // 시간대 슬롯에 추가
        const slotItems = updatedPeriod.timeSlots[timeSlot] || [];
        updatedPeriod.timeSlots = {
          ...updatedPeriod.timeSlots,
          [timeSlot]: [...slotItems, newItem],
        };

        set({
          periods: { ...freshState.periods, [currentPeriodId]: updatedPeriod },
          allItems: {
            ...freshState.allItems,
            [newItem.id]: newItem,
            [updatedOriginal.id]: updatedOriginal,
          },
        });
      },

      // ═══════════════════════════════════════════════════════════
      // 슬롯 간 아이템 이동
      // ═══════════════════════════════════════════════════════════
      moveSlotItem: (itemId, fromSlotId, toSlotId) => {
        const { currentPeriodId, ensurePeriod } = get();
        const period = ensurePeriod(currentPeriodId);
        const freshState = get();

        // 동일 슬롯이면 무시
        if (fromSlotId === toSlotId) return;

        // 원본 슬롯에서 아이템 찾기
        const fromItems = period.slots[fromSlotId] || [];
        const itemToMove = fromItems.find((i) => i.id === itemId);
        if (!itemToMove) return;

        // 원본 슬롯에서 제거
        const updatedFromItems = fromItems.filter((i) => i.id !== itemId);

        // 대상 슬롯에 추가
        const toItems = period.slots[toSlotId] || [];
        const updatedToItems = [...toItems, itemToMove];

        // 기간 업데이트
        const updatedPeriod = {
          ...period,
          slots: {
            ...period.slots,
            [fromSlotId]: updatedFromItems,
            [toSlotId]: updatedToItems,
          },
        };

        set({
          periods: { ...freshState.periods, [currentPeriodId]: updatedPeriod },
        });
      },

      // ═══════════════════════════════════════════════════════════
      // 시간대 슬롯 간 아이템 이동
      // ═══════════════════════════════════════════════════════════
      moveTimeSlotItem: (itemId, fromSlotId, toSlotId) => {
        const { currentPeriodId, ensurePeriod, currentLevel } = get();

        // DAY 레벨에서만 작동
        if (currentLevel !== 'DAY') return;

        const period = ensurePeriod(currentPeriodId);
        const freshState = get();

        // 동일 슬롯이면 무시
        if (fromSlotId === toSlotId) return;

        // 시간대 슬롯 ID에서 TimeSlot 추출 (ts-d-2025-01-10-morning_early -> morning_early)
        const fromParts = fromSlotId.split('-');
        const fromTimeSlot = fromParts[fromParts.length - 1] as TimeSlot;
        const toParts = toSlotId.split('-');
        const toTimeSlot = toParts[toParts.length - 1] as TimeSlot;

        if (!period.timeSlots) return;

        // 원본 슬롯에서 아이템 찾기
        const fromItems = period.timeSlots[fromTimeSlot] || [];
        const itemToMove = fromItems.find((i) => i.id === itemId);
        if (!itemToMove) return;

        // 원본 슬롯에서 제거
        const updatedFromItems = fromItems.filter((i) => i.id !== itemId);

        // 대상 슬롯에 추가
        const toItems = period.timeSlots[toTimeSlot] || [];
        const updatedToItems = [...toItems, itemToMove];

        // 기간 업데이트
        const updatedPeriod = {
          ...period,
          timeSlots: {
            ...period.timeSlots,
            [fromTimeSlot]: updatedFromItems,
            [toTimeSlot]: updatedToItems,
          },
        };

        set({
          periods: { ...freshState.periods, [currentPeriodId]: updatedPeriod },
        });
      },

      // ═══════════════════════════════════════════════════════════
      // 쪼개기: 하위 항목 추가
      // ═══════════════════════════════════════════════════════════
      addSubItem: (parentId, content, location) => {
        const state = get();
        const { currentPeriodId, currentLevel } = state;
        const period = state.periods[currentPeriodId];
        if (!period) return;

        const sourceList = location === 'todo' ? period.todos : period.routines;
        const parentItem = sourceList.find((i) => i.id === parentId);
        if (!parentItem) return;

        // 새 하위 항목 생성 (부모의 카테고리 상속)
        const newItem: Item = {
          id: genId(),
          content,
          isCompleted: false,
          color: parentItem.color,
          category: parentItem.category, // 부모 카테고리 상속
          parentId: parentId,
          originPeriodId: currentPeriodId,
          sourceLevel: currentLevel,
          sourceType: location === 'routine' ? 'routine' : 'todo',
        };

        // 부모 아이템 업데이트 (childIds에 추가, 펼치기)
        const updatedParent: Item = {
          ...parentItem,
          childIds: [...(parentItem.childIds || []), newItem.id],
          isExpanded: true,
        };

        // 리스트 업데이트
        const updatedPeriod = { ...period };
        if (location === 'todo') {
          // 부모 업데이트 + 새 항목 추가 (부모 바로 뒤에)
          const parentIndex = period.todos.findIndex((i) => i.id === parentId);
          const newTodos = [...period.todos];
          newTodos[parentIndex] = updatedParent;
          // 부모의 마지막 자식 뒤에 삽입
          let insertIndex = parentIndex + 1;
          for (let i = parentIndex + 1; i < newTodos.length; i++) {
            if (newTodos[i].parentId === parentId) {
              insertIndex = i + 1;
            } else if (!newTodos[i].parentId || newTodos[i].parentId !== parentId) {
              break;
            }
          }
          newTodos.splice(insertIndex, 0, newItem);
          updatedPeriod.todos = newTodos;
        } else {
          const parentIndex = period.routines.findIndex((i) => i.id === parentId);
          const newRoutines = [...period.routines];
          newRoutines[parentIndex] = updatedParent;
          let insertIndex = parentIndex + 1;
          for (let i = parentIndex + 1; i < newRoutines.length; i++) {
            if (newRoutines[i].parentId === parentId) {
              insertIndex = i + 1;
            } else if (!newRoutines[i].parentId || newRoutines[i].parentId !== parentId) {
              break;
            }
          }
          newRoutines.splice(insertIndex, 0, newItem);
          updatedPeriod.routines = newRoutines;
        }

        set({
          periods: { ...state.periods, [currentPeriodId]: updatedPeriod },
          allItems: {
            ...state.allItems,
            [newItem.id]: newItem,
            [updatedParent.id]: updatedParent,
          },
        });
      },

      // ═══════════════════════════════════════════════════════════
      // 접기/펼치기 토글
      // ═══════════════════════════════════════════════════════════
      toggleExpand: (itemId, location) => {
        const state = get();
        const period = state.periods[state.currentPeriodId];
        if (!period) return;

        const toggler = (item: Item): Item =>
          item.id === itemId ? { ...item, isExpanded: !item.isExpanded } : item;

        const updatedPeriod = { ...period };
        if (location === 'todo') {
          updatedPeriod.todos = period.todos.map(toggler);
        } else {
          updatedPeriod.routines = period.routines.map(toggler);
        }

        set({
          periods: { ...state.periods, [state.currentPeriodId]: updatedPeriod },
        });
      },

      toggleComplete: (itemId, location, slotId) => {
        const state = get();
        const period = state.periods[state.currentPeriodId];
        if (!period) return;

        // allItems 먼저 업데이트
        const newAllItems = { ...state.allItems };
        const targetItem = newAllItems[itemId];
        if (!targetItem) return;

        const newCompletedState = !targetItem.isCompleted;
        newAllItems[itemId] = { ...targetItem, isCompleted: newCompletedState };

        // 자식들도 같은 상태로 변경 (하위 전파)
        const updateChildrenRecursive = (parentId: string, completed: boolean) => {
          const parent = newAllItems[parentId];
          if (!parent?.childIds) return;

          parent.childIds.forEach((childId) => {
            const child = newAllItems[childId];
            if (child) {
              newAllItems[childId] = { ...child, isCompleted: completed };
              // 재귀적으로 손자들도 업데이트
              updateChildrenRecursive(childId, completed);
            }
          });
        };
        updateChildrenRecursive(itemId, newCompletedState);

        // 부모 체인 업데이트 (자식 완료 시 부모 진행률 체크)
        const updateParentChain = (childId: string) => {
          const child = newAllItems[childId];
          if (!child?.parentId) return;

          const parent = newAllItems[child.parentId];
          if (!parent?.childIds || parent.childIds.length === 0) return;

          // 부모의 진행률 계산
          const completedCount = parent.childIds.filter(
            (cid) => newAllItems[cid]?.isCompleted
          ).length;
          const progress = Math.round((completedCount / parent.childIds.length) * 100);

          // 100%면 부모도 완료, 아니면 미완료
          const shouldBeCompleted = progress === 100;
          if (parent.isCompleted !== shouldBeCompleted) {
            newAllItems[parent.id] = { ...parent, isCompleted: shouldBeCompleted };
            // 재귀적으로 상위 부모도 업데이트
            updateParentChain(parent.id);
          }
        };
        updateParentChain(itemId);

        // 모든 기간에서 해당 항목 업데이트
        const updatedPeriods = { ...state.periods };

        Object.keys(updatedPeriods).forEach((periodId) => {
          const p = updatedPeriods[periodId];
          if (!p) return;

          let needsUpdate = false;
          const updatedP = { ...p };

          // 업데이트 함수: allItems의 상태를 반영
          const syncFromAllItems = (item: Item): Item => {
            const latest = newAllItems[item.id];
            if (latest && latest.isCompleted !== item.isCompleted) {
              return { ...item, isCompleted: latest.isCompleted };
            }
            return item;
          };

          // todos 동기화
          const syncedTodos = p.todos.map(syncFromAllItems);
          if (JSON.stringify(syncedTodos) !== JSON.stringify(p.todos)) {
            updatedP.todos = syncedTodos;
            needsUpdate = true;
          }

          // routines 동기화
          const syncedRoutines = p.routines.map(syncFromAllItems);
          if (JSON.stringify(syncedRoutines) !== JSON.stringify(p.routines)) {
            updatedP.routines = syncedRoutines;
            needsUpdate = true;
          }

          // slots 동기화
          const syncedSlots: Record<string, Item[]> = {};
          let slotsChanged = false;
          Object.keys(p.slots).forEach((slotKey) => {
            const syncedSlot = p.slots[slotKey].map(syncFromAllItems);
            syncedSlots[slotKey] = syncedSlot;
            if (JSON.stringify(syncedSlot) !== JSON.stringify(p.slots[slotKey])) {
              slotsChanged = true;
            }
          });
          if (slotsChanged) {
            updatedP.slots = syncedSlots;
            needsUpdate = true;
          }

          // timeSlots 동기화
          if (p.timeSlots) {
            const syncedTimeSlots: Record<TimeSlot, Item[]> = {
              dawn: [],
              morning_early: [],
              morning_late: [],
              afternoon_early: [],
              afternoon_late: [],
              evening_early: [],
              evening_late: [],
              anytime: [],
            };
            let timeSlotsChanged = false;
            (Object.keys(p.timeSlots) as TimeSlot[]).forEach((ts) => {
              const syncedSlot = (p.timeSlots![ts] || []).map(syncFromAllItems);
              syncedTimeSlots[ts] = syncedSlot;
              if (JSON.stringify(syncedSlot) !== JSON.stringify(p.timeSlots![ts])) {
                timeSlotsChanged = true;
              }
            });
            if (timeSlotsChanged) {
              updatedP.timeSlots = syncedTimeSlots;
              needsUpdate = true;
            }
          }

          if (needsUpdate) {
            updatedPeriods[periodId] = updatedP;
          }
        });

        set({
          periods: updatedPeriods,
          allItems: newAllItems,
        });
      },

      getProgress: (itemId) => {
        const state = get();
        const item = state.allItems[itemId];

        if (!item) return 0;
        if (!item.childIds || item.childIds.length === 0) {
          return item.isCompleted ? 100 : 0;
        }

        const completedCount = item.childIds.filter(
          (cid) => state.allItems[cid]?.isCompleted
        ).length;

        return Math.round((completedCount / item.childIds.length) * 100);
      },

      ensurePeriod: (periodId) => {
        const state = get();
        if (state.periods[periodId]) {
          return state.periods[periodId];
        }

        const parsed = parsePeriodId(periodId);
        const newPeriod = createEmptyPeriod(periodId, parsed.level);

        set({
          periods: { ...state.periods, [periodId]: newPeriod },
        });

        return newPeriod;
      },

      getCurrentPeriod: () => {
        const state = get();
        return state.ensurePeriod(state.currentPeriodId);
      },

      // ═══════════════════════════════════════════════════════════
      // 루틴 자동 리셋
      // ═══════════════════════════════════════════════════════════
      resetRoutinesIfNeeded: (periodId: string) => {
        const state = get();
        const period = state.periods[periodId];
        if (!period) return;

        let needsUpdate = false;
        const updatedRoutines = period.routines.map((routine) => {
          // 리셋 대상이 아닌 경우 (targetCount 없음)
          if (routine.targetCount === undefined) return routine;

          // 출처 레벨 확인
          const sourceLevel = routine.sourceLevel || routine.originPeriodId
            ? parsePeriodId(routine.originPeriodId || periodId).level
            : period.level;

          // 현재 리셋 키 계산
          const currentResetKey = getResetKey(periodId, sourceLevel);

          // 이전 리셋 키와 비교
          if (routine.lastResetDate === currentResetKey) {
            // 같은 리셋 주기면 리셋하지 않음
            return routine;
          }

          // 리셋 필요!
          needsUpdate = true;
          return {
            ...routine,
            currentCount: routine.targetCount,
            lastResetDate: currentResetKey,
          };
        });

        if (needsUpdate) {
          set({
            periods: {
              ...state.periods,
              [periodId]: {
                ...period,
                routines: updatedRoutines,
              },
            },
          });
        }
      },

      // ═══════════════════════════════════════════════════════════
      // 기록 (Record) 관련 액션
      // ═══════════════════════════════════════════════════════════
      getRecord: (periodId: string) => {
        const state = get();
        return state.records[periodId] || null;
      },

      updateRecordContent: (periodId: string, content: string) => {
        const state = get();
        const now = new Date().toISOString();
        const existing = state.records[periodId];

        const updated: DailyRecord = existing
          ? { ...existing, content, updatedAt: now }
          : {
              id: genId(),
              periodId,
              content,
              highlights: [],
              gratitude: [],
              createdAt: now,
              updatedAt: now,
            };

        set({
          records: { ...state.records, [periodId]: updated },
        });
      },

      updateRecordMood: (periodId: string, mood: Mood | undefined) => {
        const state = get();
        const now = new Date().toISOString();
        const existing = state.records[periodId];

        const updated: DailyRecord = existing
          ? { ...existing, mood, updatedAt: now }
          : {
              id: genId(),
              periodId,
              content: '',
              mood,
              highlights: [],
              gratitude: [],
              createdAt: now,
              updatedAt: now,
            };

        set({
          records: { ...state.records, [periodId]: updated },
        });
      },

      addHighlight: (periodId: string, text: string) => {
        const state = get();
        const now = new Date().toISOString();
        const existing = state.records[periodId];

        const updated: DailyRecord = existing
          ? { ...existing, highlights: [...existing.highlights, text], updatedAt: now }
          : {
              id: genId(),
              periodId,
              content: '',
              highlights: [text],
              gratitude: [],
              createdAt: now,
              updatedAt: now,
            };

        set({
          records: { ...state.records, [periodId]: updated },
        });
      },

      removeHighlight: (periodId: string, index: number) => {
        const state = get();
        const existing = state.records[periodId];
        if (!existing) return;

        const newHighlights = [...existing.highlights];
        newHighlights.splice(index, 1);

        set({
          records: {
            ...state.records,
            [periodId]: {
              ...existing,
              highlights: newHighlights,
              updatedAt: new Date().toISOString(),
            },
          },
        });
      },

      addGratitude: (periodId: string, text: string) => {
        const state = get();
        const now = new Date().toISOString();
        const existing = state.records[periodId];

        const updated: DailyRecord = existing
          ? { ...existing, gratitude: [...existing.gratitude, text], updatedAt: now }
          : {
              id: genId(),
              periodId,
              content: '',
              highlights: [],
              gratitude: [text],
              createdAt: now,
              updatedAt: now,
            };

        set({
          records: { ...state.records, [periodId]: updated },
        });
      },

      removeGratitude: (periodId: string, index: number) => {
        const state = get();
        const existing = state.records[periodId];
        if (!existing) return;

        const newGratitude = [...existing.gratitude];
        newGratitude.splice(index, 1);

        set({
          records: {
            ...state.records,
            [periodId]: {
              ...existing,
              gratitude: newGratitude,
              updatedAt: new Date().toISOString(),
            },
          },
        });
      },

      // ═══════════════════════════════════════════════════════════════
      // 연간 기념일 CRUD
      // ═══════════════════════════════════════════════════════════════
      addAnnualEvent: (event) => {
        const newEvent: AnnualEvent = {
          ...event,
          id: genId(),
          createdAt: new Date().toISOString(),
        };
        set({ annualEvents: [...get().annualEvents, newEvent] });
      },

      updateAnnualEvent: (id, updates) => {
        set({
          annualEvents: get().annualEvents.map((e) =>
            e.id === id ? { ...e, ...updates } : e
          ),
        });
      },

      deleteAnnualEvent: (id) => {
        set({
          annualEvents: get().annualEvents.filter((e) => e.id !== id),
        });
      },

      getUpcomingEvents: (days = 30) => {
        const events = get().annualEvents;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return events
          .map((event) => {
            // 올해 날짜로 계산
            let nextDate = new Date(today.getFullYear(), event.month - 1, event.day);

            // 이미 지났으면 내년으로
            if (nextDate < today) {
              nextDate = new Date(today.getFullYear() + 1, event.month - 1, event.day);
            }

            const daysUntil = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            return { ...event, daysUntil, nextDate };
          })
          .filter((e) => e.daysUntil <= days)
          .sort((a, b) => a.daysUntil - b.daysUntil);
      },
    }),
    {
      name: 'life-planner-storage',
      partialize: (state) => ({
        baseYear: state.baseYear,
        periods: state.periods,
        allItems: state.allItems,
        records: state.records,
        annualEvents: state.annualEvents,
      }),
    }
  )
);
