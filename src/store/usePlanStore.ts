import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Level, Item, Period, LEVEL_CONFIG, LEVELS, TimeSlot, TIME_SLOTS } from '../types/plan';

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
    todos: [],
    routines: [],
    slots: {},
  };

  // DAY 레벨은 timeSlots 초기화
  if (level === 'DAY') {
    base.timeSlots = {
      morning: [],
      afternoon: [],
      evening: [],
      anytime: [],
    };
  }

  return base;
};

// ═══════════════════════════════════════════════════════════════
// ID 체계 (실제 날짜 기반)
// ═══════════════════════════════════════════════════════════════
// THIRTY_YEAR: "30y"
// FIVE_YEAR:   "5y-0" ~ "5y-5" (0번째~5번째 5년 구간)
// YEAR:        "y-2025"
// QUARTER:     "q-2025-1" ~ "q-2025-4"
// MONTH:       "m-2025-01" ~ "m-2025-12"
// WEEK:        "w-2025-01" ~ "w-2025-53"
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

    case 'FIVE_YEAR':
      // 5개 년도
      const startYear = baseYear + (parsed.fiveYearIndex || 0) * 5;
      for (let i = 0; i < 5; i++) {
        ids.push(getPeriodId('YEAR', baseYear, { year: startYear + i }));
      }
      break;

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
      // 7일
      for (let d = 1; d <= 7; d++) {
        // 간단하게 주차 기반으로 일자 계산
        const weekNum = parsed.week || 1;
        const dayOfYear = (weekNum - 1) * 7 + d;
        const date = new Date(parsed.year || baseYear, 0, dayOfYear);
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

// 슬롯 라벨 생성
export const getSlotLabel = (childId: string, baseYear: number): string => {
  const parsed = parsePeriodId(childId);

  switch (parsed.level) {
    case 'FIVE_YEAR': {
      const startYear = baseYear + (parsed.fiveYearIndex || 0) * 5;
      const endYear = startYear + 4;
      return `${startYear}~${endYear}`;
    }
    case 'YEAR':
      return `${parsed.year}년`;
    case 'QUARTER':
      return `Q${parsed.quarter}`;
    case 'MONTH':
      return `${parsed.month}월`;
    case 'WEEK':
      return `${parsed.week}주차`;
    case 'DAY': {
      const date = new Date(parsed.year!, parsed.month! - 1, parsed.day);
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      return `${parsed.month}/${parsed.day} (${days[date.getDay()]})`;
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
      const fiveYearIndex = Math.floor((parsed.year! - baseYear) / 5);
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
      // 일에서 주차 추정
      const date = new Date(parsed.year!, parsed.month! - 1, parsed.day);
      const startOfYear = new Date(parsed.year!, 0, 1);
      const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
      const weekNum = Math.ceil((days + 1) / 7);
      return `w-${parsed.year}-${String(weekNum).padStart(2, '0')}`;
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

  // 네비게이션
  setBaseYear: (year: number) => void;
  navigateTo: (periodId: string) => void;
  drillDown: (childPeriodId: string) => void;
  drillUp: () => void;

  // 기간 헤더 수정
  updatePeriodHeader: (field: 'goal' | 'motto' | 'memo', value: string) => void;

  // 항목 CRUD
  addItem: (content: string, to: 'todo' | 'routine', targetCount?: number) => void;
  deleteItem: (itemId: string, from: 'todo' | 'routine' | 'slot', slotId?: string) => void;
  updateItemContent: (itemId: string, content: string, location: 'todo' | 'routine' | 'slot', slotId?: string) => void;
  updateItemColor: (itemId: string, color: string, location: 'todo' | 'routine' | 'slot', slotId?: string) => void;

  // 드래그 → 슬롯 배정 (핵심!)
  assignToSlot: (itemId: string, from: 'todo' | 'routine', targetSlotId: string, subContent?: string) => void;

  // 시간대 슬롯 배정 (일 뷰 전용)
  assignToTimeSlot: (itemId: string, from: 'todo' | 'routine', timeSlot: TimeSlot, subContent?: string) => void;

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
}

// ═══════════════════════════════════════════════════════════════
// 스토어 구현
// ═══════════════════════════════════════════════════════════════
const currentYear = new Date().getFullYear();

export const usePlanStore = create<PlanStore>()(
  persist(
    (set, get) => ({
      currentLevel: 'YEAR',
      currentPeriodId: `y-${currentYear}`,
      baseYear: currentYear,
      periods: {},
      allItems: {},

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

      addItem: (content, to, targetCount) => {
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
              morning: [],
              afternoon: [],
              evening: [],
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

        // 부모의 childIds에서 제거
        if (item?.parentId) {
          const parent = newAllItems[item.parentId];
          if (parent?.childIds) {
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
          // 루틴: targetCount가 있는 경우에만 카운트 감소
          if (originalItem.targetCount !== undefined) {
            const newCount = (originalItem.currentCount ?? originalItem.targetCount) - 1;
            const updatedRoutine: Item = {
              ...updatedOriginal,
              currentCount: Math.max(0, newCount),
            };

            // 카운트가 0이면 루틴 목록에서 제거
            if (newCount <= 0) {
              updatedPeriod.routines = period.routines.filter((i) => i.id !== itemId);
            } else {
              updatedPeriod.routines = period.routines.map((i) =>
                i.id === itemId ? updatedRoutine : i
              );
            }
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
        };

        updatedPeriods[targetSlotId] = {
          ...childPeriod,
          todos: [...childPeriod.todos, propagatedItem],
        };

        set({
          periods: updatedPeriods,
          allItems: {
            ...freshState.allItems,
            [newItem.id]: newItem,
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
            morning: [],
            afternoon: [],
            evening: [],
            anytime: [],
          };
        }

        // 원본 리스트 업데이트
        if (from === 'todo') {
          updatedPeriod.todos = period.todos.map((i) =>
            i.id === itemId ? updatedOriginal : i
          );
        } else {
          // 루틴: targetCount가 있는 경우에만 카운트 감소
          if (originalItem.targetCount !== undefined) {
            const newCount = (originalItem.currentCount ?? originalItem.targetCount) - 1;
            const updatedRoutine: Item = {
              ...updatedOriginal,
              currentCount: Math.max(0, newCount),
            };

            if (newCount <= 0) {
              updatedPeriod.routines = period.routines.filter((i) => i.id !== itemId);
            } else {
              updatedPeriod.routines = period.routines.map((i) =>
                i.id === itemId ? updatedRoutine : i
              );
            }
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

        // 새 하위 항목 생성
        const newItem: Item = {
          id: genId(),
          content,
          isCompleted: false,
          color: parentItem.color,
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

        const toggle = (item: Item): Item => ({
          ...item,
          isCompleted: !item.isCompleted,
        });

        const updatedPeriod = { ...period };

        if (location === 'todo') {
          updatedPeriod.todos = period.todos.map((i) =>
            i.id === itemId ? toggle(i) : i
          );
        } else if (location === 'routine') {
          updatedPeriod.routines = period.routines.map((i) =>
            i.id === itemId ? toggle(i) : i
          );
        } else if (location === 'slot' && slotId) {
          // 시간대 슬롯 체크
          const parsedTimeSlot = parseTimeSlotId(slotId);
          if (parsedTimeSlot && period.timeSlots) {
            const { timeSlot } = parsedTimeSlot;
            updatedPeriod.timeSlots = {
              ...period.timeSlots,
              [timeSlot]: (period.timeSlots[timeSlot] || []).map((i) =>
                i.id === itemId ? toggle(i) : i
              ),
            };
          } else {
            updatedPeriod.slots = {
              ...period.slots,
              [slotId]: (period.slots[slotId] || []).map((i) =>
                i.id === itemId ? toggle(i) : i
              ),
            };
          }
        }

        // allItems 업데이트
        const newAllItems = { ...state.allItems };
        if (newAllItems[itemId]) {
          newAllItems[itemId] = toggle(newAllItems[itemId]);
        }

        set({
          periods: { ...state.periods, [state.currentPeriodId]: updatedPeriod },
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
    }),
    {
      name: 'life-planner-storage',
      partialize: (state) => ({
        baseYear: state.baseYear,
        periods: state.periods,
        allItems: state.allItems,
      }),
    }
  )
);
