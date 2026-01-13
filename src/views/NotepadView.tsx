'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useNotepadStore, Note } from '../store/useNotepadStore';

export default function NotepadView() {
    const { notes, addNote, updateNote, deleteNote } = useNotepadStore();
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);

    // 편집 상태 (신규 생성 포함)
    const [editTitle, setEditTitle] = useState('');
    const [editContent, setEditContent] = useState('');

    const selectedNote = notes.find((n) => n.id === selectedNoteId);

    const handleCreateNew = () => {
        setSelectedNoteId(null);
        setEditTitle('');
        setEditContent('');
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
            setIsEditing(true);
        }
    };

    const handleSave = () => {
        if (!editTitle.trim() && !editContent.trim()) return;

        if (selectedNoteId && selectedNote) {
            updateNote(selectedNoteId, editTitle, editContent);
        } else {
            addNote(editTitle, editContent);
        }
        setIsEditing(false);

        // 신규 저장 시 목록 최상단으로 가므로 선택 초기화 혹은 방금 만든거 선택?
        // 여기서는 간단히 편집 모드만 종료
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
                <div className="w-64 md:w-80 bg-white border-r border-gray-200 overflow-y-auto">
                    <div className="p-2 space-y-1">
                        {notes.length === 0 && (
                            <div className="text-center py-10 text-gray-400 text-sm">
                                메모가 없습니다.
                            </div>
                        )}
                        {notes.map((note) => (
                            <div
                                key={note.id}
                                onClick={() => handleSelectNote(note)}
                                className={`
                  group p-3 rounded-lg cursor-pointer transition-colors relative
                  ${selectedNoteId === note.id ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'}
                `}
                            >
                                <h3 className={`font-medium text-sm mb-1 ${selectedNoteId === note.id ? 'text-blue-800' : 'text-slate-700'}`}>
                                    {note.title || '(제목 없음)'}
                                </h3>
                                <p className="text-xs text-gray-500 line-clamp-2 h-8">
                                    {note.content || '(내용 없음)'}
                                </p>
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
                            // 편집 모드 (신규 or 수정)
                            <div className="flex flex-col flex-1 p-6">
                                <input
                                    type="text"
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    placeholder="제목을 입력하세요"
                                    className="text-2xl font-bold placeholder-gray-300 border-b border-transparent focus:border-gray-200 outline-none pb-2 mb-4"
                                    autoFocus
                                />
                                <textarea
                                    value={editContent}
                                    onChange={(e) => setEditContent(e.target.value)}
                                    placeholder="내용을 입력하세요..."
                                    className="flex-1 resize-none outline-none text-gray-700 leading-relaxed placeholder-gray-300"
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
                            // 상세 보기 모드
                            <div className="flex flex-col flex-1 p-6">
                                <div className="flex justify-between items-start mb-6 pb-4 border-b border-gray-100">
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-800 mb-1">{selectedNote.title || '(제목 없음)'}</h2>
                                        <span className="text-xs text-gray-400">
                                            최종 수정: {new Date(selectedNote.updatedAt).toLocaleString()}
                                        </span>
                                    </div>
                                    <button
                                        onClick={handleEdit}
                                        className="text-gray-400 hover:text-blue-600 p-2 hover:bg-blue-50 rounded"
                                    >
                                        편집
                                    </button>
                                </div>
                                <div className="flex-1 whitespace-pre-wrap text-gray-700 leading-relaxed">
                                    {selectedNote.content || '(내용 없음)'}
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
