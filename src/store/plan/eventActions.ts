import type { PlanStore } from './types';
import { genId } from './types';
import type { AnnualEvent } from '../../types/plan';

type SetFn = (partial: Partial<PlanStore> | ((state: PlanStore) => Partial<PlanStore>)) => void;
type GetFn = () => PlanStore;

export const createEventActions = (set: SetFn, get: GetFn) => ({
  addAnnualEvent: (event: Omit<AnnualEvent, 'id' | 'createdAt'>) => {
    const newEvent: AnnualEvent = {
      ...event,
      id: genId(),
      createdAt: new Date().toISOString(),
    };
    set({ annualEvents: [...get().annualEvents, newEvent] });
  },

  updateAnnualEvent: (id: string, updates: Partial<Omit<AnnualEvent, 'id' | 'createdAt'>>) => {
    set({
      annualEvents: get().annualEvents.map((e) =>
        e.id === id ? { ...e, ...updates } : e
      ),
    });
  },

  deleteAnnualEvent: (id: string) => {
    set({
      annualEvents: get().annualEvents.filter((e) => e.id !== id),
    });
  },

  getUpcomingEvents: (days = 30): Array<AnnualEvent & { daysUntil: number; nextDate: Date }> => {
    const events = get().annualEvents;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return events
      .map((event) => {
        // 올해 날짜로 계산
        let nextDate = new Date(today.getFullYear(), event.month - 1, event.day);

        // 이미 지났으면 내년으로
        if (nextDate < today) {
          nextDate = new Date(today.getFullYear() + 1, event.month - 1, event.day);
        }

        const daysUntil = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        return { ...event, daysUntil, nextDate };
      })
      .filter((e) => e.daysUntil <= days)
      .sort((a, b) => a.daysUntil - b.daysUntil);
  },
});
