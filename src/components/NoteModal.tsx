'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Item } from '../types/plan';

interface NoteModalProps {
  item: Item;
  onSave: (note: string) => void;
  onClose: () => void;
}

export function NoteModal({ item, onSave, onClose }: NoteModalProps) {
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
      role="dialog"
      aria-modal="true"
      aria-labelledby="note-modal-title"
    >
      <div
        ref={modalRef}
        className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200 motion-reduce:animate-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모달 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 bg-amber-50 border-b border-amber-200">
          <div className="flex items-center gap-2">
            <span className="text-amber-600" aria-hidden="true">📝</span>
            <span id="note-modal-title" className="font-semibold text-slate-700 truncate max-w-[250px]">{item.content}</span>
          </div>
          <button
            onClick={onClose}
            aria-label="모달 닫기"
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-amber-200 text-slate-500 hover:text-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            ×
          </button>
        </div>

        {/* 모달 본문 */}
        <div className="p-4">
          <textarea
            ref={textareaRef}
            name="item-note"
            value={noteValue}
            onChange={(e) => setNoteValue(e.target.value)}
            placeholder="상세 메모를 입력하세요..."
            aria-label="메모 내용"
            className="w-full h-40 px-3 py-2 text-sm border border-slate-200 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:border-transparent resize-none"
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
            aria-label="메모 삭제"
            className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            메모 삭제
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              aria-label="취소"
              className="px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-200 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              aria-label="메모 저장"
              className="px-4 py-1.5 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
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
