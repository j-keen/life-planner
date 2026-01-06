import { getSupabase, isSupabaseConfigured } from './supabase';
import { Period, DailyRecord } from '../types/plan';

// ═══════════════════════════════════════════════════════════════
// Supabase 동기화 유틸리티
// ═══════════════════════════════════════════════════════════════

// Period 저장
export const savePeriodToCloud = async (period: Period): Promise<boolean> => {
  const supabase = getSupabase();
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('periods')
      .upsert({
        id: period.id,
        level: period.level,
        goal: period.goal,
        motto: period.motto,
        memo: period.memo,
        todos: period.todos,
        routines: period.routines,
        slots: period.slots,
        time_slots: period.timeSlots || null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'id',
      });

    if (error) {
      console.error('Error saving period:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error saving period:', err);
    return false;
  }
};

// 모든 Period 로드
export const loadPeriodsFromCloud = async (): Promise<Record<string, Period> | null> => {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('periods')
      .select('*');

    if (error) {
      console.error('Error loading periods:', error);
      return null;
    }

    if (!data) return {};

    const periods: Record<string, Period> = {};
    for (const row of data) {
      periods[row.id] = {
        id: row.id,
        level: row.level,
        goal: row.goal || '',
        motto: row.motto || '',
        memo: row.memo || '',
        memos: row.memos || [],
        todos: row.todos || [],
        routines: row.routines || [],
        slots: row.slots || {},
        timeSlots: row.time_slots || undefined,
      };
    }

    return periods;
  } catch (err) {
    console.error('Error loading periods:', err);
    return null;
  }
};

// Record 저장
export const saveRecordToCloud = async (record: DailyRecord): Promise<boolean> => {
  const supabase = getSupabase();
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('records')
      .upsert({
        id: record.id,
        period_id: record.periodId,
        content: record.content,
        mood: record.mood || null,
        highlights: record.highlights,
        gratitude: record.gratitude,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      }, {
        onConflict: 'id',
      });

    if (error) {
      console.error('Error saving record:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error saving record:', err);
    return false;
  }
};

// 모든 Record 로드
export const loadRecordsFromCloud = async (): Promise<Record<string, DailyRecord> | null> => {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('records')
      .select('*');

    if (error) {
      console.error('Error loading records:', error);
      return null;
    }

    if (!data) return {};

    const records: Record<string, DailyRecord> = {};
    for (const row of data) {
      records[row.period_id] = {
        id: row.id,
        periodId: row.period_id,
        content: row.content || '',
        mood: row.mood || undefined,
        highlights: row.highlights || [],
        gratitude: row.gratitude || [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    }

    return records;
  } catch (err) {
    console.error('Error loading records:', err);
    return null;
  }
};

// 전체 동기화 (로컬 → 클라우드)
export const syncToCloud = async (
  periods: Record<string, Period>,
  records: Record<string, DailyRecord>
): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;

  try {
    // Period 동기화
    for (const period of Object.values(periods)) {
      await savePeriodToCloud(period);
    }

    // Record 동기화
    for (const record of Object.values(records)) {
      await saveRecordToCloud(record);
    }

    console.log('Cloud sync completed');
    return true;
  } catch (err) {
    console.error('Sync error:', err);
    return false;
  }
};

// 전체 동기화 (클라우드 → 로컬)
export const syncFromCloud = async (): Promise<{
  periods: Record<string, Period>;
  records: Record<string, DailyRecord>;
} | null> => {
  if (!isSupabaseConfigured()) return null;

  try {
    const [periods, records] = await Promise.all([
      loadPeriodsFromCloud(),
      loadRecordsFromCloud(),
    ]);

    if (periods === null || records === null) {
      return null;
    }

    return { periods, records };
  } catch (err) {
    console.error('Sync error:', err);
    return null;
  }
};
