import { getSupabase, isSupabaseConfigured } from './supabase';
import { Period, DailyRecord, AnnualEvent } from '../types/plan';

// ═══════════════════════════════════════════════════════════════
// Supabase 동기화 유틸리티
// ═══════════════════════════════════════════════════════════════

// 동기화 상태
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

let syncStatus: SyncStatus = 'idle';
let lastSyncTime: string | null = null;
let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;

// 동기화 상태 변경 리스너
type SyncStatusListener = (status: SyncStatus, lastSync: string | null) => void;
const syncStatusListeners: SyncStatusListener[] = [];

export const subscribeSyncStatus = (listener: SyncStatusListener) => {
  syncStatusListeners.push(listener);
  // 현재 상태 즉시 알림
  listener(syncStatus, lastSyncTime);
  return () => {
    const idx = syncStatusListeners.indexOf(listener);
    if (idx > -1) syncStatusListeners.splice(idx, 1);
  };
};

const notifySyncStatus = (status: SyncStatus) => {
  syncStatus = status;
  if (status === 'success') {
    lastSyncTime = new Date().toLocaleTimeString('ko-KR');
  }
  syncStatusListeners.forEach(fn => fn(syncStatus, lastSyncTime));
};

// ═══════════════════════════════════════════════════════════════
// Period CRUD
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
        memos: period.memos || [],
        structured_memos: period.structuredMemos || [],
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
        structuredMemos: row.structured_memos || [],
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

// ═══════════════════════════════════════════════════════════════
// Record CRUD
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// Annual Events CRUD
// ═══════════════════════════════════════════════════════════════

// AnnualEvent 저장
export const saveAnnualEventToCloud = async (event: AnnualEvent): Promise<boolean> => {
  const supabase = getSupabase();
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('annual_events')
      .upsert({
        id: event.id,
        name: event.title,
        month: event.month,
        day: event.day,
        type: event.type,
        emoji: undefined, // 스키마에 있지만 타입에는 없음
        note: event.note || null,
        is_lunar: event.lunarDate || false,
        created_at: event.createdAt,
      }, {
        onConflict: 'id',
      });

    if (error) {
      console.error('Error saving annual event:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error saving annual event:', err);
    return false;
  }
};

// 모든 AnnualEvents 로드
export const loadAnnualEventsFromCloud = async (): Promise<AnnualEvent[] | null> => {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('annual_events')
      .select('*');

    if (error) {
      console.error('Error loading annual events:', error);
      return null;
    }

    if (!data) return [];

    return data.map(row => ({
      id: row.id,
      title: row.name,
      type: row.type,
      month: row.month,
      day: row.day,
      lunarDate: row.is_lunar || false,
      note: row.note || undefined,
      createdAt: row.created_at,
    }));
  } catch (err) {
    console.error('Error loading annual events:', err);
    return null;
  }
};

// ═══════════════════════════════════════════════════════════════
// 전체 동기화 (로컬 → 클라우드)
// ═══════════════════════════════════════════════════════════════

export const syncToCloud = async (
  periods: Record<string, Period>,
  records: Record<string, DailyRecord>,
  annualEvents?: AnnualEvent[]
): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;

  notifySyncStatus('syncing');

  try {
    // Period 동기화
    for (const period of Object.values(periods)) {
      await savePeriodToCloud(period);
    }

    // Record 동기화
    for (const record of Object.values(records)) {
      await saveRecordToCloud(record);
    }

    // AnnualEvent 동기화
    if (annualEvents) {
      for (const event of annualEvents) {
        await saveAnnualEventToCloud(event);
      }
    }

    console.log('Cloud sync completed');
    notifySyncStatus('success');
    return true;
  } catch (err) {
    console.error('Sync error:', err);
    notifySyncStatus('error');
    return false;
  }
};

// ═══════════════════════════════════════════════════════════════
// 전체 동기화 (클라우드 → 로컬)
// ═══════════════════════════════════════════════════════════════

export const syncFromCloud = async (): Promise<{
  periods: Record<string, Period>;
  records: Record<string, DailyRecord>;
  annualEvents: AnnualEvent[];
} | null> => {
  if (!isSupabaseConfigured()) return null;

  notifySyncStatus('syncing');

  try {
    const [periods, records, annualEvents] = await Promise.all([
      loadPeriodsFromCloud(),
      loadRecordsFromCloud(),
      loadAnnualEventsFromCloud(),
    ]);

    if (periods === null || records === null || annualEvents === null) {
      notifySyncStatus('error');
      return null;
    }

    notifySyncStatus('success');
    return { periods, records, annualEvents };
  } catch (err) {
    console.error('Sync error:', err);
    notifySyncStatus('error');
    return null;
  }
};

// ═══════════════════════════════════════════════════════════════
// 자동 동기화 (debounce 2000ms)
// ═══════════════════════════════════════════════════════════════

export const autoSyncToCloud = (
  periods: Record<string, Period>,
  records: Record<string, DailyRecord>,
  annualEvents?: AnnualEvent[]
) => {
  if (!isSupabaseConfigured()) return;

  // 이전 타이머 취소
  if (syncDebounceTimer) {
    clearTimeout(syncDebounceTimer);
  }

  // 2초 후 동기화 실행
  syncDebounceTimer = setTimeout(async () => {
    await syncToCloud(periods, records, annualEvents);
  }, 2000);
};


