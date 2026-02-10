import { create } from 'zustand';
import { genId, createEmptyPeriod } from './types';
import type { PlanStore } from './types';
import { parsePeriodId, getParentPeriodId, getResetKey, getISOWeek, getISOWeekYear, getWeeksInMonth, getChildPeriodIds, getPeriodId } from './periodUtils';
import { parseTimeSlotId } from './slotUtils';
import { Level, Item, Period, TimeSlot, Category, TodoCategory, DailyRecord, Mood, AnnualEvent, AnnualEventType, Memo, LEVEL_CONFIG } from '../../types/plan';

// Slice factory imports
import { createRecordActions } from './recordActions';
import { createEventActions } from './eventActions';
import { createTreeActions } from './treeActions';
import { createItemMutations } from './itemMutations';
import { createSlotActions } from './slotActions';
import { createCompletionActions } from './completionActions';

// ═══════════════════════════════════════════════════════════════
// 스토어 구현
// ═══════════════════════════════════════════════════════════════
const currentYear = new Date().getFullYear();
const now = new Date();
const initialWeekNum = getISOWeek(now);
const initialWeekYear = getISOWeekYear(now);

export const usePlanStore = create<PlanStore>()(
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

    // Composed slices
    ...createRecordActions(set, get),
    ...createEventActions(set, get),
    ...createTreeActions(set, get),
    ...createItemMutations(set, get),
    ...createSlotActions(set, get),
    ...createCompletionActions(set, get),
  })
);
