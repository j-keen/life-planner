'use client';

import React, { useState, memo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Item, Category, TodoCategory } from '../../types/plan';
import { usePlanStore } from '../../store/usePlanStore';
import { parseDayPeriodId, isHolidayOrWeekend } from '../../lib/holidays';
import { NoteModal } from '../../components/NoteModal';
import { CellDraggableItem } from './CellDraggableItem';

// ═══════════════════════════════════════════════════════════════
// 할일 카테고리 드롭 영역
// ═══════════════════════════════════════════════════════════════
export function TodoCategoryDropZone({
  category,
  children
}: {
  category: TodoCategory;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `todo-category-${category}`
  });

  return (
    <div
      ref={setNodeRef}
      className={`p-2 hover:bg-slate-50 transition-colors ${isOver ? 'bg-blue-50 ring-2 ring-blue-300 ring-inset' : ''}`}
    >
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 루틴 카테고리 드롭 영역
// ═══════════════════════════════════════════════════════════════
export function RoutineCategoryDropZone({
  category,
  children
}: {
  category: Category;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `routine-category-${category}`
  });

  return (
    <div
      ref={setNodeRef}
      className={`p-2 hover:bg-slate-50 transition-colors ${isOver ? 'bg-purple-50 ring-2 ring-purple-300 ring-inset' : ''}`}
    >
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 드롭 가능한 그리드 셀 컴포넌트
// rerender-memo: 부모 리렌더 시 불필요한 리렌더링 방지
// ═══════════════════════════════════════════════════════════════
export const GridCell = memo(function GridCell({
  slotId,
  label,
  items,
  onDrillDown,
  onToggleItem,
  onDeleteItem,
  onUpdateNote,
  isOutsideMonth = false,
}: {
  slotId: string;
  label: string;
  items: Item[];
  onDrillDown: () => void;
  onToggleItem: (itemId: string) => void;
  onDeleteItem: (itemId: string) => void;
  onUpdateNote: (itemId: string, note: string) => void;
  isOutsideMonth?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: slotId });
  const [noteModalItem, setNoteModalItem] = useState<Item | null>(null);

  const completedCount = items.filter((i) => i.isCompleted).length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // 주말/공휴일 색상 계산
  const date = parseDayPeriodId(slotId);
  const dayInfo = date ? isHolidayOrWeekend(date) : null;

  // 색상 결정: 다른 달 > 공휴일/일요일 > 토요일 > 기본
  const getColors = () => {
    // 다른 달 날짜는 회색 처리
    if (isOutsideMonth) {
      return { bg: 'bg-gray-100', header: 'bg-gray-200', border: 'border-gray-300', text: 'text-gray-400', opacity: 'opacity-60' };
    }
    if (!dayInfo) return { bg: 'bg-white', header: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-800', opacity: '' };
    if (dayInfo.isHoliday || dayInfo.isSunday) {
      return { bg: 'bg-red-50', header: 'bg-red-100', border: 'border-red-200', text: 'text-red-700', opacity: '' };
    }
    if (dayInfo.isSaturday) {
      return { bg: 'bg-blue-50', header: 'bg-blue-100', border: 'border-blue-200', text: 'text-blue-700', opacity: '' };
    }
    return { bg: 'bg-white', header: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-800', opacity: '' };
  };
  const colors = getColors();

  return (
    <div
      ref={setNodeRef}
      onClick={onDrillDown}
      className={`
        flex flex-col rounded-xl cursor-pointer
        min-h-[140px] transition-all overflow-hidden
        ${colors.opacity}
        ${isOver
          ? 'border-2 border-blue-500 bg-blue-50 shadow-lg scale-[1.02]'
          : `border ${colors.border} ${colors.bg} hover:border-blue-400 hover:shadow-md`}
      `}
    >
      {/* 셀 헤더 */}
      <div className={`flex items-center justify-between px-3 py-2 ${colors.header} border-b ${colors.border}`}>
        <div className="flex items-center gap-1">
          <span className={`text-sm font-bold ${colors.text}`}>{label}</span>
          {dayInfo?.holidayName && (
            <span className="text-[10px] text-red-500 font-medium">({dayInfo.holidayName})</span>
          )}
        </div>
        {totalCount > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${progress === 100 ? 'bg-green-500' : 'bg-blue-500'
                  }`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className={`text-xs font-bold ${progress === 100 ? 'text-green-600' : 'text-blue-600'}`}>{progress}%</span>
          </div>
        )}
      </div>

      {/* 배정된 아이템들 */}
      <div className="flex-1 p-2 space-y-1.5 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {(() => {
          // 트리 구조 렌더링을 위한 처리
          const itemMap = new Map(items.map(i => [i.id, i]));
          // 부모가 없거나 이 셀에 부모가 없는 아이템을 루트로 간주
          const rootItems = items.filter(i => !i.parentId || !itemMap.has(i.parentId));
          const { toggleExpand } = usePlanStore.getState(); // 액션 직접 접근

          const renderItem = (item: Item, depth: number) => {
            const hasChildren = item.childIds?.some(id => itemMap.has(id));
            const isExpanded = item.isExpanded ?? false;

            return (
              <React.Fragment key={item.id}>
                <CellDraggableItem
                  item={item}
                  slotId={slotId}
                  onToggle={() => onToggleItem(item.id)}
                  onDelete={() => onDeleteItem(item.id)}
                  onOpenNote={() => setNoteModalItem(item)}
                  onToggleExpand={() => toggleExpand(item.id, item.sourceType || 'todo')}
                  depth={depth}
                  hasChildren={!!hasChildren}
                />
                {isExpanded && hasChildren && item.childIds?.map(childId => {
                  const child = itemMap.get(childId);
                  if (child) return renderItem(child, depth + 1);
                  return null;
                })}
              </React.Fragment>
            );
          };

          return rootItems.map(item => renderItem(item, 0));
        })()}
        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs py-4">
            <span className="text-2xl mb-1">📥</span>
            드래그하여 추가
          </div>
        )}
      </div>

      {/* 메모 모달 */}
      {noteModalItem && (
        <NoteModal
          item={noteModalItem}
          onSave={(note) => onUpdateNote(noteModalItem.id, note)}
          onClose={() => setNoteModalItem(null)}
        />
      )}
    </div>
  );
});
