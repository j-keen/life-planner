'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useNotepadStore, Note } from '../store/useNotepadStore';
import { CATEGORY_CONFIG, CATEGORIES, Category } from '@/types/plan';

export default function NotepadView() {
    const {
        addNote,
        updateNote,
        deleteNote,
        searchQuery,
        setSearchQuery,
        filterCategory,
        setFilterCategory,
        togglePin,
        getFilteredNotes,
    } = useNotepadStore();

    const filteredNotes = getFilteredNotes();

    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);

    // 편집 상태
    const [editTitle, setEditTitle] = useState('');
    const [editContent, setEditContent] = useState('');
    const [editCategory, setEditCategory] = useState<Category | undefined>(undefined);

    const selectedNote = filteredNotes.find((n) => n.id === selectedNoteId);

    const handleCreateNew = () => {
        setSelectedNoteId(null);
        setEditTitle('');
        setEditContent('');
        setEditCategory(undefined);
        setIsEditing(true);
    };

    const handleSelectNote = (note: Note) => {
        setSelectedNoteId(note.id);
        setIsEditing(false);
    };

    const handleEdit = () => {
        if (selectedNote) {
            setEditTitle(selectedNote.title);
            setEditContent(selectedNote.content);
            setEditCategory(selectedNote.category);
            setIsEditing(true);
        }
    };

    const handleSave = () => {
        if (!editTitle.trim() && !editContent.trim()) return;

        if (selectedNoteId && selectedNote) {
            updateNote(selectedNoteId, editTitle, editContent, editCategory);
        } else {
            addNote(editTitle, editContent, editCategory);
        }
        setIsEditing(false);
    };

    const handleDelete = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('정말 삭제하시겠습니까?')) {
            deleteNote(id);
            if (selectedNoteId === id) {
                setSelectedNoteId(null);
                setIsEditing(false);
            }
        }
    };

    const handleTogglePin = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        togglePin(id);
    };

    // 간단한 마크다운 렌더링 (볼드, 이탤릭, 링크, 리스트)
    const renderMarkdown = (text: string) => {
        if (!text) return '(내용 없음)';

        const lines = text.split('\n');
        return lines.map((line, i) => {
            // 헤더
            if (line.startsWith('### ')) {
                return <h3 key={i} className="text-lg font-bold mt-4 mb-2">{line.slice(4)}</h3>;
            }
            if (line.startsWith('## ')) {
                return <h2 key={i} className="text-xl font-bold mt-4 mb-2">{line.slice(3)}</h2>;
            }
            if (line.startsWith('# ')) {
                return <h1 key={i} className="text-2xl font-bold mt-4 mb-2">{line.slice(2)}</h1>;
            }

            // 리스트
            if (line.startsWith('- ') || line.startsWith('* ')) {
                return <li key={i} className="ml-4 list-disc">{line.slice(2)}</li>;
            }

            // 볼드/이탤릭
            let processed = line
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.+?)\*/g, '<em>$1</em>')
                .replace(/`(.+?)`/g, '<code class="bg-gray-100 px-1 rounded">$1</code>');

            if (processed !== line) {
                return <p key={i} className="mb-1" dangerouslySetInnerHTML={{ __html: processed }} />;
            }

            // 빈 줄
            if (!line.trim()) {
                return <br key={i} />;
            }

            return <p key={i} className="mb-1">{line}</p>;
        });
    };

    return (
        <div className="flex flex-col h-screen bg-gray-50">
            {/* 헤더 */}
            <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link href="/" className="text-gray-500 hover:text-gray-800 transition-colors">
                        ← 돌아가기
                    </Link>
                    <h1 className="text-xl font-bold text-slate-800">📝 중요 메모장</h1>
                </div>
                <button
                    onClick={handleCreateNew}
                    className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
                >
                    + 새 메모
                </button>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* 좌측 사이드바: 목록 */}
                <div className="w-64 md:w-80 bg-white border-r border-gray-200 flex flex-col">
                    {/* 검색 & 필터 */}
                    <div className="p-3 border-b border-gray-100 space-y-2">
                        {/* 검색 입력 */}
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="🔍 메모 검색..."
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
                        />
                        {/* 카테고리 필터 */}
                        <div className="flex flex-wrap gap-1">
                            <button
                                onClick={() => setFilterCategory('all')}
                                className={`px-2 py-1 text-xs rounded-full transition-colors ${
                                    filterCategory === 'all'
                                        ? 'bg-gray-800 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                전체
                            </button>
                            {CATEGORIES.map((cat) => (
                                <button
                                    key={cat}
                                    onClick={() => setFilterCategory(cat)}
                                    className={`px-2 py-1 text-xs rounded-full transition-colors ${
                                        filterCategory === cat
                                            ? `${CATEGORY_CONFIG[cat].bgColor} ${CATEGORY_CONFIG[cat].textColor} font-medium`
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    {CATEGORY_CONFIG[cat].icon}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 메모 목록 */}
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {filteredNotes.length === 0 && (
                            <div className="text-center py-10 text-gray-400 text-sm">
                                {searchQuery || filterCategory !== 'all'
                                    ? '검색 결과가 없습니다.'
                                    : '메모가 없습니다.'}
                            </div>
                        )}
                        {filteredNotes.map((note) => (
                            <div
                                key={note.id}
                                onClick={() => handleSelectNote(note)}
                                className={`
                                    group p-3 rounded-lg cursor-pointer transition-colors relative
                                    ${selectedNoteId === note.id
                                        ? 'bg-blue-50 border border-blue-200'
                                        : 'hover:bg-gray-50 border border-transparent'
                                    }
                                `}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            {note.isPinned && <span className="text-yellow-500">📌</span>}
                                            {note.category && (
                                                <span className="text-xs">{CATEGORY_CONFIG[note.category].icon}</span>
                                            )}
                                            <h3 className={`font-medium text-sm truncate ${
                                                selectedNoteId === note.id ? 'text-blue-800' : 'text-slate-700'
                                            }`}>
                                                {note.title || '(제목 없음)'}
                                            </h3>
                                        </div>
                                        <p className="text-xs text-gray-500 line-clamp-2 mt-1">
                                            {note.content || '(내용 없음)'}
                                        </p>
                                    </div>
                                    {/* 핀 버튼 */}
                                    <button
                                        onClick={(e) => handleTogglePin(note.id, e)}
                                        className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-all ${
                                            note.isPinned
                                                ? 'text-yellow-500 hover:bg-yellow-50'
                                                : 'text-gray-400 hover:bg-gray-100'
                                        }`}
                                        title={note.isPinned ? '고정 해제' : '고정'}
                                    >
                                        📌
                                    </button>
                                </div>
                                <div className="text-[10px] text-gray-400 mt-2 flex justify-between items-center">
                                    <span>{new Date(note.updatedAt).toLocaleDateString()}</span>
                                    <button
                                        onClick={(e) => handleDelete(note.id, e)}
                                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 hover:text-red-500 rounded text-slate-400 transition-all"
                                    >
                                        삭제
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 우측 메인: 상세/편집 */}
                <div className="flex-1 overflow-y-auto bg-gray-50 p-4 md:p-8">
                    <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm min-h-[500px] flex flex-col relative">
                        {isEditing || !selectedNoteId ? (
                            // 편집 모드
                            <div className="flex flex-col flex-1 p-6">
                                <input
                                    type="text"
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    placeholder="제목을 입력하세요"
                                    className="text-2xl font-bold placeholder-gray-300 border-b border-transparent focus:border-gray-200 outline-none pb-2 mb-4"
                                    autoFocus
                                />

                                {/* 카테고리 선택 */}
                                <div className="flex gap-2 mb-4">
                                    <button
                                        onClick={() => setEditCategory(undefined)}
                                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                                            !editCategory
                                                ? 'bg-gray-800 text-white'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                    >
                                        미분류
                                    </button>
                                    {CATEGORIES.filter(c => c !== 'uncategorized').map((cat) => (
                                        <button
                                            key={cat}
                                            onClick={() => setEditCategory(cat)}
                                            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                                                editCategory === cat
                                                    ? `${CATEGORY_CONFIG[cat].bgColor} ${CATEGORY_CONFIG[cat].textColor} font-medium`
                                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                        >
                                            {CATEGORY_CONFIG[cat].icon} {CATEGORY_CONFIG[cat].label}
                                        </button>
                                    ))}
                                </div>

                                <textarea
                                    value={editContent}
                                    onChange={(e) => setEditContent(e.target.value)}
                                    placeholder="내용을 입력하세요... (마크다운 지원: **볼드**, *이탤릭*, # 제목, - 리스트)"
                                    className="flex-1 resize-none outline-none text-gray-700 leading-relaxed placeholder-gray-300 font-mono text-sm"
                                />
                                <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-100">
                                    {selectedNoteId && (
                                        <button
                                            onClick={() => setIsEditing(false)}
                                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md text-sm"
                                        >
                                            취소
                                        </button>
                                    )}
                                    <button
                                        onClick={handleSave}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                                    >
                                        저장
                                    </button>
                                </div>
                            </div>
                        ) : selectedNote ? (
                            // 상세 보기 모드 (마크다운 렌더링)
                            <div className="flex flex-col flex-1 p-6">
                                <div className="flex justify-between items-start mb-6 pb-4 border-b border-gray-100">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            {selectedNote.isPinned && <span className="text-yellow-500">📌</span>}
                                            {selectedNote.category && (
                                                <span className={`px-2 py-0.5 text-xs rounded-full ${CATEGORY_CONFIG[selectedNote.category].bgColor} ${CATEGORY_CONFIG[selectedNote.category].textColor}`}>
                                                    {CATEGORY_CONFIG[selectedNote.category].icon} {CATEGORY_CONFIG[selectedNote.category].label}
                                                </span>
                                            )}
                                        </div>
                                        <h2 className="text-2xl font-bold text-slate-800 mb-1">
                                            {selectedNote.title || '(제목 없음)'}
                                        </h2>
                                        <span className="text-xs text-gray-400">
                                            최종 수정: {new Date(selectedNote.updatedAt).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => togglePin(selectedNote.id)}
                                            className={`p-2 rounded transition-colors ${
                                                selectedNote.isPinned
                                                    ? 'text-yellow-500 hover:bg-yellow-50'
                                                    : 'text-gray-400 hover:bg-gray-100'
                                            }`}
                                            title={selectedNote.isPinned ? '고정 해제' : '고정'}
                                        >
                                            📌
                                        </button>
                                        <button
                                            onClick={handleEdit}
                                            className="text-gray-400 hover:text-blue-600 p-2 hover:bg-blue-50 rounded"
                                        >
                                            편집
                                        </button>
                                    </div>
                                </div>
                                <div className="flex-1 text-gray-700 leading-relaxed prose prose-sm max-w-none">
                                    {renderMarkdown(selectedNote.content)}
                                </div>
                            </div>
                        ) : (
                            // 선택 안됨
                            <div className="flex flex-col items-center justify-center flex-1 text-gray-400">
                                <span className="text-4xl mb-4">📝</span>
                                <p>메모를 선택하거나 새로 작성하세요.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
