"use client";

import { useEffect, useRef, useCallback } from 'react';
import { usePlanStore } from '@/store/usePlanStore';
import { syncToCloud, syncFromCloud } from '@/lib/sync';
import { isSupabaseConfigured } from '@/lib/supabase';

// 자동 동기화 훅
// - 앱 시작 시 클라우드에서 데이터 로드
// - 데이터 변경 시 3초 디바운스 후 클라우드 업로드

const DEBOUNCE_MS = 3000;

export function useAutoSync() {
  const periods = usePlanStore((state) => state.periods);
  const records = usePlanStore((state) => state.records);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoad = useRef(true);
  const lastSyncedData = useRef<string>('');

  // 클라우드에서 데이터 로드 (앱 시작 시)
  const loadFromCloud = useCallback(async () => {
    if (!isSupabaseConfigured()) return;

    try {
      const cloudData = await syncFromCloud();
      if (cloudData) {
        // 클라우드 데이터가 있으면 로컬에 병합
        const currentState = usePlanStore.getState();
        const mergedPeriods = { ...currentState.periods, ...cloudData.periods };
        const mergedRecords = { ...currentState.records, ...cloudData.records };

        usePlanStore.setState({
          periods: mergedPeriods,
          records: mergedRecords,
        });

        // 마지막 동기화 데이터 저장 (변경 감지용)
        lastSyncedData.current = JSON.stringify({ periods: mergedPeriods, records: mergedRecords });
        console.log('[AutoSync] Loaded from cloud');
      }
    } catch (err) {
      console.error('[AutoSync] Load error:', err);
    }
  }, []);

  // 클라우드로 업로드 (디바운스)
  const uploadToCloud = useCallback(async () => {
    if (!isSupabaseConfigured()) return;

    try {
      const currentData = JSON.stringify({ periods, records });

      // 데이터가 변경되지 않았으면 스킵
      if (currentData === lastSyncedData.current) {
        return;
      }

      const success = await syncToCloud(periods, records);
      if (success) {
        lastSyncedData.current = currentData;
        console.log('[AutoSync] Uploaded to cloud');
      }
    } catch (err) {
      console.error('[AutoSync] Upload error:', err);
    }
  }, [periods, records]);

  // 앱 시작 시 클라우드에서 로드
  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      loadFromCloud();
    }
  }, [loadFromCloud]);

  // 데이터 변경 감지 및 디바운스 업로드
  useEffect(() => {
    // 초기 로드 중에는 업로드 하지 않음
    if (isInitialLoad.current) return;

    // 이전 타이머 취소
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // 3초 후 업로드
    debounceTimer.current = setTimeout(() => {
      uploadToCloud();
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [periods, records, uploadToCloud]);

  // 페이지 떠날 때 즉시 동기화
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      // 동기적으로 데이터 저장 시도 (navigator.sendBeacon 사용 불가하므로 최선의 노력)
      uploadToCloud();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [uploadToCloud]);

  return { loadFromCloud, uploadToCloud };
}
