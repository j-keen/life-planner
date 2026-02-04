import crypto from 'crypto';
import { Level, Period, TimeSlot, Item } from './types.js';

// 고유 ID 생성
export const genId = (): string => {
  return crypto.randomUUID();
};

// 빈 기간 생성
export const createEmptyPeriod = (id: string, level: Level): Period => {
  const base: Period = {
    id,
    level,
    goal: '',
    motto: '',
    memo: '',
    memos: [],
    structuredMemos: [],
    todos: [],
    routines: [],
    slots: {},
  };

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

// allItems 레지스트리 재구성 (기간 데이터에서)
export const rebuildAllItems = (periods: Record<string, Period>): Record<string, Item> => {
  const allItems: Record<string, Item> = {};

  for (const period of Object.values(periods)) {
    for (const item of period.todos) {
      allItems[item.id] = item;
    }
    for (const item of period.routines) {
      allItems[item.id] = item;
    }
    for (const slotItems of Object.values(period.slots)) {
      for (const item of slotItems) {
        allItems[item.id] = item;
      }
    }
    if (period.timeSlots) {
      for (const tsItems of Object.values(period.timeSlots)) {
        for (const item of tsItems) {
          allItems[item.id] = item;
        }
      }
    }
  }

  return allItems;
};
