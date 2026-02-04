import { getSupabase } from '../supabase-client.js';
import { Period, Level, Item, LEVEL_CONFIG } from '../types.js';
import { parsePeriodId, getChildPeriodIds, getParentPeriodId, getCurrentPeriodId } from '../period-utils.js';

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

// 기간 조회
export async function getPeriod(periodId: string): Promise<Period | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('periods')
    .select('*')
    .eq('id', periodId)
    .single();

  if (error || !data) return null;
  return rowToPeriod(data);
}

// 현재 날짜 기준 기간 조회
export async function getCurrentPeriod(level: Level, baseYear: number): Promise<{ periodId: string; period: Period | null }> {
  const periodId = getCurrentPeriodId(level, baseYear);
  const period = await getPeriod(periodId);
  return { periodId, period };
}

// 하위 기간 목록 + 요약
export async function getChildPeriods(periodId: string, baseYear: number): Promise<{
  parentId: string;
  childIds: string[];
  children: Array<{
    id: string;
    level: Level;
    goal: string;
    todoCount: number;
    routineCount: number;
    completedTodos: number;
    completedRoutines: number;
    slotItemCount: number;
  }>;
}> {
  const childIds = getChildPeriodIds(periodId, baseYear);

  if (childIds.length === 0) {
    return { parentId: periodId, childIds: [], children: [] };
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('periods')
    .select('*')
    .in('id', childIds);

  const periodsMap: Record<string, Period> = {};
  if (data) {
    for (const row of data) {
      periodsMap[row.id] = rowToPeriod(row);
    }
  }

  const children = childIds.map(id => {
    const p = periodsMap[id];
    if (!p) {
      const parsed = parsePeriodId(id);
      return {
        id,
        level: parsed.level,
        goal: '',
        todoCount: 0,
        routineCount: 0,
        completedTodos: 0,
        completedRoutines: 0,
        slotItemCount: 0,
      };
    }

    const completedTodos = p.todos.filter(i => i.isCompleted).length;
    const completedRoutines = p.routines.filter(i => i.isCompleted).length;
    let slotItemCount = 0;
    for (const items of Object.values(p.slots)) {
      slotItemCount += items.length;
    }

    return {
      id,
      level: p.level,
      goal: p.goal,
      todoCount: p.todos.length,
      routineCount: p.routines.length,
      completedTodos,
      completedRoutines,
      slotItemCount,
    };
  });

  return { parentId: periodId, childIds, children };
}

// 기간 요약 통계
export async function getPeriodSummary(periodId: string): Promise<{
  periodId: string;
  level: Level;
  goal: string;
  motto: string;
  totalTodos: number;
  completedTodos: number;
  totalRoutines: number;
  completedRoutines: number;
  totalSlotItems: number;
  completedSlotItems: number;
  completionRate: number;
  todoList: Array<{ id: string; content: string; isCompleted: boolean; category?: string }>;
  routineList: Array<{ id: string; content: string; isCompleted: boolean; category?: string; targetCount?: number; currentCount?: number }>;
} | null> {
  const period = await getPeriod(periodId);
  if (!period) {
    return null;
  }

  const completedTodos = period.todos.filter(i => i.isCompleted).length;
  const completedRoutines = period.routines.filter(i => i.isCompleted).length;

  let totalSlotItems = 0;
  let completedSlotItems = 0;
  for (const items of Object.values(period.slots)) {
    for (const item of items) {
      totalSlotItems++;
      if (item.isCompleted) completedSlotItems++;
    }
  }

  const total = period.todos.length + period.routines.length + totalSlotItems;
  const completed = completedTodos + completedRoutines + completedSlotItems;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    periodId,
    level: period.level,
    goal: period.goal,
    motto: period.motto,
    totalTodos: period.todos.length,
    completedTodos,
    totalRoutines: period.routines.length,
    completedRoutines,
    totalSlotItems,
    completedSlotItems,
    completionRate,
    todoList: period.todos.map(i => ({
      id: i.id,
      content: i.content,
      isCompleted: i.isCompleted,
      category: i.todoCategory,
    })),
    routineList: period.routines.map(i => ({
      id: i.id,
      content: i.content,
      isCompleted: i.isCompleted,
      category: i.category,
      targetCount: i.targetCount,
      currentCount: i.currentCount,
    })),
  };
}

// 상위 목표 기반 계획 제안 컨텍스트
export async function suggestPlan(periodId: string, baseYear: number): Promise<{
  currentPeriod: { id: string; level: Level; goal: string; motto: string } | null;
  parentChainGoals: Array<{ periodId: string; level: Level; goal: string; motto: string }>;
  existingItems: { todos: string[]; routines: string[] };
}> {
  const period = await getPeriod(periodId);

  const parentChainGoals: Array<{ periodId: string; level: Level; goal: string; motto: string }> = [];

  let currentId: string | null = periodId;
  while (currentId) {
    const parentId = getParentPeriodId(currentId, baseYear);
    if (!parentId) break;

    const parentPeriod = await getPeriod(parentId);
    if (parentPeriod && (parentPeriod.goal || parentPeriod.motto)) {
      parentChainGoals.push({
        periodId: parentId,
        level: parentPeriod.level,
        goal: parentPeriod.goal,
        motto: parentPeriod.motto,
      });
    }
    currentId = parentId;
  }

  return {
    currentPeriod: period
      ? { id: period.id, level: period.level, goal: period.goal, motto: period.motto }
      : null,
    parentChainGoals: parentChainGoals.reverse(),
    existingItems: {
      todos: period?.todos.map(i => i.content) || [],
      routines: period?.routines.map(i => i.content) || [],
    },
  };
}
