'use client';

import React, { useState, useEffect } from 'react';
import { usePlanStore } from '../store/usePlanStore';
import { isSupabaseConfigured } from '../lib/supabase';
import { syncToCloud, syncFromCloud } from '../lib/sync';

function CloudSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);

  const { periods, records } = usePlanStore();

  useEffect(() => {
    setIsConfigured(isSupabaseConfigured());
  }, []);

  // 클라우드에 업로드
  const handleUpload = async () => {
    if (isSyncing) return;
    setIsSyncing(true);

    try {
      const success = await syncToCloud(periods, records);
      if (success) {
        setLastSync(new Date().toLocaleTimeString('ko-KR'));
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  // 클라우드에서 다운로드
  const handleDownload = async () => {
    if (isSyncing) return;
    setIsSyncing(true);

    try {
      const data = await syncFromCloud();
      if (data) {
        // Zustand 상태 업데이트
        usePlanStore.setState({
          periods: { ...usePlanStore.getState().periods, ...data.periods },
          records: { ...usePlanStore.getState().records, ...data.records },
        });
        setLastSync(new Date().toLocaleTimeString('ko-KR'));
      }
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isConfigured) {
    return (
      <div className="text-xs text-gray-400 flex items-center gap-1">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
        </svg>
        <span>로컬 저장</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/* 동기화 상태 */}
      <div className="text-xs text-gray-500">
        {lastSync ? `동기화: ${lastSync}` : '클라우드 연결됨'}
      </div>

      {/* 업로드 버튼 */}
      <button
        onClick={handleUpload}
        disabled={isSyncing}
        className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600 hover:text-blue-600 transition-colors disabled:opacity-50"
        title="클라우드에 업로드"
      >
        <svg className={`w-4 h-4 ${isSyncing ? 'animate-pulse' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      </button>

      {/* 다운로드 버튼 */}
      <button
        onClick={handleDownload}
        disabled={isSyncing}
        className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600 hover:text-green-600 transition-colors disabled:opacity-50"
        title="클라우드에서 다운로드"
      >
        <svg className={`w-4 h-4 ${isSyncing ? 'animate-pulse' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
        </svg>
      </button>
    </div>
  );
}

export { CloudSync };
