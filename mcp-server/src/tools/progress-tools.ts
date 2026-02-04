import { getSupabase } from '../supabase-client.js';
import { Period, Item, Level } from '../types.js';
import { parsePeriodId } from '../period-utils.js';

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

// 기간 헤더 수정 (목표/좌우명)
export async function updatePeriodHeader(params: {
  periodId: string;
  goal?: string;
  motto?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabase();
    const { data } = await supabase.from('periods').select('*').eq('id', params.periodId).single();

    let period: Period;
    if (data) {
      period = rowToPeriod(data);
    } else {
      const parsed = parsePeriodId(params.periodId);
      period = {
        id: params.periodId,
        level: parsed.level,
        goal: '',
        motto: '',
        memo: '',
        memos: [],
        structuredMemos: [],
        todos: [],
        routines: [],
        slots: {},
      };
    }

    if (params.goal !== undefined) period.goal = params.goal;
    if (params.motto !== undefined) period.motto = params.motto;

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

    return { success: !error, error: error?.message };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
