'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePlanStore } from '../store/usePlanStore';
import { searchAllData, SearchResult, getTypeLabel, getTypeBadgeColor } from '../lib/search';
import { LEVEL_CONFIG } from '../types/plan';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const { periods, records, annualEvents, navigateTo, setViewMode } = usePlanStore();

  // 모달 열릴 때 포커스
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // 검색 실행
  useEffect(() => {
    if (query.length >= 2) {
      const searchResults = searchAllData(periods, records, annualEvents, { query });
      setResults(searchResults);
      setSelectedIndex(0);
    } else {
      setResults([]);
    }
  }, [query, periods, records, annualEvents]);

  // 결과 선택 처리
  const handleResultClick = useCallback((result: SearchResult) => {
    // 기념일은 이동하지 않음
    if (result.type === 'event') {
      onClose();
      return;
    }

    // 기록 타입이면 record 뷰로 전환
    if (result.type === 'record' && result.record) {
      setViewMode('record');
    }

    // 해당 기간으로 이동
    if (result.periodId && !result.periodId.startsWith('event-')) {
      navigateTo(result.periodId);
    }

    onClose();
  }, [navigateTo, setViewMode, onClose]);

  // 키보드 네비게이션
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      handleResultClick(results[selectedIndex]);
    }
  }, [results, selectedIndex, handleResultClick, onClose]);

  // 선택된 항목 스크롤
  useEffect(() => {
    if (resultsRef.current && results.length > 0) {
      const selectedElement = resultsRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, results.length]);

  // ESC 키로 닫기 (전역)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-16 md:pt-24 bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="search-modal-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
        {/* 검색 입력 */}
        <div className="p-4 border-b border-slate-200">
          <h2 id="search-modal-title" className="sr-only">검색</h2>
          <div className="flex items-center gap-3">
            <svg
              className="w-5 h-5 text-slate-400 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              ref={inputRef}
              type="text"
              name="search-query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="할일, 루틴, 메모, 목표, 기록 검색..."
              aria-label="검색어 입력"
              className="flex-1 text-lg outline-none bg-transparent placeholder:text-slate-400 focus-visible:outline-none"
            />
            <button
              onClick={onClose}
              aria-label="검색 닫기 (ESC)"
              className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              ESC
            </button>
          </div>
        </div>

        {/* 검색 결과 */}
        <div ref={resultsRef} className="max-h-[60vh] overflow-y-auto">
          {query.length < 2 && (
            <div className="p-8 text-center text-slate-400">
              <p className="text-sm">2글자 이상 입력하세요</p>
              <p className="text-xs mt-2 text-slate-300">
                Tip: Ctrl+K 또는 Cmd+K로 검색창을 열 수 있습니다
              </p>
            </div>
          )}

          {query.length >= 2 && results.length === 0 && (
            <div className="p-8 text-center text-slate-400">
              <p className="text-sm">"{query}"에 대한 검색 결과가 없습니다</p>
            </div>
          )}

          {results.map((result, index) => (
            <button
              key={`${result.type}-${result.periodId}-${index}`}
              onClick={() => handleResultClick(result)}
              aria-label={`${getTypeLabel(result.type)}: ${result.content}`}
              className={`w-full px-4 py-3 text-left hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${
                index === selectedIndex ? 'bg-blue-50' : ''
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${getTypeBadgeColor(
                    result.type
                  )}`}
                >
                  {getTypeLabel(result.type)}
                </span>
                {result.periodLevel && (
                  <span className="text-xs text-slate-400">
                    {LEVEL_CONFIG[result.periodLevel].label}
                  </span>
                )}
                <span className="text-xs text-slate-300">{result.periodId}</span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{result.highlight}</p>
              {result.content !== result.highlight && (
                <p className="text-xs text-slate-400 mt-1 truncate">{result.content}</p>
              )}
            </button>
          ))}
        </div>

        {/* 검색 결과 개수 */}
        {results.length > 0 && (
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-400 flex items-center justify-between">
            <span>{results.length}개 결과</span>
            <span className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-500">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-500">↓</kbd>
              <span>이동</span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-500">Enter</kbd>
              <span>선택</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
