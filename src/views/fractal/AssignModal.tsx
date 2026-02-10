'use client';

import React, { useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Item, TimeSlot, TIME_SLOTS, TIME_SLOT_CONFIG } from '../../types/plan';
import { getSlotLabel, parsePeriodId } from '../../store/usePlanStore';
import { parseDayPeriodId, isHolidayOrWeekend } from '../../lib/holidays';

// ═══════════════════════════════════════════════════════════════
// 모바일 배정 모달 (롱프레스용)
// ═══════════════════════════════════════════════════════════════
export function AssignModal({
  item,
  from,
  currentLevel,
  childPeriodIds,
  baseYear,
  onAssignToSlot,
  onAssignToTimeSlot,
  onClose,
}: {
  item: Item;
  from: 'todo' | 'routine';
  currentLevel: string;
  childPeriodIds: string[];
  baseYear: number;
  onAssignToSlot: (itemId: string, from: 'todo' | 'routine', slotId: string) => void;
  onAssignToTimeSlot: (itemId: string, from: 'todo' | 'routine', timeSlot: TimeSlot) => void;
  onClose: () => void;
}) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleAssign = (slotId: string) => {
    if (currentLevel === 'DAY') {
      const timeSlot = slotId as TimeSlot;
      onAssignToTimeSlot(item.id, from, timeSlot);
    } else {
      onAssignToSlot(item.id, from, slotId);
    }
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="bg-white rounded-t-2xl shadow-2xl w-full max-w-md mx-0 overflow-hidden animate-in slide-in-from-bottom duration-300 max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모달 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 bg-blue-50 border-b border-blue-200">
          <div className="flex items-center gap-2">
            <span className="text-blue-600">📍</span>
            <span className="font-semibold text-slate-700 truncate max-w-[200px]">{item.content}</span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-blue-200 text-slate-500 hover:text-slate-700 transition-colors"
          >
            ×
          </button>
        </div>

        {/* 슬롯 선택 영역 */}
        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-xs text-slate-500 mb-3">배정할 위치를 선택하세요</p>

          {currentLevel === 'DAY' ? (
            <div className="grid grid-cols-2 gap-2">
              {TIME_SLOTS.map((timeSlot) => {
                const config = TIME_SLOT_CONFIG[timeSlot];
                return (
                  <button
                    key={timeSlot}
                    onClick={() => handleAssign(timeSlot)}
                    className="p-3 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-left"
                  >
                    <div className="font-medium text-sm text-slate-700">{config.label}</div>
                    {config.timeRange && (
                      <div className="text-xs text-slate-500">{config.timeRange}</div>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {childPeriodIds.map((childId) => {
                const date = parseDayPeriodId(childId);
                const dayInfo = date ? isHolidayOrWeekend(date) : null;

                let textColorClass = 'text-slate-700';
                if (dayInfo?.isHoliday || dayInfo?.isSunday) textColorClass = 'text-red-600';
                else if (dayInfo?.isSaturday) textColorClass = 'text-blue-600';

                return (
                  <button
                    key={childId}
                    onClick={() => handleAssign(childId)}
                    className="p-3 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-left"
                  >
                    <div className={`font-medium text-sm ${textColorClass}`}>
                      {getSlotLabel(childId, baseYear)}
                    </div>
                    {dayInfo?.holidayName && (
                      <div className="text-xs text-red-500">{dayInfo.holidayName}</div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 취소 버튼 */}
        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="w-full py-2.5 text-sm text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors font-medium"
          >
            취소
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
