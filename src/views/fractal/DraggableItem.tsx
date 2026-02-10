'use client';

import React, { useState, useRef, useEffect, memo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Item, COLORS, TODO_CATEGORY_CONFIG, CATEGORY_CONFIG } from '../../types/plan';
import { EditableText } from './EditableText';

// ═══════════════════════════════════════════════════════════════
// 색상 선택 메뉴 (DraggableItem 전용 인라인 버전)
// ═══════════════════════════════════════════════════════════════
function ColorMenu({
  onSelect,
  onClose,
}: {
  onSelect: (color: string) => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="absolute z-50 bg-white border shadow-lg rounded-lg p-2 flex gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      {COLORS.map((color) => (
        <button
          key={color}
          className={`w-6 h-6 rounded-full border-2 border-gray-300 hover:border-blue-500 ${color}`}
          onClick={() => {
            onSelect(color);
            onClose();
          }}
        />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 드래그 가능한 아이템 컴포넌트 (트리 구조 지원)
// rerender-memo: 부모 리렌더 시 불필요한 리렌더링 방지
// ═══════════════════════════════════════════════════════════════
export const DraggableItem = memo(function DraggableItem({
  item,
  from,
  onToggle,
  onDelete,
  onColorChange,
  onContentChange,
  onAddSubItem,
  onToggleExpand,
  onLongPress,
  onOpenNote,
  progress,
  depth = 0,
  isHidden = false,
}: {
  item: Item;
  from: 'todo' | 'routine';
  onToggle: () => void;
  onDelete: () => void;
  onColorChange: (color: string) => void;
  onContentChange: (content: string) => void;
  onAddSubItem: (content: string) => void;
  onToggleExpand: () => void;
  onLongPress?: () => void;
  onOpenNote?: () => void;
  progress?: number;
  depth?: number;
  isHidden?: boolean;
}) {
  const [showColorMenu, setShowColorMenu] = useState(false);
  const [showSubInput, setShowSubInput] = useState(false);
  const [subContent, setSubContent] = useState('');
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subInputRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 감지: 하위 항목 입력창 닫기
  useEffect(() => {
    if (!showSubInput) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (subInputRef.current && !subInputRef.current.contains(e.target as Node)) {
        setShowSubInput(false);
        setSubContent('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSubInput]);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${from}-${item.id}`,
    data: { item, from },
  });

  // 롱프레스 핸들러
  const handleTouchStart = () => {
    if (onLongPress) {
      longPressTimer.current = setTimeout(() => {
        onLongPress();
        if (navigator.vibrate) navigator.vibrate(50);
      }, 500);
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleTouchMove = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const showCount = from === 'routine' && item.targetCount;
  const remaining = item.currentCount ?? item.targetCount ?? 0;
  const hasChildren = item.childIds && item.childIds.length > 0;
  const isRoot = !item.parentId;

  // 카테고리 배경색 결정
  const getCategoryColors = () => {
    if (from === 'todo' && item.todoCategory) {
      const config = TODO_CATEGORY_CONFIG[item.todoCategory];
      // 배정됨: -100 (진한 색), 미배정: -50 (연한 색)
      const bgClass = hasChildren
        ? config.bgColor.replace('-50', '-100')  // 배정됨 (진한 색)
        : config.bgColor;  // 미배정 (연한 색)
      const borderClass = hasChildren
        ? config.borderColor.replace('-200', '-300')  // 배정됨 (진한 테두리)
        : config.borderColor;  // 미배정
      return `${bgClass} ${borderClass}`;
    } else if (from === 'routine' && item.category) {
      const config = CATEGORY_CONFIG[item.category];
      const bgClass = hasChildren
        ? config.bgColor.replace('-50', '-100')
        : config.bgColor;
      const borderClass = hasChildren
        ? config.borderColor.replace('-200', '-300')
        : config.borderColor;
      return `${bgClass} ${borderClass}`;
    }
    return hasChildren ? 'bg-slate-100 border-slate-300' : 'bg-white border-slate-200';
  };

  // 숨겨진 항목은 렌더링하지 않음
  if (isHidden) return null;

  const handleAddSubItem = () => {
    if (subContent.trim()) {
      onAddSubItem(subContent.trim());
      setSubContent('');
      // 입력창 유지 - Escape로 닫기
    }
  };

  return (
    <div className="flex flex-col">
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        className={`
          group relative flex items-center gap-2 px-2 py-1.5 rounded-lg border cursor-grab
          ${item.isCompleted
            ? 'bg-green-50 border-green-300'  // 완료됨 (최우선)
            : getCategoryColors()  // 카테고리 색상 (배정 여부에 따라 진하기 다름)
          }
          ${isDragging ? 'opacity-40 scale-95' : 'opacity-100'}
          hover:shadow-md hover:border-blue-400 transition-all
        `}
        style={{ marginLeft: depth * 16 }}
        onContextMenu={(e) => {
          e.preventDefault();
          setShowColorMenu(true);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (onOpenNote) onOpenNote();
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
      >
        {/* 접기/펼치기 버튼 (자식이 있을 때만) */}
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded flex-shrink-0 text-[10px]"
          >
            {item.isExpanded ? '▼' : '▶'}
          </button>
        )}

        {/* 체크박스 */}
        <input
          type="checkbox"
          checked={item.isCompleted}
          onChange={onToggle}
          className="w-4 h-4 cursor-pointer accent-blue-500 flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        />

        {/* 내용 (편집 가능) */}
        <div className={`flex-1 min-w-0 text-sm ${item.isCompleted ? 'line-through text-gray-400' : ''}`}>
          <EditableText value={item.content} onSave={onContentChange} className="truncate" />
        </div>

        {/* 달성률 표시 (최상위 항목만, 하위 항목은 체크만) */}
        {hasChildren && progress !== undefined && !item.parentId && (
          <span className={`text-[10px] font-bold flex-shrink-0 ${progress === 100 ? 'text-green-600' : 'text-blue-600'
            }`}>{progress}%</span>
        )}

        {/* 루틴 카운트 */}
        {showCount && (
          <span className="text-[10px] font-bold text-purple-600 flex-shrink-0">
            {remaining}/{item.targetCount}
          </span>
        )}

        {/* 메모 뱃지 */}
        {item.note && onOpenNote && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenNote();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="text-amber-500 hover:text-amber-600 text-[10px] flex-shrink-0"
            title="메모 보기"
          >
            📝
          </button>
        )}

        {/* 호버 시 나타나는 액션 버튼들 */}
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 flex-shrink-0 transition-opacity">
          {/* 쪼개기 버튼 (루트 아이템만) */}
          {isRoot && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowSubInput(!showSubInput);
              }}
              className="w-5 h-5 flex items-center justify-center rounded bg-blue-100 text-blue-500 hover:bg-blue-500 hover:text-white transition-all text-xs"
              title="쪼개기"
            >
              +
            </button>
          )}

          {/* 삭제 버튼 */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="w-5 h-5 flex items-center justify-center rounded-full bg-red-100 text-red-500 hover:bg-red-500 hover:text-white transition-all"
          >
            ×
          </button>
        </div>

        {/* 색상 메뉴 */}
        {showColorMenu && (
          <div className="absolute top-full left-0 mt-1 z-50">
            <ColorMenu
              onSelect={onColorChange}
              onClose={() => setShowColorMenu(false)}
            />
          </div>
        )}

      </div>

      {/* 하위 항목 추가 입력 */}
      {showSubInput && (
        <div
          ref={subInputRef}
          className="flex items-center gap-2 mt-1 p-2 bg-gray-50 rounded-lg border border-dashed border-gray-300"
          style={{ marginLeft: (depth + 1) * 20 }}
        >
          <input
            type="text"
            value={subContent}
            onChange={(e) => setSubContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddSubItem();
              if (e.key === 'Escape') {
                setShowSubInput(false);
                setSubContent('');
              }
            }}
            placeholder="하위 항목 내용..."
            className="flex-1 px-2 py-1 text-sm border rounded focus:outline-none focus:border-blue-400"
            autoFocus
          />
          <button
            onClick={handleAddSubItem}
            className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
          >
            추가
          </button>
          <button
            onClick={() => {
              setShowSubInput(false);
              setSubContent('');
            }}
            className="px-2 py-1 text-gray-500 text-xs hover:bg-gray-200 rounded"
          >
            취소
          </button>
        </div>
      )}
    </div>
  );
});
