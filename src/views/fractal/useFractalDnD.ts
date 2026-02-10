import { useState } from 'react';
import { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { Item, TimeSlot, TIME_SLOTS, Category, TodoCategory } from '../../types/plan';

// ═══════════════════════════════════════════════════════════════
// 드래그앤드롭 핸들러 커스텀 훅
// ═══════════════════════════════════════════════════════════════
export function useFractalDnD({
  currentLevel,
  childPeriodIds,
  assignToSlot,
  assignToTimeSlot,
  moveSlotItem,
  moveTimeSlotItem,
  updateTodoCategory,
  updateItemCategory,
}: {
  currentLevel: string;
  childPeriodIds: string[];
  assignToSlot: (itemId: string, from: 'todo' | 'routine', slotId: string) => void;
  assignToTimeSlot: (itemId: string, from: 'todo' | 'routine', timeSlot: TimeSlot) => void;
  moveSlotItem: (itemId: string, fromSlotId: string, toSlotId: string) => void;
  moveTimeSlotItem: (itemId: string, fromSlotId: string, toSlotId: string) => void;
  updateTodoCategory: (itemId: string, category: TodoCategory) => void;
  updateItemCategory: (itemId: string, category: Category, location: 'routine') => void;
}) {
  const [activeItem, setActiveItem] = useState<{ item: Item; from: 'todo' | 'routine' | 'cell' | 'timeslot' } | null>(null);

  // 드래그 시작
  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as {
      item: Item;
      from: 'todo' | 'routine' | 'cell' | 'timeslot';
    } | undefined;
    if (data) {
      setActiveItem({ item: data.item, from: data.from });
    }
  };

  // 드래그 종료
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveItem(null);

    const { active, over } = event;
    if (!over) return;

    const data = active.data.current as {
      item: Item;
      from: 'todo' | 'routine' | 'cell' | 'timeslot';
      sourceSlotId?: string;
    } | undefined;
    if (!data) return;

    const targetSlotId = over.id as string;

    // 할일 카테고리로 드롭
    if (targetSlotId.startsWith('todo-category-')) {
      const newCategory = targetSlotId.replace('todo-category-', '') as TodoCategory;
      if (data.from === 'todo') {
        updateTodoCategory(data.item.id, newCategory);
      }
      return;
    }

    // 루틴 카테고리로 드롭
    if (targetSlotId.startsWith('routine-category-')) {
      const newCategory = targetSlotId.replace('routine-category-', '') as Category;
      if (data.from === 'routine') {
        updateItemCategory(data.item.id, newCategory, 'routine');
      }
      return;
    }

    // DAY 레벨: 시간대 슬롯 처리
    if (currentLevel === 'DAY') {
      if (targetSlotId.startsWith('ts-')) {
        const parts = targetSlotId.split('-');
        const timeSlot = parts[parts.length - 1] as TimeSlot;
        if (TIME_SLOTS.includes(timeSlot)) {
          // 시간대 슬롯에서 다른 시간대 슬롯으로 이동
          if (data.from === 'timeslot' && data.sourceSlotId) {
            moveTimeSlotItem(data.item.id, data.sourceSlotId, targetSlotId);
          } else if (data.from === 'todo' || data.from === 'routine') {
            // 좌우 패널에서 시간대 슬롯으로 드래그
            assignToTimeSlot(data.item.id, data.from, timeSlot);
          }
        }
      }
      return;
    }

    // 다른 레벨: 유효한 슬롯인지 확인
    if (childPeriodIds.includes(targetSlotId)) {
      // 셀에서 다른 셀로 이동
      if (data.from === 'cell' && data.sourceSlotId) {
        moveSlotItem(data.item.id, data.sourceSlotId, targetSlotId);
      } else if (data.from === 'todo' || data.from === 'routine') {
        // 좌우 패널에서 셀로 드래그
        assignToSlot(data.item.id, data.from, targetSlotId);
      }
    }
  };

  return { handleDragStart, handleDragEnd, activeItem, setActiveItem };
}
