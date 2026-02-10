import type { PlanStore } from './types';
import { genId, createEmptyPeriod } from './types';
import type { Item, TimeSlot } from '../../types/plan';
import { LEVEL_CONFIG as LevelConfig } from '../../types/plan';

type SetFn = (partial: Partial<PlanStore> | ((state: PlanStore) => Partial<PlanStore>)) => void;
type GetFn = () => PlanStore;

export const createSlotActions = (set: SetFn, get: GetFn) => ({
  // ═══════════════════════════════════════════════════════════
  // 핵심: 슬롯 배정 (쪼개기)
  // ═══════════════════════════════════════════════════════════
  assignToSlot: (itemId: string, from: 'todo' | 'routine', targetSlotId: string, subContent?: string) => {
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
    const childPeriod = freshState.periods[targetSlotId] || createEmptyPeriod(targetSlotId, LevelConfig[currentLevel].childLevel!);
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
  assignToTimeSlot: (itemId: string, from: 'todo' | 'routine', timeSlot: TimeSlot, subContent?: string) => {
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
  moveSlotItem: (itemId: string, fromSlotId: string, toSlotId: string) => {
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
  moveTimeSlotItem: (itemId: string, fromSlotId: string, toSlotId: string) => {
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
});
