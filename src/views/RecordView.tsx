'use client';

import React, { useState, useEffect } from 'react';
import { usePlanStore, parsePeriodId, getAdjacentPeriodId, getISOWeek, getISOWeekYear } from '../store/usePlanStore';
import { MOOD_CONFIG, MOODS, Mood, LEVEL_CONFIG, Level, CATEGORY_CONFIG, CATEGORIES } from '../types/plan';

// ═══════════════════════════════════════════════════════════════
// 레벨별 기분 라벨
// ═══════════════════════════════════════════════════════════════
const MOOD_LABEL_BY_LEVEL: Record<Level, string> = {
  THIRTY_YEAR: '30년을 돌아보며',
  FIVE_YEAR: '5년을 돌아보며',
  YEAR: '올해를 돌아보며',
  QUARTER: '이번 분기를 돌아보며',
  MONTH: '이번 달을 돌아보며',
  WEEK: '이번 주를 돌아보며',
  DAY: '오늘의 기분',
};

// ═══════════════════════════════════════════════════════════════
// 레벨별 기록 질문 (6개 셀)
// ═══════════════════════════════════════════════════════════════
interface RecordQuestion {
  id: string;
  title: string;
  placeholder: string;
  emoji: string;
  bgColor: string;
  borderColor: string;
}

const getQuestionsForLevel = (level: Level): RecordQuestion[] => {
  switch (level) {
    case 'THIRTY_YEAR':
      return [
        { id: 'life_purpose', title: '인생의 의미', placeholder: '30년 동안 가장 의미 있었던 것은?', emoji: '🌟', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
        { id: 'major_achievements', title: '주요 성취', placeholder: '이룬 가장 큰 성취들은?', emoji: '🏆', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200' },
        { id: 'relationships', title: '소중한 관계', placeholder: '가장 소중한 사람들과 관계는?', emoji: '💝', bgColor: 'bg-rose-50', borderColor: 'border-rose-200' },
        { id: 'lessons', title: '인생 교훈', placeholder: '배운 가장 큰 교훈은?', emoji: '📚', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
        { id: 'regrets', title: '아쉬움과 성찰', placeholder: '다시 한다면 바꾸고 싶은 것은?', emoji: '💭', bgColor: 'bg-purple-50', borderColor: 'border-purple-200' },
        { id: 'future', title: '앞으로의 바람', placeholder: '앞으로 어떻게 살고 싶은가요?', emoji: '🌈', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
      ];
    case 'FIVE_YEAR':
      return [
        { id: 'growth', title: '성장과 변화', placeholder: '5년 동안 어떻게 성장했나요?', emoji: '🌱', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
        { id: 'achievements', title: '주요 성취', placeholder: '이룬 것들은 무엇인가요?', emoji: '🎯', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
        { id: 'challenges', title: '도전과 극복', placeholder: '어떤 어려움을 겪고 극복했나요?', emoji: '💪', bgColor: 'bg-orange-50', borderColor: 'border-orange-200' },
        { id: 'relationships', title: '관계 변화', placeholder: '중요한 만남이나 이별은?', emoji: '👥', bgColor: 'bg-rose-50', borderColor: 'border-rose-200' },
        { id: 'learnings', title: '배운 것들', placeholder: '새롭게 배운 것들은?', emoji: '📖', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
        { id: 'next_goals', title: '다음 5년', placeholder: '다음 5년의 방향은?', emoji: '🧭', bgColor: 'bg-purple-50', borderColor: 'border-purple-200' },
      ];
    case 'YEAR':
      return [
        { id: 'highlights', title: '올해의 하이라이트', placeholder: '가장 기억에 남는 순간들은?', emoji: '✨', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
        { id: 'achievements', title: '성취한 것들', placeholder: '올해 이룬 것들은 무엇인가요?', emoji: '🏅', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200' },
        { id: 'challenges', title: '도전과 어려움', placeholder: '어떤 어려움이 있었나요?', emoji: '🧗', bgColor: 'bg-orange-50', borderColor: 'border-orange-200' },
        { id: 'growth', title: '성장한 점', placeholder: '어떻게 성장했나요?', emoji: '🌿', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
        { id: 'relationships', title: '소중한 관계', placeholder: '의미 있었던 만남이나 관계는?', emoji: '💕', bgColor: 'bg-rose-50', borderColor: 'border-rose-200' },
        { id: 'next_year', title: '내년 다짐', placeholder: '내년에는 어떻게 하고 싶나요?', emoji: '🎯', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
      ];
    case 'QUARTER':
      return [
        { id: 'progress', title: '목표 진행', placeholder: '분기 목표는 얼마나 달성했나요?', emoji: '📊', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
        { id: 'achievements', title: '이룬 것들', placeholder: '이번 분기에 완성한 것들은?', emoji: '✅', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
        { id: 'learnings', title: '배운 것', placeholder: '새롭게 알게 된 것은?', emoji: '💡', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200' },
        { id: 'difficulties', title: '어려웠던 점', placeholder: '힘들었던 부분은 무엇인가요?', emoji: '🤔', bgColor: 'bg-orange-50', borderColor: 'border-orange-200' },
        { id: 'health', title: '건강 & 에너지', placeholder: '몸과 마음 상태는 어땠나요?', emoji: '💚', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' },
        { id: 'next_quarter', title: '다음 분기', placeholder: '다음 분기에 집중할 것은?', emoji: '🎯', bgColor: 'bg-purple-50', borderColor: 'border-purple-200' },
      ];
    case 'MONTH':
      return [
        { id: 'accomplishments', title: '이번 달 성과', placeholder: '완료한 일들은 무엇인가요?', emoji: '🎉', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
        { id: 'struggles', title: '어려웠던 점', placeholder: '힘들었던 부분은?', emoji: '😓', bgColor: 'bg-orange-50', borderColor: 'border-orange-200' },
        { id: 'habits', title: '습관 & 루틴', placeholder: '루틴은 잘 지켰나요?', emoji: '🔄', bgColor: 'bg-purple-50', borderColor: 'border-purple-200' },
        { id: 'memorable', title: '기억에 남는 일', placeholder: '특별했던 순간은?', emoji: '📸', bgColor: 'bg-pink-50', borderColor: 'border-pink-200' },
        { id: 'self_care', title: '나를 위한 시간', placeholder: '스스로를 돌본 방법은?', emoji: '🧘', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
        { id: 'next_month', title: '다음 달 계획', placeholder: '다음 달 중점적으로 할 것은?', emoji: '📋', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
      ];
    case 'WEEK':
      return [
        { id: 'wins', title: '이번 주 성과', placeholder: '잘한 일들은 무엇인가요?', emoji: '🌟', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200' },
        { id: 'challenges', title: '도전했던 것', placeholder: '새로 시도하거나 도전한 것은?', emoji: '🚀', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
        { id: 'energy', title: '에너지 레벨', placeholder: '컨디션과 에너지는 어땠나요?', emoji: '⚡', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
        { id: 'people', title: '만난 사람들', placeholder: '의미 있는 만남은 있었나요?', emoji: '👋', bgColor: 'bg-rose-50', borderColor: 'border-rose-200' },
        { id: 'learning', title: '배운 것', placeholder: '새롭게 알게 된 것은?', emoji: '📚', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
        { id: 'next_week', title: '다음 주 목표', placeholder: '다음 주 꼭 하고 싶은 것은?', emoji: '🎯', bgColor: 'bg-purple-50', borderColor: 'border-purple-200' },
      ];
    case 'DAY':
    default:
      return [
        { id: 'done', title: '오늘 한 일', placeholder: '오늘 무엇을 했나요?', emoji: '✅', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
        { id: 'feeling', title: '오늘의 기분', placeholder: '기분이 어땠나요? 왜 그랬을까요?', emoji: '💭', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
        { id: 'proud', title: '잘한 것', placeholder: '오늘 스스로 칭찬할 일은?', emoji: '👏', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200' },
        { id: 'difficult', title: '어려웠던 것', placeholder: '힘들거나 아쉬웠던 것은?', emoji: '😔', bgColor: 'bg-orange-50', borderColor: 'border-orange-200' },
        { id: 'learned', title: '오늘의 배움', placeholder: '새롭게 알게 된 것은?', emoji: '💡', bgColor: 'bg-purple-50', borderColor: 'border-purple-200' },
        { id: 'tomorrow', title: '내일 할 일', placeholder: '내일 가장 중요한 일은?', emoji: '📌', bgColor: 'bg-rose-50', borderColor: 'border-rose-200' },
      ];
  }
};

// ═══════════════════════════════════════════════════════════════
// 기록 뷰 컴포넌트
// ═══════════════════════════════════════════════════════════════

function RecordView() {
  const {
    currentPeriodId,
    currentLevel,
    baseYear,
    viewMode,
    toggleViewMode,
    navigateTo,
    drillUp,
    getRecord,
    updateRecordContent,
    updateRecordMood,
    addHighlight,
    removeHighlight,
    addGratitude,
    removeGratitude,
    periods,
    ensurePeriod,
  } = usePlanStore();

  const record = getRecord(currentPeriodId);
  const period = ensurePeriod(currentPeriodId);
  const parsed = parsePeriodId(currentPeriodId);
  const questions = getQuestionsForLevel(currentLevel);

  // 각 질문별 답변 상태
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [highlightInput, setHighlightInput] = useState('');
  const [gratitudeInput, setGratitudeInput] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // 기존 기록 내용을 파싱해서 answers에 로드
  useEffect(() => {
    if (record?.content) {
      try {
        const parsed = JSON.parse(record.content);
        if (typeof parsed === 'object') {
          setAnswers(parsed);
        }
      } catch {
        // 기존 텍스트 형식이면 첫 번째 질문에 할당
        setAnswers({ [questions[0]?.id || 'content']: record.content });
      }
    } else {
      setAnswers({});
    }
  }, [currentPeriodId, record?.content]);

  // 자동 저장 (debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      const content = JSON.stringify(answers);
      if (content !== (record?.content || '{}')) {
        updateRecordContent(currentPeriodId, content);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [answers, currentPeriodId, record?.content, updateRecordContent]);

  // 기간 제목 생성
  const getPeriodTitle = () => {
    switch (parsed.level) {
      case 'DAY': {
        const date = new Date(parsed.year!, parsed.month! - 1, parsed.day);
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        return `${parsed.year}년 ${parsed.month}월 ${parsed.day}일 (${days[date.getDay()]})`;
      }
      case 'WEEK':
        return `${parsed.year}년 ${parsed.week}주차`;
      case 'MONTH':
        return `${parsed.year}년 ${parsed.month}월`;
      case 'QUARTER':
        return `${parsed.year}년 Q${parsed.quarter}`;
      case 'YEAR':
        return `${parsed.year}년`;
      case 'FIVE_YEAR': {
        const startYear = baseYear + (parsed.fiveYearIndex || 0) * 5;
        return `${startYear}~${startYear + 4}년`;
      }
      case 'THIRTY_YEAR':
        return `${baseYear}~${baseYear + 29} (30년)`;
      default:
        return currentPeriodId;
    }
  };

  // 하이라이트 추가
  const handleAddHighlight = () => {
    if (highlightInput.trim()) {
      addHighlight(currentPeriodId, highlightInput.trim());
      setHighlightInput('');
    }
  };

  // 감사 추가
  const handleAddGratitude = () => {
    if (gratitudeInput.trim()) {
      addGratitude(currentPeriodId, gratitudeInput.trim());
      setGratitudeInput('');
    }
  };

  // Hydration 불일치 방지
  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-full bg-amber-50">
        <div className="text-amber-400">로딩 중...</div>
      </div>
    );
  }

  // 할일/루틴 진행률 계산
  const todoCompleted = period.todos.filter(t => t.isCompleted).length;
  const todoTotal = period.todos.length;
  const routineCompleted = period.routines.filter(r => r.isCompleted).length;
  const routineTotal = period.routines.length;

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      {/* ═══════════════════════════════════════════════════════ */}
      {/* 헤더 영역 */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="p-4 bg-white/90 backdrop-blur border-b border-amber-200 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          {/* 뒤로가기 */}
          {currentLevel !== 'THIRTY_YEAR' && (
            <button
              onClick={drillUp}
              className="px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 transition-colors text-amber-700 text-sm font-medium"
            >
              ↑ 상위
            </button>
          )}

          {/* 네비게이션 그룹 */}
          {currentLevel !== 'THIRTY_YEAR' && (
            <div className="flex items-center bg-amber-100 rounded-lg p-1">
              <button
                onClick={() => {
                  const prevId = getAdjacentPeriodId(currentPeriodId, 'prev', baseYear);
                  if (prevId) navigateTo(prevId);
                }}
                className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-white hover:shadow-sm transition-all text-amber-700"
              >
                ◀
              </button>
              <div className="px-4 min-w-[160px] text-center">
                <span className="font-bold text-amber-800">{getPeriodTitle()}</span>
              </div>
              <button
                onClick={() => {
                  const nextId = getAdjacentPeriodId(currentPeriodId, 'next', baseYear);
                  if (nextId) navigateTo(nextId);
                }}
                className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-white hover:shadow-sm transition-all text-amber-700"
              >
                ▶
              </button>
            </div>
          )}

          {currentLevel === 'THIRTY_YEAR' && (
            <div className="font-bold text-xl text-amber-800">{getPeriodTitle()}</div>
          )}

          {/* 현재로 이동 버튼 */}
          {currentLevel !== 'THIRTY_YEAR' && currentLevel !== 'FIVE_YEAR' && (
            <button
              onClick={() => {
                const now = new Date();
                const currentYear = now.getFullYear();
                const currentMonth = now.getMonth() + 1;
                let targetId = '';
                switch (currentLevel) {
                  case 'YEAR':
                    targetId = `y-${currentYear}`;
                    break;
                  case 'QUARTER':
                    targetId = `q-${currentYear}-${Math.ceil(currentMonth / 3)}`;
                    break;
                  case 'MONTH':
                    targetId = `m-${currentYear}-${String(currentMonth).padStart(2, '0')}`;
                    break;
                  case 'WEEK':
                    targetId = `w-${getISOWeekYear(now)}-${String(getISOWeek(now)).padStart(2, '0')}`;
                    break;
                  case 'DAY':
                    targetId = `d-${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                    break;
                }
                if (targetId) navigateTo(targetId);
              }}
              className="px-3 py-1.5 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium"
            >
              {currentLevel === 'DAY' && '오늘'}
              {currentLevel === 'WEEK' && '이번 주'}
              {currentLevel === 'MONTH' && '이번 달'}
              {currentLevel === 'QUARTER' && '이번 분기'}
              {currentLevel === 'YEAR' && '올해'}
            </button>
          )}

          {/* 계획/기록 토글 */}
          <div className="ml-auto flex items-center">
            <div className="flex bg-amber-100 rounded-lg p-1">
              <button
                onClick={() => viewMode === 'record' && toggleViewMode()}
                className="px-4 py-1.5 rounded-md text-sm font-medium text-amber-600 hover:text-amber-700"
              >
                계획
              </button>
              <button className="px-4 py-1.5 rounded-md text-sm font-medium bg-white text-amber-700 shadow-sm">
                기록
              </button>
            </div>
          </div>
        </div>

        {/* 기분 선택 + 계획 요약 */}
        <div className="grid grid-cols-3 gap-4">
          {/* 기분 선택 */}
          <div>
            <label className="text-xs font-medium text-amber-600 mb-1 block">
              {MOOD_LABEL_BY_LEVEL[currentLevel]}
            </label>
            <div className="flex gap-1 p-2 bg-amber-50 border border-amber-200 rounded-lg">
              {MOODS.map((mood) => {
                const config = MOOD_CONFIG[mood];
                const isSelected = record?.mood === mood;
                return (
                  <button
                    key={mood}
                    onClick={() => updateRecordMood(currentPeriodId, isSelected ? undefined : mood)}
                    className={`
                      flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-md transition-all
                      ${isSelected ? 'bg-white ring-2 ring-amber-400 shadow-sm' : 'hover:bg-white/50'}
                    `}
                    title={config.label}
                  >
                    <span className="text-xl">{config.emoji}</span>
                    <span className={`text-[10px] font-medium ${isSelected ? 'text-amber-700' : 'text-gray-400'}`}>
                      {config.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 할일 진행률 */}
          <div>
            <label className="text-xs font-medium text-amber-600 mb-1 block">할일 진행률</label>
            <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg h-[52px] flex flex-col justify-center">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-blue-700">
                  {todoTotal > 0 ? `${todoCompleted}/${todoTotal} 완료` : '할일 없음'}
                </span>
                <span className="text-xs font-bold text-blue-600">
                  {todoTotal > 0 ? Math.round((todoCompleted / todoTotal) * 100) : 0}%
                </span>
              </div>
              <div className="w-full h-2 bg-blue-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${todoTotal > 0 ? (todoCompleted / todoTotal) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* 루틴 진행률 */}
          <div>
            <label className="text-xs font-medium text-amber-600 mb-1 block">루틴 진행률</label>
            <div className="p-2 bg-purple-50 border border-purple-200 rounded-lg h-[52px] flex flex-col justify-center">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-purple-700">
                  {routineTotal > 0 ? `${routineCompleted}/${routineTotal} 완료` : '루틴 없음'}
                </span>
                <span className="text-xs font-bold text-purple-600">
                  {routineTotal > 0 ? Math.round((routineCompleted / routineTotal) * 100) : 0}%
                </span>
              </div>
              <div className="w-full h-2 bg-purple-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all"
                  style={{ width: `${routineTotal > 0 ? (routineCompleted / routineTotal) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* 본문 영역 (3열) */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="flex-1 flex overflow-hidden">
        {/* ─────────────────────────────────────────────────────── */}
        {/* 좌측 패널: 할일/루틴 현황 (부모-자식 관계 표시) */}
        {/* ─────────────────────────────────────────────────────── */}
        <div className="w-72 bg-white/80 backdrop-blur border-r border-amber-200 overflow-y-auto flex flex-col">
          {/* 헤더 */}
          <div className="p-3 border-b border-amber-100 bg-gray-50">
            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-1">
              <span>📋</span> 이 기간의 계획
              <button
                onClick={toggleViewMode}
                className="ml-auto text-xs text-amber-600 hover:text-amber-700"
              >
                계획 보기 →
              </button>
            </h3>
          </div>

          {/* 할일/루틴 목록 (트리 구조) */}
          <div className="flex-1 overflow-y-auto">
            {todoTotal > 0 && (
              <div className="p-3 border-b border-amber-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-blue-600">할일</span>
                  <span className="text-[10px] text-blue-400">{todoCompleted}/{todoTotal}</span>
                </div>
                <div className="space-y-0.5">
                  {(() => {
                    const itemMap = new Map(period.todos.map(i => [i.id, i]));
                    const getDepth = (item: typeof period.todos[0]): number => {
                      if (!item.parentId) return 0;
                      const parent = itemMap.get(item.parentId);
                      return parent ? getDepth(parent) + 1 : 0;
                    };
                    // 루트 아이템만 먼저 렌더링하고, 자식은 부모 아래에 표시
                    const renderItem = (todo: typeof period.todos[0], isLast: boolean = false) => {
                      const depth = getDepth(todo);
                      const hasChildren = todo.childIds && todo.childIds.length > 0;
                      const childItems = hasChildren ? period.todos.filter(t => t.parentId === todo.id) : [];

                      return (
                        <div key={todo.id}>
                          <div
                            className={`flex items-center gap-1 py-1 text-xs rounded-md transition-colors
                              ${depth > 0 ? 'ml-3 pl-2 border-l-2 border-blue-100' : 'bg-blue-50/50 px-2'}
                            `}
                          >
                            {hasChildren ? (
                              <span className="w-4 text-center text-blue-400 text-[10px]">
                                {todo.isExpanded !== false ? '▾' : '▸'}
                              </span>
                            ) : (
                              <span className="w-4" />
                            )}
                            <span className={`w-4 h-4 flex items-center justify-center rounded-full text-[10px]
                              ${todo.isCompleted
                                ? 'bg-green-100 text-green-600'
                                : 'bg-gray-100 text-gray-400'
                              }`}
                            >
                              {todo.isCompleted ? '✓' : ''}
                            </span>
                            <span className={`flex-1 truncate ${todo.isCompleted ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                              {todo.content}
                            </span>
                            {hasChildren && (
                              <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 rounded-full">
                                {childItems.filter(c => c.isCompleted).length}/{childItems.length}
                              </span>
                            )}
                          </div>
                          {hasChildren && todo.isExpanded !== false && (
                            <div className="ml-2">
                              {childItems.map((child, idx) => renderItem(child, idx === childItems.length - 1))}
                            </div>
                          )}
                        </div>
                      );
                    };
                    return period.todos.filter(t => !t.parentId).map((todo, idx, arr) => renderItem(todo, idx === arr.length - 1));
                  })()}
                </div>
              </div>
            )}

            {/* 루틴 목록 */}
            {routineTotal > 0 && (
              <div className="p-3 border-b border-amber-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-purple-600">루틴</span>
                  <span className="text-[10px] text-purple-400">{routineCompleted}/{routineTotal}</span>
                </div>
                <div className="space-y-0.5">
                  {(() => {
                    const itemMap = new Map(period.routines.map(i => [i.id, i]));
                    const getDepth = (item: typeof period.routines[0]): number => {
                      if (!item.parentId) return 0;
                      const parent = itemMap.get(item.parentId);
                      return parent ? getDepth(parent) + 1 : 0;
                    };
                    const renderItem = (routine: typeof period.routines[0], isLast: boolean = false) => {
                      const depth = getDepth(routine);
                      const hasChildren = routine.childIds && routine.childIds.length > 0;
                      const childItems = hasChildren ? period.routines.filter(r => r.parentId === routine.id) : [];

                      return (
                        <div key={routine.id}>
                          <div
                            className={`flex items-center gap-1 py-1 text-xs rounded-md transition-colors
                              ${depth > 0 ? 'ml-3 pl-2 border-l-2 border-purple-100' : 'bg-purple-50/50 px-2'}
                            `}
                          >
                            {hasChildren ? (
                              <span className="w-4 text-center text-purple-400 text-[10px]">
                                {routine.isExpanded !== false ? '▾' : '▸'}
                              </span>
                            ) : (
                              <span className="w-4" />
                            )}
                            <span className={`w-4 h-4 flex items-center justify-center rounded-full text-[10px]
                              ${routine.isCompleted
                                ? 'bg-green-100 text-green-600'
                                : 'bg-gray-100 text-gray-400'
                              }`}
                            >
                              {routine.isCompleted ? '✓' : ''}
                            </span>
                            <span className={`flex-1 truncate ${routine.isCompleted ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                              {routine.content}
                            </span>
                            {routine.targetCount && !hasChildren && (
                              <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 rounded-full">
                                {routine.currentCount ?? routine.targetCount}/{routine.targetCount}
                              </span>
                            )}
                            {hasChildren && (
                              <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 rounded-full">
                                {childItems.filter(c => c.isCompleted).length}/{childItems.length}
                              </span>
                            )}
                          </div>
                          {hasChildren && routine.isExpanded !== false && (
                            <div className="ml-2">
                              {childItems.map((child, idx) => renderItem(child, idx === childItems.length - 1))}
                            </div>
                          )}
                        </div>
                      );
                    };
                    return period.routines.filter(r => !r.parentId).map((routine, idx, arr) => renderItem(routine, idx === arr.length - 1));
                  })()}
                </div>
              </div>
            )}

            {todoTotal === 0 && routineTotal === 0 && (
              <div className="p-3 text-xs text-gray-400 text-center">
                계획된 할일/루틴이 없습니다
              </div>
            )}
          </div>

          {/* 목표 & 다짐 (계획에서 가져옴) */}
          <div className="p-3 border-t border-amber-100 bg-amber-50/50">
            <h3 className="text-xs font-bold text-amber-700 mb-2">목표 & 다짐</h3>
            {period.goal && (
              <div className="mb-2 p-2 bg-white rounded-lg border border-amber-200">
                <div className="text-[10px] text-amber-600 mb-0.5">목표</div>
                <div className="text-xs text-gray-700">{period.goal}</div>
              </div>
            )}
            {period.motto && (
              <div className="p-2 bg-white rounded-lg border border-orange-200">
                <div className="text-[10px] text-orange-600 mb-0.5">다짐</div>
                <div className="text-xs text-gray-700">{period.motto}</div>
              </div>
            )}
            {!period.goal && !period.motto && (
              <div className="text-xs text-gray-400 text-center py-1">
                계획에서 설정하세요
              </div>
            )}
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────── */}
        {/* 중앙: 질문별 기록 그리드 (6칸) */}
        {/* ─────────────────────────────────────────────────────── */}
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="grid grid-cols-3 grid-rows-2 gap-3 h-full">
            {questions.map((q) => (
              <div
                key={q.id}
                className={`flex flex-col rounded-xl border ${q.borderColor} ${q.bgColor} overflow-hidden`}
              >
                <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-white/50">
                  <span className="text-lg">{q.emoji}</span>
                  <span className="text-sm font-semibold text-gray-700">{q.title}</span>
                </div>
                <textarea
                  value={answers[q.id] || ''}
                  onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder={q.placeholder}
                  className="flex-1 w-full p-3 bg-transparent outline-none resize-none text-sm text-gray-700 placeholder-gray-400"
                />
              </div>
            ))}
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────── */}
        {/* 우측 패널: 감사한 것들 + 하이라이트 (반반) */}
        {/* ─────────────────────────────────────────────────────── */}
        <div className="w-72 bg-white/80 backdrop-blur border-l border-amber-200 flex flex-col">
          {/* 감사한 것들 (상단 50%) */}
          <div className="flex-1 flex flex-col min-h-0 border-b border-amber-200">
            <div className="p-2 border-b border-amber-100 bg-rose-50">
              <h2 className="text-sm font-bold text-rose-700 flex items-center gap-2">
                <span className="text-rose-400">♥</span>
                감사한 것들 ({record?.gratitude?.length || 0})
              </h2>
            </div>
            <div className="flex-1 p-2 space-y-1.5 overflow-y-auto">
              {(record?.gratitude || []).map((item, index) => (
                <div
                  key={index}
                  className="group flex items-start gap-1.5 p-2 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors"
                >
                  <span className="text-rose-400 text-sm">♥</span>
                  <span className="flex-1 text-xs text-gray-700">{item}</span>
                  <button
                    onClick={() => removeGratitude(currentPeriodId, index)}
                    className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center rounded-full bg-red-100 text-red-500 hover:bg-red-500 hover:text-white transition-all text-xs"
                  >
                    ×
                  </button>
                </div>
              ))}
              {(record?.gratitude?.length || 0) === 0 && (
                <div className="text-center py-3 text-gray-400 text-xs">
                  감사한 것들
                </div>
              )}
              <input
                type="text"
                value={gratitudeInput}
                onChange={(e) => setGratitudeInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddGratitude()}
                placeholder="+ 감사한 것..."
                className="w-full px-2 py-1.5 text-xs bg-white border border-dashed border-rose-300 rounded-lg focus:outline-none focus:border-rose-500 placeholder-gray-400"
              />
            </div>
          </div>

          {/* 하이라이트 (하단 50%) */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="p-2 border-b border-amber-100 bg-yellow-50">
              <h2 className="text-sm font-bold text-yellow-700 flex items-center gap-2">
                <span className="text-yellow-500">★</span>
                하이라이트 ({record?.highlights?.length || 0})
              </h2>
            </div>
            <div className="flex-1 p-2 space-y-1.5 overflow-y-auto">
              {(record?.highlights || []).map((highlight, index) => (
                <div
                  key={index}
                  className="group flex items-start gap-1.5 p-2 bg-yellow-50 hover:bg-yellow-100 rounded-lg border border-yellow-200 transition-colors"
                >
                  <span className="text-yellow-500 text-sm">★</span>
                  <span className="flex-1 text-xs text-gray-700">{highlight}</span>
                  <button
                    onClick={() => removeHighlight(currentPeriodId, index)}
                    className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center rounded-full bg-red-100 text-red-500 hover:bg-red-500 hover:text-white transition-all text-xs"
                  >
                    ×
                  </button>
                </div>
              ))}
              {(record?.highlights?.length || 0) === 0 && (
                <div className="text-center py-3 text-gray-400 text-xs">
                  성취한 것, 좋았던 일
                </div>
              )}
              <input
                type="text"
                value={highlightInput}
                onChange={(e) => setHighlightInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddHighlight()}
                placeholder="+ 성취한 것, 좋았던 일..."
                className="w-full px-2 py-1.5 text-xs bg-white border border-dashed border-yellow-300 rounded-lg focus:outline-none focus:border-yellow-500 placeholder-gray-400"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { RecordView };
