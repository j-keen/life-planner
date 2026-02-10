'use client';

import { useState, useEffect } from 'react';
import { usePlanStore } from '../store/usePlanStore';
import { isSupabaseConfigured } from '../lib/supabase';
import { syncToCloud, syncFromCloud, subscribeSyncStatus, SyncStatus } from '../lib/sync';

function CloudSync() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);

  const { periods, records, annualEvents } = usePlanStore();

  useEffect(() => {
    setIsConfigured(isSupabaseConfigured());

    // 동기화 상태 구독
    const unsubscribe = subscribeSyncStatus((status, lastSyncTime) => {
      setSyncStatus(status);
      if (lastSyncTime) setLastSync(lastSyncTime);
    });

    return () => unsubscribe();
  }, []);

  // 수동 업로드
  const handleUpload = async () => {
    if (syncStatus === 'syncing') return;
    await syncToCloud(periods, records, annualEvents);
  };

  // 수동 다운로드
  const handleDownload = async () => {
    if (syncStatus === 'syncing') return;
    const data = await syncFromCloud();
    if (data) {
      usePlanStore.setState({
        periods: { ...usePlanStore.getState().periods, ...data.periods },
        records: { ...usePlanStore.getState().records, ...data.records },
        annualEvents: data.annualEvents.length > 0
          ? data.annualEvents
          : usePlanStore.getState().annualEvents,
      });
    }
  };

  // 상태별 아이콘/색상
  const getStatusIcon = () => {
    switch (syncStatus) {
      case 'syncing':
        return (
          <svg className="w-4 h-4 animate-spin motion-reduce:animate-none text-blue-500" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        );
      case 'success':
        return (
          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
          </svg>
        );
    }
  };

  const getStatusText = () => {
    switch (syncStatus) {
      case 'syncing': return '동기화 중...';
      case 'success': return lastSync ? `동기화: ${lastSync}` : '동기화 완료';
      case 'error': return '동기화 오류';
      default: return isConfigured ? '클라우드 연결됨' : '로컬 저장';
    }
  };

  if (!isConfigured) {
    return (
      <div className="text-xs text-gray-400 flex items-center gap-1" aria-label="로컬 저장 모드">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
        </svg>
        <span>로컬 저장</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/* 동기화 상태 아이콘 + 텍스트 */}
      <div className="flex items-center gap-1 text-xs text-gray-500">
        {getStatusIcon()}
        <span>{getStatusText()}</span>
      </div>

      {/* 수동 업로드 버튼 */}
      <button
        onClick={handleUpload}
        disabled={syncStatus === 'syncing'}
        aria-label="클라우드에 수동 업로드"
        className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600 hover:text-blue-600 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      </button>

      {/* 수동 다운로드 버튼 */}
      <button
        onClick={handleDownload}
        disabled={syncStatus === 'syncing'}
        aria-label="클라우드에서 새로고침"
        className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600 hover:text-green-600 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
    </div>
  );
}

export { CloudSync };

