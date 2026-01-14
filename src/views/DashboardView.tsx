"use client";

import React, { useMemo } from 'react';
import { usePlanStore, getChildPeriodIds } from '@/store/usePlanStore';
import { CATEGORY_CONFIG, CATEGORIES, Category, MOOD_CONFIG, Mood, TODO_CATEGORY_CONFIG, TodoCategory } from '@/types/plan';

export const DashboardView: React.FC = () => {
  const {
    currentPeriodId,
    currentLevel,
    baseYear,
    periods,
    records,
    getUpcomingEvents,
    navigateTo,
  } = usePlanStore();

  const period = periods[currentPeriodId];

  // 할일 완료율 계산
  const todoStats = useMemo(() => {
    if (!period) return { completed: 0, total: 0, rate: 0 };
    const todos = period.todos.filter(t => !t.parentId); // 최상위만
    const completed = todos.filter(t => t.isCompleted).length;
    return {
      completed,
      total: todos.length,
      rate: todos.length > 0 ? Math.round((completed / todos.length) * 100) : 0,
    };
  }, [period]);

  // 루틴 실천율 계산
  const routineStats = useMemo(() => {
    if (!period) return { completed: 0, total: 0, rate: 0, byCategory: {} as Record<Category, { completed: number; total: number }> };

    const routines = period.routines.filter(r => !r.parentId); // 최상위만
    const completed = routines.filter(r => r.isCompleted || (r.currentCount !== undefined && r.currentCount === 0)).length;

    // 카테고리별 분석
    const byCategory: Record<Category, { completed: number; total: number }> = {} as Record<Category, { completed: number; total: number }>;
    CATEGORIES.forEach(cat => {
      byCategory[cat] = { completed: 0, total: 0 };
    });

    routines.forEach(r => {
      const cat = r.category || 'uncategorized';
      byCategory[cat].total++;
      if (r.isCompleted || (r.currentCount !== undefined && r.currentCount === 0)) {
        byCategory[cat].completed++;
      }
    });

    return {
      completed,
      total: routines.length,
      rate: routines.length > 0 ? Math.round((completed / routines.length) * 100) : 0,
      byCategory,
    };
  }, [period]);

  // 할일 카테고리별 분석
  const todoCategoryStats = useMemo(() => {
    if (!period) return {} as Record<TodoCategory, { completed: number; total: number }>;

    const stats: Record<TodoCategory, { completed: number; total: number }> = {
      personal: { completed: 0, total: 0 },
      work: { completed: 0, total: 0 },
      other: { completed: 0, total: 0 },
    };

    period.todos.filter(t => !t.parentId).forEach(t => {
      const cat = t.todoCategory || 'other';
      stats[cat].total++;
      if (t.isCompleted) stats[cat].completed++;
    });

    return stats;
  }, [period]);

  // 현재 기록
  const currentRecord = records[currentPeriodId];

  // 예정된 기념일
  const upcomingEvents = useMemo(() => getUpcomingEvents(30), [getUpcomingEvents]);

  // 하위 기간들의 기록 수집 (기분 트렌드)
  const childRecords = useMemo(() => {
    const childIds = getChildPeriodIds(currentPeriodId, baseYear);
    return childIds
      .map(id => ({ id, record: records[id] }))
      .filter(({ record }) => record?.mood);
  }, [currentPeriodId, baseYear, records]);

  if (!period) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">기간을 선택해주세요</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Life Planner 대시보드</h1>
          <p className="text-gray-500">현재 기간: {currentLevel} - {currentPeriodId}</p>
        </div>

        {/* 현재 기간 요약 */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-lg font-medium opacity-90">목표</h2>
              <p className="text-xl font-bold">{period.goal || '(설정된 목표 없음)'}</p>
            </div>
            <div>
              <h2 className="text-lg font-medium opacity-90">모토</h2>
              <p className="text-xl font-bold">{period.motto || '(설정된 모토 없음)'}</p>
            </div>
            {currentRecord?.mood && (
              <div className="text-center">
                <h2 className="text-lg font-medium opacity-90">기분</h2>
                <p className="text-4xl">{MOOD_CONFIG[currentRecord.mood].emoji}</p>
              </div>
            )}
          </div>
        </div>

        {/* 통계 카드 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 할일 완료율 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span className="text-2xl">✅</span> 할일 완료율
            </h3>
            <div className="mb-4">
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">{todoStats.completed} / {todoStats.total} 완료</span>
                <span className="font-bold text-blue-600">{todoStats.rate}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${todoStats.rate}%` }}
                />
              </div>
            </div>
            {/* 할일 카테고리별 */}
            <div className="space-y-2">
              {Object.entries(todoCategoryStats).map(([cat, stats]) => (
                <div key={cat} className="flex items-center justify-between text-sm">
                  <span className={`${TODO_CATEGORY_CONFIG[cat as TodoCategory].textColor}`}>
                    {TODO_CATEGORY_CONFIG[cat as TodoCategory].icon} {TODO_CATEGORY_CONFIG[cat as TodoCategory].label}
                  </span>
                  <span className="text-gray-600">
                    {stats.completed}/{stats.total}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 루틴 실천율 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span className="text-2xl">🔄</span> 루틴 실천율
            </h3>
            <div className="mb-4">
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">{routineStats.completed} / {routineStats.total} 완료</span>
                <span className="font-bold text-green-600">{routineStats.rate}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-green-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${routineStats.rate}%` }}
                />
              </div>
            </div>
            {/* 루틴 카테고리별 */}
            <div className="space-y-2">
              {CATEGORIES.filter(cat => routineStats.byCategory[cat]?.total > 0).map(cat => (
                <div key={cat} className="flex items-center justify-between text-sm">
                  <span className={`${CATEGORY_CONFIG[cat].textColor}`}>
                    {CATEGORY_CONFIG[cat].icon} {CATEGORY_CONFIG[cat].label}
                  </span>
                  <span className="text-gray-600">
                    {routineStats.byCategory[cat].completed}/{routineStats.byCategory[cat].total}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 하위 기간 기분 트렌드 */}
        {childRecords.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span className="text-2xl">📈</span> 기분 트렌드
            </h3>
            <div className="flex flex-wrap gap-2">
              {childRecords.map(({ id, record }) => (
                <button
                  key={id}
                  onClick={() => navigateTo(id)}
                  className="flex flex-col items-center p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  title={`${id} - ${MOOD_CONFIG[record!.mood!].label}`}
                >
                  <span className="text-2xl">{MOOD_CONFIG[record!.mood!].emoji}</span>
                  <span className="text-xs text-gray-500 mt-1">{id.split('-').slice(-1)[0]}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 예정된 기념일 & 하이라이트 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 예정된 기념일 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span className="text-2xl">🎂</span> 예정된 기념일 (30일 내)
            </h3>
            {upcomingEvents.length > 0 ? (
              <div className="space-y-3">
                {upcomingEvents.slice(0, 5).map(event => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{event.type === 'birthday' ? '🎂' : '🎉'}</span>
                      <div>
                        <p className="font-medium text-gray-800">{event.title}</p>
                        <p className="text-sm text-gray-500">
                          {event.nextDate.getMonth() + 1}월 {event.nextDate.getDate()}일
                        </p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded text-sm font-medium ${
                      event.daysUntil === 0 ? 'bg-red-100 text-red-700' :
                      event.daysUntil <= 7 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {event.daysUntil === 0 ? '오늘!' : `D-${event.daysUntil}`}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">예정된 기념일이 없습니다</p>
            )}
          </div>

          {/* 하이라이트 & 감사 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span className="text-2xl">⭐</span> 하이라이트 & 감사
            </h3>
            {currentRecord ? (
              <div className="space-y-4">
                {currentRecord.highlights.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-600 mb-2">하이라이트</h4>
                    <ul className="space-y-1">
                      {currentRecord.highlights.map((h, i) => (
                        <li key={i} className="text-sm text-gray-800 flex items-start gap-2">
                          <span className="text-yellow-500">★</span>
                          {h}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {currentRecord.gratitude.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-600 mb-2">감사</h4>
                    <ul className="space-y-1">
                      {currentRecord.gratitude.map((g, i) => (
                        <li key={i} className="text-sm text-gray-800 flex items-start gap-2">
                          <span className="text-pink-500">♥</span>
                          {g}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {currentRecord.highlights.length === 0 && currentRecord.gratitude.length === 0 && (
                  <p className="text-gray-500 text-center py-4">기록된 내용이 없습니다</p>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">이 기간의 기록이 없습니다</p>
            )}
          </div>
        </div>

        {/* 사용 가이드 */}
        <div className="bg-gradient-to-r from-gray-700 to-gray-900 rounded-xl shadow-lg p-6 text-white">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="text-2xl">💡</span> 효과적인 사용 팁
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="bg-white/10 rounded-lg p-4">
              <h4 className="font-medium mb-2">📅 주간 계획 (WEEK)</h4>
              <p className="opacity-80">주 초에 할일/루틴을 등록하고, 요일별 슬롯에 드래그로 배정하세요.</p>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <h4 className="font-medium mb-2">⏰ 일일 실행 (DAY)</h4>
              <p className="opacity-80">8개 시간대에 할일을 배치하고, 완료 시 체크하세요.</p>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <h4 className="font-medium mb-2">📊 월간 리뷰 (MONTH)</h4>
              <p className="opacity-80">대시보드에서 완료율을 확인하고, 카테고리별 균형을 점검하세요.</p>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <h4 className="font-medium mb-2">🔄 루틴 관리</h4>
              <p className="opacity-80">상위 레벨에서 큰 루틴을 등록하고, 하위로 자동 상속시키세요.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
