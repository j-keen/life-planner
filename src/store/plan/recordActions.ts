import type { PlanStore } from './types';
import { genId } from './types';
import type { DailyRecord, Mood } from '../../types/plan';

type SetFn = (partial: Partial<PlanStore> | ((state: PlanStore) => Partial<PlanStore>)) => void;
type GetFn = () => PlanStore;

export const createRecordActions = (set: SetFn, get: GetFn) => ({
  getRecord: (periodId: string): DailyRecord | null => {
    const state = get();
    return state.records[periodId] || null;
  },

  updateRecordContent: (periodId: string, content: string) => {
    const state = get();
    const now = new Date().toISOString();
    const existing = state.records[periodId];

    const updated: DailyRecord = existing
      ? { ...existing, content, updatedAt: now }
      : {
        id: genId(),
        periodId,
        content,
        highlights: [],
        gratitude: [],
        createdAt: now,
        updatedAt: now,
      };

    set({
      records: { ...state.records, [periodId]: updated },
    });
  },

  updateRecordMood: (periodId: string, mood: Mood | undefined) => {
    const state = get();
    const now = new Date().toISOString();
    const existing = state.records[periodId];

    const updated: DailyRecord = existing
      ? { ...existing, mood, updatedAt: now }
      : {
        id: genId(),
        periodId,
        content: '',
        mood,
        highlights: [],
        gratitude: [],
        createdAt: now,
        updatedAt: now,
      };

    set({
      records: { ...state.records, [periodId]: updated },
    });
  },

  addHighlight: (periodId: string, text: string) => {
    const state = get();
    const now = new Date().toISOString();
    const existing = state.records[periodId];

    const updated: DailyRecord = existing
      ? { ...existing, highlights: [...existing.highlights, text], updatedAt: now }
      : {
        id: genId(),
        periodId,
        content: '',
        highlights: [text],
        gratitude: [],
        createdAt: now,
        updatedAt: now,
      };

    set({
      records: { ...state.records, [periodId]: updated },
    });
  },

  removeHighlight: (periodId: string, index: number) => {
    const state = get();
    const existing = state.records[periodId];
    if (!existing) return;

    const newHighlights = [...existing.highlights];
    newHighlights.splice(index, 1);

    set({
      records: {
        ...state.records,
        [periodId]: {
          ...existing,
          highlights: newHighlights,
          updatedAt: new Date().toISOString(),
        },
      },
    });
  },

  addGratitude: (periodId: string, text: string) => {
    const state = get();
    const now = new Date().toISOString();
    const existing = state.records[periodId];

    const updated: DailyRecord = existing
      ? { ...existing, gratitude: [...existing.gratitude, text], updatedAt: now }
      : {
        id: genId(),
        periodId,
        content: '',
        highlights: [],
        gratitude: [text],
        createdAt: now,
        updatedAt: now,
      };

    set({
      records: { ...state.records, [periodId]: updated },
    });
  },

  removeGratitude: (periodId: string, index: number) => {
    const state = get();
    const existing = state.records[periodId];
    if (!existing) return;

    const newGratitude = [...existing.gratitude];
    newGratitude.splice(index, 1);

    set({
      records: {
        ...state.records,
        [periodId]: {
          ...existing,
          gratitude: newGratitude,
          updatedAt: new Date().toISOString(),
        },
      },
    });
  },
});
