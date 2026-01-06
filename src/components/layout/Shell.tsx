"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePlanStore, getPeriodId, getISOWeek, getISOWeekYear } from '@/store/usePlanStore';
import { Level, LEVEL_CONFIG, LEVELS } from '@/types/plan';
import { ChatAssistant } from '@/components/ChatAssistant';
import { CloudSync } from '@/components/CloudSync';

interface ShellProps {
  children: React.ReactNode;
}

export const Shell: React.FC<ShellProps> = ({ children }) => {
  const { currentLevel, baseYear, setBaseYear, navigateTo } = usePlanStore();
  const [showSettings, setShowSettings] = useState(false);

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
              <div className="absolute right-0 top-full mt-2 bg-white border shadow-lg rounded-lg p-4 z-50 w-64">
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
                <button
                  onClick={() => setShowSettings(false)}
                  className="mt-3 w-full py-1 bg-gray-100 rounded text-sm hover:bg-gray-200"
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
    </div>
  );
};
