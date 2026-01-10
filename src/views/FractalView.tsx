'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  useDraggable,
  useDroppable,
  DragStartEvent,
  DragEndEvent,
  useSensors,
  useSensor,
  PointerSensor,
} from '@dnd-kit/core';
import { createPortal } from 'react-dom';
import {
  usePlanStore,
  getChildPeriodIds,
  getSlotLabel,
  parsePeriodId,
  getTimeSlotId,
  getAdjacentPeriodId,
  getISOWeek,
  getISOWeekYear,
} from '../store/usePlanStore';
import { Item, LEVEL_CONFIG, COLORS, TIME_SLOTS, TIME_SLOT_CONFIG, TimeSlot, SOURCE_TAG_PREFIX, Category, CATEGORIES, CATEGORY_CONFIG } from '../types/plan';
import { parseDayPeriodId, isHolidayOrWeekend } from '../lib/holidays';

// ═══════════════════════════════════════════════════════════════
// 카테고리별 힌트 텍스트
// ═══════════════════════════════════════════════════════════════
const CATEGORY_PLACEHOLDER: Record<Category, { todo: string; routine: string }> = {
  work: { todo: '+ 보고서 작성', routine: '+ 이메일 확인 / 2' },
  health: { todo: '+ 건강검진 예약', routine: '+ 운동 / 3' },
  relationship: { todo: '+ 부모님 전화', routine: '+ 연락하기 / 2' },
  finance: { todo: '+ 공과금 납부', routine: '+ 가계부 정리 / 1' },
  growth: { todo: '+ 책 구매', routine: '+ 독서 30분 / 5' },
  uncategorized: { todo: '+ 할일 추가', routine: '+ 루틴 / 횟수' },
};

// ═══════════════════════════════════════════════════════════════
// 카테고리 실제 border 색상 (Tailwind 클래스 → 실제 색상)
// ═══════════════════════════════════════════════════════════════
const getCategoryBorderColor = (category: Category): string => {
  const colors: Record<Category, string> = {
    work: '#3b82f6',        // blue-500
    health: '#22c55e',      // green-500
    relationship: '#f43f5e', // rose-500
    finance: '#f59e0b',     // amber-500
    growth: '#a855f7',      // purple-500
    uncategorized: '#9ca3af', // gray-400
  };
  return colors[category];
};

// ═══════════════════════════════════════════════════════════════
// 색상 선택 메뉴
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
// 메모 팝업 모달
// ═══════════════════════════════════════════════════════════════
function NoteModal({
  item,
  onSave,
  onClose,
}: {
  item: Item;
  onSave: (note: string) => void;
  onClose: () => void;
}) {
  const [noteValue, setNoteValue] = useState(item.note || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleSave = () => {
    onSave(noteValue);
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모달 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 bg-amber-50 border-b border-amber-200">
          <div className="flex items-center gap-2">
            <span className="text-amber-600">📝</span>
            <span className="font-semibold text-slate-700 truncate max-w-[250px]">{item.content}</span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-amber-200 text-slate-500 hover:text-slate-700 transition-colors"
          >
            ×
          </button>
        </div>

        {/* 모달 본문 */}
        <div className="p-4">
          <textarea
            ref={textareaRef}
            value={noteValue}
            onChange={(e) => setNoteValue(e.target.value)}
            placeholder="상세 메모를 입력하세요..."
            className="w-full h-40 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none"
          />
        </div>

        {/* 모달 푸터 */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200">
          <button
            onClick={() => {
              setNoteValue('');
              onSave('');
              onClose();
            }}
            className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            메모 삭제
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium"
            >
              저장
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ═══════════════════════════════════════════════════════════════
// 편집 가능한 텍스트
// ═══════════════════════════════════════════════════════════════
function EditableText({
  value,
  onSave,
  className = '',
}: {
  value: string;
  onSave: (value: string) => void;
  className?: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={() => {
          setIsEditing(false);
          if (localValue !== value) {
            onSave(localValue);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            setIsEditing(false);
            onSave(localValue);
          }
          if (e.key === 'Escape') {
            setIsEditing(false);
            setLocalValue(value);
          }
        }}
        className={`w-full px-1 border-b-2 border-blue-500 outline-none bg-transparent ${className}`}
      />
    );
  }

  return (
    <span
      onClick={() => setIsEditing(true)}
      className={`cursor-text hover:bg-gray-100 rounded px-1 block overflow-hidden text-ellipsis whitespace-nowrap ${className}`}
    >
      {value || <span className="text-gray-400">클릭하여 편집...</span>}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════
// 드래그 가능한 아이템 컴포넌트 (트리 구조 지원)
// ═══════════════════════════════════════════════════════════════
function DraggableItem({
  item,
  from,
  onToggle,
  onDelete,
  onColorChange,
  onContentChange,
  onAddSubItem,
  onToggleExpand,
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
  progress?: number;
  depth?: number;
  isHidden?: boolean;
}) {
  const [showColorMenu, setShowColorMenu] = useState(false);
  const [showSubInput, setShowSubInput] = useState(false);
  const [subContent, setSubContent] = useState('');
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${from}-${item.id}`,
    data: { item, from },
  });

  const showCount = from === 'routine' && item.targetCount;
  const remaining = item.currentCount ?? item.targetCount ?? 0;
  const hasChildren = item.childIds && item.childIds.length > 0;
  const isRoot = !item.parentId;

  // 숨겨진 항목은 렌더링하지 않음
  if (isHidden) return null;

  const handleAddSubItem = () => {
    if (subContent.trim()) {
      onAddSubItem(subContent.trim());
      setSubContent('');
      setShowSubInput(false);
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
          ${item.color || 'bg-white'} border-slate-200
          ${isDragging ? 'opacity-40 scale-95' : 'opacity-100'}
          ${item.isCompleted ? 'bg-green-50 border-green-300' : ''}
          hover:shadow-md hover:border-blue-400 transition-all
        `}
        style={{ marginLeft: depth * 16 }}
        onContextMenu={(e) => {
          e.preventDefault();
          setShowColorMenu(true);
        }}
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

        {/* 달성률 표시 (자식이 있는 항목) */}
        {hasChildren && progress !== undefined && (
          <span className={`text-[10px] font-bold flex-shrink-0 ${
            progress === 100 ? 'text-green-600' : 'text-blue-600'
          }`}>{progress}%</span>
        )}

        {/* 루틴 카운트 */}
        {showCount && (
          <span className="text-[10px] font-bold text-purple-600 flex-shrink-0">
            {remaining}/{item.targetCount}
          </span>
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
}

// ═══════════════════════════════════════════════════════════════
// 드롭 가능한 그리드 셀 컴포넌트
// ═══════════════════════════════════════════════════════════════
function GridCell({
  slotId,
  label,
  items,
  onDrillDown,
  onToggleItem,
  onDeleteItem,
  onUpdateNote,
}: {
  slotId: string;
  label: string;
  items: Item[];
  onDrillDown: () => void;
  onToggleItem: (itemId: string) => void;
  onDeleteItem: (itemId: string) => void;
  onUpdateNote: (itemId: string, note: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: slotId });
  const [noteModalItem, setNoteModalItem] = useState<Item | null>(null);

  const completedCount = items.filter((i) => i.isCompleted).length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // 주말/공휴일 색상 계산
  const date = parseDayPeriodId(slotId);
  const dayInfo = date ? isHolidayOrWeekend(date) : null;

  // 색상 결정: 공휴일/일요일 > 토요일 > 기본
  const getColors = () => {
    if (!dayInfo) return { bg: 'bg-white', header: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-800' };
    if (dayInfo.isHoliday || dayInfo.isSunday) {
      return { bg: 'bg-red-50', header: 'bg-red-100', border: 'border-red-200', text: 'text-red-700' };
    }
    if (dayInfo.isSaturday) {
      return { bg: 'bg-blue-50', header: 'bg-blue-100', border: 'border-blue-200', text: 'text-blue-700' };
    }
    return { bg: 'bg-white', header: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-800' };
  };
  const colors = getColors();

  return (
    <div
      ref={setNodeRef}
      onClick={onDrillDown}
      className={`
        flex flex-col rounded-xl cursor-pointer
        min-h-[140px] transition-all overflow-hidden
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
                className={`h-full rounded-full transition-all ${
                  progress === 100 ? 'bg-green-500' : 'bg-blue-500'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className={`text-xs font-bold ${progress === 100 ? 'text-green-600' : 'text-blue-600'}`}>{progress}%</span>
          </div>
        )}
      </div>

      {/* 배정된 아이템들 */}
      <div className="flex-1 p-2 space-y-1.5 overflow-y-auto">
        {items.map((item) => {
          const catConfig = item.category ? CATEGORY_CONFIG[item.category] : null;
          return (
            <div
              key={item.id}
              className={`
                group flex items-center gap-1.5 p-1.5 rounded-lg text-xs
                ${item.color || 'bg-slate-50'} border border-slate-200
                ${item.isCompleted ? 'bg-green-50 border-green-200' : ''}
                hover:shadow-sm hover:bg-white transition-all
              `}
              style={catConfig ? { borderLeftWidth: '3px', borderLeftColor: getCategoryBorderColor(item.category!) } : undefined}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setNoteModalItem(item);
              }}
            >
              <input
                type="checkbox"
                checked={item.isCompleted}
                onChange={() => onToggleItem(item.id)}
                className="w-3.5 h-3.5 accent-blue-600 rounded flex-shrink-0"
              />
              <span className={`flex-1 truncate ${item.isCompleted ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                {item.content}
              </span>
              {/* 출처 태그 (inline compact) */}
              {item.sourceLevel && (
                <span className={`text-[9px] px-1 py-0.5 rounded flex-shrink-0 ${
                  item.sourceType === 'routine'
                    ? 'bg-purple-100 text-purple-600'
                    : 'bg-blue-100 text-blue-600'
                }`}>
                  {SOURCE_TAG_PREFIX[item.sourceLevel]}
                </span>
              )}
              {/* 메모 뱃지 (메모가 있을 때만) */}
              {item.note && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setNoteModalItem(item);
                  }}
                  className="text-amber-500 hover:text-amber-600 text-[10px] flex-shrink-0"
                  title="메모 보기"
                >
                  📝
                </button>
              )}
              <button
                onClick={() => onDeleteItem(item.id)}
                className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 transition-all text-[10px] flex-shrink-0"
              >
                ×
              </button>
            </div>
          );
        })}
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
}

// ═══════════════════════════════════════════════════════════════
// 시간대 슬롯 셀 컴포넌트 (일 뷰 전용)
// ═══════════════════════════════════════════════════════════════
function TimeSlotCell({
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
        {items.map((item) => {
          const catConfig = item.category ? CATEGORY_CONFIG[item.category] : null;
          return (
            <div
              key={item.id}
              className={`
                group flex items-center gap-1.5 p-2 rounded-lg text-sm
                ${item.color || 'bg-white'} border border-gray-100 shadow-sm
                ${item.isCompleted ? 'opacity-60' : ''}
                hover:shadow-md transition-all
              `}
              style={catConfig ? { borderLeftWidth: '3px', borderLeftColor: getCategoryBorderColor(item.category!) } : undefined}
              onDoubleClick={() => setNoteModalItem(item)}
            >
              <input
                type="checkbox"
                checked={item.isCompleted}
                onChange={() => onToggleItem(item.id)}
                className="w-4 h-4 accent-blue-500 flex-shrink-0"
              />
              <span className={`flex-1 truncate ${item.isCompleted ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                {item.content}
              </span>
              {/* 출처 태그 (inline compact) */}
              {item.sourceLevel && (
                <span className={`text-[9px] px-1 py-0.5 rounded flex-shrink-0 ${
                  item.sourceType === 'routine'
                    ? 'bg-purple-100 text-purple-600'
                    : 'bg-blue-100 text-blue-600'
                }`}>
                  {SOURCE_TAG_PREFIX[item.sourceLevel]}
                </span>
              )}
              {/* 메모 뱃지 (메모가 있을 때만) */}
              {item.note && (
                <button
                  onClick={() => setNoteModalItem(item)}
                  className="text-amber-500 hover:text-amber-600 text-xs flex-shrink-0"
                  title="메모 보기"
                >
                  📝
                </button>
              )}
              <button
                onClick={() => onDeleteItem(item.id)}
                className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded-full bg-red-100 text-red-500 hover:bg-red-500 hover:text-white transition-all flex-shrink-0"
              >
                ×
              </button>
            </div>
          );
        })}
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
}

// ═══════════════════════════════════════════════════════════════
// 아이템 추가 입력 컴포넌트 (간소화)
// ═══════════════════════════════════════════════════════════════
function AddItemInput({
  onAdd,
  placeholder,
}: {
  onAdd: (content: string, count?: number) => void;
  placeholder: string;
}) {
  const [value, setValue] = useState('');

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!value.trim()) return;

    // "운동 / 3" 형식 파싱
    const match = value.match(/^(.+?)\s*\/\s*(\d+)$/);
    if (match) {
      onAdd(match[1].trim(), parseInt(match[2]));
    } else {
      onAdd(value.trim());
    }
    setValue('');
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        enterKeyHint="done"
        className="w-full px-2 py-1 text-xs bg-transparent border-b border-dashed border-gray-200 focus:outline-none focus:border-gray-400 placeholder-gray-300"
      />
    </form>
  );
}

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
    toggleComplete,
    getProgress,
    ensurePeriod,
    addSubItem,
    toggleExpand,
    setBaseYear,
  } = usePlanStore();

  const [activeItem, setActiveItem] = useState<{ item: Item; from: 'todo' | 'routine' } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [editingField, setEditingField] = useState<'goal' | 'motto' | null>(null);
  const [memoInput, setMemoInput] = useState('');
  const [mobileTab, setMobileTab] = useState<'todo' | 'grid' | 'routine'>('grid');

  useEffect(() => setMounted(true), []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // 현재 기간 확보
  const period = ensurePeriod(currentPeriodId);
  const config = LEVEL_CONFIG[currentLevel];
  const childPeriodIds = getChildPeriodIds(currentPeriodId, baseYear);
  const parsed = parsePeriodId(currentPeriodId);

  // Hydration 불일치 방지: 클라이언트 마운트 전까지 로딩 표시
  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100">
        <div className="text-gray-400">로딩 중...</div>
      </div>
    );
  }

  // 드래그 시작
  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as { item: Item; from: 'todo' | 'routine' } | undefined;
    if (data) {
      setActiveItem({ item: data.item, from: data.from });
    }
  };

  // 드래그 종료
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveItem(null);

    const { active, over } = event;
    if (!over) return;

    const data = active.data.current as { item: Item; from: 'todo' | 'routine' } | undefined;
    if (!data) return;

    const targetSlotId = over.id as string;

    // DAY 레벨: 시간대 슬롯 처리
    if (currentLevel === 'DAY') {
      if (targetSlotId.startsWith('ts-')) {
        const parts = targetSlotId.split('-');
        const timeSlot = parts[parts.length - 1] as TimeSlot;
        if (TIME_SLOTS.includes(timeSlot)) {
          assignToTimeSlot(data.item.id, data.from, timeSlot);
        }
      }
      return;
    }

    // 다른 레벨: 유효한 슬롯인지 확인
    if (childPeriodIds.includes(targetSlotId)) {
      assignToSlot(data.item.id, data.from, targetSlotId);
    }
  };

  // 현재 기간 제목 생성
  const getPeriodTitle = (): string => {
    switch (currentLevel) {
      case 'THIRTY_YEAR':
        return `${baseYear}~${baseYear + 29} (30년)`;
      case 'FIVE_YEAR': {
        const startYear = baseYear + (parsed.fiveYearIndex || 0) * 5;
        const endYear = startYear + 4;
        return `${startYear}~${endYear} (5년)`;
      }
      case 'YEAR':
        return `${parsed.year}년`;
      case 'QUARTER':
        return `${parsed.year}년 Q${parsed.quarter}`;
      case 'MONTH':
        return `${parsed.year}년 ${parsed.month}월`;
      case 'WEEK':
        return `${parsed.year}년 ${parsed.week}주차`;
      case 'DAY':
        return `${parsed.year}년 ${parsed.month}월 ${parsed.day}일`;
      default:
        return currentPeriodId;
    }
  };

  // 레벨별 최적 그리드 레이아웃 (반응형)
  const getGridStyle = (isMobile: boolean = false) => {
    if (isMobile) {
      // 모바일: 세로 스크롤 레이아웃
      switch (currentLevel) {
        case 'THIRTY_YEAR':
          return { gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: 'repeat(3, minmax(120px, auto))' };
        case 'FIVE_YEAR':
          return { gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: 'repeat(3, minmax(100px, auto))' };
        case 'YEAR':
          return { gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: 'repeat(2, minmax(120px, auto))' };
        case 'QUARTER':
          return { gridTemplateColumns: '1fr', gridTemplateRows: 'repeat(3, minmax(100px, auto))' };
        case 'MONTH':
          return { gridTemplateColumns: '1fr', gridTemplateRows: 'repeat(5, minmax(80px, auto))' };
        case 'WEEK':
          return { gridTemplateColumns: '1fr', gridTemplateRows: 'repeat(7, minmax(80px, auto))' };
        default:
          return { gridTemplateColumns: '1fr' };
      }
    }
    // 데스크톱
    switch (currentLevel) {
      case 'THIRTY_YEAR':
        return { gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(2, 1fr)' };
      case 'FIVE_YEAR':
        return { gridTemplateColumns: 'repeat(5, 1fr)', gridTemplateRows: '1fr' };
      case 'YEAR':
        return { gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: '1fr' };
      case 'QUARTER':
        return { gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: '1fr' };
      case 'MONTH':
        return { gridTemplateColumns: 'repeat(5, 1fr)', gridTemplateRows: '1fr' };
      case 'WEEK':
        return { gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'repeat(2, 1fr)' };
      default:
        return { gridTemplateColumns: 'repeat(4, 1fr)' };
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-full bg-slate-100">
        {/* ═══════════════════════════════════════════════════════ */}
        {/* 뷰/시간대 인지 배너 (큰 헤더) */}
        {/* ═══════════════════════════════════════════════════════ */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-3 md:px-6 py-2 md:py-3 shadow-md">
          <div className="flex items-center justify-between">
            {/* 좌측: 기간 제목 + 뷰 타입 */}
            <div className="flex items-center gap-2 md:gap-4">
              {/* 뒤로가기 (상위 레벨로) */}
              {currentLevel !== 'THIRTY_YEAR' && (
                <button
                  onClick={drillUp}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/20 hover:bg-white/30 transition-all text-white text-sm font-medium"
                  title="상위 레벨로"
                >
                  ↑
                </button>
              )}
              <div>
                <h1 className="text-lg md:text-2xl font-bold leading-tight">
                  {getPeriodTitle()}
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 mt-0.5 rounded-full text-xs font-medium bg-white/20">
                  {config.label} 뷰
                </span>
              </div>
            </div>

            {/* 우측: 네비게이션 버튼 */}
            <div className="flex items-center gap-1 md:gap-2">
              {/* 이전/다음 네비게이션 */}
              {currentLevel !== 'THIRTY_YEAR' && (
                <div className="flex items-center bg-white/20 rounded-lg">
                  <button
                    onClick={() => {
                      const prevId = getAdjacentPeriodId(currentPeriodId, 'prev', baseYear);
                      if (prevId) usePlanStore.getState().navigateTo(prevId);
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-l-lg hover:bg-white/30 transition-all text-white text-sm"
                    title="이전"
                  >
                    ◀
                  </button>
                  <button
                    onClick={() => {
                      const nextId = getAdjacentPeriodId(currentPeriodId, 'next', baseYear);
                      if (nextId) usePlanStore.getState().navigateTo(nextId);
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-r-lg hover:bg-white/30 transition-all text-white text-sm"
                    title="다음"
                  >
                    ▶
                  </button>
                </div>
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
                      case 'YEAR': targetId = `y-${currentYear}`; break;
                      case 'QUARTER': targetId = `q-${currentYear}-${Math.ceil(currentMonth / 3)}`; break;
                      case 'MONTH': targetId = `m-${currentYear}-${String(currentMonth).padStart(2, '0')}`; break;
                      case 'WEEK': {
                        const weekNum = getISOWeek(now);
                        const weekYear = getISOWeekYear(now);
                        targetId = `w-${weekYear}-${String(weekNum).padStart(2, '0')}`;
                        break;
                      }
                      case 'DAY': targetId = `d-${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; break;
                    }
                    if (targetId) usePlanStore.getState().navigateTo(targetId);
                  }}
                  className="px-3 py-1.5 text-xs font-medium bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-all"
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
        <div className="px-2 md:px-4 py-2 bg-white border-b border-slate-200 shadow-sm">
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
                  className={`flex-1 min-w-0 truncate cursor-pointer text-sm px-1 py-0.5 rounded hover:bg-blue-50 ${
                    period.goal ? 'text-slate-700 font-medium' : 'text-slate-400'
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
                  className={`flex-1 min-w-0 truncate cursor-pointer text-sm px-1 py-0.5 rounded hover:bg-green-50 ${
                    period.motto ? 'text-slate-700 font-medium' : 'text-slate-400'
                  }`}
                >
                  {period.motto || '다짐 입력...'}
                </span>
              )}
            </div>

            {/* 계획/기록 토글 (태블릿 이상만) */}
            <div className="hidden lg:flex bg-slate-200 rounded-md p-0.5 flex-shrink-0">
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
                  className={`group inline-flex items-center gap-1 px-2 py-0.5 border rounded-full text-xs ${colorClass} ${!isCurrentPeriod ? 'opacity-70' : ''}`}
                >
                  {/* 출처 레벨 태그 (현재 기간이 아닌 경우만) */}
                  {!isCurrentPeriod && (
                    <span className="text-[10px] font-semibold opacity-60">
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
              {CATEGORIES.map((cat) => {
                const config = CATEGORY_CONFIG[cat];
                const categoryItems = period.todos.filter(i => i.category === cat);

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
                  <div key={cat} className="p-2 hover:bg-slate-50 transition-colors">
                    {/* 카테고리 헤더 */}
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${config.dotColor}`} />
                      <span className="text-xs font-semibold text-slate-700">{config.label}</span>
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
                          progress={getProgress(item.id)}
                          depth={getDepth(item)}
                          isHidden={isHidden(item)}
                        />
                      ))}
                    </div>
                    {/* 카테고리별 추가 입력 */}
                    <AddItemInput
                      onAdd={(content) => addItem(content, 'todo', undefined, cat)}
                      placeholder={CATEGORY_PLACEHOLDER[cat].todo}
                    />
                  </div>
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
              <>
                {/* 데스크톱 그리드 */}
                <div
                  className="hidden md:grid gap-2 lg:gap-4 h-full"
                  style={getGridStyle(false)}
                >
                  {childPeriodIds.map((childId) => (
                    <GridCell
                      key={childId}
                      slotId={childId}
                      label={getSlotLabel(childId, baseYear)}
                      items={period.slots[childId] || []}
                      onDrillDown={() => drillDown(childId)}
                      onToggleItem={(itemId) => toggleComplete(itemId, 'slot', childId)}
                      onDeleteItem={(itemId) => deleteItem(itemId, 'slot', childId)}
                      onUpdateNote={(itemId, note) => updateItemNote(itemId, note, 'slot', childId)}
                    />
                  ))}
                </div>
                {/* 모바일 그리드 */}
                <div
                  className="md:hidden grid gap-2"
                  style={getGridStyle(true)}
                >
                  {childPeriodIds.map((childId) => (
                    <GridCell
                      key={childId}
                      slotId={childId}
                      label={getSlotLabel(childId, baseYear)}
                      items={period.slots[childId] || []}
                      onDrillDown={() => drillDown(childId)}
                      onToggleItem={(itemId) => toggleComplete(itemId, 'slot', childId)}
                      onDeleteItem={(itemId) => deleteItem(itemId, 'slot', childId)}
                      onUpdateNote={(itemId, note) => updateItemNote(itemId, note, 'slot', childId)}
                    />
                  ))}
                </div>
              </>
            ) : (
              /* DAY 레벨: 시간대 그리드 (반응형) */
              <>
                {/* 데스크톱: 4x2 그리드 */}
                <div className="hidden md:grid grid-cols-4 grid-rows-2 gap-3 h-full">
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
                {/* 모바일: 세로 리스트 */}
                <div className="md:hidden grid grid-cols-1 gap-2">
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
              </>
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
                  <div key={cat} className="p-2 hover:bg-slate-50 transition-colors">
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
                          progress={getProgress(item.id)}
                          depth={getDepth(item)}
                          isHidden={isHidden(item)}
                        />
                      ))}
                    </div>
                    {/* 카테고리별 추가 입력 (루틴은 횟수 지원) */}
                    <AddItemInput
                      onAdd={(content, count) => addItem(content, 'routine', count, cat)}
                      placeholder={CATEGORY_PLACEHOLDER[cat].routine}
                    />
                  </div>
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
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                mobileTab === 'todo'
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <span className="text-lg">✓</span>
              <span className="text-[10px] font-medium">할일</span>
            </button>
            <button
              onClick={() => setMobileTab('grid')}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                mobileTab === 'grid'
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <span className="text-lg">📅</span>
              <span className="text-[10px] font-medium">일정</span>
            </button>
            <button
              onClick={() => setMobileTab('routine')}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                mobileTab === 'routine'
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

    </DndContext>
  );
}

export { FractalView };
