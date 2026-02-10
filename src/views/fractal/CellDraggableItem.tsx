'use client';

import React, { memo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Item, SOURCE_TAG_PREFIX, TODO_CATEGORY_CONFIG, CATEGORY_CONFIG } from '../../types/plan';
import { getCategoryBorderColor } from './constants';

// ═══════════════════════════════════════════════════════════════
// 셀 내 드래그 가능한 아이템 컴포넌트
// rerender-memo: 부모 리렌더 시 불필요한 리렌더링 방지
// ═══════════════════════════════════════════════════════════════
export const CellDraggableItem = memo(function CellDraggableItem({
  item,
  slotId,
  onToggle,
  onDelete,
  onOpenNote,
  onToggleExpand,
  depth = 0,
  hasChildren = false,
}: {
  item: Item;
  slotId: string;
  onToggle: () => void;
  onDelete: () => void;
  onOpenNote: () => void;
  onToggleExpand?: () => void;
  depth?: number;
  hasChildren?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `cell-${slotId}-${item.id}`,
    data: { item, from: 'cell', sourceSlotId: slotId },
  });

  const catConfig = item.category ? CATEGORY_CONFIG[item.category] : null;

  // 카테고리 기반 배경/테두리 색상 계산
  const getCellCategoryColors = () => {
    if (item.isCompleted) {
      return 'bg-green-50 border-green-200';
    }
    if (item.todoCategory) {
      const config = TODO_CATEGORY_CONFIG[item.todoCategory];
      return `${config.bgColor} ${config.borderColor}`;
    } else if (item.category) {
      const config = CATEGORY_CONFIG[item.category];
      return `${config.bgColor} ${config.borderColor}`;
    }
    return 'bg-slate-50 border-slate-200';
  };

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`
        group flex items-center gap-1.5 p-1.5 rounded-lg text-xs cursor-grab
        ${getCellCategoryColors()}
        ${isDragging ? 'opacity-40 scale-95' : 'opacity-100'}
        hover:shadow-sm hover:border-blue-300 transition-all
      `}
      style={{
        marginLeft: depth * 12,
        ...(catConfig ? { borderLeftWidth: '3px', borderLeftColor: getCategoryBorderColor(item.category!) } : {})
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onOpenNote();
      }}
    >
      {/* 접기/펼치기 버튼 */}
      {hasChildren && onToggleExpand && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
          className="w-3 h-3 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-black/5 rounded flex-shrink-0 text-[8px]"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {item.isExpanded ? '▼' : '▶'}
        </button>
      )}

      <input
        type="checkbox"
        checked={item.isCompleted}
        onChange={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        onClick={(e) => e.stopPropagation()}
        className="w-3.5 h-3.5 accent-blue-600 rounded flex-shrink-0"
      />
      <span className={`flex-1 truncate ${item.isCompleted ? 'line-through text-slate-400' : 'text-slate-700'}`}>
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
          className="text-amber-500 hover:text-amber-600 text-[10px] flex-shrink-0"
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
        className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 transition-all text-[10px] flex-shrink-0"
      >
        ×
      </button>
    </div>
  );
});
