import { create } from 'zustand';
import { genId, createEmptyPeriod } from './types';
import type { PlanStore } from './types';
import { parsePeriodId, getParentPeriodId, getResetKey, getISOWeek, getISOWeekYear, getWeeksInMonth, getChildPeriodIds, getPeriodId } from './periodUtils';
import { parseTimeSlotId } from './slotUtils';
import { Level, Item, Period, TimeSlot, Category, TodoCategory, DailyRecord, Mood, AnnualEvent, AnnualEventType, Memo, LEVEL_CONFIG } from '../../types/plan';

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

    // 할일 카테고리 변경
    updateTodoCategory: (itemId, todoCategory) => {
      const state = get();
      const period = state.periods[state.currentPeriodId];
      if (!period) return;

      const updatedTodos = period.todos.map(item =>
        item.id === itemId ? { ...item, todoCategory } : item
      );

      set({
        periods: {
          ...state.periods,
          [state.currentPeriodId]: { ...period, todos: updatedTodos }
        },
        allItems: {
          ...state.allItems,
          [itemId]: { ...state.allItems[itemId], todoCategory }
        }
      });
    },

    deleteItem: (itemId, from, slotId) => {
      const state = get();
      const period = state.periods[state.currentPeriodId];
      if (!period) return;

      // 삭제할 모든 ID 수집 (연쇄 삭제, 순환 참조 방어)
      const idsToDelete = new Set<string>();
      const collectChildIds = (id: string) => {
        if (idsToDelete.has(id)) return; // EC-03: 순환 참조 감지 (idsToDelete가 visited 역할)
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

      // allItems 먼저 업데이트
      const newAllItems = { ...state.allItems };
      const targetItem = newAllItems[itemId];
      if (!targetItem) return;

      newAllItems[itemId] = { ...targetItem, content };

      // 자식들의 content도 업데이트 (subContent 로직 적용, 순환 참조 방어)
      const updateChildrenRecursive = (parentId: string, parentContent: string, visited = new Set<string>()) => {
        if (visited.has(parentId)) return; // 순환 참조 감지
        visited.add(parentId);

        const parent = newAllItems[parentId];
        if (!parent?.childIds) return;

        parent.childIds.forEach((childId) => {
          const child = newAllItems[childId];
          if (child) {
            // subContent가 있으면 "newParentContent: subContent" 형태로, 없으면 부모 content 그대로
            const newChildContent = child.subContent
              ? `${parentContent}: ${child.subContent}`
              : parentContent;

            newAllItems[childId] = { ...child, content: newChildContent };

            // 손자들도 재귀적으로 업데이트 (새로운 자식 content를 부모로 사용)
            updateChildrenRecursive(childId, newChildContent, visited);
          }
        });
      };
      updateChildrenRecursive(itemId, content);

      // 모든 기간에서 해당 항목들 업데이트
      const updatedPeriods = { ...state.periods };

      Object.keys(updatedPeriods).forEach((periodId) => {
        const p = updatedPeriods[periodId];
        if (!p) return;

        let needsUpdate = false;
        const updatedP = { ...p };

        // 업데이트 함수: allItems의 content를 반영
        const syncFromAllItems = (item: Item): Item => {
          const latest = newAllItems[item.id];
          if (latest && latest.content !== item.content) {
            return { ...item, content: latest.content };
          }
          return item;
        };

        // todos 동기화 (참조 비교로 변경 확인)
        const syncedTodos = p.todos.map(syncFromAllItems);
        if (syncedTodos.some((item, idx) => item !== p.todos[idx])) {
          updatedP.todos = syncedTodos;
          needsUpdate = true;
        }

        // routines 동기화
        const syncedRoutines = p.routines.map(syncFromAllItems);
        if (syncedRoutines.some((item, idx) => item !== p.routines[idx])) {
          updatedP.routines = syncedRoutines;
          needsUpdate = true;
        }

        // slots 동기화
        const syncedSlots: Record<string, Item[]> = {};
        let slotsChanged = false;
        Object.keys(p.slots).forEach((slotKey) => {
          const syncedSlot = p.slots[slotKey].map(syncFromAllItems);
          syncedSlots[slotKey] = syncedSlot;
          if (syncedSlot.some((item, idx) => item !== p.slots[slotKey][idx])) {
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
            const original = p.timeSlots![ts] || [];
            const syncedSlot = original.map(syncFromAllItems);
            syncedTimeSlots[ts] = syncedSlot;
            if (syncedSlot.some((item, idx) => item !== original[idx])) {
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

    updateItemColor: (itemId, color, location, slotId) => {
      const state = get();
      const period = state.periods[state.currentPeriodId];
      if (!period) return;

      // Step 1: Update allItems for the target item and all descendants
      const newAllItems = { ...state.allItems };
      const visited = new Set<string>();

      const updateItemAndChildren = (id: string) => {
        if (visited.has(id)) return;
        visited.add(id);

        if (newAllItems[id]) {
          newAllItems[id] = { ...newAllItems[id], color };
          const childIds = newAllItems[id].childIds;
          if (childIds && childIds.length > 0) {
            childIds.forEach((childId) => updateItemAndChildren(childId));
          }
        }
      };

      updateItemAndChildren(itemId);

      // Step 2: Sync all periods from allItems
      const updatedPeriods = { ...state.periods };

      Object.keys(updatedPeriods).forEach((periodId) => {
        const p = updatedPeriods[periodId];
        if (!p) return;

        let needsUpdate = false;
        const updatedP = { ...p };

        // Sync function: compare color
        const syncFromAllItems = (item: Item): Item => {
          const latest = newAllItems[item.id];
          if (latest && latest.color !== item.color) {
            return { ...item, color: latest.color };
          }
          return item;
        };

        // todos synchronization
        const syncedTodos = p.todos.map(syncFromAllItems);
        if (syncedTodos.some((item, idx) => item !== p.todos[idx])) {
          updatedP.todos = syncedTodos;
          needsUpdate = true;
        }

        // routines synchronization
        const syncedRoutines = p.routines.map(syncFromAllItems);
        if (syncedRoutines.some((item, idx) => item !== p.routines[idx])) {
          updatedP.routines = syncedRoutines;
          needsUpdate = true;
        }

        // slots synchronization
        const syncedSlots: Record<string, Item[]> = {};
        let slotsChanged = false;
        Object.keys(p.slots).forEach((slotKey) => {
          const syncedSlot = p.slots[slotKey].map(syncFromAllItems);
          syncedSlots[slotKey] = syncedSlot;
          if (syncedSlot.some((item, idx) => item !== p.slots[slotKey][idx])) {
            slotsChanged = true;
          }
        });
        if (slotsChanged) {
          updatedP.slots = syncedSlots;
          needsUpdate = true;
        }

        // timeSlots synchronization
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
            const original = p.timeSlots![ts] || [];
            const syncedSlot = original.map(syncFromAllItems);
            syncedTimeSlots[ts] = syncedSlot;
            if (syncedSlot.some((item, idx) => item !== original[idx])) {
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

    updateItemNote: (itemId, note, location, slotId) => {
      const state = get();
      const period = state.periods[state.currentPeriodId];
      if (!period) return;

      // allItems 먼저 업데이트 (ONLY the target item - no child propagation for notes)
      const newAllItems = { ...state.allItems };
      const targetItem = newAllItems[itemId];
      if (!targetItem) return;

      newAllItems[itemId] = { ...targetItem, note };

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
          if (latest && latest.note !== item.note) {
            return { ...item, note: latest.note };
          }
          return item;
        };

        // todos 동기화 (참조 비교)
        const syncedTodos = p.todos.map(syncFromAllItems);
        if (syncedTodos.some((item, idx) => item !== p.todos[idx])) {
          updatedP.todos = syncedTodos;
          needsUpdate = true;
        }

        // routines 동기화
        const syncedRoutines = p.routines.map(syncFromAllItems);
        if (syncedRoutines.some((item, idx) => item !== p.routines[idx])) {
          updatedP.routines = syncedRoutines;
          needsUpdate = true;
        }

        // slots 동기화
        const syncedSlots: Record<string, Item[]> = {};
        let slotsChanged = false;
        Object.keys(p.slots).forEach((slotKey) => {
          const syncedSlot = p.slots[slotKey].map(syncFromAllItems);
          syncedSlots[slotKey] = syncedSlot;
          if (syncedSlot.some((item, idx) => item !== p.slots[slotKey][idx])) {
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
            const original = p.timeSlots![ts] || [];
            const syncedSlot = original.map(syncFromAllItems);
            syncedTimeSlots[ts] = syncedSlot;
            if (syncedSlot.some((item, idx) => item !== original[idx])) {
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
        category: originalItem.category,  // 루틴 카테고리 복사
        todoCategory: originalItem.todoCategory,  // 할일 카테고리 복사
        note: originalItem.note,
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
        category: originalItem.category,  // 루틴 카테고리 복사
        todoCategory: originalItem.todoCategory,  // 할일 카테고리 복사
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
        category: originalItem.category,  // 루틴 카테고리 복사
        todoCategory: originalItem.todoCategory,  // 할일 카테고리 복사
        note: originalItem.note,
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
        category: parentItem.category, // 루틴 카테고리 상속
        todoCategory: parentItem.todoCategory, // 할일 카테고리 상속
        note: parentItem.note,
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

      // 자식들도 같은 상태로 변경 (하위 전파, 순환 참조 방어)
      const updateChildrenRecursive = (parentId: string, completed: boolean, visited = new Set<string>()) => {
        if (visited.has(parentId)) return; // EC-02: 순환 참조 감지
        visited.add(parentId);

        const parent = newAllItems[parentId];
        if (!parent?.childIds) return;

        parent.childIds.forEach((childId) => {
          const child = newAllItems[childId];
          if (child) {
            newAllItems[childId] = { ...child, isCompleted: completed };
            updateChildrenRecursive(childId, completed, visited);
          }
        });
      };
      updateChildrenRecursive(itemId, newCompletedState);

      // 부모 체인 업데이트 (자식 완료 시 부모 진행률 체크, 순환 참조 방어)
      const updateParentChain = (childId: string, visited = new Set<string>()) => {
        if (visited.has(childId)) return; // 순환 참조 감지
        visited.add(childId);

        const child = newAllItems[childId];
        if (!child?.parentId) return;

        const parent = newAllItems[child.parentId];
        if (!parent?.childIds || parent.childIds.length === 0) return;

        const completedCount = parent.childIds.filter(
          (cid) => newAllItems[cid]?.isCompleted
        ).length;
        const progress = Math.round((completedCount / parent.childIds.length) * 100);

        const shouldBeCompleted = progress === 100;
        if (parent.isCompleted !== shouldBeCompleted) {
          newAllItems[parent.id] = { ...parent, isCompleted: shouldBeCompleted };
          updateParentChain(parent.id, visited);
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

        // todos 동기화 (EC-10: 참조 비교로 변경, JSON.stringify 제거)
        const syncedTodos = p.todos.map(syncFromAllItems);
        if (syncedTodos.some((item, idx) => item !== p.todos[idx])) {
          updatedP.todos = syncedTodos;
          needsUpdate = true;
        }

        // routines 동기화
        const syncedRoutines = p.routines.map(syncFromAllItems);
        if (syncedRoutines.some((item, idx) => item !== p.routines[idx])) {
          updatedP.routines = syncedRoutines;
          needsUpdate = true;
        }

        // slots 동기화
        const syncedSlots: Record<string, Item[]> = {};
        let slotsChanged = false;
        Object.keys(p.slots).forEach((slotKey) => {
          const syncedSlot = p.slots[slotKey].map(syncFromAllItems);
          syncedSlots[slotKey] = syncedSlot;
          if (syncedSlot.some((item, idx) => item !== p.slots[slotKey][idx])) {
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
            const original = p.timeSlots![ts] || [];
            const syncedSlot = original.map(syncFromAllItems);
            syncedTimeSlots[ts] = syncedSlot;
            if (syncedSlot.some((item, idx) => item !== original[idx])) {
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
  })
);
