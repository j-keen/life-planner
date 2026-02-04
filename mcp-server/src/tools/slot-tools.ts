import { getSupabase } from '../supabase-client.js';
import { Period, Item, Level, TimeSlot, LEVEL_CONFIG } from '../types.js';
import { genId, createEmptyPeriod } from '../item-utils.js';
import { parsePeriodId } from '../period-utils.js';

// Period를 Supabase에 저장
async function savePeriod(period: Period): Promise<boolean> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('periods')
    .upsert({
      id: period.id,
      level: period.level,
      goal: period.goal,
      motto: period.motto,
      memo: period.memo,
      memos: period.memos || [],
      structured_memos: period.structuredMemos || [],
      todos: period.todos,
      routines: period.routines,
      slots: period.slots,
      time_slots: period.timeSlots || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
  return !error;
}

function rowToPeriod(row: any): Period {
  return {
    id: row.id,
    level: row.level,
    goal: row.goal || '',
    motto: row.motto || '',
    memo: row.memo || '',
    memos: row.memos || [],
    structuredMemos: row.structured_memos || [],
    todos: row.todos || [],
    routines: row.routines || [],
    slots: row.slots || {},
    timeSlots: row.time_slots || undefined,
  };
}

async function loadPeriod(periodId: string): Promise<Period | null> {
  const supabase = getSupabase();
  const { data } = await supabase.from('periods').select('*').eq('id', periodId).single();
  return data ? rowToPeriod(data) : null;
}

async function ensurePeriod(periodId: string): Promise<Period> {
  const existing = await loadPeriod(periodId);
  if (existing) return existing;
  const parsed = parsePeriodId(periodId);
  return createEmptyPeriod(periodId, parsed.level);
}

// 하위 기간에 배정 (핵심 기능)
export async function assignToSlot(params: {
  periodId: string;
  itemId: string;
  targetSlotId: string;
  subContent?: string;
}): Promise<{ success: boolean; newItemId?: string; propagatedItemId?: string; error?: string }> {
  try {
    const period = await ensurePeriod(params.periodId);
    const parsed = parsePeriodId(params.periodId);

    // 원본 아이템 찾기
    const originalItem = [...period.todos, ...period.routines].find(i => i.id === params.itemId);
    if (!originalItem) return { success: false, error: 'Item not found in period' };

    // 표시 내용 생성
    const displayContent = params.subContent
      ? `${originalItem.content}: ${params.subContent}`
      : originalItem.content;

    // 슬롯 아이템 생성
    const newItem: Item = {
      id: genId(),
      content: displayContent,
      isCompleted: false,
      color: originalItem.color,
      category: originalItem.category,
      todoCategory: originalItem.todoCategory,
      parentId: originalItem.id,
      originPeriodId: params.periodId,
      subContent: params.subContent,
      sourceLevel: parsed.level,
      sourceType: originalItem.sourceType || (period.routines.some(i => i.id === params.itemId) ? 'routine' : 'todo'),
      note: originalItem.note,
    };

    // 전파 아이템 생성
    const propagatedItem: Item = {
      ...newItem,
      id: genId(),
      parentId: newItem.id,
    };

    // 슬롯 아이템에 전파 아이템을 자식으로 연결
    newItem.childIds = [propagatedItem.id];

    // 원본 아이템의 childIds 업데이트
    const updatedOriginal = {
      ...originalItem,
      childIds: [...(originalItem.childIds || []), newItem.id],
    };

    // 원본 리스트 업데이트
    const isRoutine = period.routines.some(i => i.id === params.itemId);
    if (isRoutine) {
      if (originalItem.targetCount !== undefined) {
        const newCount = (originalItem.currentCount ?? originalItem.targetCount) - 1;
        period.routines = period.routines.map(i =>
          i.id === params.itemId ? { ...updatedOriginal, currentCount: Math.max(0, newCount) } : i
        );
      } else {
        period.routines = period.routines.map(i =>
          i.id === params.itemId ? updatedOriginal : i
        );
      }
    } else {
      period.todos = period.todos.map(i =>
        i.id === params.itemId ? updatedOriginal : i
      );
    }

    // 슬롯에 추가
    const slotItems = period.slots[params.targetSlotId] || [];
    period.slots = {
      ...period.slots,
      [params.targetSlotId]: [...slotItems, newItem],
    };

    // 부모 기간 저장
    await savePeriod(period);

    // 자식 기간에 전파
    const childLevel = LEVEL_CONFIG[parsed.level].childLevel;
    if (childLevel) {
      const childPeriod = await ensurePeriod(params.targetSlotId);
      childPeriod.todos = [...childPeriod.todos, propagatedItem];
      await savePeriod(childPeriod);
    }

    return { success: true, newItemId: newItem.id, propagatedItemId: propagatedItem.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// 시간대에 배정 (DAY 전용)
export async function assignToTimeSlot(params: {
  periodId: string;
  itemId: string;
  timeSlot: TimeSlot;
  subContent?: string;
}): Promise<{ success: boolean; newItemId?: string; error?: string }> {
  try {
    const period = await ensurePeriod(params.periodId);
    const parsed = parsePeriodId(params.periodId);

    if (parsed.level !== 'DAY') {
      return { success: false, error: 'assignToTimeSlot only works on DAY level periods' };
    }

    const originalItem = [...period.todos, ...period.routines].find(i => i.id === params.itemId);
    if (!originalItem) return { success: false, error: 'Item not found in period' };

    const displayContent = params.subContent
      ? `${originalItem.content}: ${params.subContent}`
      : originalItem.content;

    const newItem: Item = {
      id: genId(),
      content: displayContent,
      isCompleted: false,
      color: originalItem.color,
      category: originalItem.category,
      todoCategory: originalItem.todoCategory,
      subContent: params.subContent,
      sourceLevel: originalItem.sourceLevel || parsed.level,
      sourceType: originalItem.sourceType || (period.routines.some(i => i.id === params.itemId) ? 'routine' : 'todo'),
      parentId: originalItem.id,
      originPeriodId: params.periodId,
      note: originalItem.note,
    };

    // 원본 아이템의 childIds 업데이트
    const updatedOriginal = {
      ...originalItem,
      childIds: [...(originalItem.childIds || []), newItem.id],
    };

    const isRoutine = period.routines.some(i => i.id === params.itemId);
    if (isRoutine) {
      if (originalItem.targetCount !== undefined) {
        const newCount = (originalItem.currentCount ?? originalItem.targetCount) - 1;
        period.routines = period.routines.map(i =>
          i.id === params.itemId ? { ...updatedOriginal, currentCount: Math.max(0, newCount) } : i
        );
      } else {
        period.routines = period.routines.map(i =>
          i.id === params.itemId ? updatedOriginal : i
        );
      }
    } else {
      period.todos = period.todos.map(i =>
        i.id === params.itemId ? updatedOriginal : i
      );
    }

    // timeSlots 초기화
    if (!period.timeSlots) {
      period.timeSlots = {
        dawn: [], morning_early: [], morning_late: [],
        afternoon_early: [], afternoon_late: [],
        evening_early: [], evening_late: [], anytime: [],
      };
    }

    const slotItems = period.timeSlots[params.timeSlot] || [];
    period.timeSlots = {
      ...period.timeSlots,
      [params.timeSlot]: [...slotItems, newItem],
    };

    await savePeriod(period);
    return { success: true, newItemId: newItem.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
