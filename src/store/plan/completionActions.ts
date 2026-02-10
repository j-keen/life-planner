import type { PlanStore } from './types';
import { syncAllPeriodsFromItems } from './syncHelpers';
import type { Item } from '../../types/plan';

type SetFn = (partial: Partial<PlanStore> | ((state: PlanStore) => Partial<PlanStore>)) => void;
type GetFn = () => PlanStore;

export const createCompletionActions = (set: SetFn, get: GetFn) => ({
  toggleComplete: (itemId: string, location: 'todo' | 'routine' | 'slot', slotId?: string) => {
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
    const updatedPeriods = syncAllPeriodsFromItems(state.periods, (item: Item): Item => {
      const latest = newAllItems[item.id];
      if (latest && latest.isCompleted !== item.isCompleted) {
        return { ...item, isCompleted: latest.isCompleted };
      }
      return item;
    });

    set({
      periods: updatedPeriods,
      allItems: newAllItems,
    });
  },

  getProgress: (itemId: string): number => {
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
});
