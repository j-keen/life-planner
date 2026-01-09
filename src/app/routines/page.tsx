"use client";

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { usePlanStore, parsePeriodId, getPeriodId, getResetKey } from '@/store/usePlanStore';
import { Item, Level, LEVEL_CONFIG, LEVELS, SOURCE_TAG_LABELS } from '@/types/plan';

// 고유 ID 생성
const genId = () => Math.random().toString(36).substr(2, 9);

interface RoutineWithPeriod extends Item {
  periodId: string;
  periodLevel: Level;
}

export default function RoutinesPage() {
  const { periods, baseYear } = usePlanStore();
  const [filterLevel, setFilterLevel] = useState<Level | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // 모든 기간에서 루틴 수집
  const allRoutines = useMemo(() => {
    const routines: RoutineWithPeriod[] = [];

    Object.entries(periods).forEach(([periodId, period]) => {
      if (period.routines && period.routines.length > 0) {
        period.routines.forEach((routine) => {
          routines.push({
            ...routine,
            periodId,
            periodLevel: period.level,
          });
        });
      }
    });

    // 레벨별로 정렬
    return routines.sort((a, b) => {
      const levelIndexA = LEVELS.indexOf(a.periodLevel);
      const levelIndexB = LEVELS.indexOf(b.periodLevel);
      return levelIndexA - levelIndexB;
    });
  }, [periods]);

  // 필터링
  const filteredRoutines = useMemo(() => {
    return allRoutines.filter((routine) => {
      // 레벨 필터
      if (filterLevel !== 'ALL' && routine.periodLevel !== filterLevel) {
        return false;
      }
      // 검색어 필터
      if (searchTerm && !routine.content.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [allRoutines, filterLevel, searchTerm]);

  // 레벨별 그룹화
  const groupedRoutines = useMemo(() => {
    const groups: Record<Level, RoutineWithPeriod[]> = {
      THIRTY_YEAR: [],
      FIVE_YEAR: [],
      YEAR: [],
      QUARTER: [],
      MONTH: [],
      WEEK: [],
      DAY: [],
    };

    filteredRoutines.forEach((routine) => {
      groups[routine.periodLevel].push(routine);
    });

    return groups;
  }, [filteredRoutines]);

  // 기간 라벨 생성
  const getPeriodLabel = (periodId: string): string => {
    const parsed = parsePeriodId(periodId);

    switch (parsed.level) {
      case 'THIRTY_YEAR':
        return '30년 계획';
      case 'FIVE_YEAR':
        return `${parsed.fiveYearIndex! + 1}번째 5년`;
      case 'YEAR':
        return `${parsed.year}년`;
      case 'QUARTER':
        return `${parsed.year}년 Q${parsed.quarter}`;
      case 'MONTH':
        return `${parsed.year}년 ${parsed.month}월`;
      case 'WEEK':
        return `${parsed.year}년 ${parsed.week}주차`;
      case 'DAY':
        return `${parsed.year}.${parsed.month}.${parsed.day}`;
      default:
        return periodId;
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-gray-50 text-gray-800">
      {/* Header */}
      <header className="h-14 border-b border-gray-200 bg-white shadow-sm px-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-gray-500 hover:text-gray-700">
            ← 돌아가기
          </Link>
          <h1 className="font-bold text-lg text-gray-900">루틴 관리</h1>
        </div>

        <div className="flex items-center gap-4">
          {/* 검색 */}
          <input
            type="text"
            placeholder="루틴 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-1.5 border rounded-lg text-sm w-48"
          />

          {/* 레벨 필터 */}
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value as Level | 'ALL')}
            className="px-3 py-1.5 border rounded-lg text-sm"
          >
            <option value="ALL">전체 레벨</option>
            {LEVELS.map((level) => (
              <option key={level} value={level}>
                {LEVEL_CONFIG[level].label}
              </option>
            ))}
          </select>

          {/* 루틴 추가 버튼 */}
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-1.5 bg-purple-500 text-white rounded-lg text-sm hover:bg-purple-600 transition-colors"
          >
            + 루틴 추가
          </button>
        </div>
      </header>

      {/* 루틴 추가 폼 */}
      {showAddForm && (
        <AddRoutineForm
          baseYear={baseYear}
          onClose={() => setShowAddForm(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-6">
        {allRoutines.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg mb-2">등록된 루틴이 없습니다</p>
            <p className="text-sm">각 기간의 루틴 패널에서 루틴을 추가해보세요</p>
            <Link
              href="/"
              className="inline-block mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              플래너로 이동
            </Link>
          </div>
        ) : (
          <div className="space-y-8 max-w-4xl mx-auto">
            {LEVELS.map((level) => {
              const routines = groupedRoutines[level];
              if (routines.length === 0) return null;

              return (
                <section key={level} className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 rounded-t-xl">
                    <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                      <span className="text-blue-500">{SOURCE_TAG_LABELS[level]}</span>
                      <span className="text-sm text-gray-400">({routines.length}개)</span>
                    </h2>
                  </div>

                  <div className="divide-y divide-gray-100">
                    {routines.map((routine) => (
                      <RoutineRow
                        key={routine.id}
                        routine={routine}
                        periodLabel={getPeriodLabel(routine.periodId)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}

            {filteredRoutines.length === 0 && allRoutines.length > 0 && (
              <div className="text-center py-12 text-gray-500">
                <p>검색 결과가 없습니다</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// 루틴 행 컴포넌트
function RoutineRow({
  routine,
  periodLabel,
}: {
  routine: RoutineWithPeriod;
  periodLabel: string;
}) {
  const { periods, navigateTo } = usePlanStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(routine.content);
  const [editTargetCount, setEditTargetCount] = useState(routine.targetCount || 0);

  const handleSave = () => {
    const period = periods[routine.periodId];
    if (!period) return;

    // store 직접 업데이트
    const state = usePlanStore.getState();
    const updatedRoutines = period.routines.map((r) =>
      r.id === routine.id
        ? { ...r, content: editContent, targetCount: editTargetCount, currentCount: editTargetCount }
        : r
    );

    usePlanStore.setState({
      periods: {
        ...state.periods,
        [routine.periodId]: {
          ...period,
          routines: updatedRoutines,
        },
      },
    });

    setIsEditing(false);
  };

  const handleDelete = () => {
    if (!confirm('이 루틴을 삭제하시겠습니까?')) return;

    const period = periods[routine.periodId];
    if (!period) return;

    const state = usePlanStore.getState();
    const updatedRoutines = period.routines.filter((r) => r.id !== routine.id);

    usePlanStore.setState({
      periods: {
        ...state.periods,
        [routine.periodId]: {
          ...period,
          routines: updatedRoutines,
        },
      },
    });
  };

  const handleGoToPeriod = () => {
    navigateTo(routine.periodId);
    window.location.href = '/';
  };

  return (
    <div className="px-5 py-4 hover:bg-gray-50 transition-colors group/row">
      {isEditing ? (
        <div className="space-y-3">
          <div className="flex gap-3">
            <input
              type="text"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="flex-1 px-3 py-2 border rounded-lg"
              placeholder="루틴 내용"
              autoFocus
            />
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">목표:</span>
              <input
                type="number"
                value={editTargetCount}
                onChange={(e) => setEditTargetCount(parseInt(e.target.value) || 0)}
                className="w-16 px-2 py-2 border rounded-lg text-center"
                min={0}
              />
              <span className="text-sm text-gray-500">회</span>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsEditing(false)}
              className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              저장
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <span className={`font-medium ${routine.color || ''}`}>
                {routine.content}
              </span>
              {routine.targetCount !== undefined && (
                <span className="text-sm text-gray-400">
                  {routine.currentCount ?? routine.targetCount}/{routine.targetCount}회
                </span>
              )}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {periodLabel}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleGoToPeriod}
              className="px-2 py-1 text-xs text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded"
              title="해당 기간으로 이동"
            >
              이동
            </button>
            <button
              onClick={() => setIsEditing(true)}
              className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
            >
              수정
            </button>
            <button
              onClick={handleDelete}
              className="px-2 py-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
            >
              삭제
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// 루틴 추가 폼 컴포넌트
function AddRoutineForm({
  baseYear,
  onClose,
}: {
  baseYear: number;
  onClose: () => void;
}) {
  const { periods } = usePlanStore();
  const [content, setContent] = useState('');
  const [targetCount, setTargetCount] = useState(1);
  const [selectedLevel, setSelectedLevel] = useState<Level>('WEEK');

  // 현재 날짜 기준 기간 ID 생성
  const getCurrentPeriodId = (level: Level): string => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentQuarter = Math.ceil(currentMonth / 3);

    switch (level) {
      case 'THIRTY_YEAR':
        return '30y';
      case 'FIVE_YEAR': {
        const fiveYearIndex = Math.floor((currentYear - baseYear) / 5);
        return getPeriodId('FIVE_YEAR', baseYear, { fiveYearIndex: Math.max(0, fiveYearIndex) });
      }
      case 'YEAR':
        return getPeriodId('YEAR', baseYear, { year: currentYear });
      case 'QUARTER':
        return getPeriodId('QUARTER', baseYear, { year: currentYear, quarter: currentQuarter });
      case 'MONTH':
        return getPeriodId('MONTH', baseYear, { year: currentYear, month: currentMonth });
      case 'WEEK': {
        const startOfYear = new Date(currentYear, 0, 1);
        const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
        const weekNum = Math.ceil((days + 1) / 7);
        return getPeriodId('WEEK', baseYear, { year: currentYear, week: weekNum });
      }
      case 'DAY':
        return getPeriodId('DAY', baseYear, {
          year: currentYear,
          month: currentMonth,
          day: now.getDate()
        });
      default:
        return '30y';
    }
  };

  const handleSubmit = () => {
    if (!content.trim()) return;

    const periodId = getCurrentPeriodId(selectedLevel);
    const state = usePlanStore.getState();

    // 기간이 없으면 생성
    let period = state.periods[periodId];
    if (!period) {
      period = {
        id: periodId,
        level: selectedLevel,
        goal: '',
        motto: '',
        memo: '',
        memos: [],
        structuredMemos: [],
        todos: [],
        routines: [],
        slots: {},
      };
      if (selectedLevel === 'DAY') {
        period.timeSlots = {
          dawn: [],
          morning_early: [],
          morning_late: [],
          afternoon_early: [],
          afternoon_late: [],
          evening_early: [],
          evening_late: [],
          anytime: [],
        };
      }
    }

    // 새 루틴 생성
    const initialResetKey = getResetKey(periodId, selectedLevel);
    const newRoutine: Item = {
      id: genId(),
      content: content.trim(),
      isCompleted: false,
      targetCount,
      currentCount: targetCount,
      originPeriodId: periodId,
      sourceLevel: selectedLevel,
      sourceType: 'routine',  // 뱃지 표시용
      lastResetDate: initialResetKey,
    };

    usePlanStore.setState({
      periods: {
        ...state.periods,
        [periodId]: {
          ...period,
          routines: [...period.routines, newRoutine],
        },
      },
      allItems: {
        ...state.allItems,
        [newRoutine.id]: newRoutine,
      },
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-[480px]">
        <h3 className="text-lg font-bold text-gray-800 mb-4">새 루틴 추가</h3>

        <div className="space-y-4">
          {/* 루틴 내용 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">루틴 내용</label>
            <input
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="예: 운동, 독서, 명상..."
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
              autoFocus
            />
          </div>

          {/* 레벨 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">적용 레벨</label>
            <div className="grid grid-cols-3 gap-2">
              {(['FIVE_YEAR', 'YEAR', 'QUARTER', 'MONTH', 'WEEK', 'DAY'] as Level[]).map((level) => (
                <button
                  key={level}
                  onClick={() => setSelectedLevel(level)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedLevel === level
                      ? 'bg-purple-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {LEVEL_CONFIG[level].label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {selectedLevel === 'FIVE_YEAR' && '5년 반복 루틴 (5년마다 리셋)'}
              {selectedLevel === 'YEAR' && '연간 반복 루틴 (매년 리셋)'}
              {selectedLevel === 'QUARTER' && '분기 반복 루틴 (분기마다 리셋)'}
              {selectedLevel === 'MONTH' && '월간 반복 루틴 (매월 리셋)'}
              {selectedLevel === 'WEEK' && '주간 반복 루틴 (매주 리셋)'}
              {selectedLevel === 'DAY' && '일간 반복 루틴 (매일 리셋)'}
            </p>
          </div>

          {/* 목표 횟수 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">목표 횟수</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={targetCount}
                onChange={(e) => setTargetCount(Math.max(1, parseInt(e.target.value) || 1))}
                min={1}
                className="w-24 px-3 py-2.5 border border-gray-200 rounded-lg text-center"
              />
              <span className="text-gray-500">회 / {LEVEL_CONFIG[selectedLevel].label}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={!content.trim()}
            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            추가
          </button>
        </div>
      </div>
    </div>
  );
}
