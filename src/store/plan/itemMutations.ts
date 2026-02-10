import type { PlanStore } from './types';
import { genId } from './types';
import { getResetKey } from './periodUtils';
import { collectDescendantIds, updateItemAndDescendants, syncAllPeriodsFromItems } from './syncHelpers';
import type { Item, TimeSlot, Category, TodoCategory } from '../../types/plan';

type SetFn = (partial: Partial<PlanStore> | ((state: PlanStore) => Partial<PlanStore>)) => void;
type GetFn = () => PlanStore;

export const createItemMutations = (set: SetFn, get: GetFn) => ({
  addItem: (content: string, to: 'todo' | 'routine', targetCount?: number, category?: Category, todoCategory?: TodoCategory) => {
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

  updateItemCategory: (itemId: string, category: Category | undefined, location: 'todo' | 'routine' | 'slot', slotId?: string) => {
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
  updateTodoCategory: (itemId: string, todoCategory: TodoCategory) => {
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

  deleteItem: (itemId: string, from: 'todo' | 'routine' | 'slot', slotId?: string) => {
    const state = get();
    const period = state.periods[state.currentPeriodId];
    if (!period) return;

    // 삭제할 모든 ID 수집 (연쇄 삭제, 순환 참조 방어)
    const idsToDelete = collectDescendantIds(state.allItems, itemId);

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

  updateItemContent: (itemId: string, content: string, location: 'todo' | 'routine' | 'slot', slotId?: string) => {
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
    const updatedPeriods = syncAllPeriodsFromItems(state.periods, (item: Item): Item => {
      const latest = newAllItems[item.id];
      if (latest && latest.content !== item.content) {
        return { ...item, content: latest.content };
      }
      return item;
    });

    set({
      periods: updatedPeriods,
      allItems: newAllItems,
    });
  },

  updateItemColor: (itemId: string, color: string, location: 'todo' | 'routine' | 'slot', slotId?: string) => {
    const state = get();
    const period = state.periods[state.currentPeriodId];
    if (!period) return;

    // Step 1: Update allItems for the target item and all descendants
    const newAllItems = { ...state.allItems };
    updateItemAndDescendants(newAllItems, itemId, (item) => ({ ...item, color }));

    // Step 2: Sync all periods from allItems
    const updatedPeriods = syncAllPeriodsFromItems(state.periods, (item: Item): Item => {
      const latest = newAllItems[item.id];
      if (latest && latest.color !== item.color) {
        return { ...item, color: latest.color };
      }
      return item;
    });

    set({
      periods: updatedPeriods,
      allItems: newAllItems,
    });
  },

  updateItemNote: (itemId: string, note: string, location: 'todo' | 'routine' | 'slot', slotId?: string) => {
    const state = get();
    const period = state.periods[state.currentPeriodId];
    if (!period) return;

    // allItems 먼저 업데이트 (ONLY the target item - no child propagation for notes)
    const newAllItems = { ...state.allItems };
    const targetItem = newAllItems[itemId];
    if (!targetItem) return;

    newAllItems[itemId] = { ...targetItem, note };

    // 모든 기간에서 해당 항목 업데이트
    const updatedPeriods = syncAllPeriodsFromItems(state.periods, (item: Item): Item => {
      const latest = newAllItems[item.id];
      if (latest && latest.note !== item.note) {
        return { ...item, note: latest.note };
      }
      return item;
    });

    set({
      periods: updatedPeriods,
      allItems: newAllItems,
    });
  },
});
