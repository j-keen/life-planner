import { getSupabase } from '../supabase-client.js';
import { Period, Item, Level, TimeSlot, LEVEL_CONFIG } from '../types.js';
import { genId, createEmptyPeriod, rebuildAllItems } from '../item-utils.js';
import { parsePeriodId, getChildPeriodIds, getParentPeriodId } from '../period-utils.js';

// Period를 Supabase에 저장 (camelCase → snake_case)
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

// Supabase row → Period 변환
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

// 기간 조회 (없으면 새로 생성)
async function ensurePeriod(periodId: string): Promise<Period> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('periods')
    .select('*')
    .eq('id', periodId)
    .single();

  if (data) return rowToPeriod(data);

  const parsed = parsePeriodId(periodId);
  return createEmptyPeriod(periodId, parsed.level);
}

// 할일/루틴 추가
export async function addItem(params: {
  periodId: string;
  content: string;
  type: 'todo' | 'routine';
  category?: string;
  todoCategory?: string;
  targetCount?: number;
  note?: string;
}): Promise<{ success: boolean; itemId?: string; error?: string }> {
  try {
    const period = await ensurePeriod(params.periodId);
    const parsed = parsePeriodId(params.periodId);

    const newItem: Item = {
      id: genId(),
      content: params.content,
      isCompleted: false,
      originPeriodId: params.periodId,
      sourceLevel: parsed.level,
      sourceType: params.type === 'routine' ? 'routine' : 'todo',
    };

    if (params.type === 'routine' && params.category) {
      newItem.category = params.category as any;
    }
    if (params.type === 'todo' && params.todoCategory) {
      newItem.todoCategory = params.todoCategory as any;
    }
    if (params.targetCount !== undefined) {
      newItem.targetCount = params.targetCount;
      newItem.currentCount = params.targetCount;
    }
    if (params.note) {
      newItem.note = params.note;
    }

    if (params.type === 'todo') {
      period.todos = [...period.todos, newItem];
    } else {
      period.routines = [...period.routines, newItem];
    }

    const success = await savePeriod(period);
    return { success, itemId: newItem.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// 항목 수정
export async function updateItem(params: {
  periodId: string;
  itemId: string;
  content?: string;
  note?: string;
  color?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const period = await ensurePeriod(params.periodId);

    const updateFn = (item: Item): Item => {
      if (item.id !== params.itemId) return item;
      const updated = { ...item };
      if (params.content !== undefined) updated.content = params.content;
      if (params.note !== undefined) updated.note = params.note;
      if (params.color !== undefined) updated.color = params.color;
      return updated;
    };

    period.todos = period.todos.map(updateFn);
    period.routines = period.routines.map(updateFn);

    // slots 업데이트
    for (const slotId of Object.keys(period.slots)) {
      period.slots[slotId] = period.slots[slotId].map(updateFn);
    }

    // timeSlots 업데이트
    if (period.timeSlots) {
      for (const ts of Object.keys(period.timeSlots) as TimeSlot[]) {
        period.timeSlots[ts] = period.timeSlots[ts].map(updateFn);
      }
    }

    const success = await savePeriod(period);
    return { success };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// 항목 삭제 (하위 연쇄)
export async function deleteItem(params: {
  periodId: string;
  itemId: string;
}): Promise<{ success: boolean; deletedCount: number; error?: string }> {
  try {
    // 모든 기간 로드
    const supabase = getSupabase();
    const { data: allRows } = await supabase.from('periods').select('*');
    if (!allRows) return { success: false, deletedCount: 0, error: 'Failed to load periods' };

    const periods: Record<string, Period> = {};
    for (const row of allRows) {
      periods[row.id] = rowToPeriod(row);
    }

    // allItems 재구성
    const allItems = rebuildAllItems(periods);

    // 삭제할 모든 ID 수집 (연쇄)
    const idsToDelete = new Set<string>();
    const collectChildIds = (id: string) => {
      if (idsToDelete.has(id)) return;
      idsToDelete.add(id);
      const item = allItems[id];
      if (item?.childIds) {
        item.childIds.forEach(collectChildIds);
      }
    };
    collectChildIds(params.itemId);

    // 부모의 childIds에서 제거
    const item = allItems[params.itemId];
    if (item?.parentId && allItems[item.parentId]) {
      const parent = allItems[item.parentId];
      if (parent.childIds) {
        parent.childIds = parent.childIds.filter(id => id !== params.itemId);
      }
    }

    // 모든 기간에서 관련 항목 삭제
    const modifiedPeriodIds: string[] = [];
    for (const [periodId, period] of Object.entries(periods)) {
      let modified = false;
      const filterItems = (items: Item[]): Item[] => {
        const filtered = items.filter(i => !idsToDelete.has(i.id));
        // 부모 childIds 업데이트
        return filtered.map(i => {
          if (item?.parentId && i.id === item.parentId && i.childIds) {
            return { ...i, childIds: i.childIds.filter(id => id !== params.itemId) };
          }
          return i;
        });
      };

      const newTodos = filterItems(period.todos);
      if (newTodos.length !== period.todos.length) { period.todos = newTodos; modified = true; }

      const newRoutines = filterItems(period.routines);
      if (newRoutines.length !== period.routines.length) { period.routines = newRoutines; modified = true; }

      for (const slotId of Object.keys(period.slots)) {
        const newSlotItems = period.slots[slotId].filter(i => !idsToDelete.has(i.id));
        if (newSlotItems.length !== period.slots[slotId].length) {
          period.slots[slotId] = newSlotItems;
          modified = true;
        }
      }

      if (period.timeSlots) {
        for (const ts of Object.keys(period.timeSlots) as TimeSlot[]) {
          const newTsItems = period.timeSlots[ts].filter(i => !idsToDelete.has(i.id));
          if (newTsItems.length !== period.timeSlots[ts].length) {
            period.timeSlots[ts] = newTsItems;
            modified = true;
          }
        }
      }

      if (modified) modifiedPeriodIds.push(periodId);
    }

    // 변경된 기간만 저장
    for (const periodId of modifiedPeriodIds) {
      await savePeriod(periods[periodId]);
    }

    return { success: true, deletedCount: idsToDelete.size };
  } catch (err: any) {
    return { success: false, deletedCount: 0, error: err.message };
  }
}

// 완료 토글 (상위/하위 연쇄)
export async function toggleComplete(params: {
  periodId: string;
  itemId: string;
}): Promise<{ success: boolean; newState?: boolean; error?: string }> {
  try {
    // 모든 기간 로드
    const supabase = getSupabase();
    const { data: allRows } = await supabase.from('periods').select('*');
    if (!allRows) return { success: false, error: 'Failed to load periods' };

    const periods: Record<string, Period> = {};
    for (const row of allRows) {
      periods[row.id] = rowToPeriod(row);
    }

    // allItems 재구성
    const allItems = rebuildAllItems(periods);

    const targetItem = allItems[params.itemId];
    if (!targetItem) return { success: false, error: 'Item not found' };

    const newCompletedState = !targetItem.isCompleted;
    allItems[params.itemId] = { ...targetItem, isCompleted: newCompletedState };

    // 하위 전파
    const updateChildrenRecursive = (parentId: string, completed: boolean, visited = new Set<string>()) => {
      if (visited.has(parentId)) return;
      visited.add(parentId);
      const parent = allItems[parentId];
      if (!parent?.childIds) return;
      parent.childIds.forEach(childId => {
        const child = allItems[childId];
        if (child) {
          allItems[childId] = { ...child, isCompleted: completed };
          updateChildrenRecursive(childId, completed, visited);
        }
      });
    };
    updateChildrenRecursive(params.itemId, newCompletedState);

    // 상위 전파
    const updateParentChain = (childId: string, visited = new Set<string>()) => {
      if (visited.has(childId)) return;
      visited.add(childId);
      const child = allItems[childId];
      if (!child?.parentId) return;
      const parent = allItems[child.parentId];
      if (!parent?.childIds || parent.childIds.length === 0) return;
      const completedCount = parent.childIds.filter(cid => allItems[cid]?.isCompleted).length;
      const shouldBeCompleted = completedCount === parent.childIds.length;
      if (parent.isCompleted !== shouldBeCompleted) {
        allItems[parent.id] = { ...parent, isCompleted: shouldBeCompleted };
        updateParentChain(parent.id, visited);
      }
    };
    updateParentChain(params.itemId);

    // 모든 기간 동기화
    const modifiedPeriodIds = new Set<string>();
    for (const [periodId, period] of Object.entries(periods)) {
      const syncItem = (item: Item): Item => {
        const latest = allItems[item.id];
        if (latest && latest.isCompleted !== item.isCompleted) {
          return { ...item, isCompleted: latest.isCompleted };
        }
        return item;
      };

      let modified = false;
      const newTodos = period.todos.map(syncItem);
      if (newTodos.some((item, idx) => item !== period.todos[idx])) {
        period.todos = newTodos; modified = true;
      }

      const newRoutines = period.routines.map(syncItem);
      if (newRoutines.some((item, idx) => item !== period.routines[idx])) {
        period.routines = newRoutines; modified = true;
      }

      for (const slotId of Object.keys(period.slots)) {
        const newSlotItems = period.slots[slotId].map(syncItem);
        if (newSlotItems.some((item, idx) => item !== period.slots[slotId][idx])) {
          period.slots[slotId] = newSlotItems; modified = true;
        }
      }

      if (period.timeSlots) {
        for (const ts of Object.keys(period.timeSlots) as TimeSlot[]) {
          const newTsItems = (period.timeSlots[ts] || []).map(syncItem);
          if (newTsItems.some((item, idx) => item !== (period.timeSlots![ts] || [])[idx])) {
            period.timeSlots[ts] = newTsItems; modified = true;
          }
        }
      }

      if (modified) modifiedPeriodIds.add(periodId);
    }

    for (const periodId of modifiedPeriodIds) {
      await savePeriod(periods[periodId]);
    }

    return { success: true, newState: newCompletedState };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// 전체 텍스트 검색
export async function searchItems(params: {
  query: string;
  level?: Level;
  completed?: boolean;
}): Promise<Array<{
  periodId: string;
  level: Level;
  itemId: string;
  content: string;
  note?: string;
  isCompleted: boolean;
  type: 'todo' | 'routine' | 'slot';
  category?: string;
}>> {
  const supabase = getSupabase();
  let query = supabase.from('periods').select('*');

  if (params.level) {
    query = query.eq('level', params.level);
  }

  const { data } = await query;
  if (!data) return [];

  const results: Array<{
    periodId: string;
    level: Level;
    itemId: string;
    content: string;
    note?: string;
    isCompleted: boolean;
    type: 'todo' | 'routine' | 'slot';
    category?: string;
  }> = [];

  const lowerQuery = params.query.toLowerCase();

  for (const row of data) {
    const period = rowToPeriod(row);

    const matchItem = (item: Item, type: 'todo' | 'routine' | 'slot') => {
      const contentMatch = item.content.toLowerCase().includes(lowerQuery);
      const noteMatch = item.note ? item.note.toLowerCase().includes(lowerQuery) : false;
      if (!contentMatch && !noteMatch) return;
      if (params.completed !== undefined && item.isCompleted !== params.completed) return;
      results.push({
        periodId: period.id,
        level: period.level,
        itemId: item.id,
        content: item.content,
        note: item.note,
        isCompleted: item.isCompleted,
        type,
        category: item.category || item.todoCategory,
      });
    };

    period.todos.forEach(i => matchItem(i, 'todo'));
    period.routines.forEach(i => matchItem(i, 'routine'));
    for (const items of Object.values(period.slots)) {
      items.forEach(i => matchItem(i, 'slot'));
    }
  }

  return results;
}
