import type { Item, Period, TimeSlot } from '../../types/plan';

/**
 * Collect all descendant IDs recursively from allItems, with cycle detection.
 */
export function collectDescendantIds(
  allItems: Record<string, Item>,
  rootId: string
): Set<string> {
  const ids = new Set<string>();
  const collect = (id: string) => {
    if (ids.has(id)) return; // cycle guard
    ids.add(id);
    const item = allItems[id];
    if (item?.childIds) {
      item.childIds.forEach(collect);
    }
  };
  collect(rootId);
  return ids;
}

/**
 * Update an item and all its descendants in allItems using an updater function.
 * Returns the mutated allItems (caller should spread-copy beforehand).
 */
export function updateItemAndDescendants(
  allItems: Record<string, Item>,
  rootId: string,
  updaterFn: (item: Item) => Item
): void {
  const visited = new Set<string>();
  const recurse = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id);
    if (allItems[id]) {
      allItems[id] = updaterFn(allItems[id]);
      const childIds = allItems[id].childIds;
      if (childIds && childIds.length > 0) {
        childIds.forEach(recurse);
      }
    }
  };
  recurse(rootId);
}

const EMPTY_TIME_SLOTS: Record<TimeSlot, Item[]> = {
  dawn: [],
  morning_early: [],
  morning_late: [],
  afternoon_early: [],
  afternoon_late: [],
  evening_early: [],
  evening_late: [],
  anytime: [],
};

/**
 * Synchronize all periods from allItems using a per-item sync function.
 * The syncFn takes an embedded item and returns either the same reference (no change)
 * or a new object (changed). Reference equality is used for change detection.
 *
 * Returns a new periods object with only changed periods replaced.
 */
export function syncAllPeriodsFromItems(
  periods: Record<string, Period>,
  syncFn: (item: Item) => Item
): Record<string, Period> {
  const updatedPeriods = { ...periods };
  let anyPeriodChanged = false;

  Object.keys(updatedPeriods).forEach((periodId) => {
    const p = updatedPeriods[periodId];
    if (!p) return;

    let needsUpdate = false;
    const updatedP = { ...p };

    // todos sync (reference comparison for change detection)
    const syncedTodos = p.todos.map(syncFn);
    if (syncedTodos.some((item, idx) => item !== p.todos[idx])) {
      updatedP.todos = syncedTodos;
      needsUpdate = true;
    }

    // routines sync
    const syncedRoutines = p.routines.map(syncFn);
    if (syncedRoutines.some((item, idx) => item !== p.routines[idx])) {
      updatedP.routines = syncedRoutines;
      needsUpdate = true;
    }

    // slots sync
    const syncedSlots: Record<string, Item[]> = {};
    let slotsChanged = false;
    Object.keys(p.slots).forEach((slotKey) => {
      const syncedSlot = p.slots[slotKey].map(syncFn);
      syncedSlots[slotKey] = syncedSlot;
      if (syncedSlot.some((item, idx) => item !== p.slots[slotKey][idx])) {
        slotsChanged = true;
      }
    });
    if (slotsChanged) {
      updatedP.slots = syncedSlots;
      needsUpdate = true;
    }

    // timeSlots sync
    if (p.timeSlots) {
      const syncedTimeSlots: Record<TimeSlot, Item[]> = { ...EMPTY_TIME_SLOTS };
      let timeSlotsChanged = false;
      (Object.keys(p.timeSlots) as TimeSlot[]).forEach((ts) => {
        const original = p.timeSlots![ts] || [];
        const syncedSlot = original.map(syncFn);
        syncedTimeSlots[ts] = syncedSlot;
        if (syncedSlot.some((item, idx) => item !== original[idx])) {
          timeSlotsChanged = true;
        }
      });
      if (timeSlotsChanged) {
        updatedP.timeSlots = syncedTimeSlots;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      updatedPeriods[periodId] = updatedP;
      anyPeriodChanged = true;
    }
  });

  return anyPeriodChanged ? updatedPeriods : periods;
}
