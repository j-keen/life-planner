"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePlanStore, getPeriodId } from '@/store/usePlanStore';
import { Level, LEVEL_CONFIG, LEVELS } from '@/types/plan';

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
      case 'WEEK':
        const startOfYear = new Date(currentYear, 0, 1);
        const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
        const weekNum = Math.ceil((days + 1) / 7);
        periodId = getPeriodId('WEEK', baseYear, { year: currentYear, week: weekNum });
        break;
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
          {/* 루틴 관리 링크 */}
          <Link
            href="/routines"
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            루틴 관리
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
                <h3 className="font-medium text-sm mb-3">기준 연도 설정</h3>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">30세 기준 연도:</label>
                  <input
                    type="number"
                    value={baseYear}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (val > 1950 && val < 2100) {
                        setBaseYear(val);
                      }
                    }}
                    className="w-20 px-2 py-1 border rounded text-sm"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  생년: {baseYear - 30}년 (현재 {new Date().getFullYear() - (baseYear - 30)}세)
                </p>
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
    </div>
  );
};
