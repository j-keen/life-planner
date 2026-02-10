'use client';

import React, { useState, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  useSensors,
  useSensor,
  PointerSensor,
  TouchSensor,
} from '@dnd-kit/core';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import {
  usePlanStore,
  getChildPeriodIds,
  getSlotLabel,
  getSlotLabelShort,
  parsePeriodId,
  getTimeSlotId,
  getAdjacentPeriodId,
  getWeeksInMonth,
} from '../store/usePlanStore';
import { Item, LEVELS, LEVEL_CONFIG, TIME_SLOTS, SOURCE_TAG_PREFIX, CATEGORIES, CATEGORY_CONFIG, TODO_CATEGORIES, TODO_CATEGORY_CONFIG } from '../types/plan';
import { NoteModal } from '../components/NoteModal';
import {
  TODO_PLACEHOLDER,
  ROUTINE_PLACEHOLDER,
  getPeriodTitle,
  getGridStyle,
  DraggableItem,
  AddItemInput,
  AssignModal,
  GridCell,
  TodoCategoryDropZone,
  RoutineCategoryDropZone,
  TimeSlotCell,
  useFractalDnD,
} from './fractal';

// ═══════════════════════════════════════════════════════════════
// 메인 FractalView 컴포넌트
// ═══════════════════════════════════════════════════════════════
export default function FractalView() {
  const {
    currentLevel,
    currentPeriodId,
    baseYear,
    periods,
    allItems, // allItems 구독 추가 - 진행률 업데이트 트리거용
    drillDown,
    drillUp,
    updatePeriodHeader,
    addMemo,
    removeMemo,
    getInheritedMemos,
    addItem,
    deleteItem,
    updateItemContent,
    updateItemColor,
    updateItemNote,
    assignToSlot,
    assignToTimeSlot,
    moveSlotItem,
    moveTimeSlotItem,
    toggleComplete,
    getProgress,
    ensurePeriod,
    addSubItem,
    toggleExpand,
    setBaseYear,
    updateTodoCategory,
    updateItemCategory,
  } = usePlanStore();

  const [mounted, setMounted] = useState(false);
  const [editingField, setEditingField] = useState<'goal' | 'motto' | null>(null);
  const [memoInput, setMemoInput] = useState('');
  const [mobileTab, setMobileTab] = useState<'todo' | 'grid' | 'routine'>('grid');
  const [isMobile, setIsMobile] = useState(false);
  const [assignModalItem, setAssignModalItem] = useState<{ item: Item; from: 'todo' | 'routine' } | null>(null);
  const [sidebarNoteItem, setSidebarNoteItem] = useState<Item | null>(null);
  const [sidebarNoteLocation, setSidebarNoteLocation] = useState<'todo' | 'routine'>('todo');

  useEffect(() => {
    setMounted(true);
    // 화면 크기 감지 (768px = md breakpoint)
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  // 현재 기간 확보
  const period = ensurePeriod(currentPeriodId);
  const config = LEVEL_CONFIG[currentLevel];
  const childPeriodIds = getChildPeriodIds(currentPeriodId, baseYear);
  const parsed = parsePeriodId(currentPeriodId);

  // DnD 핸들러
  const { handleDragStart, handleDragEnd, activeItem } = useFractalDnD({
    currentLevel,
    childPeriodIds,
    assignToSlot,
    assignToTimeSlot,
    moveSlotItem,
    moveTimeSlotItem,
    updateTodoCategory,
    updateItemCategory,
  });

  // Hydration 불일치 방지: 클라이언트 마운트 전까지 로딩 표시
  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100">
        <div className="text-gray-400">로딩 중...</div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-full bg-gray-50">
        {/* ═══════════════════════════════════════════════════════ */}
        {/* 통합 헤더 - 네비게이션 중앙 집중 */}
        {/* ═══════════════════════════════════════════════════════ */}
        <div className="bg-white border-b border-gray-200 px-3 md:px-4 py-2 md:py-3">
          <div className="flex items-center justify-between">
            {/* 좌측: 상위 레벨 이동 */}
            <div className="w-20 flex justify-start">
              {currentLevel !== 'THIRTY_YEAR' && (
                <button
                  onClick={drillUp}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
                  title="상위 레벨로"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
              )}
            </div>

            {/* 중앙: 기간 네비게이션 (핵심) */}
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1 md:gap-2">
                {/* 이전 */}
                {currentLevel !== 'THIRTY_YEAR' && (
                  <button
                    onClick={() => {
                      const prevId = getAdjacentPeriodId(currentPeriodId, 'prev', baseYear);
                      if (prevId) usePlanStore.getState().navigateTo(prevId);
                    }}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}

                {/* 기간 제목 */}
                <h1 className="text-lg md:text-xl font-bold text-gray-900 min-w-[140px] md:min-w-[180px] text-center">
                  {getPeriodTitle(currentLevel, parsed, baseYear, currentPeriodId)}
                </h1>

                {/* 다음 */}
                {currentLevel !== 'THIRTY_YEAR' && (
                  <button
                    onClick={() => {
                      const nextId = getAdjacentPeriodId(currentPeriodId, 'next', baseYear);
                      if (nextId) usePlanStore.getState().navigateTo(nextId);
                    }}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}
              </div>

              {/* 뷰 레벨 탭 - 제목 아래 */}
              <div className="flex items-center gap-0.5 mt-1">
                {LEVELS.map((level) => (
                  <button
                    key={level}
                    onClick={() => {
                      const now = new Date();
                      const year = now.getFullYear();
                      const month = now.getMonth() + 1;
                      let targetId = '';
                      switch (level) {
                        case 'THIRTY_YEAR': targetId = '30y'; break;
                        case 'FIVE_YEAR': {
                          // 현재 연도 기준 5년 구간 인덱스 (0-5)
                          const idx = Math.floor((year - baseYear) / 5);
                          targetId = `5y-${Math.max(0, Math.min(5, idx))}`;
                          break;
                        }
                        case 'YEAR': targetId = `y-${year}`; break;
                        case 'QUARTER': targetId = `q-${year}-${Math.ceil(month / 3)}`; break;
                        case 'MONTH': targetId = `m-${year}-${String(month).padStart(2, '0')}`; break;
                        case 'WEEK': {
                          // 현재 날짜가 속한 월의 주차 계산
                          const day = now.getDate();
                          const weeks = getWeeksInMonth(year, month);
                          const targetDate = new Date(year, month - 1, day);
                          let weekNum = 1;
                          for (const week of weeks) {
                            if (targetDate >= week.start && targetDate <= week.end) {
                              weekNum = week.weekNum;
                              break;
                            }
                          }
                          targetId = `w-${year}-${String(month).padStart(2, '0')}-${weekNum}`;
                          break;
                        }
                        case 'DAY': targetId = `d-${year}-${String(month).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; break;
                      }
                      usePlanStore.getState().navigateTo(targetId);
                    }}
                    className={`px-2 py-0.5 text-xs rounded-md transition-colors ${currentLevel === level
                      ? 'bg-blue-100 text-blue-700 font-medium'
                      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                      }`}
                  >
                    {LEVEL_CONFIG[level].label}
                  </button>
                ))}
              </div>
            </div>

            {/* 우측: 오늘 버튼 + 계획/기록 토글 */}
            <div className="w-20 flex justify-end items-center gap-2">
              {/* 현재로 이동 버튼 */}
              {currentLevel !== 'THIRTY_YEAR' && currentLevel !== 'FIVE_YEAR' && (
                <button
                  onClick={() => {
                    const now = new Date();
                    const currentYear = now.getFullYear();
                    const currentMonth = now.getMonth() + 1;
                    let targetId = '';
                    switch (currentLevel) {
                      case 'YEAR': targetId = `y-${currentYear}`; break;
                      case 'QUARTER': targetId = `q-${currentYear}-${Math.ceil(currentMonth / 3)}`; break;
                      case 'MONTH': targetId = `m-${currentYear}-${String(currentMonth).padStart(2, '0')}`; break;
                      case 'WEEK': {
                        // 현재 날짜가 속한 월의 주차 계산
                        const day = now.getDate();
                        const weeks = getWeeksInMonth(currentYear, currentMonth);
                        const targetDate = new Date(currentYear, currentMonth - 1, day);
                        let weekNum = 1;
                        for (const week of weeks) {
                          if (targetDate >= week.start && targetDate <= week.end) {
                            weekNum = week.weekNum;
                            break;
                          }
                        }
                        targetId = `w-${currentYear}-${String(currentMonth).padStart(2, '0')}-${weekNum}`;
                        break;
                      }
                      case 'DAY': targetId = `d-${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; break;
                    }
                    if (targetId) usePlanStore.getState().navigateTo(targetId);
                  }}
                  className="px-2.5 py-1 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  {currentLevel === 'DAY' ? '오늘' : currentLevel === 'WEEK' ? '이번주' : currentLevel === 'MONTH' ? '이번달' : currentLevel === 'QUARTER' ? '이번분기' : '올해'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* 목표/다짐 영역 */}
        {/* ═══════════════════════════════════════════════════════ */}
        <div className="px-2 md:px-4 py-2 bg-white border-b border-gray-200">
          {/* 목표 + 다짐 + 토글 */}
          <div className="flex items-center gap-1 md:gap-2">
            {/* 목표 인라인 입력 (데스크톱만) */}
            <div className="hidden md:flex items-center gap-1 flex-1 min-w-0">
              <span className="text-xs text-slate-500 flex-shrink-0">🎯</span>
              {editingField === 'goal' ? (
                <input
                  type="text"
                  value={period.goal}
                  onChange={(e) => updatePeriodHeader('goal', e.target.value)}
                  onBlur={() => setEditingField(null)}
                  onKeyDown={(e) => e.key === 'Enter' && setEditingField(null)}
                  placeholder="목표..."
                  autoFocus
                  className="flex-1 min-w-0 px-2 py-0.5 text-sm border-b-2 border-blue-500 outline-none bg-transparent"
                />
              ) : (
                <span
                  onClick={() => setEditingField('goal')}
                  className={`flex-1 min-w-0 truncate cursor-pointer text-sm px-1 py-0.5 rounded hover:bg-blue-50 ${period.goal ? 'text-slate-700 font-medium' : 'text-slate-400'
                    }`}
                >
                  {period.goal || '목표 입력...'}
                </span>
              )}
            </div>

            {/* 다짐 인라인 입력 (데스크톱만) */}
            <div className="hidden md:flex items-center gap-1 flex-1 min-w-0">
              <span className="text-xs text-slate-500 flex-shrink-0">💪</span>
              {editingField === 'motto' ? (
                <input
                  type="text"
                  value={period.motto}
                  onChange={(e) => updatePeriodHeader('motto', e.target.value)}
                  onBlur={() => setEditingField(null)}
                  onKeyDown={(e) => e.key === 'Enter' && setEditingField(null)}
                  placeholder="다짐..."
                  autoFocus
                  className="flex-1 min-w-0 px-2 py-0.5 text-sm border-b-2 border-green-500 outline-none bg-transparent"
                />
              ) : (
                <span
                  onClick={() => setEditingField('motto')}
                  className={`flex-1 min-w-0 truncate cursor-pointer text-sm px-1 py-0.5 rounded hover:bg-green-50 ${period.motto ? 'text-slate-700 font-medium' : 'text-slate-400'
                    }`}
                >
                  {period.motto || '다짐 입력...'}
                </span>
              )}
            </div>

            {/* 계획/기록 토글 (태블릿 이상만) */}
            <div className="hidden lg:flex items-center gap-2">
              <div className="bg-slate-200 rounded-md p-0.5 flex-shrink-0">
                <button className="px-3 py-1 rounded text-xs font-medium bg-blue-600 text-white">
                  계획
                </button>
                <button
                  onClick={() => usePlanStore.getState().toggleViewMode()}
                  className="px-3 py-1 rounded text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  기록
                </button>
              </div>
              <Link href="/notepad">
                <span className="px-3 py-1.5 rounded-md text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900 border border-gray-200 transition-colors flex items-center gap-1">
                  <span>📝</span>
                  메모장
                </span>
              </Link>
            </div>
          </div>

          {/* 2줄: 메모 태그들 (데스크톱만) */}
          <div className="hidden md:flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-500 flex-shrink-0">📝</span>
            {/* 상속된 메모 + 현재 기간 메모 */}
            {getInheritedMemos(currentPeriodId).map((memo, index) => {
              const isCurrentPeriod = memo.sourcePeriodId === currentPeriodId;
              const levelColors: Record<string, string> = {
                THIRTY_YEAR: 'bg-rose-50 border-rose-200 text-rose-700',
                FIVE_YEAR: 'bg-orange-50 border-orange-200 text-orange-700',
                YEAR: 'bg-amber-50 border-amber-200 text-amber-700',
                QUARTER: 'bg-lime-50 border-lime-200 text-lime-700',
                MONTH: 'bg-emerald-50 border-emerald-200 text-emerald-700',
                WEEK: 'bg-cyan-50 border-cyan-200 text-cyan-700',
                DAY: 'bg-blue-50 border-blue-200 text-blue-700',
              };
              const colorClass = levelColors[memo.sourceLevel] || 'bg-gray-50 border-gray-200 text-gray-700';

              return (
                <span
                  key={memo.id}
                  className={`group inline-flex items-center gap-1 px-2 py-0.5 border rounded-full text-xs ${colorClass} ${!isCurrentPeriod ? 'opacity-90 ring-1 ring-inset ring-black/5' : ''}`}
                >
                  {/* 출처 레벨 태그 (현재 기간이 아닌 경우만) */}
                  {!isCurrentPeriod && (
                    <span className="text-[10px] font-bold px-1 rounded-sm bg-black/5 mr-0.5">
                      {SOURCE_TAG_PREFIX[memo.sourceLevel]}
                    </span>
                  )}
                  {memo.content}
                  {/* 삭제 버튼 (현재 기간 메모만) */}
                  {isCurrentPeriod && (
                    <button
                      onClick={() => {
                        // 현재 기간의 structuredMemos에서 해당 인덱스 찾기
                        const currentMemos = period.structuredMemos || [];
                        const memoIndex = currentMemos.findIndex(m => m.id === memo.id);
                        if (memoIndex !== -1) removeMemo(memoIndex);
                      }}
                      className="w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-white/50 transition-colors"
                    >
                      ×
                    </button>
                  )}
                </span>
              );
            })}
            {/* 메모 추가 입력 */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (memoInput.trim()) {
                  addMemo(memoInput.trim());
                  setMemoInput('');
                }
              }}
              className="flex-shrink-0"
            >
              <input
                type="text"
                value={memoInput}
                onChange={(e) => setMemoInput(e.target.value)}
                placeholder="+ 메모 추가..."
                enterKeyHint="done"
                className="w-28 px-2 py-0.5 text-xs border border-dashed border-slate-300 rounded-full outline-none focus:border-amber-400 bg-transparent placeholder-slate-400"
              />
            </form>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* 본문 영역 (반응형: 데스크톱 3열 / 모바일 탭 전환) */}
        {/* ═══════════════════════════════════════════════════════ */}
        <div className="flex-1 flex overflow-hidden pb-14 md:pb-0">
          {/* ─────────────────────────────────────────────────────── */}
          {/* 좌측 패널: 할일 목록 (데스크톱: 항상 / 모바일: 탭 선택시) */}
          {/* ─────────────────────────────────────────────────────── */}
          <div className={`
            bg-white border-r border-slate-200 overflow-y-auto
            w-full md:w-56 lg:w-72
            ${mobileTab === 'todo' ? 'block' : 'hidden'} md:block
          `}>
            <div className="p-3 border-b-2 border-blue-500 bg-blue-50">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span className="text-blue-600">✓</span>
                할일
                <span className="text-xs font-medium text-white bg-blue-600 px-2 py-0.5 rounded-full">
                  {period.todos.filter(t => t.isCompleted).length}/{period.todos.length}
                </span>
              </h2>
            </div>
            <div className="divide-y divide-slate-100">
              {TODO_CATEGORIES.map((cat) => {
                const catConfig = TODO_CATEGORY_CONFIG[cat];
                const categoryItems = period.todos.filter(i => i.todoCategory === cat);

                // 트리 구조 헬퍼
                const itemMap = new Map(categoryItems.map(i => [i.id, i]));
                const collapsedParents = new Set<string>();
                categoryItems.forEach(item => {
                  if (item.childIds && item.childIds.length > 0 && !item.isExpanded) {
                    collapsedParents.add(item.id);
                  }
                });
                const isHidden = (item: Item): boolean => {
                  if (!item.parentId) return false;
                  if (collapsedParents.has(item.parentId)) return true;
                  const parent = itemMap.get(item.parentId);
                  return parent ? isHidden(parent) : false;
                };
                const getDepth = (item: Item): number => {
                  if (!item.parentId) return 0;
                  const parent = itemMap.get(item.parentId);
                  return parent ? getDepth(parent) + 1 : 0;
                };

                return (
                  <TodoCategoryDropZone key={cat} category={cat}>
                    {/* 카테고리 헤더 */}
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${catConfig.dotColor}`} />
                      <span className="text-xs font-semibold text-slate-700">{catConfig.label}</span>
                      {categoryItems.length > 0 && (
                        <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full font-medium">{categoryItems.length}</span>
                      )}
                    </div>
                    {/* 카테고리 아이템 목록 */}
                    <div className="space-y-1 mb-1">
                      {categoryItems.map((item) => (
                        <DraggableItem
                          key={item.id}
                          item={item}
                          from="todo"
                          onToggle={() => toggleComplete(item.id, 'todo')}
                          onDelete={() => deleteItem(item.id, 'todo')}
                          onColorChange={(color) => updateItemColor(item.id, color, 'todo')}
                          onContentChange={(content) => updateItemContent(item.id, content, 'todo')}
                          onAddSubItem={(content) => addSubItem(item.id, content, 'todo')}
                          onToggleExpand={() => toggleExpand(item.id, 'todo')}
                          onLongPress={() => setAssignModalItem({ item, from: 'todo' })}
                          onOpenNote={() => {
                            setSidebarNoteItem(item);
                            setSidebarNoteLocation('todo');
                          }}
                          progress={getProgress(item.id)}
                          depth={getDepth(item)}
                          isHidden={isHidden(item)}
                        />
                      ))}
                    </div>
                    {/* 카테고리별 추가 입력 */}
                    <AddItemInput
                      onAdd={(content) => addItem(content, 'todo', undefined, undefined, cat)}
                      placeholder={TODO_PLACEHOLDER[cat]}
                    />
                  </TodoCategoryDropZone>
                );
              })}
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────── */}
          {/* 중앙: 메인 그리드 (데스크톱: 항상 / 모바일: 탭 선택시) */}
          {/* ─────────────────────────────────────────────────────── */}
          <div className={`
            flex-1 p-2 md:p-4 lg:p-6 overflow-y-auto
            ${mobileTab === 'grid' ? 'block' : 'hidden'} md:block
          `}>
            {config.childLevel ? (
              /* 단일 그리드 (isMobile 상태로 레이아웃 결정) */
              <div
                className="grid gap-2 lg:gap-4 h-full"
                style={getGridStyle(currentLevel, isMobile)}
              >
                {childPeriodIds.map((childId) => {
                  // WEEK 레벨에서 DAY 셀이 다른 달에 속하는지 확인
                  const currentParsed = parsePeriodId(currentPeriodId);
                  const childParsed = parsePeriodId(childId);
                  const isOutsideMonth = currentParsed.level === 'WEEK' &&
                    currentParsed.month !== undefined &&
                    childParsed.month !== undefined &&
                    childParsed.month !== currentParsed.month;

                  return (
                    <GridCell
                      key={childId}
                      slotId={childId}
                      label={isMobile ? getSlotLabelShort(childId, baseYear) : getSlotLabel(childId, baseYear)}
                      items={period.slots[childId] || []}
                      onDrillDown={() => drillDown(childId)}
                      onToggleItem={(itemId) => toggleComplete(itemId, 'slot', childId)}
                      onDeleteItem={(itemId) => deleteItem(itemId, 'slot', childId)}
                      onUpdateNote={(itemId, note) => updateItemNote(itemId, note, 'slot', childId)}
                      isOutsideMonth={isOutsideMonth}
                    />
                  );
                })}
              </div>
            ) : (
              /* DAY 레벨: 시간대 그리드 (단일 렌더링) */
              <div className={`grid gap-2 md:gap-3 h-full ${isMobile ? 'grid-cols-1' : 'grid-cols-4 grid-rows-2'}`}>
                {TIME_SLOTS.map((timeSlot) => {
                  const slotId = getTimeSlotId(currentPeriodId, timeSlot);
                  const items = period.timeSlots?.[timeSlot] || [];
                  return (
                    <TimeSlotCell
                      key={timeSlot}
                      slotId={slotId}
                      timeSlot={timeSlot}
                      items={items}
                      onToggleItem={(itemId) => toggleComplete(itemId, 'slot', slotId)}
                      onDeleteItem={(itemId) => deleteItem(itemId, 'slot', slotId)}
                      onUpdateNote={(itemId, note) => updateItemNote(itemId, note, 'slot', slotId)}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* ─────────────────────────────────────────────────────── */}
          {/* 우측 패널: 루틴 목록 (데스크톱: 항상 / 모바일: 탭 선택시) */}
          {/* ─────────────────────────────────────────────────────── */}
          <div className={`
            bg-white border-l border-slate-200 overflow-y-auto
            w-full md:w-56 lg:w-72
            ${mobileTab === 'routine' ? 'block' : 'hidden'} md:block
          `}>
            <div className="p-3 border-b-2 border-purple-500 bg-purple-50">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span className="text-purple-600">↻</span>
                루틴
                <span className="text-xs font-medium text-white bg-purple-600 px-2 py-0.5 rounded-full">
                  {period.routines.filter(r => r.isCompleted).length}/{period.routines.length}
                </span>
              </h2>
            </div>
            <div className="divide-y divide-slate-100">
              {CATEGORIES.map((cat) => {
                const catConfig = CATEGORY_CONFIG[cat];
                const categoryItems = period.routines.filter(i => i.category === cat);

                // 트리 구조 헬퍼
                const itemMap = new Map(categoryItems.map(i => [i.id, i]));
                const collapsedParents = new Set<string>();
                categoryItems.forEach(item => {
                  if (item.childIds && item.childIds.length > 0 && !item.isExpanded) {
                    collapsedParents.add(item.id);
                  }
                });
                const isHidden = (item: Item): boolean => {
                  if (!item.parentId) return false;
                  if (collapsedParents.has(item.parentId)) return true;
                  const parent = itemMap.get(item.parentId);
                  return parent ? isHidden(parent) : false;
                };
                const getDepth = (item: Item): number => {
                  if (!item.parentId) return 0;
                  const parent = itemMap.get(item.parentId);
                  return parent ? getDepth(parent) + 1 : 0;
                };

                return (
                  <RoutineCategoryDropZone key={cat} category={cat}>
                    {/* 카테고리 헤더 */}
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${catConfig.dotColor}`} />
                      <span className="text-xs font-semibold text-slate-700">{catConfig.label}</span>
                      {categoryItems.length > 0 && (
                        <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full font-medium">{categoryItems.length}</span>
                      )}
                    </div>
                    {/* 카테고리 아이템 목록 */}
                    <div className="space-y-1 mb-1">
                      {categoryItems.map((item) => (
                        <DraggableItem
                          key={item.id}
                          item={item}
                          from="routine"
                          onToggle={() => toggleComplete(item.id, 'routine')}
                          onDelete={() => deleteItem(item.id, 'routine')}
                          onColorChange={(color) => updateItemColor(item.id, color, 'routine')}
                          onContentChange={(content) => updateItemContent(item.id, content, 'routine')}
                          onAddSubItem={(content) => addSubItem(item.id, content, 'routine')}
                          onToggleExpand={() => toggleExpand(item.id, 'routine')}
                          onLongPress={() => setAssignModalItem({ item, from: 'routine' })}
                          onOpenNote={() => {
                            setSidebarNoteItem(item);
                            setSidebarNoteLocation('routine');
                          }}
                          progress={getProgress(item.id)}
                          depth={getDepth(item)}
                          isHidden={isHidden(item)}
                        />
                      ))}
                    </div>
                    {/* 카테고리별 추가 입력 (루틴은 횟수 지원) */}
                    <AddItemInput
                      onAdd={(content, count) => addItem(content, 'routine', count, cat)}
                      placeholder={ROUTINE_PLACEHOLDER[cat]}
                    />
                  </RoutineCategoryDropZone>
                );
              })}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* 하단 탭바 (모바일 전용) */}
        {/* ═══════════════════════════════════════════════════════ */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-white border-t border-slate-200 shadow-lg z-50">
          <nav className="flex h-full">
            <button
              onClick={() => setMobileTab('todo')}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${mobileTab === 'todo'
                ? 'text-blue-600 bg-blue-50'
                : 'text-slate-500 hover:bg-slate-50'
                }`}
            >
              <span className="text-lg">✓</span>
              <span className="text-[10px] font-medium">할일</span>
            </button>
            <button
              onClick={() => setMobileTab('grid')}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${mobileTab === 'grid'
                ? 'text-blue-600 bg-blue-50'
                : 'text-slate-500 hover:bg-slate-50'
                }`}
            >
              <span className="text-lg">📅</span>
              <span className="text-[10px] font-medium">일정</span>
            </button>
            <button
              onClick={() => setMobileTab('routine')}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${mobileTab === 'routine'
                ? 'text-purple-600 bg-purple-50'
                : 'text-slate-500 hover:bg-slate-50'
                }`}
            >
              <span className="text-lg">↻</span>
              <span className="text-[10px] font-medium">루틴</span>
            </button>
          </nav>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* 드래그 오버레이 */}
      {/* ═══════════════════════════════════════════════════════ */}
      {mounted && createPortal(
        <DragOverlay>
          {activeItem && (
            <div className={`
              p-3 rounded-lg border-2 border-blue-500 shadow-xl
              ${activeItem.item.color || 'bg-white'}
              transform rotate-2 scale-105
            `}>
              <span className="font-medium">{activeItem.item.content}</span>
            </div>
          )}
        </DragOverlay>,
        document.body
      )}

      {/* 모바일 배정 모달 (롱프레스) */}
      {assignModalItem && (
        <AssignModal
          item={assignModalItem.item}
          from={assignModalItem.from}
          currentLevel={currentLevel}
          childPeriodIds={childPeriodIds}
          baseYear={baseYear}
          onAssignToSlot={assignToSlot}
          onAssignToTimeSlot={assignToTimeSlot}
          onClose={() => setAssignModalItem(null)}
        />
      )}

      {/* 사이드바 노트 모달 */}
      {sidebarNoteItem && (
        <NoteModal
          item={sidebarNoteItem}
          onSave={(note) => {
            updateItemNote(sidebarNoteItem.id, note, sidebarNoteLocation);
            setSidebarNoteItem(null);
          }}
          onClose={() => setSidebarNoteItem(null)}
        />
      )}

    </DndContext>
  );
}

export { FractalView };
