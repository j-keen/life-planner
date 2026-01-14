import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Category } from '@/types/plan';

export interface Note {
    id: string;
    title: string;
    content: string;
    category?: Category;
    isPinned?: boolean;
    createdAt: number;
    updatedAt: number;
}

interface NotepadStore {
    notes: Note[];
    searchQuery: string;
    filterCategory: Category | 'all';

    // CRUD
    addNote: (title: string, content: string, category?: Category) => void;
    updateNote: (id: string, title: string, content: string, category?: Category) => void;
    deleteNote: (id: string) => void;

    // 검색/필터
    setSearchQuery: (query: string) => void;
    setFilterCategory: (category: Category | 'all') => void;

    // 즐겨찾기
    togglePin: (id: string) => void;

    // 필터링된 노트
    getFilteredNotes: () => Note[];
}

export const useNotepadStore = create<NotepadStore>()(
    persist(
        (set, get) => ({
            notes: [],
            searchQuery: '',
            filterCategory: 'all',

            addNote: (title, content, category) =>
                set((state) => ({
                    notes: [
                        {
                            id: crypto.randomUUID(),
                            title,
                            content,
                            category,
                            isPinned: false,
                            createdAt: Date.now(),
                            updatedAt: Date.now(),
                        },
                        ...state.notes,
                    ],
                })),

            updateNote: (id, title, content, category) =>
                set((state) => ({
                    notes: state.notes.map((note) =>
                        note.id === id
                            ? { ...note, title, content, category, updatedAt: Date.now() }
                            : note
                    ),
                })),

            deleteNote: (id) =>
                set((state) => ({
                    notes: state.notes.filter((note) => note.id !== id),
                })),

            setSearchQuery: (query) => set({ searchQuery: query }),
            setFilterCategory: (category) => set({ filterCategory: category }),

            togglePin: (id) =>
                set((state) => ({
                    notes: state.notes.map((note) =>
                        note.id === id
                            ? { ...note, isPinned: !note.isPinned }
                            : note
                    ),
                })),

            getFilteredNotes: () => {
                const state = get();
                let filtered = [...state.notes];

                // 검색 필터
                if (state.searchQuery.trim()) {
                    const query = state.searchQuery.toLowerCase();
                    filtered = filtered.filter(
                        (note) =>
                            note.title.toLowerCase().includes(query) ||
                            note.content.toLowerCase().includes(query)
                    );
                }

                // 카테고리 필터
                if (state.filterCategory !== 'all') {
                    filtered = filtered.filter(
                        (note) => note.category === state.filterCategory
                    );
                }

                // 정렬: 고정된 메모 먼저, 그 다음 최신순
                filtered.sort((a, b) => {
                    if (a.isPinned && !b.isPinned) return -1;
                    if (!a.isPinned && b.isPinned) return 1;
                    return b.updatedAt - a.updatedAt;
                });

                return filtered;
            },
        }),
        {
            name: 'life-planner-notepad',
            partialize: (state) => ({
                notes: state.notes,
            }),
        }
    )
);
