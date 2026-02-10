import type { PlanStore } from './types';
import { genId } from './types';
import type { Item } from '../../types/plan';

type SetFn = (partial: Partial<PlanStore> | ((state: PlanStore) => Partial<PlanStore>)) => void;
type GetFn = () => PlanStore;

export const createTreeActions = (set: SetFn, get: GetFn) => ({
  // ═══════════════════════════════════════════════════════════
  // 쪼개기: 하위 항목 추가
  // ═══════════════════════════════════════════════════════════
  addSubItem: (parentId: string, content: string, location: 'todo' | 'routine') => {
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
  toggleExpand: (itemId: string, location: 'todo' | 'routine') => {
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
});
