"use client";

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { usePlanStore } from '@/store/usePlanStore';
import { AnnualEvent, AnnualEventType, ANNUAL_EVENT_TYPES, ANNUAL_EVENT_TYPE_CONFIG } from '@/types/plan';

export default function EventsPage() {
  const { annualEvents, addAnnualEvent, updateAnnualEvent, deleteAnnualEvent, getUpcomingEvents } = usePlanStore();
  const [filterType, setFilterType] = useState<AnnualEventType | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => setMounted(true), []);

  // 다가오는 이벤트 (30일 이내)
  const upcomingEvents = getUpcomingEvents(365);

  // 필터링
  const filteredEvents = useMemo(() => {
    return annualEvents.filter((event) => {
      // 타입 필터
      if (filterType !== 'ALL' && event.type !== filterType) {
        return false;
      }
      // 검색어 필터
      if (searchTerm && !event.title.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [annualEvents, filterType, searchTerm]);

  // 타입별 그룹화
  const groupedEvents = useMemo(() => {
    const groups: Record<AnnualEventType, AnnualEvent[]> = {
      birthday: [],
      anniversary: [],
      memorial: [],
      holiday: [],
      other: [],
    };

    filteredEvents.forEach((event) => {
      groups[event.type].push(event);
    });

    // 각 그룹을 날짜순 정렬
    Object.keys(groups).forEach((key) => {
      groups[key as AnnualEventType].sort((a, b) => {
        if (a.month !== b.month) return a.month - b.month;
        return a.day - b.day;
      });
    });

    return groups;
  }, [filteredEvents]);

  // 이번 달 이벤트
  const thisMonthEvents = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    return annualEvents.filter(e => e.month === currentMonth).sort((a, b) => a.day - b.day);
  }, [annualEvents]);

  // 가까운 이벤트 (7일 이내)
  const soonEvents = upcomingEvents.filter(e => e.daysUntil <= 7);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-gray-400">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-gray-50 text-gray-800">
      {/* Header */}
      <header className="h-14 border-b border-gray-200 bg-white shadow-sm px-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-gray-500 hover:text-gray-700">
            ← 돌아가기
          </Link>
          <h1 className="font-bold text-lg text-gray-900">연간 기념일 관리</h1>
        </div>

        <div className="flex items-center gap-4">
          {/* 검색 */}
          <input
            type="text"
            placeholder="기념일 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-1.5 border rounded-lg text-sm w-48"
          />

          {/* 타입 필터 */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as AnnualEventType | 'ALL')}
            className="px-3 py-1.5 border rounded-lg text-sm"
          >
            <option value="ALL">전체 유형</option>
            {ANNUAL_EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {ANNUAL_EVENT_TYPE_CONFIG[type].icon} {ANNUAL_EVENT_TYPE_CONFIG[type].label}
              </option>
            ))}
          </select>

          {/* 기념일 추가 버튼 */}
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-1.5 bg-pink-500 text-white rounded-lg text-sm hover:bg-pink-600 transition-colors"
          >
            + 기념일 추가
          </button>
        </div>
      </header>

      {/* 기념일 추가 폼 */}
      {showAddForm && (
        <AddEventForm
          onAdd={addAnnualEvent}
          onClose={() => setShowAddForm(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* 곧 다가오는 기념일 알림 */}
          {soonEvents.length > 0 && (
            <div className="bg-gradient-to-r from-pink-50 to-red-50 border border-pink-200 rounded-xl p-4">
              <h3 className="font-bold text-pink-700 mb-3 flex items-center gap-2">
                <span>🔔</span>
                곧 다가오는 기념일
              </h3>
              <div className="flex flex-wrap gap-3">
                {soonEvents.map((event) => {
                  const config = ANNUAL_EVENT_TYPE_CONFIG[event.type];
                  return (
                    <div
                      key={event.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${config.color}`}
                    >
                      <span>{config.icon}</span>
                      <span className="font-medium">{event.title}</span>
                      <span className="text-sm opacity-70">
                        {event.daysUntil === 0 ? '오늘!' : `D-${event.daysUntil}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 이번 달 기념일 */}
          {thisMonthEvents.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                <span>📅</span>
                이번 달 기념일 ({new Date().getMonth() + 1}월)
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {thisMonthEvents.map((event) => {
                  const config = ANNUAL_EVENT_TYPE_CONFIG[event.type];
                  return (
                    <div
                      key={event.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${config.color}`}
                    >
                      <span className="text-sm font-bold text-gray-500">{event.day}일</span>
                      <span>{config.icon}</span>
                      <span className="truncate">{event.title}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {annualEvents.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg mb-2">등록된 기념일이 없습니다</p>
              <p className="text-sm">생일, 기념일 등을 추가해보세요</p>
              <button
                onClick={() => setShowAddForm(true)}
                className="mt-4 px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600"
              >
                첫 기념일 추가하기
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {ANNUAL_EVENT_TYPES.map((type) => {
                const events = groupedEvents[type];
                if (events.length === 0) return null;

                const config = ANNUAL_EVENT_TYPE_CONFIG[type];

                return (
                  <section key={type} className="bg-white rounded-xl shadow-sm border border-gray-200">
                    <div className={`px-5 py-4 border-b border-gray-100 rounded-t-xl ${config.color.split(' ')[0]}`}>
                      <h2 className="font-semibold flex items-center gap-2">
                        <span>{config.icon}</span>
                        <span>{config.label}</span>
                        <span className="text-sm opacity-60">({events.length}개)</span>
                      </h2>
                    </div>

                    <div className="divide-y divide-gray-100">
                      {events.map((event) => (
                        <EventRow
                          key={event.id}
                          event={event}
                          onUpdate={updateAnnualEvent}
                          onDelete={deleteAnnualEvent}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}

              {filteredEvents.length === 0 && annualEvents.length > 0 && (
                <div className="text-center py-12 text-gray-500">
                  <p>검색 결과가 없습니다</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// 기념일 행 컴포넌트
function EventRow({
  event,
  onUpdate,
  onDelete,
}: {
  event: AnnualEvent;
  onUpdate: (id: string, updates: Partial<Omit<AnnualEvent, 'id' | 'createdAt'>>) => void;
  onDelete: (id: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [editTitle, setEditTitle] = useState(event.title);
  const [editMonth, setEditMonth] = useState(event.month);
  const [editDay, setEditDay] = useState(event.day);
  const [editType, setEditType] = useState(event.type);

  const config = ANNUAL_EVENT_TYPE_CONFIG[event.type];

  const handleSave = () => {
    onUpdate(event.id, {
      title: editTitle,
      month: editMonth,
      day: editDay,
      type: editType,
    });
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (!confirm('이 기념일을 삭제하시겠습니까?')) return;
    onDelete(event.id);
  };

  // D-day 계산
  const getDday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let nextDate = new Date(today.getFullYear(), event.month - 1, event.day);
    if (nextDate < today) {
      nextDate = new Date(today.getFullYear() + 1, event.month - 1, event.day);
    }
    const daysUntil = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntil;
  };

  const dday = getDday();

  return (
    <div className="px-5 py-4 hover:bg-gray-50 transition-colors">
      {isEditing ? (
        <div className="space-y-3">
          <div className="flex gap-3 items-center">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="flex-1 px-3 py-2 border rounded-lg"
              placeholder="기념일 이름"
              autoFocus
            />
            <select
              value={editType}
              onChange={(e) => setEditType(e.target.value as AnnualEventType)}
              className="px-3 py-2 border rounded-lg"
            >
              {ANNUAL_EVENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {ANNUAL_EVENT_TYPE_CONFIG[type].icon} {ANNUAL_EVENT_TYPE_CONFIG[type].label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 items-center">
            <select
              value={editMonth}
              onChange={(e) => setEditMonth(parseInt(e.target.value))}
              className="px-3 py-2 border rounded-lg"
            >
              {[...Array(12)].map((_, i) => (
                <option key={i + 1} value={i + 1}>{i + 1}월</option>
              ))}
            </select>
            <select
              value={editDay}
              onChange={(e) => setEditDay(parseInt(e.target.value))}
              className="px-3 py-2 border rounded-lg"
            >
              {[...Array(31)].map((_, i) => (
                <option key={i + 1} value={i + 1}>{i + 1}일</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsEditing(false)}
              className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-1.5 text-sm bg-pink-500 text-white rounded-lg hover:bg-pink-600"
            >
              저장
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* 날짜 */}
            <div className="w-16 text-center">
              <div className="text-lg font-bold text-gray-700">{event.month}/{event.day}</div>
              <div className="text-xs text-gray-400">{event.lunarDate ? '음력' : '양력'}</div>
            </div>

            {/* 아이콘 */}
            <span className="text-2xl">{config.icon}</span>

            {/* 제목 */}
            <div>
              <div className="font-medium text-gray-800">{event.title}</div>
              {event.note && (
                <div className="text-xs text-gray-400 truncate max-w-[200px]">{event.note}</div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* D-day */}
            <div className={`px-3 py-1 rounded-full text-sm font-bold ${
              dday === 0 ? 'bg-red-500 text-white' :
              dday <= 7 ? 'bg-pink-100 text-pink-700' :
              dday <= 30 ? 'bg-amber-100 text-amber-700' :
              'bg-gray-100 text-gray-600'
            }`}>
              {dday === 0 ? '오늘!' : `D-${dday}`}
            </div>

            {/* 액션 버튼 */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowNoteModal(true)}
                className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg"
                title="메모"
              >
                {event.note ? '📝' : '📄'}
              </button>
              <button
                onClick={() => setIsEditing(true)}
                className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
              >
                수정
              </button>
              <button
                onClick={handleDelete}
                className="px-2 py-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 메모 모달 */}
      {showNoteModal && (
        <EventNoteModal
          event={event}
          onSave={(note) => onUpdate(event.id, { note })}
          onClose={() => setShowNoteModal(false)}
        />
      )}
    </div>
  );
}

// 메모 모달 컴포넌트
function EventNoteModal({
  event,
  onSave,
  onClose,
}: {
  event: AnnualEvent;
  onSave: (note: string) => void;
  onClose: () => void;
}) {
  const [noteValue, setNoteValue] = useState(event.note || '');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  React.useEffect(() => {
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

  const config = ANNUAL_EVENT_TYPE_CONFIG[event.type];

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모달 헤더 */}
        <div className={`flex items-center justify-between px-4 py-3 border-b ${config.color}`}>
          <div className="flex items-center gap-2">
            <span>{config.icon}</span>
            <span className="font-semibold truncate max-w-[250px]">{event.title}</span>
            <span className="text-sm opacity-60">{event.month}/{event.day}</span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-black/10 transition-colors"
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
            placeholder="메모를 입력하세요... (선물 아이디어, 연락처 등)"
            className="w-full h-40 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-transparent resize-none"
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
              className="px-4 py-1.5 text-sm bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors font-medium"
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

// 기념일 추가 폼 컴포넌트
function AddEventForm({
  onAdd,
  onClose,
}: {
  onAdd: (event: Omit<AnnualEvent, 'id' | 'createdAt'>) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<AnnualEventType>('birthday');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [day, setDay] = useState(1);
  const [lunarDate, setLunarDate] = useState(false);
  const [note, setNote] = useState('');

  const handleSubmit = () => {
    if (!title.trim()) return;

    onAdd({
      title: title.trim(),
      type,
      month,
      day,
      lunarDate,
      note: note.trim() || undefined,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-[480px]">
        <h3 className="text-lg font-bold text-gray-800 mb-4">새 기념일 추가</h3>

        <div className="space-y-4">
          {/* 기념일 이름 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">기념일 이름</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 엄마 생신, 결혼기념일..."
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
              autoFocus
            />
          </div>

          {/* 유형 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">유형</label>
            <div className="grid grid-cols-5 gap-2">
              {ANNUAL_EVENT_TYPES.map((t) => {
                const config = ANNUAL_EVENT_TYPE_CONFIG[t];
                return (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`flex flex-col items-center p-2 rounded-lg text-sm font-medium transition-colors border-2 ${
                      type === t
                        ? 'border-pink-500 bg-pink-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-xl">{config.icon}</span>
                    <span className="text-xs mt-1">{config.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 날짜 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">날짜</label>
            <div className="flex items-center gap-3">
              <select
                value={month}
                onChange={(e) => setMonth(parseInt(e.target.value))}
                className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg"
              >
                {[...Array(12)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}월</option>
                ))}
              </select>
              <select
                value={day}
                onChange={(e) => setDay(parseInt(e.target.value))}
                className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg"
              >
                {[...Array(31)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}일</option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={lunarDate}
                  onChange={(e) => setLunarDate(e.target.checked)}
                  className="w-4 h-4 accent-pink-500"
                />
                음력
              </label>
            </div>
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">메모 (선택)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="선물 아이디어, 연락처 등..."
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-pink-400 resize-none"
              rows={2}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            추가
          </button>
        </div>
      </div>
    </div>
  );
}
