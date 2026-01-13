import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Note {
    id: string;
    title: string;
    content: string;
    createdAt: number;
    updatedAt: number;
}

interface NotepadStore {
    notes: Note[];
    addNote: (title: string, content: string) => void;
    updateNote: (id: string, title: string, content: string) => void;
    deleteNote: (id: string) => void;
}

export const useNotepadStore = create<NotepadStore>()(
    persist(
        (set) => ({
            notes: [],
            addNote: (title, content) =>
                set((state) => ({
                    notes: [
                        {
                            id: crypto.randomUUID(),
                            title,
                            content,
                            createdAt: Date.now(),
                            updatedAt: Date.now(),
                        },
                        ...state.notes,
                    ],
                })),
            updateNote: (id, title, content) =>
                set((state) => ({
                    notes: state.notes.map((note) =>
                        note.id === id
                            ? { ...note, title, content, updatedAt: Date.now() }
                            : note
                    ),
                })),
            deleteNote: (id) =>
                set((state) => ({
                    notes: state.notes.filter((note) => note.id !== id),
                })),
        }),
        {
            name: 'life-planner-notepad',
        }
    )
);
