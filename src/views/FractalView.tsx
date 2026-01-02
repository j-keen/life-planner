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
} from '../store/usePlanStore';
import { Item, LEVEL_CONFIG, COLORS, TIME_SLOTS, TIME_SLOT_CONFIG, TimeSlot, SOURCE_TAG_PREFIX } from '../types/plan';

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
      className={`cursor-text hover:bg-gray-100 rounded px-1 ${className}`}
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
          group relative flex items-center gap-1.5 p-2 rounded-lg border cursor-grab
          ${item.color || 'bg-white'} border-gray-200
          ${isDragging ? 'opacity-40 scale-95' : 'opacity-100'}
          ${item.isCompleted ? 'opacity-60' : ''}
          hover:shadow-md hover:border-blue-300 transition-all
        `}
        style={{ marginLeft: depth * 20 }}
        onContextMenu={(e) => {
          e.preventDefault();
          setShowColorMenu(true);
        }}
      >
        {/* 접기/펼치기 버튼 (자식이 있을 때만) */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
          >
            {item.isExpanded ? '▼' : '▶'}
          </button>
        ) : (
          <div className="w-5" /> /* 공간 유지 */
        )}

        {/* 체크박스 */}
        <input
          type="checkbox"
          checked={item.isCompleted}
          onChange={onToggle}
          className="w-4 h-4 cursor-pointer accent-blue-500"
          onClick={(e) => e.stopPropagation()}
        />

        {/* 내용 (편집 가능) */}
        <div className={`flex-1 text-sm ${item.isCompleted ? 'line-through text-gray-400' : ''}`}>
          <EditableText value={item.content} onSave={onContentChange} />
        </div>

        {/* 달성률 표시 */}
        {progress !== undefined && progress > 0 && (
          <div className="flex items-center gap-1">
            <div className="w-10 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[10px] text-blue-600 font-medium">{progress}%</span>
          </div>
        )}

        {/* 루틴 카운트 */}
        {showCount && (
          <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">
            {remaining}/{item.targetCount}
          </span>
        )}

        {/* 쪼개기 버튼 (루트 아이템만) */}
        {isRoot && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowSubInput(!showSubInput);
            }}
            className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded bg-blue-100 text-blue-500 hover:bg-blue-500 hover:text-white transition-all text-xs"
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
          className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded-full bg-red-100 text-red-500 hover:bg-red-500 hover:text-white transition-all"
        >
          ×
        </button>

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
}: {
  slotId: string;
  label: string;
  items: Item[];
  onDrillDown: () => void;
  onToggleItem: (itemId: string) => void;
  onDeleteItem: (itemId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: slotId });

  const completedCount = items.filter((i) => i.isCompleted).length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div
      ref={setNodeRef}
      onClick={onDrillDown}
      className={`
        flex flex-col rounded-xl border-2 cursor-pointer
        min-h-[140px] transition-all overflow-hidden
        ${isOver ? 'border-blue-500 bg-blue-50 shadow-lg scale-[1.02]' : 'border-gray-200 hover:border-gray-400 bg-white hover:shadow-md'}
      `}
    >
      {/* 셀 헤더 */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b">
        <span className="text-sm font-bold text-gray-700">{label}</span>
        {totalCount > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">{progress}%</span>
          </div>
        )}
      </div>

      {/* 배정된 아이템들 */}
      <div className="flex-1 p-2 space-y-1 overflow-y-auto">
        {items.map((item) => (
          <div
            key={item.id}
            className={`
              group flex flex-col gap-0.5 p-1.5 rounded text-xs
              ${item.color || 'bg-gray-50'} border border-gray-100
              ${item.isCompleted ? 'opacity-60' : ''}
              hover:shadow-sm transition-all
            `}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={item.isCompleted}
                onChange={() => onToggleItem(item.id)}
                className="w-3 h-3 accent-blue-500"
              />
              <span className={`flex-1 truncate ${item.isCompleted ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                {item.content}
              </span>
              <button
                onClick={() => onDeleteItem(item.id)}
                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600"
              >
                ×
              </button>
            </div>
            {/* 출처 태그 */}
            {item.sourceLevel && (
              <span className={`ml-4 text-[10px] px-1 py-0.5 rounded w-fit ${
                item.sourceType === 'routine'
                  ? 'bg-purple-100 text-purple-600'
                  : 'bg-blue-100 text-blue-600'
              }`}>
                {SOURCE_TAG_PREFIX[item.sourceLevel]} {item.sourceType === 'routine' ? '루틴' : '할일'}
              </span>
            )}
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-center text-gray-300 text-xs py-4">
            드래그하여 추가
          </div>
        )}
      </div>
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
}: {
  slotId: string;
  timeSlot: TimeSlot;
  items: Item[];
  onToggleItem: (itemId: string) => void;
  onDeleteItem: (itemId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: slotId });
  const config = TIME_SLOT_CONFIG[timeSlot];

  const completedCount = items.filter((i) => i.isCompleted).length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // 시간대별 색상
  const slotColors: Record<TimeSlot, string> = {
    morning: 'from-amber-50 to-orange-50 border-amber-200',
    afternoon: 'from-sky-50 to-blue-50 border-sky-200',
    evening: 'from-indigo-50 to-purple-50 border-indigo-200',
    anytime: 'from-gray-50 to-slate-50 border-gray-200',
  };

  const headerColors: Record<TimeSlot, string> = {
    morning: 'bg-amber-100 text-amber-700',
    afternoon: 'bg-sky-100 text-sky-700',
    evening: 'bg-indigo-100 text-indigo-700',
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
      <div className="flex-1 p-3 space-y-2 overflow-y-auto">
        {items.map((item) => (
          <div
            key={item.id}
            className={`
              group flex flex-col gap-1 p-2.5 rounded-lg text-sm
              ${item.color || 'bg-white'} border border-gray-100 shadow-sm
              ${item.isCompleted ? 'opacity-60' : ''}
              hover:shadow-md transition-all
            `}
          >
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={item.isCompleted}
                onChange={() => onToggleItem(item.id)}
                className="w-4 h-4 accent-blue-500"
              />
              <span className={`flex-1 ${item.isCompleted ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                {item.content}
              </span>
              <button
                onClick={() => onDeleteItem(item.id)}
                className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded-full bg-red-100 text-red-500 hover:bg-red-500 hover:text-white transition-all"
              >
                ×
              </button>
            </div>
            {/* 출처 태그 */}
            {item.sourceLevel && (
              <span className={`ml-6 text-xs px-1.5 py-0.5 rounded w-fit ${
                item.sourceType === 'routine'
                  ? 'bg-purple-100 text-purple-600'
                  : 'bg-blue-100 text-blue-600'
              }`}>
                {SOURCE_TAG_PREFIX[item.sourceLevel]} {item.sourceType === 'routine' ? '루틴' : '할일'}
              </span>
            )}
          </div>
        ))}
        {items.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm py-8">
            드래그하여 추가
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 아이템 추가 입력 컴포넌트
// ═══════════════════════════════════════════════════════════════
function AddItemInput({
  onAdd,
  placeholder,
}: {
  onAdd: (content: string, count?: number) => void;
  placeholder: string;
}) {
  const [value, setValue] = useState('');

  const handleSubmit = () => {
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
    <div className="flex items-center gap-2 mt-3 p-2 bg-gray-50 rounded-lg">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        placeholder={placeholder}
        className="flex-1 px-2 py-1.5 text-sm bg-white border border-gray-200 rounded focus:outline-none focus:border-blue-400"
      />
      <button
        onClick={handleSubmit}
        className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors"
      >
        +
      </button>
    </div>
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
    addItem,
    deleteItem,
    updateItemContent,
    updateItemColor,
    assignToSlot,
    assignToTimeSlot,
    toggleComplete,
    getProgress,
    ensurePeriod,
    addSubItem,
    toggleExpand,
  } = usePlanStore();

  const [activeItem, setActiveItem] = useState<{ item: Item; from: 'todo' | 'routine' } | null>(null);
  const [mounted, setMounted] = useState(false);

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

  // 레벨별 최적 그리드 레이아웃
  const getGridStyle = () => {
    switch (currentLevel) {
      case 'THIRTY_YEAR':
        // 6개 셀: 3×2
        return { gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(2, 1fr)' };
      case 'FIVE_YEAR':
        // 5개 셀: 5×1 (가로 일렬)
        return { gridTemplateColumns: 'repeat(5, 1fr)', gridTemplateRows: '1fr' };
      case 'YEAR':
        // 4개 셀: 4×1 (분기)
        return { gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: '1fr' };
      case 'QUARTER':
        // 3개 셀: 3×1 (월)
        return { gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: '1fr' };
      case 'MONTH':
        // 5개 셀: 5×1 (주)
        return { gridTemplateColumns: 'repeat(5, 1fr)', gridTemplateRows: '1fr' };
      case 'WEEK':
        // 7개 셀: 7×1 (요일)
        return { gridTemplateColumns: 'repeat(7, 1fr)', gridTemplateRows: '1fr' };
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
      <div className="flex flex-col h-full bg-gray-100">
        {/* ═══════════════════════════════════════════════════════ */}
        {/* 헤더 영역 */}
        {/* ═══════════════════════════════════════════════════════ */}
        <div className="p-4 bg-white border-b shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            {/* 뒤로가기 */}
            {currentLevel !== 'THIRTY_YEAR' && (
              <button
                onClick={drillUp}
                className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors text-gray-600 text-sm font-medium"
              >
                ↑ 상위
              </button>
            )}

            {/* 네비게이션 그룹 */}
            {currentLevel !== 'THIRTY_YEAR' && (
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                {/* 이전 기간 */}
                <button
                  onClick={() => {
                    const prevId = getAdjacentPeriodId(currentPeriodId, 'prev', baseYear);
                    if (prevId) usePlanStore.getState().navigateTo(prevId);
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-white hover:shadow-sm transition-all text-gray-600"
                  title="이전 기간"
                >
                  ◀
                </button>

                {/* 현재 기간 표시 */}
                <div className="px-4 min-w-[160px] text-center">
                  <span className="font-bold text-gray-800">{getPeriodTitle()}</span>
                </div>

                {/* 다음 기간 */}
                <button
                  onClick={() => {
                    const nextId = getAdjacentPeriodId(currentPeriodId, 'next', baseYear);
                    if (nextId) usePlanStore.getState().navigateTo(nextId);
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-white hover:shadow-sm transition-all text-gray-600"
                  title="다음 기간"
                >
                  ▶
                </button>
              </div>
            )}

            {/* 30년 뷰일 때 제목만 표시 */}
            {currentLevel === 'THIRTY_YEAR' && (
              <div className="font-bold text-xl text-gray-800">{getPeriodTitle()}</div>
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
                    case 'QUARTER': {
                      const q = Math.ceil(currentMonth / 3);
                      targetId = `q-${currentYear}-${q}`;
                      break;
                    }
                    case 'MONTH':
                      targetId = `m-${currentYear}-${String(currentMonth).padStart(2, '0')}`;
                      break;
                    case 'WEEK': {
                      const startOfYear = new Date(currentYear, 0, 1);
                      const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
                      const weekNum = Math.ceil((days + 1) / 7);
                      targetId = `w-${currentYear}-${String(weekNum).padStart(2, '0')}`;
                      break;
                    }
                    case 'DAY':
                      targetId = `d-${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                      break;
                  }

                  if (targetId) usePlanStore.getState().navigateTo(targetId);
                }}
                className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
              >
                {currentLevel === 'DAY' && '오늘'}
                {currentLevel === 'WEEK' && '이번 주'}
                {currentLevel === 'MONTH' && '이번 달'}
                {currentLevel === 'QUARTER' && '이번 분기'}
                {currentLevel === 'YEAR' && '올해'}
              </button>
            )}

            {/* 쪼개기 힌트 */}
            <div className="ml-auto text-xs text-gray-400 flex items-center gap-1">
              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded text-[10px]">+</span>
              <span>버튼으로 쪼개기</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {/* 목표 */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">목표</label>
              <input
                type="text"
                value={period.goal}
                onChange={(e) => updatePeriodHeader('goal', e.target.value)}
                placeholder="이 기간의 목표..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
              />
            </div>
            {/* 다짐 */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">다짐</label>
              <input
                type="text"
                value={period.motto}
                onChange={(e) => updatePeriodHeader('motto', e.target.value)}
                placeholder="다짐..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
              />
            </div>
            {/* 메모 */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">메모</label>
              <input
                type="text"
                value={period.memo}
                onChange={(e) => updatePeriodHeader('memo', e.target.value)}
                placeholder="기억해야 할 것..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* 본문 영역 (3열: 할일 | 그리드 | 루틴) */}
        {/* ═══════════════════════════════════════════════════════ */}
        <div className="flex-1 flex overflow-hidden">
          {/* ─────────────────────────────────────────────────────── */}
          {/* 좌측 패널: 할일 목록 (트리 구조) */}
          {/* ─────────────────────────────────────────────────────── */}
          <div className="w-72 p-4 bg-white border-r overflow-y-auto">
            <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              할일 ({period.todos.filter(i => !i.parentId).length})
            </h2>
            <div className="space-y-1">
              {(() => {
                // 트리 구조로 아이템 렌더링
                const itemMap = new Map(period.todos.map(i => [i.id, i]));
                const collapsedParents = new Set<string>();

                // 접힌 부모들 찾기
                period.todos.forEach(item => {
                  if (item.childIds && item.childIds.length > 0 && !item.isExpanded) {
                    collapsedParents.add(item.id);
                  }
                });

                // 숨겨야 할 아이템 찾기 (접힌 부모의 자식들)
                const isHidden = (item: Item): boolean => {
                  if (!item.parentId) return false;
                  if (collapsedParents.has(item.parentId)) return true;
                  const parent = itemMap.get(item.parentId);
                  return parent ? isHidden(parent) : false;
                };

                // 깊이 계산
                const getDepth = (item: Item): number => {
                  if (!item.parentId) return 0;
                  const parent = itemMap.get(item.parentId);
                  return parent ? getDepth(parent) + 1 : 0;
                };

                return period.todos.map((item) => (
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
                ));
              })()}
            </div>
            <AddItemInput
              onAdd={(content) => addItem(content, 'todo')}
              placeholder="할일 추가..."
            />
          </div>

          {/* ─────────────────────────────────────────────────────── */}
          {/* 중앙: 메인 그리드 */}
          {/* ─────────────────────────────────────────────────────── */}
          <div className="flex-1 p-6 overflow-y-auto">
            {config.childLevel ? (
              <div
                className="grid gap-4 h-full"
                style={getGridStyle()}
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
                  />
                ))}
              </div>
            ) : (
              /* DAY 레벨: 시간대 그리드 (4칸 가로 배치) */
              <div className="grid grid-cols-4 gap-4 h-full">
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
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* ─────────────────────────────────────────────────────── */}
          {/* 우측 패널: 루틴 목록 (트리 구조) */}
          {/* ─────────────────────────────────────────────────────── */}
          <div className="w-72 p-4 bg-white border-l overflow-y-auto">
            <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
              루틴 ({period.routines.filter(i => !i.parentId).length})
            </h2>
            <div className="space-y-1">
              {(() => {
                // 트리 구조로 아이템 렌더링
                const itemMap = new Map(period.routines.map(i => [i.id, i]));
                const collapsedParents = new Set<string>();

                // 접힌 부모들 찾기
                period.routines.forEach(item => {
                  if (item.childIds && item.childIds.length > 0 && !item.isExpanded) {
                    collapsedParents.add(item.id);
                  }
                });

                // 숨겨야 할 아이템 찾기 (접힌 부모의 자식들)
                const isHidden = (item: Item): boolean => {
                  if (!item.parentId) return false;
                  if (collapsedParents.has(item.parentId)) return true;
                  const parent = itemMap.get(item.parentId);
                  return parent ? isHidden(parent) : false;
                };

                // 깊이 계산
                const getDepth = (item: Item): number => {
                  if (!item.parentId) return 0;
                  const parent = itemMap.get(item.parentId);
                  return parent ? getDepth(parent) + 1 : 0;
                };

                return period.routines.map((item) => (
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
                ));
              })()}
            </div>
            <AddItemInput
              onAdd={(content, count) => addItem(content, 'routine', count)}
              placeholder="루틴 추가 (예: 운동 / 3)"
            />
          </div>
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
