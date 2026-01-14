"use client";

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  usePlanStore,
  getChildPeriodIds,
  getPeriodId,
  parsePeriodId,
  getParentPeriodId,
  getISOWeek,
  getWeeksInMonth,
} from '@/store/usePlanStore';
import {
  CATEGORY_CONFIG,
  CATEGORIES,
  Category,
  MOOD_CONFIG,
  Mood,
  TODO_CATEGORY_CONFIG,
  TodoCategory,
  TIME_SLOTS,
  TIME_SLOT_CONFIG,
  TimeSlot,
} from '@/types/plan';

export const DashboardView: React.FC = () => {
  const router = useRouter();
  const {
    baseYear,
    periods,
    records,
    navigateTo,
    getUpcomingEvents,
    toggleComplete,
    addGratitude,
  } = usePlanStore();

  // 대시보드에서 할일/루틴 토글 (currentPeriodId를 해당 기간으로 설정 후 토글)
  const handleToggleTodo = (periodId: string, itemId: string) => {
    navigateTo(periodId);
    toggleComplete(itemId, 'todo');
  };

  const handleToggleRoutine = (periodId: string, itemId: string) => {
    navigateTo(periodId);
    toggleComplete(itemId, 'routine');
  };

  // 오늘 날짜 정보
  const today = useMemo(() => {
    const now = new Date();
    return {
      date: now,
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
      dayOfWeek: now.getDay(), // 0 = 일요일
    };
  }, []);

  // 오늘의 periodId
  const todayPeriodId = useMemo(() => {
    return getPeriodId('DAY', baseYear, {
      year: today.year,
      month: today.month,
      day: today.day,
    });
  }, [baseYear, today]);

  // 이번 주의 periodId
  const thisWeekPeriodId = useMemo(() => {
    const weeksInMonth = getWeeksInMonth(today.year, today.month);
    const todayDate = today.date;
    const weekInfo = weeksInMonth.find(w => todayDate >= w.start && todayDate <= w.end);
    if (weekInfo) {
      return `w-${today.year}-${String(today.month).padStart(2, '0')}-${weekInfo.weekNum}`;
    }
    return `w-${today.year}-${String(today.month).padStart(2, '0')}-1`;
  }, [today]);

  // 이번 달의 periodId
  const thisMonthPeriodId = useMemo(() => {
    return getPeriodId('MONTH', baseYear, {
      year: today.year,
      month: today.month,
    });
  }, [baseYear, today]);

  // 이번 분기의 periodId
  const thisQuarterPeriodId = useMemo(() => {
    const quarter = Math.ceil(today.month / 3);
    return getPeriodId('QUARTER', baseYear, {
      year: today.year,
      quarter,
    });
  }, [baseYear, today]);

  // 올해의 periodId
  const thisYearPeriodId = useMemo(() => {
    return getPeriodId('YEAR', baseYear, { year: today.year });
  }, [baseYear, today]);

  // 오늘의 period
  const todayPeriod = periods[todayPeriodId];
  const thisWeekPeriod = periods[thisWeekPeriodId];
  const todayRecord = records[todayPeriodId];

  // 오늘의 할일/루틴 (최상위만)
  const todayTodos = useMemo(() => {
    if (!todayPeriod) return [];
    return todayPeriod.todos.filter(t => !t.parentId);
  }, [todayPeriod]);

  const todayRoutines = useMemo(() => {
    if (!todayPeriod) return [];
    return todayPeriod.routines.filter(r => !r.parentId);
  }, [todayPeriod]);

  // 오늘의 포커스 (상위 3개)
  const focusTodos = useMemo(() => {
    return todayTodos.filter(t => !t.isCompleted).slice(0, 3);
  }, [todayTodos]);

  // 할일 완료율
  const todoStats = useMemo(() => {
    const completed = todayTodos.filter(t => t.isCompleted).length;
    const total = todayTodos.length;
    return {
      completed,
      total,
      rate: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }, [todayTodos]);

  // 루틴 완료율
  const routineStats = useMemo(() => {
    const completed = todayRoutines.filter(r => r.isCompleted).length;
    const total = todayRoutines.length;
    return {
      completed,
      total,
      rate: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }, [todayRoutines]);

  // 이번 주 요일별 데이터
  const weekDays = useMemo(() => {
    const days: { id: string; dayNum: number; dayName: string; todoCount: number; routineCount: number; isToday: boolean }[] = [];
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

    // 이번 주의 시작일 (월요일) 찾기
    const todayDate = new Date(today.year, today.month - 1, today.day);
    const dayOfWeek = todayDate.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(todayDate);
    monday.setDate(todayDate.getDate() + mondayOffset);

    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      const dayId = getPeriodId('DAY', baseYear, {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate(),
      });
      const period = periods[dayId];
      const isToday = date.getDate() === today.day && date.getMonth() + 1 === today.month && date.getFullYear() === today.year;

      days.push({
        id: dayId,
        dayNum: date.getDate(),
        dayName: dayNames[(i + 1) % 7], // 월요일부터 시작
        todoCount: period?.todos.filter(t => !t.parentId).length || 0,
        routineCount: period?.routines.filter(r => !r.parentId).length || 0,
        isToday,
      });
    }

    return days;
  }, [today, baseYear, periods]);

  // 카테고리별 루틴 통계
  const categoryStats = useMemo(() => {
    const stats: Record<Category, { completed: number; total: number }> = {} as any;
    CATEGORIES.forEach(cat => {
      stats[cat] = { completed: 0, total: 0 };
    });

    todayRoutines.forEach(r => {
      const cat = r.category || 'uncategorized';
      stats[cat].total++;
      if (r.isCompleted) stats[cat].completed++;
    });

    return stats;
  }, [todayRoutines]);

  // 기분 트렌드 (최근 7일)
  const moodTrend = useMemo(() => {
    const trend: { id: string; mood?: Mood; dayNum: number }[] = [];
    const todayDate = new Date(today.year, today.month - 1, today.day);

    for (let i = 6; i >= 0; i--) {
      const date = new Date(todayDate);
      date.setDate(todayDate.getDate() - i);
      const dayId = getPeriodId('DAY', baseYear, {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate(),
      });
      const record = records[dayId];
      trend.push({
        id: dayId,
        mood: record?.mood,
        dayNum: date.getDate(),
      });
    }

    return trend;
  }, [today, baseYear, records]);

  // 시간대별 계획 (오늘)
  const timeSlotItems = useMemo((): Record<TimeSlot, { todos: any[]; routines: any[] }> => {
    const emptyItems: Record<TimeSlot, { todos: any[]; routines: any[] }> = {} as any;
    TIME_SLOTS.forEach(slot => {
      emptyItems[slot] = { todos: [], routines: [] };
    });
    if (!todayPeriod?.timeSlots) return emptyItems;
    const items: Record<TimeSlot, { todos: any[]; routines: any[] }> = { ...emptyItems };

    TIME_SLOTS.forEach(slot => {
      const slotItems = todayPeriod.timeSlots?.[slot] || [];
      items[slot] = {
        todos: slotItems.filter(item => item.sourceType === 'todo' || (!item.sourceType && !item.category)),
        routines: slotItems.filter(item => item.sourceType === 'routine' || item.category),
      };
    });

    return items;
  }, [todayPeriod]);

  // 예정된 기념일
  const upcomingEvents = useMemo(() => getUpcomingEvents(30), [getUpcomingEvents]);

  // 이번 주 하이라이트 (모든 일자의 하이라이트 모음)
  const weekHighlights = useMemo(() => {
    const highlights: string[] = [];
    weekDays.forEach(day => {
      const record = records[day.id];
      if (record?.highlights) {
        highlights.push(...record.highlights);
      }
    });
    return highlights.slice(0, 5);
  }, [weekDays, records]);

  // 상위 목표 연결 (브레드크럼)
  const goalHierarchy = useMemo(() => {
    const hierarchy: { id: string; level: string; goal: string }[] = [];

    // 30년 목표
    const thirtyYear = periods['30y'];
    if (thirtyYear?.goal) {
      hierarchy.push({ id: '30y', level: '30년', goal: thirtyYear.goal });
    }

    // 5년 목표 (현재 연도 기준)
    const fiveYearIndex = Math.floor((today.year - baseYear) / 5);
    const fiveYearId = `5y-${fiveYearIndex}`;
    const fiveYear = periods[fiveYearId];
    if (fiveYear?.goal) {
      hierarchy.push({ id: fiveYearId, level: '5년', goal: fiveYear.goal });
    }

    // 올해 목표
    const year = periods[thisYearPeriodId];
    if (year?.goal) {
      hierarchy.push({ id: thisYearPeriodId, level: '올해', goal: year.goal });
    }

    // 이번 분기 목표
    const quarter = periods[thisQuarterPeriodId];
    if (quarter?.goal) {
      hierarchy.push({ id: thisQuarterPeriodId, level: '분기', goal: quarter.goal });
    }

    // 이번 달 목표
    const month = periods[thisMonthPeriodId];
    if (month?.goal) {
      hierarchy.push({ id: thisMonthPeriodId, level: '이번 달', goal: month.goal });
    }

    // 이번 주 목표
    const week = periods[thisWeekPeriodId];
    if (week?.goal) {
      hierarchy.push({ id: thisWeekPeriodId, level: '이번 주', goal: week.goal });
    }

    return hierarchy;
  }, [periods, baseYear, today, thisYearPeriodId, thisQuarterPeriodId, thisMonthPeriodId, thisWeekPeriodId]);

  // 감사 입력 상태
  const [gratitudeInput, setGratitudeInput] = useState('');

  // 감사 추가 핸들러
  const handleAddGratitude = () => {
    if (gratitudeInput.trim()) {
      addGratitude(todayPeriodId, gratitudeInput.trim());
      setGratitudeInput('');
    }
  };

  // 계획표로 이동
  const goToPlanner = (periodId?: string) => {
    if (periodId) {
      navigateTo(periodId);
    }
    router.push('/planner');
  };

  return (
    <div className="h-full overflow-auto bg-gray-50">
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold mb-1">오늘의 대시보드</h1>
              <p className="opacity-80">
                {today.year}년 {today.month}월 {today.day}일 {['일', '월', '화', '수', '목', '금', '토'][today.dayOfWeek]}요일
              </p>
            </div>
            <button
              onClick={() => goToPlanner(todayPeriodId)}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors font-medium"
            >
              📋 오늘 계획표 열기 →
            </button>
          </div>
        </div>

        {/* 오늘의 포커스 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
            🎯 오늘의 포커스
          </h2>
          <p className="text-sm text-gray-500 mb-4">오늘 가장 중요한 일에 집중하세요</p>

          {focusTodos.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {focusTodos.map((todo, idx) => (
                <div
                  key={todo.id}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    todo.isCompleted
                      ? 'bg-green-50 border-green-300'
                      : 'bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200 hover:border-blue-400'
                  }`}
                  onClick={() => handleToggleTodo(todayPeriodId, todo.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                      todo.isCompleted ? 'bg-green-500 text-white' : 'bg-blue-500 text-white'
                    }`}>
                      {todo.isCompleted ? '✓' : idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium ${todo.isCompleted ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                        {todo.content}
                      </p>
                      {todo.todoCategory && (
                        <span className={`text-xs ${TODO_CATEGORY_CONFIG[todo.todoCategory].textColor}`}>
                          {TODO_CATEGORY_CONFIG[todo.todoCategory].icon} {TODO_CATEGORY_CONFIG[todo.todoCategory].label}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <p>오늘의 할일을 추가해주세요</p>
              <button
                onClick={() => goToPlanner(todayPeriodId)}
                className="mt-2 text-blue-500 hover:text-blue-700 text-sm"
              >
                → 계획표로 이동
              </button>
            </div>
          )}
        </div>

        {/* 오늘 할일/루틴 진행률 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 할일 진행률 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                ✅ 오늘 할일
              </h3>
              <span className="text-2xl font-bold text-blue-600">{todoStats.rate}%</span>
            </div>
            <div className="mb-4">
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${todoStats.rate}%` }}
                />
              </div>
              <p className="text-sm text-gray-500 mt-2">{todoStats.completed} / {todoStats.total} 완료</p>
            </div>

            {/* 미완료 할일 미리보기 */}
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {todayTodos.filter(t => !t.isCompleted).slice(0, 4).map(todo => (
                <div
                  key={todo.id}
                  className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                  onClick={() => handleToggleTodo(todayPeriodId, todo.id)}
                >
                  <input type="checkbox" className="w-4 h-4 accent-blue-500" readOnly />
                  <span className="text-sm text-gray-700 truncate flex-1">{todo.content}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => goToPlanner(todayPeriodId)}
              className="mt-4 w-full py-2 text-blue-600 hover:bg-blue-50 rounded-lg text-sm font-medium transition-colors"
            >
              → 계획표로 이동
            </button>
          </div>

          {/* 루틴 진행률 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                🔄 오늘 루틴
              </h3>
              <span className="text-2xl font-bold text-green-600">{routineStats.rate}%</span>
            </div>
            <div className="mb-4">
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${routineStats.rate}%` }}
                />
              </div>
              <p className="text-sm text-gray-500 mt-2">{routineStats.completed} / {routineStats.total} 완료</p>
            </div>

            {/* 미완료 루틴 미리보기 */}
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {todayRoutines.filter(r => !r.isCompleted).slice(0, 4).map(routine => (
                <div
                  key={routine.id}
                  className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                  onClick={() => handleToggleRoutine(todayPeriodId, routine.id)}
                >
                  <input type="checkbox" className="w-4 h-4 accent-green-500" readOnly />
                  <span className="text-sm text-gray-700 truncate flex-1">{routine.content}</span>
                  {routine.category && (
                    <span className="text-xs">{CATEGORY_CONFIG[routine.category].icon}</span>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={() => goToPlanner(todayPeriodId)}
              className="mt-4 w-full py-2 text-green-600 hover:bg-green-50 rounded-lg text-sm font-medium transition-colors"
            >
              → 계획표로 이동
            </button>
          </div>
        </div>

        {/* 이번 주 미리보기 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            📅 이번 주 미리보기
          </h3>
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day) => (
              <button
                key={day.id}
                onClick={() => goToPlanner(day.id)}
                className={`p-3 rounded-xl text-center transition-all ${
                  day.isToday
                    ? 'bg-blue-500 text-white shadow-lg scale-105'
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                }`}
              >
                <div className="text-xs font-medium opacity-70">{day.dayName}</div>
                <div className="text-lg font-bold my-1">{day.dayNum}</div>
                <div className="flex justify-center gap-1">
                  {day.todoCount > 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${day.isToday ? 'bg-white/20' : 'bg-blue-100 text-blue-700'}`}>
                      {day.todoCount}
                    </span>
                  )}
                  {day.routineCount > 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${day.isToday ? 'bg-white/20' : 'bg-green-100 text-green-700'}`}>
                      {day.routineCount}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 카테고리별 균형 & 기분 트렌드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 카테고리별 균형 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              📊 카테고리별 균형
            </h3>
            <div className="space-y-3">
              {CATEGORIES.filter(cat => categoryStats[cat].total > 0).map(cat => {
                const stat = categoryStats[cat];
                const percentage = stat.total > 0 ? Math.round((stat.completed / stat.total) * 100) : 0;
                return (
                  <div key={cat} className="flex items-center gap-3">
                    <span className="w-20 text-sm truncate" style={{ color: CATEGORY_CONFIG[cat].textColor.replace('text-', '').replace('-700', '') }}>
                      {CATEGORY_CONFIG[cat].icon} {CATEGORY_CONFIG[cat].label}
                    </span>
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${CATEGORY_CONFIG[cat].bgColor.replace('-50', '-500')}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-12 text-right">
                      {stat.completed}/{stat.total}
                    </span>
                  </div>
                );
              })}
              {CATEGORIES.every(cat => categoryStats[cat].total === 0) && (
                <p className="text-center text-gray-400 py-4">루틴을 추가해주세요</p>
              )}
            </div>
          </div>

          {/* 기분 트렌드 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              😊 기분 트렌드 (최근 7일)
            </h3>
            <div className="flex justify-between items-end h-24">
              {moodTrend.map((day) => (
                <button
                  key={day.id}
                  onClick={() => goToPlanner(day.id)}
                  className="flex flex-col items-center gap-1 hover:bg-gray-50 p-2 rounded-lg transition-colors"
                >
                  <span className="text-2xl">{day.mood ? MOOD_CONFIG[day.mood].emoji : '➖'}</span>
                  <span className="text-xs text-gray-500">{day.dayNum}</span>
                </button>
              ))}
            </div>
            {moodTrend.some(d => d.mood) && (
              <p className="text-center text-sm text-gray-500 mt-4">
                클릭하면 해당 날짜로 이동합니다
              </p>
            )}
          </div>
        </div>

        {/* 시간대별 계획 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              ⏰ 오늘의 시간대별 계획
            </h3>
            <button
              onClick={() => goToPlanner(todayPeriodId)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              → 상세 보기
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {TIME_SLOTS.map(slot => {
              const items = timeSlotItems[slot];
              const todoCount = items?.todos?.length || 0;
              const routineCount = items?.routines?.length || 0;
              const hasItems = todoCount + routineCount > 0;

              return (
                <div
                  key={slot}
                  className={`p-3 rounded-lg border ${
                    hasItems ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="text-sm font-medium text-gray-700 mb-1">
                    {TIME_SLOT_CONFIG[slot].label}
                  </div>
                  {hasItems ? (
                    <div className="text-xs text-gray-500">
                      {todoCount > 0 && <span className="text-blue-600">할일 {todoCount}</span>}
                      {todoCount > 0 && routineCount > 0 && ' · '}
                      {routineCount > 0 && <span className="text-green-600">루틴 {routineCount}</span>}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400">비어있음</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 기념일 & 하이라이트 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 다가오는 기념일 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              🎂 다가오는 기념일
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
              <div className="text-center py-8 text-gray-400">
                <p>예정된 기념일이 없습니다</p>
                <Link href="/events" className="text-blue-500 hover:text-blue-700 text-sm">
                  → 기념일 추가하기
                </Link>
              </div>
            )}
          </div>

          {/* 이번 주 하이라이트 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              ⭐ 이번 주 하이라이트
            </h3>
            {weekHighlights.length > 0 ? (
              <ul className="space-y-2">
                {weekHighlights.map((highlight, i) => (
                  <li key={i} className="flex items-start gap-2 p-2 bg-yellow-50 rounded-lg">
                    <span className="text-yellow-500">★</span>
                    <span className="text-sm text-gray-700">{highlight}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <p>이번 주 하이라이트를 기록해주세요</p>
                <button
                  onClick={() => goToPlanner(todayPeriodId)}
                  className="mt-2 text-blue-500 hover:text-blue-700 text-sm"
                >
                  → 기록 작성하기
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 상위 목표 연결 (브레드크럼) */}
        {goalHierarchy.length > 0 && (
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl shadow-lg p-6 text-white">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              🎯 목표 연결 (Goal Hierarchy)
            </h3>
            <div className="space-y-2">
              {goalHierarchy.map((item, idx) => (
                <button
                  key={item.id}
                  onClick={() => goToPlanner(item.id)}
                  className="flex items-center gap-2 hover:bg-white/10 p-2 rounded-lg transition-colors w-full text-left"
                  style={{ paddingLeft: `${idx * 16 + 8}px` }}
                >
                  {idx > 0 && <span className="text-gray-500">└→</span>}
                  <span className="text-sm text-gray-400">{item.level}:</span>
                  <span className="font-medium truncate">&quot;{item.goal}&quot;</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-4">클릭하면 해당 기간 계획표로 이동합니다</p>
          </div>
        )}

        {/* 감사 & 성찰 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            🙏 감사 & 성찰
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 감사 입력 */}
            <div>
              <h4 className="text-sm font-medium text-gray-600 mb-2">오늘 감사한 것</h4>
              {todayRecord?.gratitude && todayRecord.gratitude.length > 0 && (
                <ul className="space-y-1 mb-3">
                  {todayRecord.gratitude.map((g, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-pink-500">♥</span>
                      {g}
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={gratitudeInput}
                  onChange={(e) => setGratitudeInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddGratitude()}
                  placeholder="감사한 것을 입력하세요..."
                  className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-pink-400"
                />
                <button
                  onClick={handleAddGratitude}
                  className="px-4 py-2 bg-pink-500 text-white rounded-lg text-sm hover:bg-pink-600 transition-colors"
                >
                  추가
                </button>
              </div>
            </div>

            {/* 오늘의 기분 & 한 줄 */}
            <div>
              <h4 className="text-sm font-medium text-gray-600 mb-2">오늘의 기록</h4>
              {todayRecord ? (
                <div className="space-y-2">
                  {todayRecord.mood && (
                    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                      <span className="text-2xl">{MOOD_CONFIG[todayRecord.mood].emoji}</span>
                      <span className="text-sm text-gray-700">{MOOD_CONFIG[todayRecord.mood].label}</span>
                    </div>
                  )}
                  {todayRecord.content && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-700 italic">&quot;{todayRecord.content}&quot;</p>
                    </div>
                  )}
                  {!todayRecord.mood && !todayRecord.content && (
                    <p className="text-sm text-gray-400">아직 기록이 없습니다</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400">아직 기록이 없습니다</p>
              )}
              <button
                onClick={() => {
                  navigateTo(todayPeriodId);
                  usePlanStore.getState().setViewMode('record');
                  router.push('/planner');
                }}
                className="mt-3 text-sm text-blue-600 hover:text-blue-800"
              >
                → 기록 작성하기
              </button>
            </div>
          </div>
        </div>

        {/* 사용 가이드 */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            💡 효과적인 사용 팁
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white/10 rounded-lg p-4">
              <h4 className="font-medium mb-2">📅 주간 계획</h4>
              <p className="text-sm opacity-80">할일/루틴을 등록하고 요일별로 드래그하여 배정하세요</p>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <h4 className="font-medium mb-2">⏰ 일일 실행</h4>
              <p className="text-sm opacity-80">8개 시간대에 할일을 배치하고 완료 체크하세요</p>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <h4 className="font-medium mb-2">📊 균형 점검</h4>
              <p className="text-sm opacity-80">카테고리별 균형을 확인하고 삶의 밸런스를 맞추세요</p>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <h4 className="font-medium mb-2">🔄 루틴 상속</h4>
              <p className="text-sm opacity-80">상위 레벨에서 루틴을 등록하면 하위로 자동 상속됩니다</p>
            </div>
          </div>
        </div>

        {/* 바로가기 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            href="/planner"
            className="bg-white rounded-xl shadow-sm p-4 text-center hover:shadow-md transition-shadow"
          >
            <span className="text-2xl">📋</span>
            <p className="mt-2 font-medium text-gray-800">계획표</p>
          </Link>
          <Link
            href="/routines"
            className="bg-white rounded-xl shadow-sm p-4 text-center hover:shadow-md transition-shadow"
          >
            <span className="text-2xl">🔄</span>
            <p className="mt-2 font-medium text-gray-800">루틴 관리</p>
          </Link>
          <Link
            href="/events"
            className="bg-white rounded-xl shadow-sm p-4 text-center hover:shadow-md transition-shadow"
          >
            <span className="text-2xl">🎂</span>
            <p className="mt-2 font-medium text-gray-800">기념일</p>
          </Link>
          <Link
            href="/notepad"
            className="bg-white rounded-xl shadow-sm p-4 text-center hover:shadow-md transition-shadow"
          >
            <span className="text-2xl">📝</span>
            <p className="mt-2 font-medium text-gray-800">메모장</p>
          </Link>
        </div>
      </div>
    </div>
  );
};
