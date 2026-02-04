// ═══════════════════════════════════════════════════════════════
// 앱 시작 시 Supabase에서 데이터 로드
// ═══════════════════════════════════════════════════════════════

import { usePlanStore } from './createPlanStore';

let isInitialized = false;

export const initializeFromCloud = async () => {
  if (isInitialized) return;
  isInitialized = true;

  const { syncFromCloud, isSupabaseConfigured } = await import('../../lib/sync').then(m => ({
    syncFromCloud: m.syncFromCloud,
    isSupabaseConfigured: () => {
      return import('../../lib/supabase').then(s => s.isSupabaseConfigured());
    }
  }));

  const configured = await import('../../lib/supabase').then(s => s.isSupabaseConfigured());

  if (!configured) {
    console.log('[Sync] Supabase not configured. Data will NOT be saved.');
    return;
  }

  console.log('[Sync] Loading data from Supabase...');
  const cloudData = await syncFromCloud();

  if (cloudData) {
    // periods 내 모든 items를 allItems에 재구축 (EC-01 fix)
    const reconstructedAllItems: Record<string, import('../../types/plan').Item> = {};

    for (const period of Object.values(cloudData.periods)) {
      for (const item of period.todos) {
        reconstructedAllItems[item.id] = item;
      }
      for (const item of period.routines) {
        reconstructedAllItems[item.id] = item;
      }
      for (const slotItems of Object.values(period.slots)) {
        for (const item of slotItems) {
          reconstructedAllItems[item.id] = item;
        }
      }
      if (period.timeSlots) {
        for (const timeSlotItems of Object.values(period.timeSlots)) {
          for (const item of timeSlotItems) {
            reconstructedAllItems[item.id] = item;
          }
        }
      }
    }

    usePlanStore.setState({
      periods: cloudData.periods,
      records: cloudData.records,
      annualEvents: cloudData.annualEvents,
      allItems: reconstructedAllItems,
    });
    console.log(`[Sync] Data loaded from Supabase (${Object.keys(reconstructedAllItems).length} items restored)`);
  } else {
    console.log('[Sync] No cloud data found. Starting fresh.');
  }
};

// ═══════════════════════════════════════════════════════════════
// 자동 동기화 구독 (상태 변경 시 클라우드에 저장)
// ═══════════════════════════════════════════════════════════════

// 브라우저 환경에서만 실행
if (typeof window !== 'undefined') {
  let prevState: { periods: unknown; records: unknown; annualEvents: unknown } | null = null;

  usePlanStore.subscribe((state) => {
    // 초기 로드 시에는 건너뛰기
    if (!prevState) {
      prevState = {
        periods: state.periods,
        records: state.records,
        annualEvents: state.annualEvents,
      };
      return;
    }

    // 변경 감지
    const hasPeriodsChanged = state.periods !== prevState.periods;
    const hasRecordsChanged = state.records !== prevState.records;
    const hasEventsChanged = state.annualEvents !== prevState.annualEvents;

    if (hasPeriodsChanged || hasRecordsChanged || hasEventsChanged) {
      // 동적 임포트로 autoSyncToCloud 호출
      import('../../lib/sync').then(({ autoSyncToCloud }) => {
        autoSyncToCloud(state.periods, state.records, state.annualEvents);
      });

      // 이전 상태 업데이트
      prevState = {
        periods: state.periods,
        records: state.records,
        annualEvents: state.annualEvents,
      };
    }
  });
}
