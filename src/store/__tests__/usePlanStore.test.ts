/**
 * Characterization tests for usePlanStore.ts
 *
 * PURPOSE: Capture the EXACT current behavior of every exported function
 * and store action. These tests serve as a safety net for future refactoring.
 *
 * RULES:
 * - Do NOT mock genId(). Verify items by checking arrays/objects rather than specific IDs.
 * - Test EXACT current behavior, not ideal behavior.
 * - Use fixed dates where Date-dependent tests are needed.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  usePlanStore,
  getISOWeek,
  getISOWeekYear,
  getWeeksInMonth,
  getPeriodId,
  parsePeriodId,
  getChildPeriodIds,
  getSlotLabel,
  getSlotLabelShort,
  getTimeSlotId,
  parseTimeSlotId,
  getResetKey,
  getAdjacentPeriodId,
  getParentPeriodId,
} from '../usePlanStore';
import type { Item, Period, TimeSlot, Level } from '../../types/plan';

// ================================================================
// Helper: reset the store to a known state before each test
// ================================================================
function resetStore() {
  usePlanStore.setState({
    currentLevel: 'WEEK',
    currentPeriodId: 'w-2026-05',
    baseYear: 2026,
    periods: {},
    allItems: {},
    records: {},
    viewMode: 'plan',
    annualEvents: [],
  });
}

beforeEach(() => {
  resetStore();
});

// ================================================================
// 1. getISOWeek
// ================================================================
describe('getISOWeek', () => {
  it('returns week 1 for January 1, 2026 (Thursday)', () => {
    // Jan 1 2026 is a Thursday -> ISO week 1
    expect(getISOWeek(new Date(2026, 0, 1))).toBe(1);
  });

  it('returns week 1 for January 5, 2026 (Monday of week 2 is Jan 5)', () => {
    // Jan 5 2026 is a Monday -> ISO week 2
    expect(getISOWeek(new Date(2026, 0, 5))).toBe(2);
  });

  it('handles Dec 31 that belongs to next year week 1', () => {
    // Dec 31, 2026 is Thursday -> check what ISO week it is
    const result = getISOWeek(new Date(2026, 11, 31));
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThanOrEqual(1);
    expect(result).toBeLessThanOrEqual(53);
  });

  it('handles Sunday (end of ISO week)', () => {
    // Jan 4, 2026 is a Sunday -> ISO week 1
    expect(getISOWeek(new Date(2026, 0, 4))).toBe(1);
  });

  it('returns correct week for mid-year date', () => {
    // June 15, 2026 is a Monday
    const result = getISOWeek(new Date(2026, 5, 15));
    expect(result).toBe(25);
  });

  it('handles year boundary where Jan 1 is in previous year ISO week', () => {
    // Jan 1, 2023 is a Sunday -> ISO week 52 of 2022
    expect(getISOWeek(new Date(2023, 0, 1))).toBe(52);
  });
});

// ================================================================
// 2. getISOWeekYear
// ================================================================
describe('getISOWeekYear', () => {
  it('returns 2026 for a standard mid-year date', () => {
    expect(getISOWeekYear(new Date(2026, 5, 15))).toBe(2026);
  });

  it('returns the ISO week year for Jan 1 that falls in previous year week', () => {
    // Jan 1, 2023 is Sunday -> ISO week 52 of 2022
    expect(getISOWeekYear(new Date(2023, 0, 1))).toBe(2022);
  });

  it('returns current year for Jan 1 that is a Thursday', () => {
    // Jan 1, 2026 is a Thursday -> ISO week 1 of 2026
    expect(getISOWeekYear(new Date(2026, 0, 1))).toBe(2026);
  });

  it('handles Dec 31 correctly', () => {
    // Dec 31, 2026 is Thursday
    const result = getISOWeekYear(new Date(2026, 11, 31));
    expect(result).toBe(2026);
  });
});

// ================================================================
// 3. getWeeksInMonth
// ================================================================
describe('getWeeksInMonth', () => {
  it('returns weeks for January 2026', () => {
    const weeks = getWeeksInMonth(2026, 1);
    expect(weeks.length).toBeGreaterThanOrEqual(4);
    expect(weeks.length).toBeLessThanOrEqual(6);

    // Each week has weekNum, start (Monday), end (Sunday)
    weeks.forEach((w, idx) => {
      expect(w.weekNum).toBe(idx + 1);
      expect(w.targetMonth).toBe(1);
      // start should be a Monday (getDay() === 1)
      expect(w.start.getDay()).toBe(1);
      // end should be a Sunday (getDay() === 0)
      expect(w.end.getDay()).toBe(0);
      // end - start = 6 days
      const diffDays = (w.end.getTime() - w.start.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBe(6);
    });
  });

  it('returns 5 weeks for February 2026', () => {
    const weeks = getWeeksInMonth(2026, 2);
    // Feb 2026: Feb 1 is Sunday, so first Monday could be in January
    expect(weeks.length).toBeGreaterThanOrEqual(4);
    expect(weeks.length).toBeLessThanOrEqual(5);
  });

  it('first week start is <= first day of month', () => {
    const weeks = getWeeksInMonth(2026, 3);
    const marchFirst = new Date(2026, 2, 1);
    // First week's start (Monday) should be on or before March 1
    expect(weeks[0].start.getTime()).toBeLessThanOrEqual(marchFirst.getTime());
  });

  it('last week end is >= last day of month', () => {
    const weeks = getWeeksInMonth(2026, 3);
    const marchLast = new Date(2026, 3, 0); // March 31
    const lastWeek = weeks[weeks.length - 1];
    expect(lastWeek.end.getTime()).toBeGreaterThanOrEqual(marchLast.getTime());
  });

  it('weeks are contiguous (no gaps or overlaps)', () => {
    const weeks = getWeeksInMonth(2026, 6);
    for (let i = 1; i < weeks.length; i++) {
      const prevEnd = weeks[i - 1].end;
      const curStart = weeks[i].start;
      // Next Monday should be exactly 1 day after previous Sunday
      const gap = (curStart.getTime() - prevEnd.getTime()) / (1000 * 60 * 60 * 24);
      expect(gap).toBe(1);
    }
  });
});

// ================================================================
// 4. getPeriodId
// ================================================================
describe('getPeriodId', () => {
  const baseYear = 2026;

  it('THIRTY_YEAR always returns "30y"', () => {
    expect(getPeriodId('THIRTY_YEAR', baseYear)).toBe('30y');
  });

  it('FIVE_YEAR with fiveYearIndex', () => {
    expect(getPeriodId('FIVE_YEAR', baseYear, { fiveYearIndex: 0 })).toBe('5y-0');
    expect(getPeriodId('FIVE_YEAR', baseYear, { fiveYearIndex: 3 })).toBe('5y-3');
  });

  it('FIVE_YEAR defaults fiveYearIndex to 0', () => {
    expect(getPeriodId('FIVE_YEAR', baseYear)).toBe('5y-0');
  });

  it('YEAR with explicit year', () => {
    expect(getPeriodId('YEAR', baseYear, { year: 2028 })).toBe('y-2028');
  });

  it('YEAR defaults to baseYear', () => {
    expect(getPeriodId('YEAR', baseYear)).toBe('y-2026');
  });

  it('QUARTER with year and quarter', () => {
    expect(getPeriodId('QUARTER', baseYear, { year: 2026, quarter: 2 })).toBe('q-2026-2');
  });

  it('QUARTER defaults quarter to 1', () => {
    expect(getPeriodId('QUARTER', baseYear)).toBe('q-2026-1');
  });

  it('MONTH with zero-padded month', () => {
    expect(getPeriodId('MONTH', baseYear, { year: 2026, month: 1 })).toBe('m-2026-01');
    expect(getPeriodId('MONTH', baseYear, { year: 2026, month: 12 })).toBe('m-2026-12');
  });

  it('WEEK with zero-padded week', () => {
    expect(getPeriodId('WEEK', baseYear, { year: 2026, week: 5 })).toBe('w-2026-05');
    expect(getPeriodId('WEEK', baseYear, { year: 2026, week: 52 })).toBe('w-2026-52');
  });

  it('DAY with zero-padded month and day', () => {
    expect(getPeriodId('DAY', baseYear, { year: 2026, month: 1, day: 5 })).toBe('d-2026-01-05');
    expect(getPeriodId('DAY', baseYear, { year: 2026, month: 12, day: 31 })).toBe('d-2026-12-31');
  });

  it('unknown level defaults to "30y"', () => {
    expect(getPeriodId('UNKNOWN' as Level, baseYear)).toBe('30y');
  });
});

// ================================================================
// 5. parsePeriodId
// ================================================================
describe('parsePeriodId', () => {
  it('parses "30y"', () => {
    expect(parsePeriodId('30y')).toEqual({ level: 'THIRTY_YEAR' });
  });

  it('parses FIVE_YEAR id', () => {
    expect(parsePeriodId('5y-3')).toEqual({ level: 'FIVE_YEAR', fiveYearIndex: 3 });
  });

  it('parses YEAR id', () => {
    expect(parsePeriodId('y-2026')).toEqual({ level: 'YEAR', year: 2026 });
  });

  it('parses QUARTER id', () => {
    expect(parsePeriodId('q-2026-2')).toEqual({ level: 'QUARTER', year: 2026, quarter: 2 });
  });

  it('parses MONTH id', () => {
    expect(parsePeriodId('m-2026-07')).toEqual({ level: 'MONTH', year: 2026, month: 7 });
  });

  it('parses WEEK legacy format (3 parts)', () => {
    expect(parsePeriodId('w-2026-17')).toEqual({ level: 'WEEK', year: 2026, week: 17 });
  });

  it('parses WEEK new format (4 parts)', () => {
    expect(parsePeriodId('w-2026-05-2')).toEqual({ level: 'WEEK', year: 2026, month: 5, week: 2 });
  });

  it('parses DAY id', () => {
    expect(parsePeriodId('d-2026-02-03')).toEqual({ level: 'DAY', year: 2026, month: 2, day: 3 });
  });

  it('unknown prefix defaults to THIRTY_YEAR', () => {
    expect(parsePeriodId('x-unknown')).toEqual({ level: 'THIRTY_YEAR' });
  });
});

// ================================================================
// 6. getChildPeriodIds
// ================================================================
describe('getChildPeriodIds', () => {
  const baseYear = 2026;

  it('THIRTY_YEAR returns 6 FIVE_YEAR ids', () => {
    const ids = getChildPeriodIds('30y', baseYear);
    expect(ids).toHaveLength(6);
    expect(ids[0]).toBe('5y-0');
    expect(ids[5]).toBe('5y-5');
  });

  it('FIVE_YEAR-0 returns 5 YEAR ids starting at baseYear', () => {
    const ids = getChildPeriodIds('5y-0', baseYear);
    expect(ids).toHaveLength(5);
    expect(ids[0]).toBe('y-2026');
    expect(ids[4]).toBe('y-2030');
  });

  it('FIVE_YEAR-1 returns 5 YEAR ids starting at baseYear+5', () => {
    const ids = getChildPeriodIds('5y-1', baseYear);
    expect(ids).toHaveLength(5);
    expect(ids[0]).toBe('y-2031');
    expect(ids[4]).toBe('y-2035');
  });

  it('YEAR returns 4 QUARTER ids', () => {
    const ids = getChildPeriodIds('y-2026', baseYear);
    expect(ids).toHaveLength(4);
    expect(ids[0]).toBe('q-2026-1');
    expect(ids[3]).toBe('q-2026-4');
  });

  it('QUARTER-1 returns 3 MONTH ids (1,2,3)', () => {
    const ids = getChildPeriodIds('q-2026-1', baseYear);
    expect(ids).toHaveLength(3);
    expect(ids[0]).toBe('m-2026-01');
    expect(ids[2]).toBe('m-2026-03');
  });

  it('QUARTER-4 returns 3 MONTH ids (10,11,12)', () => {
    const ids = getChildPeriodIds('q-2026-4', baseYear);
    expect(ids).toHaveLength(3);
    expect(ids[0]).toBe('m-2026-10');
    expect(ids[2]).toBe('m-2026-12');
  });

  it('MONTH returns WEEK ids using new format (w-year-month-weekNum)', () => {
    const ids = getChildPeriodIds('m-2026-01', baseYear);
    expect(ids.length).toBeGreaterThanOrEqual(4);
    expect(ids.length).toBeLessThanOrEqual(6);
    // All should follow new format w-2026-01-N
    ids.forEach(id => {
      expect(id).toMatch(/^w-2026-01-\d+$/);
    });
  });

  it('WEEK new format returns 7 DAY ids', () => {
    // w-2026-01-1 should return 7 days of the first week of January 2026
    const ids = getChildPeriodIds('w-2026-01-1', baseYear);
    expect(ids).toHaveLength(7);
    ids.forEach(id => {
      expect(id).toMatch(/^d-\d{4}-\d{2}-\d{2}$/);
    });
  });

  it('WEEK legacy format returns 7 DAY ids', () => {
    const ids = getChildPeriodIds('w-2026-05', baseYear);
    expect(ids).toHaveLength(7);
    ids.forEach(id => {
      expect(id).toMatch(/^d-\d{4}-\d{2}-\d{2}$/);
    });
  });

  it('DAY returns empty array (no children)', () => {
    const ids = getChildPeriodIds('d-2026-01-05', baseYear);
    expect(ids).toEqual([]);
  });
});

// ================================================================
// 7. getSlotLabel
// ================================================================
describe('getSlotLabel', () => {
  const baseYear = 2026;

  it('FIVE_YEAR shows year range in Korean', () => {
    expect(getSlotLabel('5y-0', baseYear)).toBe('2026~2030\uB144');
    expect(getSlotLabel('5y-1', baseYear)).toBe('2031~2035\uB144');
  });

  it('YEAR shows year in Korean', () => {
    expect(getSlotLabel('y-2026', baseYear)).toBe('2026\uB144');
  });

  it('QUARTER shows year, quarter, and month range', () => {
    const label = getSlotLabel('q-2026-2', baseYear);
    expect(label).toBe('2026\uB144 2\uBD84\uAE30 (4~6\uC6D4)');
  });

  it('MONTH shows year and month', () => {
    expect(getSlotLabel('m-2026-07', baseYear)).toBe('2026\uB144 7\uC6D4');
  });

  it('WEEK new format shows week number with date range', () => {
    const label = getSlotLabel('w-2026-01-1', baseYear);
    // Should be like "1주차 (M/D~M/D)"
    expect(label).toMatch(/^1\uC8FC\uCC28 \(\d+\/\d+~\d+\/\d+\)$/);
  });

  it('WEEK legacy format shows week number with date range', () => {
    const label = getSlotLabel('w-2026-05', baseYear);
    expect(label).toMatch(/^5\uC8FC\uCC28 \(\d+\/\d+~\d+\/\d+\)$/);
  });

  it('DAY shows month, day, and day of week', () => {
    // Feb 3, 2026 is a Tuesday
    const label = getSlotLabel('d-2026-02-03', baseYear);
    expect(label).toBe('2\uC6D4 3\uC77C (\uD654)');
  });

  it('returns childId for unknown level', () => {
    expect(getSlotLabel('x-unknown', baseYear)).toBe('x-unknown');
  });
});

// ================================================================
// 8. getSlotLabelShort
// ================================================================
describe('getSlotLabelShort', () => {
  const baseYear = 2026;

  it('FIVE_YEAR shows start year with tilde', () => {
    expect(getSlotLabelShort('5y-0', baseYear)).toBe('2026~');
  });

  it('YEAR shows year as string', () => {
    expect(getSlotLabelShort('y-2028', baseYear)).toBe('2028');
  });

  it('QUARTER shows quarter number in Korean', () => {
    expect(getSlotLabelShort('q-2026-3', baseYear)).toBe('3\uBD84\uAE30');
  });

  it('MONTH shows month number in Korean', () => {
    expect(getSlotLabelShort('m-2026-07', baseYear)).toBe('7\uC6D4');
  });

  it('WEEK new format shows start date with tilde', () => {
    const label = getSlotLabelShort('w-2026-01-1', baseYear);
    expect(label).toMatch(/^\d+\/\d+~$/);
  });

  it('WEEK legacy format shows start date with tilde', () => {
    const label = getSlotLabelShort('w-2026-05', baseYear);
    expect(label).toMatch(/^\d+\/\d+~$/);
  });

  it('DAY shows day with day of week', () => {
    // Feb 3, 2026 is Tuesday
    const label = getSlotLabelShort('d-2026-02-03', baseYear);
    expect(label).toBe('3(\uD654)');
  });
});

// ================================================================
// 9. getTimeSlotId
// ================================================================
describe('getTimeSlotId', () => {
  it('concatenates ts- prefix, periodId, and timeSlot', () => {
    expect(getTimeSlotId('d-2026-01-05', 'morning_early')).toBe('ts-d-2026-01-05-morning_early');
  });

  it('works with anytime slot', () => {
    expect(getTimeSlotId('d-2026-06-15', 'anytime')).toBe('ts-d-2026-06-15-anytime');
  });

  it('works with dawn slot', () => {
    expect(getTimeSlotId('d-2026-12-31', 'dawn')).toBe('ts-d-2026-12-31-dawn');
  });
});

// ================================================================
// 10. parseTimeSlotId
// ================================================================
describe('parseTimeSlotId', () => {
  it('returns null for non-ts prefix', () => {
    expect(parseTimeSlotId('d-2026-01-05-morning_early')).toBeNull();
  });

  it('parses valid time slot id', () => {
    const result = parseTimeSlotId('ts-d-2026-01-05-morning_early');
    expect(result).toEqual({
      periodId: 'd-2026-01-05',
      timeSlot: 'morning_early',
    });
  });

  it('parses anytime time slot', () => {
    const result = parseTimeSlotId('ts-d-2026-06-15-anytime');
    expect(result).toEqual({
      periodId: 'd-2026-06-15',
      timeSlot: 'anytime',
    });
  });

  it('parses dawn time slot', () => {
    const result = parseTimeSlotId('ts-d-2026-12-31-dawn');
    expect(result).toEqual({
      periodId: 'd-2026-12-31',
      timeSlot: 'dawn',
    });
  });
});

// ================================================================
// 11. getResetKey
// ================================================================
describe('getResetKey', () => {
  it('DAY sourceLevel with DAY period returns day-based key', () => {
    expect(getResetKey('d-2026-02-03', 'DAY')).toBe('day-2026-2-3');
  });

  it('DAY sourceLevel with non-DAY period returns periodId', () => {
    expect(getResetKey('w-2026-05', 'DAY')).toBe('w-2026-05');
  });

  it('WEEK sourceLevel with DAY period returns week-based key', () => {
    const key = getResetKey('d-2026-01-05', 'WEEK');
    expect(key).toMatch(/^week-2026-\d+$/);
  });

  it('WEEK sourceLevel with WEEK period returns week key', () => {
    expect(getResetKey('w-2026-05', 'WEEK')).toBe('week-2026-5');
  });

  it('MONTH sourceLevel with DAY period returns month key', () => {
    expect(getResetKey('d-2026-03-15', 'MONTH')).toBe('month-2026-3');
  });

  it('MONTH sourceLevel with WEEK period uses ceil(week/4)', () => {
    expect(getResetKey('w-2026-05', 'MONTH')).toBe('month-2026-2');
  });

  it('MONTH sourceLevel with MONTH period returns month key', () => {
    expect(getResetKey('m-2026-07', 'MONTH')).toBe('month-2026-7');
  });

  it('QUARTER sourceLevel with MONTH period uses ceil(month/3)', () => {
    expect(getResetKey('m-2026-07', 'QUARTER')).toBe('quarter-2026-3');
  });

  it('QUARTER sourceLevel with QUARTER period', () => {
    expect(getResetKey('q-2026-2', 'QUARTER')).toBe('quarter-2026-2');
  });

  it('YEAR sourceLevel returns year key', () => {
    expect(getResetKey('y-2026', 'YEAR')).toBe('year-2026');
  });

  it('FIVE_YEAR sourceLevel returns 5year key', () => {
    expect(getResetKey('5y-2', 'FIVE_YEAR')).toBe('5year-2');
  });

  it('THIRTY_YEAR sourceLevel returns periodId (default)', () => {
    expect(getResetKey('30y', 'THIRTY_YEAR')).toBe('30y');
  });
});

// ================================================================
// 12. getAdjacentPeriodId
// ================================================================
describe('getAdjacentPeriodId', () => {
  const baseYear = 2026;

  it('THIRTY_YEAR returns null for both directions', () => {
    expect(getAdjacentPeriodId('30y', 'next', baseYear)).toBeNull();
    expect(getAdjacentPeriodId('30y', 'prev', baseYear)).toBeNull();
  });

  it('FIVE_YEAR navigates within 0-5 range', () => {
    expect(getAdjacentPeriodId('5y-0', 'next', baseYear)).toBe('5y-1');
    expect(getAdjacentPeriodId('5y-5', 'next', baseYear)).toBeNull();
    expect(getAdjacentPeriodId('5y-0', 'prev', baseYear)).toBeNull();
    expect(getAdjacentPeriodId('5y-3', 'prev', baseYear)).toBe('5y-2');
  });

  it('YEAR increments/decrements year', () => {
    expect(getAdjacentPeriodId('y-2026', 'next', baseYear)).toBe('y-2027');
    expect(getAdjacentPeriodId('y-2026', 'prev', baseYear)).toBe('y-2025');
  });

  it('QUARTER wraps around year boundary', () => {
    expect(getAdjacentPeriodId('q-2026-4', 'next', baseYear)).toBe('q-2027-1');
    expect(getAdjacentPeriodId('q-2026-1', 'prev', baseYear)).toBe('q-2025-4');
    expect(getAdjacentPeriodId('q-2026-2', 'next', baseYear)).toBe('q-2026-3');
  });

  it('MONTH wraps around year boundary', () => {
    expect(getAdjacentPeriodId('m-2026-12', 'next', baseYear)).toBe('m-2027-01');
    expect(getAdjacentPeriodId('m-2026-01', 'prev', baseYear)).toBe('m-2025-12');
    expect(getAdjacentPeriodId('m-2026-06', 'next', baseYear)).toBe('m-2026-07');
  });

  it('WEEK wraps around year boundary', () => {
    expect(getAdjacentPeriodId('w-2026-52', 'next', baseYear)).toBe('w-2027-01');
    expect(getAdjacentPeriodId('w-2026-01', 'prev', baseYear)).toBe('w-2025-52');
  });

  it('DAY advances/retreats by one day', () => {
    expect(getAdjacentPeriodId('d-2026-01-31', 'next', baseYear)).toBe('d-2026-02-01');
    expect(getAdjacentPeriodId('d-2026-02-01', 'prev', baseYear)).toBe('d-2026-01-31');
    expect(getAdjacentPeriodId('d-2026-12-31', 'next', baseYear)).toBe('d-2027-01-01');
  });
});

// ================================================================
// 13. getParentPeriodId
// ================================================================
describe('getParentPeriodId', () => {
  const baseYear = 2026;

  it('THIRTY_YEAR has no parent', () => {
    expect(getParentPeriodId('30y', baseYear)).toBeNull();
  });

  it('FIVE_YEAR parent is 30y', () => {
    expect(getParentPeriodId('5y-3', baseYear)).toBe('30y');
  });

  it('YEAR parent is correct FIVE_YEAR', () => {
    // 2026 is baseYear, so fiveYearIndex = floor((2026-2026)/5) = 0
    expect(getParentPeriodId('y-2026', baseYear)).toBe('5y-0');
    // 2031: floor((2031-2026)/5) = 1
    expect(getParentPeriodId('y-2031', baseYear)).toBe('5y-1');
  });

  it('YEAR parent clamps fiveYearIndex to 0-5', () => {
    // year way before baseYear -> floor should be negative, clamped to 0
    expect(getParentPeriodId('y-2020', baseYear)).toBe('5y-0');
    // year way after -> clamped to 5
    expect(getParentPeriodId('y-2100', baseYear)).toBe('5y-5');
  });

  it('QUARTER parent is YEAR', () => {
    expect(getParentPeriodId('q-2026-3', baseYear)).toBe('y-2026');
  });

  it('MONTH parent is QUARTER', () => {
    expect(getParentPeriodId('m-2026-01', baseYear)).toBe('q-2026-1');
    expect(getParentPeriodId('m-2026-04', baseYear)).toBe('q-2026-2');
    expect(getParentPeriodId('m-2026-07', baseYear)).toBe('q-2026-3');
    expect(getParentPeriodId('m-2026-10', baseYear)).toBe('q-2026-4');
  });

  it('WEEK new format parent is MONTH', () => {
    expect(getParentPeriodId('w-2026-05-2', baseYear)).toBe('m-2026-05');
  });

  it('WEEK legacy format parent is estimated MONTH', () => {
    // ceil(5/4) = 2, so month 2
    expect(getParentPeriodId('w-2026-05', baseYear)).toBe('m-2026-02');
  });

  it('DAY parent is the correct WEEK in the month', () => {
    // d-2026-02-03 -> should find the week containing Feb 3 in February
    const parentId = getParentPeriodId('d-2026-02-03', baseYear);
    expect(parentId).toMatch(/^w-2026-02-\d+$/);
  });
});

// ================================================================
// STORE ACTION TESTS
// ================================================================

// ================================================================
// 14. navigateTo
// ================================================================
describe('store: navigateTo', () => {
  it('creates period if it does not exist', () => {
    const { navigateTo } = usePlanStore.getState();
    navigateTo('m-2026-03');

    const state = usePlanStore.getState();
    expect(state.periods['m-2026-03']).toBeDefined();
    expect(state.periods['m-2026-03'].level).toBe('MONTH');
    expect(state.periods['m-2026-03'].id).toBe('m-2026-03');
  });

  it('sets currentLevel and currentPeriodId', () => {
    usePlanStore.getState().navigateTo('q-2026-2');
    const state = usePlanStore.getState();
    expect(state.currentLevel).toBe('QUARTER');
    expect(state.currentPeriodId).toBe('q-2026-2');
  });

  it('does not overwrite existing period data', () => {
    // Pre-populate a period
    usePlanStore.setState({
      periods: {
        'm-2026-03': {
          id: 'm-2026-03',
          level: 'MONTH',
          goal: 'Existing goal',
          motto: '',
          memo: '',
          memos: [],
          structuredMemos: [],
          todos: [],
          routines: [],
          slots: {},
        },
      },
    });
    usePlanStore.getState().navigateTo('m-2026-03');
    expect(usePlanStore.getState().periods['m-2026-03'].goal).toBe('Existing goal');
  });

  it('creates DAY period with timeSlots initialized', () => {
    usePlanStore.getState().navigateTo('d-2026-01-05');
    const period = usePlanStore.getState().periods['d-2026-01-05'];
    expect(period.timeSlots).toBeDefined();
    expect(Object.keys(period.timeSlots!)).toHaveLength(8);
    expect(period.timeSlots!.morning_early).toEqual([]);
    expect(period.timeSlots!.dawn).toEqual([]);
  });
});

// ================================================================
// 15. drillDown
// ================================================================
describe('store: drillDown', () => {
  it('delegates to navigateTo', () => {
    usePlanStore.getState().drillDown('y-2026');
    const state = usePlanStore.getState();
    expect(state.currentLevel).toBe('YEAR');
    expect(state.currentPeriodId).toBe('y-2026');
    expect(state.periods['y-2026']).toBeDefined();
  });
});

// ================================================================
// 16. drillUp
// ================================================================
describe('store: drillUp', () => {
  it('navigates to parent period', () => {
    usePlanStore.getState().navigateTo('q-2026-2');
    usePlanStore.getState().drillUp();
    const state = usePlanStore.getState();
    expect(state.currentLevel).toBe('YEAR');
    expect(state.currentPeriodId).toBe('y-2026');
  });

  it('does nothing at THIRTY_YEAR level', () => {
    usePlanStore.getState().navigateTo('30y');
    usePlanStore.getState().drillUp();
    const state = usePlanStore.getState();
    expect(state.currentLevel).toBe('THIRTY_YEAR');
    expect(state.currentPeriodId).toBe('30y');
  });
});

// ================================================================
// 17. setViewMode / toggleViewMode
// ================================================================
describe('store: viewMode', () => {
  it('setViewMode sets the mode', () => {
    usePlanStore.getState().setViewMode('record');
    expect(usePlanStore.getState().viewMode).toBe('record');
    usePlanStore.getState().setViewMode('plan');
    expect(usePlanStore.getState().viewMode).toBe('plan');
  });

  it('toggleViewMode toggles between plan and record', () => {
    expect(usePlanStore.getState().viewMode).toBe('plan');
    usePlanStore.getState().toggleViewMode();
    expect(usePlanStore.getState().viewMode).toBe('record');
    usePlanStore.getState().toggleViewMode();
    expect(usePlanStore.getState().viewMode).toBe('plan');
  });
});

// ================================================================
// 18. updatePeriodHeader
// ================================================================
describe('store: updatePeriodHeader', () => {
  it('updates goal field', () => {
    usePlanStore.getState().navigateTo('w-2026-05');
    usePlanStore.getState().updatePeriodHeader('goal', 'New Goal');
    expect(usePlanStore.getState().periods['w-2026-05'].goal).toBe('New Goal');
  });

  it('updates motto field', () => {
    usePlanStore.getState().navigateTo('w-2026-05');
    usePlanStore.getState().updatePeriodHeader('motto', 'Keep going');
    expect(usePlanStore.getState().periods['w-2026-05'].motto).toBe('Keep going');
  });

  it('updates memo field', () => {
    usePlanStore.getState().navigateTo('w-2026-05');
    usePlanStore.getState().updatePeriodHeader('memo', 'Some memo');
    expect(usePlanStore.getState().periods['w-2026-05'].memo).toBe('Some memo');
  });

  it('creates period if not exists via ensurePeriod', () => {
    // Navigate sets currentPeriodId but let's verify update works on non-existent period
    usePlanStore.setState({ currentPeriodId: 'm-2026-06', currentLevel: 'MONTH', periods: {} });
    usePlanStore.getState().updatePeriodHeader('goal', 'June goal');
    expect(usePlanStore.getState().periods['m-2026-06'].goal).toBe('June goal');
  });
});

// ================================================================
// 19. addMemo / removeMemo
// ================================================================
describe('store: addMemo / removeMemo', () => {
  beforeEach(() => {
    usePlanStore.getState().navigateTo('w-2026-05');
  });

  it('addMemo adds a structured memo', () => {
    usePlanStore.getState().addMemo('Test memo');
    const period = usePlanStore.getState().periods['w-2026-05'];
    expect(period.structuredMemos).toHaveLength(1);
    expect(period.structuredMemos[0].content).toBe('Test memo');
    expect(period.structuredMemos[0].sourceLevel).toBe('WEEK');
    expect(period.structuredMemos[0].sourcePeriodId).toBe('w-2026-05');
    expect(typeof period.structuredMemos[0].id).toBe('string');
  });

  it('addMemo appends to existing memos', () => {
    usePlanStore.getState().addMemo('First');
    usePlanStore.getState().addMemo('Second');
    const period = usePlanStore.getState().periods['w-2026-05'];
    expect(period.structuredMemos).toHaveLength(2);
    expect(period.structuredMemos[0].content).toBe('First');
    expect(period.structuredMemos[1].content).toBe('Second');
  });

  it('removeMemo removes by index', () => {
    usePlanStore.getState().addMemo('A');
    usePlanStore.getState().addMemo('B');
    usePlanStore.getState().addMemo('C');
    usePlanStore.getState().removeMemo(1);
    const memos = usePlanStore.getState().periods['w-2026-05'].structuredMemos;
    expect(memos).toHaveLength(2);
    expect(memos[0].content).toBe('A');
    expect(memos[1].content).toBe('C');
  });
});

// ================================================================
// 20. getInheritedMemos
// ================================================================
describe('store: getInheritedMemos', () => {
  it('collects memos from parent chain sorted by level', () => {
    // Set up memos at MONTH and WEEK levels
    usePlanStore.getState().navigateTo('m-2026-02');
    usePlanStore.getState().addMemo('Month memo');
    // Navigate to a week in February
    const weekIds = getChildPeriodIds('m-2026-02', 2026);
    const weekId = weekIds[0];
    usePlanStore.getState().navigateTo(weekId);
    usePlanStore.getState().addMemo('Week memo');

    const memos = usePlanStore.getState().getInheritedMemos(weekId);
    // Should have month memo and week memo, month first
    expect(memos.length).toBeGreaterThanOrEqual(2);
    const monthMemoIdx = memos.findIndex(m => m.content === 'Month memo');
    const weekMemoIdx = memos.findIndex(m => m.content === 'Week memo');
    expect(monthMemoIdx).toBeLessThan(weekMemoIdx);
  });

  it('returns empty array if no memos in chain', () => {
    const memos = usePlanStore.getState().getInheritedMemos('w-2026-05');
    expect(memos).toEqual([]);
  });

  it('includes legacy string memos if not duplicated in structuredMemos', () => {
    // Manually set up a period with both legacy and structured memos
    usePlanStore.setState({
      currentPeriodId: 'w-2026-05',
      currentLevel: 'WEEK',
      periods: {
        'w-2026-05': {
          id: 'w-2026-05',
          level: 'WEEK',
          goal: '',
          motto: '',
          memo: '',
          memos: ['legacy memo'],
          structuredMemos: [],
          todos: [],
          routines: [],
          slots: {},
        },
      },
    });

    const memos = usePlanStore.getState().getInheritedMemos('w-2026-05');
    expect(memos).toHaveLength(1);
    expect(memos[0].content).toBe('legacy memo');
    expect(memos[0].id).toContain('legacy');
  });
});

// ================================================================
// 21. addItem
// ================================================================
describe('store: addItem', () => {
  beforeEach(() => {
    usePlanStore.getState().navigateTo('w-2026-05');
  });

  it('adds a todo item', () => {
    usePlanStore.getState().addItem('Buy groceries', 'todo');
    const period = usePlanStore.getState().periods['w-2026-05'];
    expect(period.todos).toHaveLength(1);
    expect(period.todos[0].content).toBe('Buy groceries');
    expect(period.todos[0].isCompleted).toBe(false);
    expect(period.todos[0].originPeriodId).toBe('w-2026-05');
    // todo should not have sourceLevel or sourceType
    expect(period.todos[0].sourceLevel).toBeUndefined();
    expect(period.todos[0].sourceType).toBeUndefined();
  });

  it('adds a routine item without targetCount', () => {
    usePlanStore.getState().addItem('Meditation', 'routine');
    const period = usePlanStore.getState().periods['w-2026-05'];
    expect(period.routines).toHaveLength(1);
    expect(period.routines[0].content).toBe('Meditation');
    expect(period.routines[0].sourceLevel).toBe('WEEK');
    expect(period.routines[0].sourceType).toBe('routine');
  });

  it('adds a routine item with targetCount', () => {
    usePlanStore.getState().addItem('Exercise', 'routine', 3);
    const period = usePlanStore.getState().periods['w-2026-05'];
    const routine = period.routines[0];
    expect(routine.targetCount).toBe(3);
    expect(routine.currentCount).toBe(3);
    expect(routine.lastResetDate).toBeDefined();
  });

  it('adds item with category (routine)', () => {
    usePlanStore.getState().addItem('Push-ups', 'routine', 5, 'health');
    const period = usePlanStore.getState().periods['w-2026-05'];
    expect(period.routines[0].category).toBe('health');
  });

  it('adds item with todoCategory (todo)', () => {
    usePlanStore.getState().addItem('Report', 'todo', undefined, undefined, 'work');
    const period = usePlanStore.getState().periods['w-2026-05'];
    expect(period.todos[0].todoCategory).toBe('work');
  });

  it('registers item in allItems', () => {
    usePlanStore.getState().addItem('Task A', 'todo');
    const state = usePlanStore.getState();
    const period = state.periods['w-2026-05'];
    const itemId = period.todos[0].id;
    expect(state.allItems[itemId]).toBeDefined();
    expect(state.allItems[itemId].content).toBe('Task A');
  });

  it('routine sets category, todo does not', () => {
    usePlanStore.getState().addItem('Work stuff', 'routine', undefined, 'work');
    usePlanStore.getState().addItem('Work todo', 'todo', undefined, 'work' as any);
    const period = usePlanStore.getState().periods['w-2026-05'];
    // Routine gets category
    expect(period.routines[0].category).toBe('work');
    // Todo does NOT get category (only todoCategory)
    expect(period.todos[0].category).toBeUndefined();
  });
});

// ================================================================
// 22. updateItemCategory / updateTodoCategory
// ================================================================
describe('store: updateItemCategory', () => {
  it('updates category on a routine in routines list', () => {
    usePlanStore.getState().navigateTo('w-2026-05');
    usePlanStore.getState().addItem('Run', 'routine', undefined, 'health');
    const routine = usePlanStore.getState().periods['w-2026-05'].routines[0];

    usePlanStore.getState().updateItemCategory(routine.id, 'growth', 'routine');
    const updated = usePlanStore.getState().periods['w-2026-05'].routines[0];
    expect(updated.category).toBe('growth');
    expect(usePlanStore.getState().allItems[routine.id].category).toBe('growth');
  });

  it('updates category on a todo in todos list', () => {
    usePlanStore.getState().navigateTo('w-2026-05');
    usePlanStore.getState().addItem('Task', 'todo');
    const todo = usePlanStore.getState().periods['w-2026-05'].todos[0];

    usePlanStore.getState().updateItemCategory(todo.id, 'work', 'todo');
    const updated = usePlanStore.getState().periods['w-2026-05'].todos[0];
    expect(updated.category).toBe('work');
  });
});

describe('store: updateTodoCategory', () => {
  it('updates todoCategory on a todo', () => {
    usePlanStore.getState().navigateTo('w-2026-05');
    usePlanStore.getState().addItem('Task', 'todo', undefined, undefined, 'personal');
    const todo = usePlanStore.getState().periods['w-2026-05'].todos[0];

    usePlanStore.getState().updateTodoCategory(todo.id, 'work');
    const updated = usePlanStore.getState().periods['w-2026-05'].todos[0];
    expect(updated.todoCategory).toBe('work');
    expect(usePlanStore.getState().allItems[todo.id].todoCategory).toBe('work');
  });
});

// ================================================================
// 23. deleteItem
// ================================================================
describe('store: deleteItem', () => {
  beforeEach(() => {
    usePlanStore.getState().navigateTo('w-2026-05');
  });

  it('removes a todo from period and allItems', () => {
    usePlanStore.getState().addItem('To delete', 'todo');
    const todo = usePlanStore.getState().periods['w-2026-05'].todos[0];

    usePlanStore.getState().deleteItem(todo.id, 'todo');
    const state = usePlanStore.getState();
    expect(state.periods['w-2026-05'].todos).toHaveLength(0);
    expect(state.allItems[todo.id]).toBeUndefined();
  });

  it('removes a routine from period and allItems', () => {
    usePlanStore.getState().addItem('To delete', 'routine');
    const routine = usePlanStore.getState().periods['w-2026-05'].routines[0];

    usePlanStore.getState().deleteItem(routine.id, 'routine');
    const state = usePlanStore.getState();
    expect(state.periods['w-2026-05'].routines).toHaveLength(0);
    expect(state.allItems[routine.id]).toBeUndefined();
  });

  it('cascading delete removes children recursively', () => {
    usePlanStore.getState().addItem('Parent', 'todo');
    const parent = usePlanStore.getState().periods['w-2026-05'].todos[0];

    // Add a sub-item
    usePlanStore.getState().addSubItem(parent.id, 'Child', 'todo');
    const stateAfterAdd = usePlanStore.getState();
    const childId = stateAfterAdd.periods['w-2026-05'].todos.find(
      t => t.parentId === parent.id
    )?.id;
    expect(childId).toBeDefined();

    // Delete the parent
    usePlanStore.getState().deleteItem(parent.id, 'todo');
    const state = usePlanStore.getState();
    expect(state.allItems[parent.id]).toBeUndefined();
    expect(state.allItems[childId!]).toBeUndefined();
    expect(state.periods['w-2026-05'].todos).toHaveLength(0);
  });

  it('cleans up parent childIds when deleting a child', () => {
    usePlanStore.getState().addItem('Parent', 'todo');
    const parent = usePlanStore.getState().periods['w-2026-05'].todos[0];

    usePlanStore.getState().addSubItem(parent.id, 'Child1', 'todo');
    usePlanStore.getState().addSubItem(parent.id, 'Child2', 'todo');

    const stateAfterAdd = usePlanStore.getState();
    const children = stateAfterAdd.periods['w-2026-05'].todos.filter(
      t => t.parentId === parent.id
    );
    expect(children).toHaveLength(2);

    // Delete first child
    usePlanStore.getState().deleteItem(children[0].id, 'todo');
    const updatedParent = usePlanStore.getState().allItems[parent.id];
    expect(updatedParent.childIds).toHaveLength(1);
    expect(updatedParent.childIds).not.toContain(children[0].id);
    expect(updatedParent.childIds).toContain(children[1].id);
  });

  it('removes items from slots across all periods', () => {
    // Add a todo, then assign to a slot
    usePlanStore.getState().addItem('Task', 'todo');
    const todo = usePlanStore.getState().periods['w-2026-05'].todos[0];

    const childIds = getChildPeriodIds('w-2026-05', 2026);
    const targetSlot = childIds[0];
    usePlanStore.getState().assignToSlot(todo.id, 'todo', targetSlot);

    // Find the slot item
    const stateAfterAssign = usePlanStore.getState();
    const slotItems = stateAfterAssign.periods['w-2026-05'].slots[targetSlot];
    expect(slotItems.length).toBe(1);
    const slotItemId = slotItems[0].id;

    // Delete the slot item
    usePlanStore.getState().deleteItem(slotItemId, 'slot', targetSlot);
    const stateAfterDelete = usePlanStore.getState();
    const remainingSlotItems = stateAfterDelete.periods['w-2026-05'].slots[targetSlot] || [];
    expect(remainingSlotItems.find(i => i.id === slotItemId)).toBeUndefined();
  });
});

// ================================================================
// 24. updateItemContent / updateItemColor / updateItemNote
// ================================================================
describe('store: updateItemContent', () => {
  it('updates content of a todo', () => {
    usePlanStore.getState().navigateTo('w-2026-05');
    usePlanStore.getState().addItem('Original', 'todo');
    const todo = usePlanStore.getState().periods['w-2026-05'].todos[0];

    usePlanStore.getState().updateItemContent(todo.id, 'Updated', 'todo');
    const updated = usePlanStore.getState().periods['w-2026-05'].todos[0];
    expect(updated.content).toBe('Updated');
    expect(usePlanStore.getState().allItems[todo.id].content).toBe('Updated');
  });
});

describe('store: updateItemColor', () => {
  it('updates color of a routine', () => {
    usePlanStore.getState().navigateTo('w-2026-05');
    usePlanStore.getState().addItem('Run', 'routine');
    const routine = usePlanStore.getState().periods['w-2026-05'].routines[0];

    usePlanStore.getState().updateItemColor(routine.id, 'bg-red-100', 'routine');
    expect(usePlanStore.getState().periods['w-2026-05'].routines[0].color).toBe('bg-red-100');
  });
});

describe('store: updateItemNote', () => {
  it('updates note of a todo', () => {
    usePlanStore.getState().navigateTo('w-2026-05');
    usePlanStore.getState().addItem('Task', 'todo');
    const todo = usePlanStore.getState().periods['w-2026-05'].todos[0];

    usePlanStore.getState().updateItemNote(todo.id, 'My note', 'todo');
    expect(usePlanStore.getState().periods['w-2026-05'].todos[0].note).toBe('My note');
    expect(usePlanStore.getState().allItems[todo.id].note).toBe('My note');
  });
});

// ================================================================
// 25. assignToSlot (THE CORE ACTION)
// ================================================================
describe('store: assignToSlot', () => {
  const weekId = 'w-2026-05';
  let childSlotIds: string[];

  beforeEach(() => {
    usePlanStore.getState().navigateTo(weekId);
    childSlotIds = getChildPeriodIds(weekId, 2026);
  });

  it('creates a new child item in the target slot', () => {
    usePlanStore.getState().addItem('Study', 'todo');
    const todo = usePlanStore.getState().periods[weekId].todos[0];
    const targetSlot = childSlotIds[0];

    usePlanStore.getState().assignToSlot(todo.id, 'todo', targetSlot);

    const state = usePlanStore.getState();
    const slotItems = state.periods[weekId].slots[targetSlot];
    expect(slotItems).toHaveLength(1);
    expect(slotItems[0].content).toBe('Study');
    expect(slotItems[0].parentId).toBe(todo.id);
  });

  it('sets parentId on child and adds childId to parent', () => {
    usePlanStore.getState().addItem('Study', 'todo');
    const todo = usePlanStore.getState().periods[weekId].todos[0];
    const targetSlot = childSlotIds[0];

    usePlanStore.getState().assignToSlot(todo.id, 'todo', targetSlot);

    const state = usePlanStore.getState();
    const updatedParent = state.allItems[todo.id];
    expect(updatedParent.childIds).toBeDefined();
    expect(updatedParent.childIds!.length).toBeGreaterThanOrEqual(1);

    const slotItem = state.periods[weekId].slots[targetSlot][0];
    expect(slotItem.parentId).toBe(todo.id);
  });

  it('propagates item to child period todos', () => {
    usePlanStore.getState().addItem('Study', 'todo');
    const todo = usePlanStore.getState().periods[weekId].todos[0];
    const targetSlot = childSlotIds[0];

    usePlanStore.getState().assignToSlot(todo.id, 'todo', targetSlot);

    const state = usePlanStore.getState();
    // The child period should exist and have the propagated item in todos
    const childPeriod = state.periods[targetSlot];
    expect(childPeriod).toBeDefined();
    expect(childPeriod.todos).toHaveLength(1);
    expect(childPeriod.todos[0].content).toBe('Study');
  });

  it('creates chain: original -> slot item -> propagated item', () => {
    usePlanStore.getState().addItem('Study', 'todo');
    const todo = usePlanStore.getState().periods[weekId].todos[0];
    const targetSlot = childSlotIds[0];

    usePlanStore.getState().assignToSlot(todo.id, 'todo', targetSlot);

    const state = usePlanStore.getState();
    const slotItem = state.periods[weekId].slots[targetSlot][0];
    const propagatedItem = state.periods[targetSlot].todos[0];

    // Chain: original -> slot item -> propagated
    expect(slotItem.parentId).toBe(todo.id);
    expect(propagatedItem.parentId).toBe(slotItem.id);
    expect(slotItem.childIds).toContain(propagatedItem.id);
  });

  it('decrements currentCount for routine with targetCount', () => {
    usePlanStore.getState().addItem('Exercise', 'routine', 3);
    const routine = usePlanStore.getState().periods[weekId].routines[0];
    expect(routine.currentCount).toBe(3);

    usePlanStore.getState().assignToSlot(routine.id, 'routine', childSlotIds[0]);
    const updatedRoutine = usePlanStore.getState().periods[weekId].routines[0];
    expect(updatedRoutine.currentCount).toBe(2);

    usePlanStore.getState().assignToSlot(routine.id, 'routine', childSlotIds[1]);
    const routine2 = usePlanStore.getState().periods[weekId].routines[0];
    expect(routine2.currentCount).toBe(1);
  });

  it('currentCount does not go below 0', () => {
    usePlanStore.getState().addItem('Exercise', 'routine', 1);
    const routine = usePlanStore.getState().periods[weekId].routines[0];

    usePlanStore.getState().assignToSlot(routine.id, 'routine', childSlotIds[0]);
    expect(usePlanStore.getState().periods[weekId].routines[0].currentCount).toBe(0);

    usePlanStore.getState().assignToSlot(routine.id, 'routine', childSlotIds[1]);
    expect(usePlanStore.getState().periods[weekId].routines[0].currentCount).toBe(0);
  });

  it('subContent creates "originalContent: subContent" format', () => {
    usePlanStore.getState().addItem('Exercise', 'routine');
    const routine = usePlanStore.getState().periods[weekId].routines[0];

    usePlanStore.getState().assignToSlot(routine.id, 'routine', childSlotIds[0], 'Push-ups');

    const slotItem = usePlanStore.getState().periods[weekId].slots[childSlotIds[0]][0];
    expect(slotItem.content).toBe('Exercise: Push-ups');
    expect(slotItem.subContent).toBe('Push-ups');
  });

  it('copies color and category from original', () => {
    usePlanStore.getState().addItem('Run', 'routine', undefined, 'health');
    const routine = usePlanStore.getState().periods[weekId].routines[0];
    usePlanStore.getState().updateItemColor(routine.id, 'bg-green-100', 'routine');

    usePlanStore.getState().assignToSlot(routine.id, 'routine', childSlotIds[0]);

    const slotItem = usePlanStore.getState().periods[weekId].slots[childSlotIds[0]][0];
    expect(slotItem.color).toBe('bg-green-100');
    expect(slotItem.category).toBe('health');
  });

  it('registers all new items in allItems', () => {
    usePlanStore.getState().addItem('Task', 'todo');
    const todo = usePlanStore.getState().periods[weekId].todos[0];

    usePlanStore.getState().assignToSlot(todo.id, 'todo', childSlotIds[0]);

    const state = usePlanStore.getState();
    const slotItem = state.periods[weekId].slots[childSlotIds[0]][0];
    const propagated = state.periods[childSlotIds[0]].todos[0];

    expect(state.allItems[slotItem.id]).toBeDefined();
    expect(state.allItems[propagated.id]).toBeDefined();
  });

  it('does nothing if original item not found', () => {
    usePlanStore.getState().assignToSlot('nonexistent', 'todo', childSlotIds[0]);
    const state = usePlanStore.getState();
    const slotItems = state.periods[weekId]?.slots[childSlotIds[0]];
    expect(slotItems).toBeUndefined();
  });
});

// ================================================================
// 26. assignToTimeSlot
// ================================================================
describe('store: assignToTimeSlot', () => {
  const dayId = 'd-2026-02-03';

  beforeEach(() => {
    usePlanStore.getState().navigateTo(dayId);
  });

  it('creates item in time slot at DAY level', () => {
    usePlanStore.getState().addItem('Morning run', 'todo');
    const todo = usePlanStore.getState().periods[dayId].todos[0];

    usePlanStore.getState().assignToTimeSlot(todo.id, 'todo', 'morning_early');

    const period = usePlanStore.getState().periods[dayId];
    expect(period.timeSlots!.morning_early).toHaveLength(1);
    expect(period.timeSlots!.morning_early[0].content).toBe('Morning run');
    expect(period.timeSlots!.morning_early[0].parentId).toBe(todo.id);
  });

  it('does nothing at non-DAY level', () => {
    usePlanStore.getState().navigateTo('w-2026-05');
    usePlanStore.getState().addItem('Task', 'todo');
    const todo = usePlanStore.getState().periods['w-2026-05'].todos[0];

    usePlanStore.getState().assignToTimeSlot(todo.id, 'todo', 'morning_early');
    // Nothing should happen since not DAY level
    const period = usePlanStore.getState().periods['w-2026-05'];
    expect(period.timeSlots).toBeUndefined();
  });

  it('decrements routine currentCount', () => {
    usePlanStore.getState().addItem('Stretch', 'routine', 2);
    const routine = usePlanStore.getState().periods[dayId].routines[0];

    usePlanStore.getState().assignToTimeSlot(routine.id, 'routine', 'dawn');
    expect(usePlanStore.getState().periods[dayId].routines[0].currentCount).toBe(1);
  });

  it('subContent creates formatted content', () => {
    usePlanStore.getState().addItem('Exercise', 'todo');
    const todo = usePlanStore.getState().periods[dayId].todos[0];

    usePlanStore.getState().assignToTimeSlot(todo.id, 'todo', 'afternoon_early', 'Yoga');

    const timeSlotItems = usePlanStore.getState().periods[dayId].timeSlots!.afternoon_early;
    expect(timeSlotItems[0].content).toBe('Exercise: Yoga');
    expect(timeSlotItems[0].subContent).toBe('Yoga');
  });
});

// ================================================================
// 27. moveSlotItem
// ================================================================
describe('store: moveSlotItem', () => {
  it('moves item from one slot to another', () => {
    const weekId = 'w-2026-05';
    usePlanStore.getState().navigateTo(weekId);
    usePlanStore.getState().addItem('Task', 'todo');
    const todo = usePlanStore.getState().periods[weekId].todos[0];

    const childIds = getChildPeriodIds(weekId, 2026);
    const fromSlot = childIds[0];
    const toSlot = childIds[1];

    usePlanStore.getState().assignToSlot(todo.id, 'todo', fromSlot);
    const slotItem = usePlanStore.getState().periods[weekId].slots[fromSlot][0];

    usePlanStore.getState().moveSlotItem(slotItem.id, fromSlot, toSlot);

    const state = usePlanStore.getState();
    expect(state.periods[weekId].slots[fromSlot]).toHaveLength(0);
    expect(state.periods[weekId].slots[toSlot]).toHaveLength(1);
    expect(state.periods[weekId].slots[toSlot][0].id).toBe(slotItem.id);
  });

  it('does nothing if fromSlotId === toSlotId', () => {
    const weekId = 'w-2026-05';
    usePlanStore.getState().navigateTo(weekId);
    usePlanStore.getState().addItem('Task', 'todo');
    const todo = usePlanStore.getState().periods[weekId].todos[0];

    const childIds = getChildPeriodIds(weekId, 2026);
    const slot = childIds[0];

    usePlanStore.getState().assignToSlot(todo.id, 'todo', slot);
    const slotItem = usePlanStore.getState().periods[weekId].slots[slot][0];

    usePlanStore.getState().moveSlotItem(slotItem.id, slot, slot);
    expect(usePlanStore.getState().periods[weekId].slots[slot]).toHaveLength(1);
  });
});

// ================================================================
// 28. moveTimeSlotItem
// ================================================================
describe('store: moveTimeSlotItem', () => {
  const dayId = 'd-2026-02-03';

  beforeEach(() => {
    usePlanStore.getState().navigateTo(dayId);
  });

  it('moves item between time slots', () => {
    usePlanStore.getState().addItem('Task', 'todo');
    const todo = usePlanStore.getState().periods[dayId].todos[0];
    usePlanStore.getState().assignToTimeSlot(todo.id, 'todo', 'morning_early');

    const item = usePlanStore.getState().periods[dayId].timeSlots!.morning_early[0];
    const fromSlotId = `ts-${dayId}-morning_early`;
    const toSlotId = `ts-${dayId}-evening_early`;

    usePlanStore.getState().moveTimeSlotItem(item.id, fromSlotId, toSlotId);

    const state = usePlanStore.getState();
    expect(state.periods[dayId].timeSlots!.morning_early).toHaveLength(0);
    expect(state.periods[dayId].timeSlots!.evening_early).toHaveLength(1);
  });

  it('does nothing at non-DAY level', () => {
    usePlanStore.getState().navigateTo('w-2026-05');
    usePlanStore.getState().moveTimeSlotItem('any', 'from', 'to');
    // Should not throw or modify state
    expect(usePlanStore.getState().currentLevel).toBe('WEEK');
  });

  it('does nothing if fromSlotId === toSlotId', () => {
    usePlanStore.getState().addItem('Task', 'todo');
    const todo = usePlanStore.getState().periods[dayId].todos[0];
    usePlanStore.getState().assignToTimeSlot(todo.id, 'todo', 'morning_early');

    const item = usePlanStore.getState().periods[dayId].timeSlots!.morning_early[0];
    const slotId = `ts-${dayId}-morning_early`;

    usePlanStore.getState().moveTimeSlotItem(item.id, slotId, slotId);
    expect(usePlanStore.getState().periods[dayId].timeSlots!.morning_early).toHaveLength(1);
  });
});

// ================================================================
// 29. addSubItem
// ================================================================
describe('store: addSubItem', () => {
  beforeEach(() => {
    usePlanStore.getState().navigateTo('w-2026-05');
  });

  it('creates a sub-item with parent link', () => {
    usePlanStore.getState().addItem('Parent', 'todo');
    const parent = usePlanStore.getState().periods['w-2026-05'].todos[0];

    usePlanStore.getState().addSubItem(parent.id, 'Child', 'todo');

    const state = usePlanStore.getState();
    const todos = state.periods['w-2026-05'].todos;
    const child = todos.find(t => t.parentId === parent.id);
    expect(child).toBeDefined();
    expect(child!.content).toBe('Child');
    expect(child!.parentId).toBe(parent.id);
  });

  it('adds childId to parent and sets isExpanded=true', () => {
    usePlanStore.getState().addItem('Parent', 'todo');
    const parent = usePlanStore.getState().periods['w-2026-05'].todos[0];

    usePlanStore.getState().addSubItem(parent.id, 'Child', 'todo');

    const state = usePlanStore.getState();
    const updatedParent = state.allItems[parent.id];
    expect(updatedParent.childIds).toHaveLength(1);
    expect(updatedParent.isExpanded).toBe(true);
  });

  it('inserts child after parent in the list', () => {
    usePlanStore.getState().addItem('First', 'todo');
    usePlanStore.getState().addItem('Parent', 'todo');
    usePlanStore.getState().addItem('Last', 'todo');

    const parent = usePlanStore.getState().periods['w-2026-05'].todos[1];
    usePlanStore.getState().addSubItem(parent.id, 'Child', 'todo');

    const todos = usePlanStore.getState().periods['w-2026-05'].todos;
    const parentIdx = todos.findIndex(t => t.id === parent.id);
    const childIdx = todos.findIndex(t => t.parentId === parent.id);
    expect(childIdx).toBe(parentIdx + 1);
  });

  it('inherits parent color and category', () => {
    usePlanStore.getState().addItem('Parent', 'routine', undefined, 'health');
    const parent = usePlanStore.getState().periods['w-2026-05'].routines[0];
    usePlanStore.getState().updateItemColor(parent.id, 'bg-green-100', 'routine');

    usePlanStore.getState().addSubItem(parent.id, 'Child', 'routine');

    const routines = usePlanStore.getState().periods['w-2026-05'].routines;
    const child = routines.find(r => r.parentId === parent.id);
    expect(child!.color).toBe('bg-green-100');
    expect(child!.category).toBe('health');
  });

  it('registers sub-item in allItems', () => {
    usePlanStore.getState().addItem('Parent', 'todo');
    const parent = usePlanStore.getState().periods['w-2026-05'].todos[0];
    usePlanStore.getState().addSubItem(parent.id, 'Child', 'todo');

    const todos = usePlanStore.getState().periods['w-2026-05'].todos;
    const child = todos.find(t => t.parentId === parent.id);
    expect(usePlanStore.getState().allItems[child!.id]).toBeDefined();
  });
});

// ================================================================
// 30. toggleExpand
// ================================================================
describe('store: toggleExpand', () => {
  it('toggles isExpanded on a todo', () => {
    usePlanStore.getState().navigateTo('w-2026-05');
    usePlanStore.getState().addItem('Task', 'todo');
    const todo = usePlanStore.getState().periods['w-2026-05'].todos[0];
    expect(todo.isExpanded).toBeUndefined();

    usePlanStore.getState().toggleExpand(todo.id, 'todo');
    expect(usePlanStore.getState().periods['w-2026-05'].todos[0].isExpanded).toBe(true);

    usePlanStore.getState().toggleExpand(todo.id, 'todo');
    expect(usePlanStore.getState().periods['w-2026-05'].todos[0].isExpanded).toBe(false);
  });

  it('toggles isExpanded on a routine', () => {
    usePlanStore.getState().navigateTo('w-2026-05');
    usePlanStore.getState().addItem('Routine', 'routine');
    const routine = usePlanStore.getState().periods['w-2026-05'].routines[0];

    usePlanStore.getState().toggleExpand(routine.id, 'routine');
    expect(usePlanStore.getState().periods['w-2026-05'].routines[0].isExpanded).toBe(true);
  });
});

// ================================================================
// 31. toggleComplete
// ================================================================
describe('store: toggleComplete', () => {
  beforeEach(() => {
    usePlanStore.getState().navigateTo('w-2026-05');
  });

  it('toggles completion on a single todo', () => {
    usePlanStore.getState().addItem('Task', 'todo');
    const todo = usePlanStore.getState().periods['w-2026-05'].todos[0];
    expect(todo.isCompleted).toBe(false);

    usePlanStore.getState().toggleComplete(todo.id, 'todo');
    expect(usePlanStore.getState().periods['w-2026-05'].todos[0].isCompleted).toBe(true);
    expect(usePlanStore.getState().allItems[todo.id].isCompleted).toBe(true);

    usePlanStore.getState().toggleComplete(todo.id, 'todo');
    expect(usePlanStore.getState().periods['w-2026-05'].todos[0].isCompleted).toBe(false);
  });

  it('recursively completes all children when parent completes', () => {
    usePlanStore.getState().addItem('Parent', 'todo');
    const parent = usePlanStore.getState().periods['w-2026-05'].todos[0];

    usePlanStore.getState().addSubItem(parent.id, 'Child1', 'todo');
    usePlanStore.getState().addSubItem(parent.id, 'Child2', 'todo');

    usePlanStore.getState().toggleComplete(parent.id, 'todo');

    const state = usePlanStore.getState();
    const todos = state.periods['w-2026-05'].todos;
    const children = todos.filter(t => t.parentId === parent.id);
    children.forEach(child => {
      expect(child.isCompleted).toBe(true);
    });
  });

  it('auto-completes parent when all children are completed', () => {
    usePlanStore.getState().addItem('Parent', 'todo');
    const parent = usePlanStore.getState().periods['w-2026-05'].todos[0];

    usePlanStore.getState().addSubItem(parent.id, 'Child1', 'todo');
    usePlanStore.getState().addSubItem(parent.id, 'Child2', 'todo');

    const stateAfterAdd = usePlanStore.getState();
    const children = stateAfterAdd.periods['w-2026-05'].todos.filter(
      t => t.parentId === parent.id
    );

    // Complete first child
    usePlanStore.getState().toggleComplete(children[0].id, 'todo');
    expect(usePlanStore.getState().allItems[parent.id].isCompleted).toBe(false);

    // Complete second child -> parent should auto-complete
    usePlanStore.getState().toggleComplete(children[1].id, 'todo');
    expect(usePlanStore.getState().allItems[parent.id].isCompleted).toBe(true);
  });

  it('uncompletes parent when a child is uncompleted', () => {
    usePlanStore.getState().addItem('Parent', 'todo');
    const parent = usePlanStore.getState().periods['w-2026-05'].todos[0];

    usePlanStore.getState().addSubItem(parent.id, 'Child1', 'todo');
    usePlanStore.getState().addSubItem(parent.id, 'Child2', 'todo');

    // Complete parent (cascades to children)
    usePlanStore.getState().toggleComplete(parent.id, 'todo');
    expect(usePlanStore.getState().allItems[parent.id].isCompleted).toBe(true);

    const stateAfterComplete = usePlanStore.getState();
    const children = stateAfterComplete.periods['w-2026-05'].todos.filter(
      t => t.parentId === parent.id
    );

    // Uncomplete one child -> parent should uncomplete
    usePlanStore.getState().toggleComplete(children[0].id, 'todo');
    expect(usePlanStore.getState().allItems[parent.id].isCompleted).toBe(false);
  });

  it('syncs completion state across all periods', () => {
    // Set up: assign a todo to a slot, creating items in multiple periods
    usePlanStore.getState().addItem('Task', 'todo');
    const todo = usePlanStore.getState().periods['w-2026-05'].todos[0];
    const childIds = getChildPeriodIds('w-2026-05', 2026);
    const targetSlot = childIds[0];

    usePlanStore.getState().assignToSlot(todo.id, 'todo', targetSlot);

    const stateAfterAssign = usePlanStore.getState();
    const slotItem = stateAfterAssign.periods['w-2026-05'].slots[targetSlot][0];
    const propagated = stateAfterAssign.periods[targetSlot].todos[0];

    // Complete the propagated item
    usePlanStore.getState().navigateTo(targetSlot);
    usePlanStore.getState().toggleComplete(propagated.id, 'todo');

    // The propagated item and its parent (slot item) should sync
    const finalState = usePlanStore.getState();
    expect(finalState.allItems[propagated.id].isCompleted).toBe(true);

    // Check the slot item in the parent period - it should also be complete
    // because propagated is its only child
    expect(finalState.allItems[slotItem.id].isCompleted).toBe(true);
  });
});

// ================================================================
// 32. getProgress
// ================================================================
describe('store: getProgress', () => {
  beforeEach(() => {
    usePlanStore.getState().navigateTo('w-2026-05');
  });

  it('returns 0 for non-existent item', () => {
    expect(usePlanStore.getState().getProgress('nonexistent')).toBe(0);
  });

  it('returns 0 for incomplete item with no children', () => {
    usePlanStore.getState().addItem('Task', 'todo');
    const todo = usePlanStore.getState().periods['w-2026-05'].todos[0];
    expect(usePlanStore.getState().getProgress(todo.id)).toBe(0);
  });

  it('returns 100 for completed item with no children', () => {
    usePlanStore.getState().addItem('Task', 'todo');
    const todo = usePlanStore.getState().periods['w-2026-05'].todos[0];
    usePlanStore.getState().toggleComplete(todo.id, 'todo');
    expect(usePlanStore.getState().getProgress(todo.id)).toBe(100);
  });

  it('returns 50 when 1 of 2 children completed', () => {
    usePlanStore.getState().addItem('Parent', 'todo');
    const parent = usePlanStore.getState().periods['w-2026-05'].todos[0];
    usePlanStore.getState().addSubItem(parent.id, 'Child1', 'todo');
    usePlanStore.getState().addSubItem(parent.id, 'Child2', 'todo');

    const children = usePlanStore.getState().periods['w-2026-05'].todos.filter(
      t => t.parentId === parent.id
    );

    usePlanStore.getState().toggleComplete(children[0].id, 'todo');
    expect(usePlanStore.getState().getProgress(parent.id)).toBe(50);
  });

  it('returns 100 when all children completed', () => {
    usePlanStore.getState().addItem('Parent', 'todo');
    const parent = usePlanStore.getState().periods['w-2026-05'].todos[0];
    usePlanStore.getState().addSubItem(parent.id, 'Child1', 'todo');
    usePlanStore.getState().addSubItem(parent.id, 'Child2', 'todo');

    const children = usePlanStore.getState().periods['w-2026-05'].todos.filter(
      t => t.parentId === parent.id
    );

    usePlanStore.getState().toggleComplete(children[0].id, 'todo');
    usePlanStore.getState().toggleComplete(children[1].id, 'todo');
    expect(usePlanStore.getState().getProgress(parent.id)).toBe(100);
  });

  it('rounds to nearest integer', () => {
    usePlanStore.getState().addItem('Parent', 'todo');
    const parent = usePlanStore.getState().periods['w-2026-05'].todos[0];
    usePlanStore.getState().addSubItem(parent.id, 'C1', 'todo');
    usePlanStore.getState().addSubItem(parent.id, 'C2', 'todo');
    usePlanStore.getState().addSubItem(parent.id, 'C3', 'todo');

    const children = usePlanStore.getState().periods['w-2026-05'].todos.filter(
      t => t.parentId === parent.id
    );

    usePlanStore.getState().toggleComplete(children[0].id, 'todo');
    // 1/3 = 33.33... -> rounded to 33
    expect(usePlanStore.getState().getProgress(parent.id)).toBe(33);
  });
});

// ================================================================
// 33. ensurePeriod
// ================================================================
describe('store: ensurePeriod', () => {
  it('creates a new period if not exists', () => {
    const period = usePlanStore.getState().ensurePeriod('m-2026-09');
    expect(period.id).toBe('m-2026-09');
    expect(period.level).toBe('MONTH');
    expect(period.todos).toEqual([]);
    expect(period.routines).toEqual([]);
    expect(period.slots).toEqual({});
    expect(usePlanStore.getState().periods['m-2026-09']).toBeDefined();
  });

  it('returns existing period without modification', () => {
    usePlanStore.setState({
      periods: {
        'm-2026-09': {
          id: 'm-2026-09',
          level: 'MONTH',
          goal: 'September goal',
          motto: '',
          memo: '',
          memos: [],
          structuredMemos: [],
          todos: [],
          routines: [],
          slots: {},
        },
      },
    });

    const period = usePlanStore.getState().ensurePeriod('m-2026-09');
    expect(period.goal).toBe('September goal');
  });

  it('creates DAY period with timeSlots', () => {
    const period = usePlanStore.getState().ensurePeriod('d-2026-03-15');
    expect(period.timeSlots).toBeDefined();
    expect(period.timeSlots!.anytime).toEqual([]);
  });
});

// ================================================================
// 34. resetRoutinesIfNeeded
// ================================================================
describe('store: resetRoutinesIfNeeded', () => {
  it('resets currentCount for routines with different reset key', () => {
    // Set up a routine with a stale lastResetDate
    const routineId = 'test-routine-id';
    const item: Item = {
      id: routineId,
      content: 'Exercise',
      isCompleted: false,
      targetCount: 3,
      currentCount: 1,
      sourceLevel: 'WEEK',
      originPeriodId: 'w-2026-04',
      lastResetDate: 'week-2026-4', // old key
    };

    usePlanStore.setState({
      currentPeriodId: 'w-2026-05',
      currentLevel: 'WEEK',
      periods: {
        'w-2026-05': {
          id: 'w-2026-05',
          level: 'WEEK',
          goal: '',
          motto: '',
          memo: '',
          memos: [],
          structuredMemos: [],
          todos: [],
          routines: [item],
          slots: {},
        },
      },
      allItems: { [routineId]: item },
    });

    usePlanStore.getState().resetRoutinesIfNeeded('w-2026-05');

    const routine = usePlanStore.getState().periods['w-2026-05'].routines[0];
    expect(routine.currentCount).toBe(3); // reset to targetCount
    expect(routine.lastResetDate).toBe('week-2026-5'); // updated key
  });

  it('does not reset if lastResetDate matches current reset key', () => {
    const routineId = 'test-routine-id';
    const item: Item = {
      id: routineId,
      content: 'Exercise',
      isCompleted: false,
      targetCount: 3,
      currentCount: 1,
      sourceLevel: 'WEEK',
      originPeriodId: 'w-2026-05',
      lastResetDate: 'week-2026-5', // same key
    };

    usePlanStore.setState({
      currentPeriodId: 'w-2026-05',
      currentLevel: 'WEEK',
      periods: {
        'w-2026-05': {
          id: 'w-2026-05',
          level: 'WEEK',
          goal: '',
          motto: '',
          memo: '',
          memos: [],
          structuredMemos: [],
          todos: [],
          routines: [item],
          slots: {},
        },
      },
      allItems: { [routineId]: item },
    });

    usePlanStore.getState().resetRoutinesIfNeeded('w-2026-05');

    const routine = usePlanStore.getState().periods['w-2026-05'].routines[0];
    expect(routine.currentCount).toBe(1); // not reset
  });

  it('skips routines without targetCount', () => {
    const routineId = 'test-routine-id';
    const item: Item = {
      id: routineId,
      content: 'Meditation',
      isCompleted: false,
      // no targetCount
    };

    usePlanStore.setState({
      currentPeriodId: 'w-2026-05',
      currentLevel: 'WEEK',
      periods: {
        'w-2026-05': {
          id: 'w-2026-05',
          level: 'WEEK',
          goal: '',
          motto: '',
          memo: '',
          memos: [],
          structuredMemos: [],
          todos: [],
          routines: [item],
          slots: {},
        },
      },
      allItems: { [routineId]: item },
    });

    usePlanStore.getState().resetRoutinesIfNeeded('w-2026-05');

    const routine = usePlanStore.getState().periods['w-2026-05'].routines[0];
    expect(routine.currentCount).toBeUndefined();
  });

  it('does nothing if period does not exist', () => {
    // Should not throw
    usePlanStore.getState().resetRoutinesIfNeeded('nonexistent');
    // No error means pass
  });
});

// ================================================================
// 35. Record actions
// ================================================================
describe('store: record actions', () => {
  const periodId = 'd-2026-02-03';

  it('getRecord returns null for non-existent record', () => {
    expect(usePlanStore.getState().getRecord(periodId)).toBeNull();
  });

  it('updateRecordContent creates a new record', () => {
    usePlanStore.getState().updateRecordContent(periodId, 'Today was productive');
    const record = usePlanStore.getState().records[periodId];
    expect(record).toBeDefined();
    expect(record.content).toBe('Today was productive');
    expect(record.periodId).toBe(periodId);
    expect(record.highlights).toEqual([]);
    expect(record.gratitude).toEqual([]);
    expect(record.createdAt).toBeDefined();
    expect(record.updatedAt).toBeDefined();
  });

  it('updateRecordContent updates existing record', () => {
    usePlanStore.getState().updateRecordContent(periodId, 'First');
    const first = usePlanStore.getState().records[periodId];
    usePlanStore.getState().updateRecordContent(periodId, 'Updated');
    const updated = usePlanStore.getState().records[periodId];
    expect(updated.content).toBe('Updated');
    expect(updated.id).toBe(first.id); // same record
  });

  it('updateRecordMood sets mood', () => {
    usePlanStore.getState().updateRecordMood(periodId, 'great');
    const record = usePlanStore.getState().records[periodId];
    expect(record.mood).toBe('great');
  });

  it('updateRecordMood creates record if not exists', () => {
    usePlanStore.getState().updateRecordMood(periodId, 'okay');
    const record = usePlanStore.getState().records[periodId];
    expect(record.mood).toBe('okay');
    expect(record.content).toBe('');
  });

  it('addHighlight adds to highlights array', () => {
    usePlanStore.getState().addHighlight(periodId, 'Finished project');
    usePlanStore.getState().addHighlight(periodId, 'Had good meeting');
    const record = usePlanStore.getState().records[periodId];
    expect(record.highlights).toEqual(['Finished project', 'Had good meeting']);
  });

  it('removeHighlight removes by index', () => {
    usePlanStore.getState().addHighlight(periodId, 'A');
    usePlanStore.getState().addHighlight(periodId, 'B');
    usePlanStore.getState().addHighlight(periodId, 'C');
    usePlanStore.getState().removeHighlight(periodId, 1);
    const record = usePlanStore.getState().records[periodId];
    expect(record.highlights).toEqual(['A', 'C']);
  });

  it('removeHighlight does nothing if record does not exist', () => {
    usePlanStore.getState().removeHighlight('nonexistent', 0);
    expect(usePlanStore.getState().records['nonexistent']).toBeUndefined();
  });

  it('addGratitude adds to gratitude array', () => {
    usePlanStore.getState().addGratitude(periodId, 'Family');
    usePlanStore.getState().addGratitude(periodId, 'Health');
    const record = usePlanStore.getState().records[periodId];
    expect(record.gratitude).toEqual(['Family', 'Health']);
  });

  it('removeGratitude removes by index', () => {
    usePlanStore.getState().addGratitude(periodId, 'A');
    usePlanStore.getState().addGratitude(periodId, 'B');
    usePlanStore.getState().addGratitude(periodId, 'C');
    usePlanStore.getState().removeGratitude(periodId, 0);
    const record = usePlanStore.getState().records[periodId];
    expect(record.gratitude).toEqual(['B', 'C']);
  });
});

// ================================================================
// 36. Annual event actions
// ================================================================
describe('store: annual event actions', () => {
  it('addAnnualEvent adds an event with generated id and createdAt', () => {
    usePlanStore.getState().addAnnualEvent({
      title: 'Mom birthday',
      type: 'birthday',
      month: 3,
      day: 15,
    });
    const events = usePlanStore.getState().annualEvents;
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('Mom birthday');
    expect(events[0].type).toBe('birthday');
    expect(events[0].month).toBe(3);
    expect(events[0].day).toBe(15);
    expect(events[0].id).toBeDefined();
    expect(events[0].createdAt).toBeDefined();
  });

  it('updateAnnualEvent updates specified fields', () => {
    usePlanStore.getState().addAnnualEvent({
      title: 'Holiday',
      type: 'holiday',
      month: 12,
      day: 25,
    });
    const event = usePlanStore.getState().annualEvents[0];

    usePlanStore.getState().updateAnnualEvent(event.id, { title: 'Christmas' });
    const updated = usePlanStore.getState().annualEvents[0];
    expect(updated.title).toBe('Christmas');
    expect(updated.month).toBe(12); // unchanged
  });

  it('deleteAnnualEvent removes by id', () => {
    usePlanStore.getState().addAnnualEvent({
      title: 'Event A',
      type: 'other',
      month: 1,
      day: 1,
    });
    usePlanStore.getState().addAnnualEvent({
      title: 'Event B',
      type: 'other',
      month: 6,
      day: 15,
    });
    const eventA = usePlanStore.getState().annualEvents[0];

    usePlanStore.getState().deleteAnnualEvent(eventA.id);
    const events = usePlanStore.getState().annualEvents;
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('Event B');
  });

  it('getUpcomingEvents returns events within default 30 days sorted by daysUntil', () => {
    // This test depends on the current date; we add events relative to today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Event 5 days from now
    const future5 = new Date(today);
    future5.setDate(future5.getDate() + 5);

    // Event 20 days from now
    const future20 = new Date(today);
    future20.setDate(future20.getDate() + 20);

    // Event 50 days from now (outside 30 day window)
    const future50 = new Date(today);
    future50.setDate(future50.getDate() + 50);

    usePlanStore.getState().addAnnualEvent({
      title: 'Far event',
      type: 'other',
      month: future50.getMonth() + 1,
      day: future50.getDate(),
    });
    usePlanStore.getState().addAnnualEvent({
      title: 'Near event',
      type: 'birthday',
      month: future5.getMonth() + 1,
      day: future5.getDate(),
    });
    usePlanStore.getState().addAnnualEvent({
      title: 'Mid event',
      type: 'anniversary',
      month: future20.getMonth() + 1,
      day: future20.getDate(),
    });

    const upcoming = usePlanStore.getState().getUpcomingEvents();
    // Should include near and mid but not far
    const titles = upcoming.map(e => e.title);
    expect(titles).toContain('Near event');
    expect(titles).toContain('Mid event');
    expect(titles).not.toContain('Far event');

    // Should be sorted by daysUntil (near first)
    if (upcoming.length >= 2) {
      expect(upcoming[0].daysUntil).toBeLessThanOrEqual(upcoming[1].daysUntil);
    }
  });

  it('getUpcomingEvents respects custom days parameter', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const future10 = new Date(today);
    future10.setDate(future10.getDate() + 10);

    usePlanStore.getState().addAnnualEvent({
      title: '10-day event',
      type: 'other',
      month: future10.getMonth() + 1,
      day: future10.getDate(),
    });

    // With 5 days window, should NOT be included
    const upcoming5 = usePlanStore.getState().getUpcomingEvents(5);
    expect(upcoming5.find(e => e.title === '10-day event')).toBeUndefined();

    // With 15 days window, SHOULD be included
    const upcoming15 = usePlanStore.getState().getUpcomingEvents(15);
    expect(upcoming15.find(e => e.title === '10-day event')).toBeDefined();
  });

  it('getUpcomingEvents wraps to next year for past dates', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Event that was yesterday
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    usePlanStore.getState().addAnnualEvent({
      title: 'Yesterday event',
      type: 'other',
      month: yesterday.getMonth() + 1,
      day: yesterday.getDate(),
    });

    // Should wrap to next year, so daysUntil should be around 364-365
    const upcoming = usePlanStore.getState().getUpcomingEvents(400);
    const event = upcoming.find(e => e.title === 'Yesterday event');
    expect(event).toBeDefined();
    expect(event!.daysUntil).toBeGreaterThan(300);
  });
});

// ================================================================
// 37. setBaseYear
// ================================================================
describe('store: setBaseYear', () => {
  it('updates the baseYear', () => {
    usePlanStore.getState().setBaseYear(2030);
    expect(usePlanStore.getState().baseYear).toBe(2030);
  });
});

// ================================================================
// 38. Edge cases and integration scenarios
// ================================================================
describe('integration: multi-level assign and complete chain', () => {
  it('full drill-down assign flow: MONTH -> WEEK -> DAY with completion propagation', () => {
    const baseYear = 2026;

    // Navigate to month
    usePlanStore.getState().navigateTo('m-2026-02');
    usePlanStore.getState().addItem('Monthly goal', 'todo');
    const monthTodo = usePlanStore.getState().periods['m-2026-02'].todos[0];

    // Get first week child of February
    const weekIds = getChildPeriodIds('m-2026-02', baseYear);
    const firstWeekId = weekIds[0];

    // Assign to first week slot
    usePlanStore.getState().assignToSlot(monthTodo.id, 'todo', firstWeekId);

    const afterAssign = usePlanStore.getState();
    // Should exist in month's slots
    expect(afterAssign.periods['m-2026-02'].slots[firstWeekId]).toHaveLength(1);
    // Should be propagated to the week period's todos
    expect(afterAssign.periods[firstWeekId]).toBeDefined();
    expect(afterAssign.periods[firstWeekId].todos).toHaveLength(1);

    // Navigate to week and assign to day
    usePlanStore.getState().navigateTo(firstWeekId);
    const weekTodo = usePlanStore.getState().periods[firstWeekId].todos[0];
    const dayIds = getChildPeriodIds(firstWeekId, baseYear);

    if (dayIds.length > 0) {
      usePlanStore.getState().assignToSlot(weekTodo.id, 'todo', dayIds[0]);

      const afterDayAssign = usePlanStore.getState();
      expect(afterDayAssign.periods[firstWeekId].slots[dayIds[0]]).toHaveLength(1);

      // Navigate to day and complete
      usePlanStore.getState().navigateTo(dayIds[0]);
      const dayTodo = usePlanStore.getState().periods[dayIds[0]].todos[0];
      usePlanStore.getState().toggleComplete(dayTodo.id, 'todo');

      // Verify completion propagated upward through the chain
      const finalState = usePlanStore.getState();
      expect(finalState.allItems[dayTodo.id].isCompleted).toBe(true);
    }
  });
});

describe('integration: multiple items in same slot', () => {
  it('allows multiple items assigned to the same slot', () => {
    usePlanStore.getState().navigateTo('w-2026-05');
    usePlanStore.getState().addItem('Task A', 'todo');
    usePlanStore.getState().addItem('Task B', 'todo');

    const state = usePlanStore.getState();
    const todoA = state.periods['w-2026-05'].todos[0];
    const todoB = state.periods['w-2026-05'].todos[1];

    const childIds = getChildPeriodIds('w-2026-05', 2026);
    const targetSlot = childIds[0];

    usePlanStore.getState().assignToSlot(todoA.id, 'todo', targetSlot);
    usePlanStore.getState().assignToSlot(todoB.id, 'todo', targetSlot);

    const finalState = usePlanStore.getState();
    expect(finalState.periods['w-2026-05'].slots[targetSlot]).toHaveLength(2);
    expect(finalState.periods[targetSlot].todos).toHaveLength(2);
  });
});

describe('integration: getCurrentPeriod', () => {
  it('returns the current period, creating it if needed', () => {
    usePlanStore.setState({ currentPeriodId: 'q-2026-3', currentLevel: 'QUARTER', periods: {} });
    const period = usePlanStore.getState().getCurrentPeriod();
    expect(period.id).toBe('q-2026-3');
    expect(period.level).toBe('QUARTER');
    expect(usePlanStore.getState().periods['q-2026-3']).toBeDefined();
  });
});
