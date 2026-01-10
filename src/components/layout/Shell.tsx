"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePlanStore, getPeriodId, getISOWeek, getISOWeekYear } from '@/store/usePlanStore';
import { Level, LEVEL_CONFIG, LEVELS } from '@/types/plan';
import { ChatAssistant } from '@/components/ChatAssistant';
import { CloudSync } from '@/components/CloudSync';
import { SearchModal } from '@/components/SearchModal';
import { loadSettings, setGeminiApiKey, clearApiKeyCache } from '@/lib/settings';

interface ShellProps {
  children: React.ReactNode;
}

export const Shell: React.FC<ShellProps> = ({ children }) => {
  const { currentLevel, baseYear, setBaseYear, navigateTo } = usePlanStore();
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // API 키 관련 상태
  const [apiKey, setApiKey] = useState('');
  const [apiKeyStatus, setApiKeyStatus] = useState<'idle' | 'loading' | 'valid' | 'invalid'>('idle');
  const [isSavingKey, setIsSavingKey] = useState(false);

  // 설정 로드
  useEffect(() => {
    loadSettings().then((settings) => {
      if (settings.geminiApiKey) {
        setApiKey(settings.geminiApiKey);
        setApiKeyStatus('valid');
      }
    });
  }, []);

  // API 키 저장
  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) return;

    setIsSavingKey(true);
    setApiKeyStatus('loading');

    try {
      const success = await setGeminiApiKey(apiKey.trim());
      if (success) {
        setApiKeyStatus('valid');
        clearApiKeyCache();
      } else {
        setApiKeyStatus('invalid');
      }
    } catch {
      setApiKeyStatus('invalid');
    } finally {
      setIsSavingKey(false);
    }
  };

  // Ctrl/Cmd + K 단축키
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLevelClick = (level: Level) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentQuarter = Math.ceil(currentMonth / 3);

    let periodId: string;

    switch (level) {
      case 'THIRTY_YEAR':
        periodId = '30y';
        break;
      case 'FIVE_YEAR':
        // 현재 연도에 해당하는 5년 구간
        const fiveYearIndex = Math.floor((currentYear - baseYear) / 5);
        periodId = getPeriodId('FIVE_YEAR', baseYear, { fiveYearIndex: Math.max(0, fiveYearIndex) });
        break;
      case 'YEAR':
        periodId = getPeriodId('YEAR', baseYear, { year: currentYear });
        break;
      case 'QUARTER':
        periodId = getPeriodId('QUARTER', baseYear, { year: currentYear, quarter: currentQuarter });
        break;
      case 'MONTH':
        periodId = getPeriodId('MONTH', baseYear, { year: currentYear, month: currentMonth });
        break;
      case 'WEEK': {
        // ISO 주차 사용 (1월 초가 전년도 주차, 12월 말이 다음해 주차일 수 있음)
        const weekNum = getISOWeek(now);
        const weekYear = getISOWeekYear(now);
        periodId = getPeriodId('WEEK', baseYear, { year: weekYear, week: weekNum });
        break;
      }
      case 'DAY':
        periodId = getPeriodId('DAY', baseYear, {
          year: currentYear,
          month: currentMonth,
          day: now.getDate()
        });
        break;
      default:
        periodId = '30y';
    }

    navigateTo(periodId);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-gray-50 text-gray-800">
      {/* Header / Nav */}
      <header className="h-14 border-b border-gray-200 bg-white shadow-sm px-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="font-bold text-lg text-gray-900">Life Planner</h1>
          <nav className="flex gap-1 text-sm bg-gray-100 p-1 rounded-lg">
            {LEVELS.map((level) => (
              <button
                key={level}
                onClick={() => handleLevelClick(level)}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  currentLevel === level
                    ? 'bg-white shadow-sm text-blue-600 font-medium'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {LEVEL_CONFIG[level].label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {/* 검색 버튼 */}
          <button
            onClick={() => setShowSearch(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <span className="hidden md:inline">검색</span>
            <kbd className="hidden md:inline text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
              ⌘K
            </kbd>
          </button>

          {/* 클라우드 동기화 */}
          <CloudSync />

          {/* 루틴 관리 링크 */}
          <Link
            href="/routines"
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            루틴 관리
          </Link>

          {/* 기념일 관리 링크 */}
          <Link
            href="/events"
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            🎂 기념일
          </Link>

          {/* 설정 버튼 */}
          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              설정
            </button>

            {showSettings && (
              <div className="absolute right-0 top-full mt-2 bg-white border shadow-lg rounded-lg p-4 z-50 w-80">
                {/* 30년 계획 시작 연도 */}
                <h3 className="font-medium text-sm mb-3">30년 계획 시작 연도</h3>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={baseYear}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (val > 1900 && val < 2200) {
                        setBaseYear(val);
                      }
                    }}
                    className="w-24 px-2 py-1 border rounded text-sm text-center font-medium"
                  />
                  <span className="text-gray-400">~</span>
                  <span className="font-medium text-gray-700">{baseYear + 29}</span>
                </div>

                {/* Gemini API 키 설정 */}
                <div className="border-t border-gray-200 mt-4 pt-4">
                  <h3 className="font-medium text-sm mb-2 flex items-center gap-2">
                    <span>Gemini API 키</span>
                    {apiKeyStatus === 'valid' && (
                      <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">연결됨</span>
                    )}
                    {apiKeyStatus === 'invalid' && (
                      <span className="text-xs text-red-600 bg-red-50 px-1.5 py-0.5 rounded">오류</span>
                    )}
                    {apiKeyStatus === 'loading' && (
                      <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">확인중...</span>
                    )}
                  </h3>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="API 키 입력..."
                      className="flex-1 px-2 py-1.5 border rounded text-sm"
                    />
                    <button
                      onClick={handleSaveApiKey}
                      disabled={isSavingKey || !apiKey.trim()}
                      className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isSavingKey ? '...' : '저장'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    AI 어시스턴트 사용을 위해 필요합니다.{' '}
                    <a
                      href="https://aistudio.google.com/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      키 발급받기
                    </a>
                  </p>
                </div>

                <button
                  onClick={() => setShowSettings(false)}
                  className="mt-4 w-full py-1.5 bg-gray-100 rounded text-sm hover:bg-gray-200 transition-colors"
                >
                  닫기
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>

      {/* AI 어시스턴트 */}
      <ChatAssistant />

      {/* 검색 모달 */}
      <SearchModal isOpen={showSearch} onClose={() => setShowSearch(false)} />
    </div>
  );
};
