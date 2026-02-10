'use client';

import React, { useState, memo } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { Item, TimeSlot, TIME_SLOT_CONFIG, SOURCE_TAG_PREFIX, CATEGORY_CONFIG } from '../../types/plan';
import { NoteModal } from '../../components/NoteModal';
import { getCategoryBorderColor } from './constants';

// ═══════════════════════════════════════════════════════════════
// 시간대 슬롯 내 드래그 가능한 아이템 컴포넌트
// rerender-memo: 부모 리렌더 시 불필요한 리렌더링 방지
// ═══════════════════════════════════════════════════════════════
const TimeSlotDraggableItem = memo(function TimeSlotDraggableItem({
  item,
  slotId,
  onToggle,
  onDelete,
  onOpenNote,
}: {
  item: Item;
  slotId: string;
  onToggle: () => void;
  onDelete: () => void;
  onOpenNote: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `timeslot-${slotId}-${item.id}`,
    data: { item, from: 'timeslot', sourceSlotId: slotId },
  });

  const catConfig = item.category ? CATEGORY_CONFIG[item.category] : null;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`
        group flex items-center gap-1.5 p-2 rounded-lg text-sm cursor-grab
        ${item.color || 'bg-white'} border border-gray-100 shadow-sm
        ${item.isCompleted ? 'opacity-60' : ''}
        ${isDragging ? 'opacity-40 scale-95' : 'opacity-100'}
        hover:shadow-md hover:border-blue-300 transition-all
      `}
      style={catConfig ? { borderLeftWidth: '3px', borderLeftColor: getCategoryBorderColor(item.category!) } : undefined}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onOpenNote();
      }}
    >
      <input
        type="checkbox"
        checked={item.isCompleted}
        onChange={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        onClick={(e) => e.stopPropagation()}
        className="w-4 h-4 accent-blue-500 flex-shrink-0"
      />
      <span className={`flex-1 truncate ${item.isCompleted ? 'line-through text-gray-400' : 'text-gray-700'}`}>
        {item.content}
      </span>
      {/* 출처 태그 */}
      {item.sourceLevel && (
        <span className={`text-[9px] px-1 py-0.5 rounded flex-shrink-0 ${item.sourceType === 'routine'
          ? 'bg-purple-100 text-purple-600'
          : 'bg-blue-100 text-blue-600'
          }`}>
          {SOURCE_TAG_PREFIX[item.sourceLevel]}
        </span>
      )}
      {/* 메모 뱃지 */}
      {item.note && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenNote();
          }}
          className="text-amber-500 hover:text-amber-600 text-xs flex-shrink-0"
          title="메모 보기"
        >
          📝
        </button>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded-full bg-red-100 text-red-500 hover:bg-red-500 hover:text-white transition-all flex-shrink-0"
      >
        ×
      </button>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════
// 시간대 슬롯 셀 컴포넌트 (일 뷰 전용)
// rerender-memo: 부모 리렌더 시 불필요한 리렌더링 방지
// ═══════════════════════════════════════════════════════════════
export const TimeSlotCell = memo(function TimeSlotCell({
  slotId,
  timeSlot,
  items,
  onToggleItem,
  onDeleteItem,
  onUpdateNote,
}: {
  slotId: string;
  timeSlot: TimeSlot;
  items: Item[];
  onToggleItem: (itemId: string) => void;
  onDeleteItem: (itemId: string) => void;
  onUpdateNote: (itemId: string, note: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: slotId });
  const config = TIME_SLOT_CONFIG[timeSlot];
  const [noteModalItem, setNoteModalItem] = useState<Item | null>(null);

  const completedCount = items.filter((i) => i.isCompleted).length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // 시간대별 색상 (8칸)
  const slotColors: Record<TimeSlot, string> = {
    dawn: 'from-slate-100 to-slate-50 border-slate-300',
    morning_early: 'from-amber-50 to-yellow-50 border-amber-200',
    morning_late: 'from-orange-50 to-amber-50 border-orange-200',
    afternoon_early: 'from-sky-50 to-cyan-50 border-sky-200',
    afternoon_late: 'from-blue-50 to-sky-50 border-blue-200',
    evening_early: 'from-indigo-50 to-violet-50 border-indigo-200',
    evening_late: 'from-purple-50 to-indigo-50 border-purple-200',
    anytime: 'from-gray-50 to-slate-50 border-gray-200',
  };

  const headerColors: Record<TimeSlot, string> = {
    dawn: 'bg-slate-200 text-slate-700',
    morning_early: 'bg-amber-100 text-amber-700',
    morning_late: 'bg-orange-100 text-orange-700',
    afternoon_early: 'bg-sky-100 text-sky-700',
    afternoon_late: 'bg-blue-100 text-blue-700',
    evening_early: 'bg-indigo-100 text-indigo-700',
    evening_late: 'bg-purple-100 text-purple-700',
    anytime: 'bg-gray-100 text-gray-600',
  };

  return (
    <div
      ref={setNodeRef}
      className={`
        flex flex-col rounded-xl border-2 overflow-hidden
        h-full transition-all bg-gradient-to-br
        ${slotColors[timeSlot]}
        ${isOver ? 'border-blue-500 shadow-lg scale-[1.02]' : 'hover:shadow-md'}
      `}
    >
      {/* 슬롯 헤더 */}
      <div className={`flex flex-col px-3 py-2 ${headerColors[timeSlot]}`}>
        <div className="flex items-center justify-between">
          <span className="font-bold">{config.label}</span>
          {totalCount > 0 && (
            <span className="text-xs font-medium">{completedCount}/{totalCount}</span>
          )}
        </div>
        {config.timeRange && (
          <span className="text-xs opacity-70">{config.timeRange}</span>
        )}
        {totalCount > 0 && (
          <div className="w-full h-1 bg-white/50 rounded-full overflow-hidden mt-1">
            <div
              className="h-full bg-green-500 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* 배정된 아이템들 */}
      <div className="flex-1 p-2 space-y-1.5 overflow-y-auto">
        {items.map((item) => (
          <TimeSlotDraggableItem
            key={item.id}
            item={item}
            slotId={slotId}
            onToggle={() => onToggleItem(item.id)}
            onDelete={() => onDeleteItem(item.id)}
            onOpenNote={() => setNoteModalItem(item)}
          />
        ))}
        {items.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm py-8">
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
