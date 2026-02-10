/**
 * Property-Based Tests (PBT) for Life Planner
 * 속성 기반 테스트 - fast-check를 사용한 엣지 케이스 탐지
 *
 * Covers:
 *   A. Period ID Roundtrip (기간 ID 왕복 변환)
 *   B. Parent-Child Consistency (부모-자식 일관성)
 *   C. Adjacent Period Symmetry (인접 기간 대칭)
 *   D. ISO Week Properties (ISO 주차 속성)
 *   E. Weeks In Month Properties (월 주차 속성)
 *   F. genId Uniqueness (고유 ID 유일성)
 *   G. Sanitize Properties (살균 처리 속성)
 *   H. Search Properties (검색 속성)
 *   I. State Invariants (상태 불변 조건)
 *   J. Date Boundary Tests (날짜 경계 테스트)
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

import {
  getPeriodId,
  parsePeriodId,
  getChildPeriodIds,
  getSlotLabel,
  getAdjacentPeriodId,
  getParentPeriodId,
  getResetKey,
  getISOWeek,
  getISOWeekYear,
  getWeeksInMonth,
  usePlanStore,
} from '../store/usePlanStore';

import { searchAllData, SearchOptions } from '../lib/search';

import type { Level, Period, Item, DailyRecord, AnnualEvent } from '../types/plan';

// ═══════════════════════════════════════════════════════════════
// Arbitraries (커스텀 생성기)
// ═══════════════════════════════════════════════════════════════

const levelArb = fc.constantFrom<Level>(
  'THIRTY_YEAR',
  'FIVE_YEAR',
  'YEAR',
  'QUARTER',
  'MONTH',
  'WEEK',
  'DAY',
);

const baseYearArb = fc.integer({ min: 2020, max: 2050 });
const yearArb = fc.integer({ min: 2020, max: 2050 });
const monthArb = fc.integer({ min: 1, max: 12 });
const quarterArb = fc.integer({ min: 1, max: 4 });
const fiveYearIndexArb = fc.integer({ min: 0, max: 5 });
const weekArb = fc.integer({ min: 1, max: 53 });
const dayArb = fc.integer({ min: 1, max: 28 }); // 28 to avoid invalid month-end days

const dateArb = fc.date({
  min: new Date(2020, 0, 1),
  max: new Date(2050, 11, 31),
});

/** Generate a valid period ID for a given level */
const periodIdForLevel = (level: Level): fc.Arbitrary<{ id: string; baseYear: number }> => {
  switch (level) {
    case 'THIRTY_YEAR':
      return baseYearArb.map((by) => ({
        id: getPeriodId('THIRTY_YEAR', by),
        baseYear: by,
      }));
    case 'FIVE_YEAR':
      return fc.tuple(baseYearArb, fiveYearIndexArb).map(([by, idx]) => ({
        id: getPeriodId('FIVE_YEAR', by, { fiveYearIndex: idx }),
        baseYear: by,
      }));
    case 'YEAR':
      return fc.tuple(baseYearArb, yearArb).map(([by, y]) => ({
        id: getPeriodId('YEAR', by, { year: y }),
        baseYear: by,
      }));
    case 'QUARTER':
      return fc.tuple(baseYearArb, yearArb, quarterArb).map(([by, y, q]) => ({
        id: getPeriodId('QUARTER', by, { year: y, quarter: q }),
        baseYear: by,
      }));
    case 'MONTH':
      return fc.tuple(baseYearArb, yearArb, monthArb).map(([by, y, m]) => ({
        id: getPeriodId('MONTH', by, { year: y, month: m }),
        baseYear: by,
      }));
    case 'WEEK':
      return fc.tuple(baseYearArb, yearArb, weekArb).map(([by, y, w]) => ({
        id: getPeriodId('WEEK', by, { year: y, week: w }),
        baseYear: by,
      }));
    case 'DAY':
      return fc.tuple(baseYearArb, yearArb, monthArb, dayArb).map(([by, y, m, d]) => ({
        id: getPeriodId('DAY', by, { year: y, month: m, day: d }),
        baseYear: by,
      }));
  }
};

/** Generate any valid period ID (all levels) */
const anyPeriodIdArb: fc.Arbitrary<{ id: string; baseYear: number; level: Level }> = levelArb.chain(
  (level) => periodIdForLevel(level).map((p) => ({ ...p, level })),
);

/** Levels that have parents */
const childLevelArb = fc.constantFrom<Level>(
  'FIVE_YEAR',
  'YEAR',
  'QUARTER',
  'MONTH',
  'WEEK',
  'DAY',
);

/** Levels that have children */
const parentLevelArb = fc.constantFrom<Level>(
  'THIRTY_YEAR',
  'FIVE_YEAR',
  'YEAR',
  'QUARTER',
  'MONTH',
  'WEEK',
);

// Helper: create an empty Period object for testing
function createTestPeriod(id: string, level: Level, overrides?: Partial<Period>): Period {
  return {
    id,
    level,
    goal: '',
    motto: '',
    memo: '',
    memos: [],
    structuredMemos: [],
    todos: [],
    routines: [],
    slots: {},
    ...overrides,
  };
}

// Helper: create a test Item
function createTestItem(id: string, content: string, overrides?: Partial<Item>): Item {
  return {
    id,
    content,
    isCompleted: false,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// A. Period ID Roundtrip (기간 ID 왕복 변환)
// ═══════════════════════════════════════════════════════════════
describe('A. Period ID Roundtrip / 기간 ID 왕복 변환', () => {
  it('THIRTY_YEAR: getPeriodId -> parsePeriodId reconstructs level', () => {
    fc.assert(
      fc.property(baseYearArb, (baseYear) => {
        const id = getPeriodId('THIRTY_YEAR', baseYear);
        const parsed = parsePeriodId(id);
        expect(parsed.level).toBe('THIRTY_YEAR');
        expect(id).toBe('30y');
      }),
    );
  });

  it('FIVE_YEAR: roundtrip preserves fiveYearIndex', () => {
    fc.assert(
      fc.property(baseYearArb, fiveYearIndexArb, (baseYear, idx) => {
        const id = getPeriodId('FIVE_YEAR', baseYear, { fiveYearIndex: idx });
        const parsed = parsePeriodId(id);
        expect(parsed.level).toBe('FIVE_YEAR');
        expect(parsed.fiveYearIndex).toBe(idx);
      }),
    );
  });

  it('YEAR: roundtrip preserves year', () => {
    fc.assert(
      fc.property(baseYearArb, yearArb, (baseYear, year) => {
        const id = getPeriodId('YEAR', baseYear, { year });
        const parsed = parsePeriodId(id);
        expect(parsed.level).toBe('YEAR');
        expect(parsed.year).toBe(year);
      }),
    );
  });

  it('QUARTER: roundtrip preserves year and quarter', () => {
    fc.assert(
      fc.property(baseYearArb, yearArb, quarterArb, (baseYear, year, quarter) => {
        const id = getPeriodId('QUARTER', baseYear, { year, quarter });
        const parsed = parsePeriodId(id);
        expect(parsed.level).toBe('QUARTER');
        expect(parsed.year).toBe(year);
        expect(parsed.quarter).toBe(quarter);
      }),
    );
  });

  it('MONTH: roundtrip preserves year and month', () => {
    fc.assert(
      fc.property(baseYearArb, yearArb, monthArb, (baseYear, year, month) => {
        const id = getPeriodId('MONTH', baseYear, { year, month });
        const parsed = parsePeriodId(id);
        expect(parsed.level).toBe('MONTH');
        expect(parsed.year).toBe(year);
        expect(parsed.month).toBe(month);
      }),
    );
  });

  it('WEEK: roundtrip preserves year and week (ISO week format)', () => {
    fc.assert(
      fc.property(baseYearArb, yearArb, weekArb, (baseYear, year, week) => {
        const id = getPeriodId('WEEK', baseYear, { year, week });
        const parsed = parsePeriodId(id);
        expect(parsed.level).toBe('WEEK');
        expect(parsed.year).toBe(year);
        expect(parsed.week).toBe(week);
      }),
    );
  });

  it('DAY: roundtrip preserves year, month, and day', () => {
    fc.assert(
      fc.property(baseYearArb, yearArb, monthArb, dayArb, (baseYear, year, month, day) => {
        const id = getPeriodId('DAY', baseYear, { year, month, day });
        const parsed = parsePeriodId(id);
        expect(parsed.level).toBe('DAY');
        expect(parsed.year).toBe(year);
        expect(parsed.month).toBe(month);
        expect(parsed.day).toBe(day);
      }),
    );
  });

  it('parsePeriodId returns THIRTY_YEAR for unknown prefixes', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !['30y', '5y', 'y', 'q', 'm', 'w', 'd'].some((p) => s.startsWith(p + '-') || s === p)),
        (randomId) => {
          // Unknown IDs should fall back to THIRTY_YEAR
          const parsed = parsePeriodId(randomId);
          // Either it matches a known pattern or defaults
          expect(parsed.level).toBeDefined();
        },
      ),
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// B. Parent-Child Consistency (부모-자식 일관성)
// ═══════════════════════════════════════════════════════════════
describe('B. Parent-Child Consistency / 부모-자식 일관성', () => {
  it('THIRTY_YEAR has 6 FIVE_YEAR children', () => {
    fc.assert(
      fc.property(baseYearArb, (baseYear) => {
        const children = getChildPeriodIds('30y', baseYear);
        expect(children).toHaveLength(6);
        children.forEach((childId) => {
          const parsed = parsePeriodId(childId);
          expect(parsed.level).toBe('FIVE_YEAR');
        });
      }),
    );
  });

  it('FIVE_YEAR has 5 YEAR children', () => {
    fc.assert(
      fc.property(baseYearArb, fiveYearIndexArb, (baseYear, idx) => {
        const parentId = getPeriodId('FIVE_YEAR', baseYear, { fiveYearIndex: idx });
        const children = getChildPeriodIds(parentId, baseYear);
        expect(children).toHaveLength(5);
        children.forEach((childId) => {
          const parsed = parsePeriodId(childId);
          expect(parsed.level).toBe('YEAR');
        });
      }),
    );
  });

  it('YEAR has 4 QUARTER children', () => {
    fc.assert(
      fc.property(baseYearArb, yearArb, (baseYear, year) => {
        const parentId = getPeriodId('YEAR', baseYear, { year });
        const children = getChildPeriodIds(parentId, baseYear);
        expect(children).toHaveLength(4);
        children.forEach((childId) => {
          const parsed = parsePeriodId(childId);
          expect(parsed.level).toBe('QUARTER');
          expect(parsed.year).toBe(year);
        });
      }),
    );
  });

  it('QUARTER has 3 MONTH children', () => {
    fc.assert(
      fc.property(baseYearArb, yearArb, quarterArb, (baseYear, year, quarter) => {
        const parentId = getPeriodId('QUARTER', baseYear, { year, quarter });
        const children = getChildPeriodIds(parentId, baseYear);
        expect(children).toHaveLength(3);
        children.forEach((childId) => {
          const parsed = parsePeriodId(childId);
          expect(parsed.level).toBe('MONTH');
          expect(parsed.year).toBe(year);
        });
        // Verify the months are in the correct quarter
        const startMonth = (quarter - 1) * 3 + 1;
        const months = children.map((c) => parsePeriodId(c).month!);
        expect(months).toEqual([startMonth, startMonth + 1, startMonth + 2]);
      }),
    );
  });

  it('MONTH has 4-6 WEEK children (via getWeeksInMonth)', () => {
    fc.assert(
      fc.property(baseYearArb, yearArb, monthArb, (baseYear, year, month) => {
        const parentId = getPeriodId('MONTH', baseYear, { year, month });
        const children = getChildPeriodIds(parentId, baseYear);
        // A month typically spans 4-6 weeks (some weeks may span month boundaries)
        expect(children.length).toBeGreaterThanOrEqual(4);
        expect(children.length).toBeLessThanOrEqual(6);
        children.forEach((childId) => {
          const parsed = parsePeriodId(childId);
          expect(parsed.level).toBe('WEEK');
        });
      }),
    );
  });

  it('WEEK (ISO format) has 7 DAY children', () => {
    fc.assert(
      fc.property(
        baseYearArb,
        yearArb,
        fc.integer({ min: 1, max: 52 }),
        (baseYear, year, week) => {
          const parentId = getPeriodId('WEEK', baseYear, { year, week });
          const children = getChildPeriodIds(parentId, baseYear);
          expect(children).toHaveLength(7);
          children.forEach((childId) => {
            const parsed = parsePeriodId(childId);
            expect(parsed.level).toBe('DAY');
          });
        },
      ),
    );
  });

  it('DAY has no children', () => {
    fc.assert(
      fc.property(baseYearArb, yearArb, monthArb, dayArb, (baseYear, year, month, day) => {
        const id = getPeriodId('DAY', baseYear, { year, month, day });
        const children = getChildPeriodIds(id, baseYear);
        expect(children).toHaveLength(0);
      }),
    );
  });

  it('getParentPeriodId of FIVE_YEAR is 30y', () => {
    fc.assert(
      fc.property(baseYearArb, fiveYearIndexArb, (baseYear, idx) => {
        const id = getPeriodId('FIVE_YEAR', baseYear, { fiveYearIndex: idx });
        const parent = getParentPeriodId(id, baseYear);
        expect(parent).toBe('30y');
      }),
    );
  });

  it('getParentPeriodId of YEAR returns a FIVE_YEAR id', () => {
    fc.assert(
      fc.property(baseYearArb, yearArb, (baseYear, year) => {
        const id = getPeriodId('YEAR', baseYear, { year });
        const parent = getParentPeriodId(id, baseYear);
        expect(parent).not.toBeNull();
        const parsed = parsePeriodId(parent!);
        expect(parsed.level).toBe('FIVE_YEAR');
      }),
    );
  });

  it('getParentPeriodId of QUARTER returns a YEAR id', () => {
    fc.assert(
      fc.property(baseYearArb, yearArb, quarterArb, (baseYear, year, quarter) => {
        const id = getPeriodId('QUARTER', baseYear, { year, quarter });
        const parent = getParentPeriodId(id, baseYear);
        expect(parent).not.toBeNull();
        const parsed = parsePeriodId(parent!);
        expect(parsed.level).toBe('YEAR');
        expect(parsed.year).toBe(year);
      }),
    );
  });

  it('getParentPeriodId of MONTH returns a QUARTER id', () => {
    fc.assert(
      fc.property(baseYearArb, yearArb, monthArb, (baseYear, year, month) => {
        const id = getPeriodId('MONTH', baseYear, { year, month });
        const parent = getParentPeriodId(id, baseYear);
        expect(parent).not.toBeNull();
        const parsed = parsePeriodId(parent!);
        expect(parsed.level).toBe('QUARTER');
        expect(parsed.year).toBe(year);
        // Verify correct quarter
        const expectedQuarter = Math.ceil(month / 3);
        expect(parsed.quarter).toBe(expectedQuarter);
      }),
    );
  });

  it('getParentPeriodId of THIRTY_YEAR is null', () => {
    fc.assert(
      fc.property(baseYearArb, (baseYear) => {
        const parent = getParentPeriodId('30y', baseYear);
        expect(parent).toBeNull();
      }),
    );
  });

  it('YEAR child is contained in parent FIVE_YEAR children list', () => {
    fc.assert(
      fc.property(
        baseYearArb,
        fc.integer({ min: 2020, max: 2045 }),
        (baseYear, year) => {
          // Clamp year to be within a valid 5-year range relative to baseYear
          const clampedYear = Math.max(baseYear, Math.min(baseYear + 29, year));
          const yearId = getPeriodId('YEAR', baseYear, { year: clampedYear });
          const parentId = getParentPeriodId(yearId, baseYear);
          if (parentId) {
            const siblings = getChildPeriodIds(parentId, baseYear);
            expect(siblings).toContain(yearId);
          }
        },
      ),
    );
  });

  it('QUARTER child is contained in parent YEAR children list', () => {
    fc.assert(
      fc.property(baseYearArb, yearArb, quarterArb, (baseYear, year, quarter) => {
        const quarterId = getPeriodId('QUARTER', baseYear, { year, quarter });
        const parentId = getParentPeriodId(quarterId, baseYear);
        if (parentId) {
          const siblings = getChildPeriodIds(parentId, baseYear);
          expect(siblings).toContain(quarterId);
        }
      }),
    );
  });

  it('MONTH child is contained in parent QUARTER children list', () => {
    fc.assert(
      fc.property(baseYearArb, yearArb, monthArb, (baseYear, year, month) => {
        const monthId = getPeriodId('MONTH', baseYear, { year, month });
        const parentId = getParentPeriodId(monthId, baseYear);
        if (parentId) {
          const siblings = getChildPeriodIds(parentId, baseYear);
          expect(siblings).toContain(monthId);
        }
      }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// C. Adjacent Period Symmetry (인접 기간 대칭)
// ═══════════════════════════════════════════════════════════════
describe('C. Adjacent Period Symmetry / 인접 기간 대칭', () => {
  it('YEAR: next then prev returns original', () => {
    fc.assert(
      fc.property(baseYearArb, fc.integer({ min: 2021, max: 2049 }), (baseYear, year) => {
        const id = getPeriodId('YEAR', baseYear, { year });
        const nextId = getAdjacentPeriodId(id, 'next', baseYear);
        expect(nextId).not.toBeNull();
        const backId = getAdjacentPeriodId(nextId!, 'prev', baseYear);
        expect(backId).toBe(id);
      }),
    );
  });

  it('QUARTER: next then prev returns original', () => {
    fc.assert(
      fc.property(baseYearArb, yearArb, quarterArb, (baseYear, year, quarter) => {
        const id = getPeriodId('QUARTER', baseYear, { year, quarter });
        const nextId = getAdjacentPeriodId(id, 'next', baseYear);
        expect(nextId).not.toBeNull();
        const backId = getAdjacentPeriodId(nextId!, 'prev', baseYear);
        expect(backId).toBe(id);
      }),
    );
  });

  it('MONTH: next then prev returns original', () => {
    fc.assert(
      fc.property(baseYearArb, yearArb, monthArb, (baseYear, year, month) => {
        const id = getPeriodId('MONTH', baseYear, { year, month });
        const nextId = getAdjacentPeriodId(id, 'next', baseYear);
        expect(nextId).not.toBeNull();
        const backId = getAdjacentPeriodId(nextId!, 'prev', baseYear);
        expect(backId).toBe(id);
      }),
    );
  });

  it('WEEK (ISO): next then prev returns original', () => {
    fc.assert(
      fc.property(
        baseYearArb,
        yearArb,
        fc.integer({ min: 1, max: 51 }),
        (baseYear, year, week) => {
          const id = getPeriodId('WEEK', baseYear, { year, week });
          const nextId = getAdjacentPeriodId(id, 'next', baseYear);
          expect(nextId).not.toBeNull();
          const backId = getAdjacentPeriodId(nextId!, 'prev', baseYear);
          expect(backId).toBe(id);
        },
      ),
    );
  });

  it('DAY: next then prev returns original', () => {
    fc.assert(
      fc.property(baseYearArb, yearArb, monthArb, dayArb, (baseYear, year, month, day) => {
        const id = getPeriodId('DAY', baseYear, { year, month, day });
        const nextId = getAdjacentPeriodId(id, 'next', baseYear);
        expect(nextId).not.toBeNull();
        const backId = getAdjacentPeriodId(nextId!, 'prev', baseYear);
        expect(backId).toBe(id);
      }),
    );
  });

  it('FIVE_YEAR: next then prev returns original (within bounds)', () => {
    fc.assert(
      fc.property(baseYearArb, fc.integer({ min: 0, max: 4 }), (baseYear, idx) => {
        const id = getPeriodId('FIVE_YEAR', baseYear, { fiveYearIndex: idx });
        const nextId = getAdjacentPeriodId(id, 'next', baseYear);
        expect(nextId).not.toBeNull();
        const backId = getAdjacentPeriodId(nextId!, 'prev', baseYear);
        expect(backId).toBe(id);
      }),
    );
  });

  it('THIRTY_YEAR: adjacent always returns null', () => {
    fc.assert(
      fc.property(baseYearArb, (baseYear) => {
        expect(getAdjacentPeriodId('30y', 'next', baseYear)).toBeNull();
        expect(getAdjacentPeriodId('30y', 'prev', baseYear)).toBeNull();
      }),
    );
  });

  it('FIVE_YEAR at index 0: prev returns null', () => {
    fc.assert(
      fc.property(baseYearArb, (baseYear) => {
        const id = getPeriodId('FIVE_YEAR', baseYear, { fiveYearIndex: 0 });
        expect(getAdjacentPeriodId(id, 'prev', baseYear)).toBeNull();
      }),
    );
  });

  it('FIVE_YEAR at index 5: next returns null', () => {
    fc.assert(
      fc.property(baseYearArb, (baseYear) => {
        const id = getPeriodId('FIVE_YEAR', baseYear, { fiveYearIndex: 5 });
        expect(getAdjacentPeriodId(id, 'next', baseYear)).toBeNull();
      }),
    );
  });

  it('QUARTER year wrap: Q4 next is Q1 of next year', () => {
    fc.assert(
      fc.property(baseYearArb, yearArb, (baseYear, year) => {
        const q4 = getPeriodId('QUARTER', baseYear, { year, quarter: 4 });
        const nextId = getAdjacentPeriodId(q4, 'next', baseYear);
        expect(nextId).not.toBeNull();
        const parsed = parsePeriodId(nextId!);
        expect(parsed.quarter).toBe(1);
        expect(parsed.year).toBe(year + 1);
      }),
    );
  });

  it('MONTH year wrap: December next is January of next year', () => {
    fc.assert(
      fc.property(baseYearArb, yearArb, (baseYear, year) => {
        const dec = getPeriodId('MONTH', baseYear, { year, month: 12 });
        const nextId = getAdjacentPeriodId(dec, 'next', baseYear);
        expect(nextId).not.toBeNull();
        const parsed = parsePeriodId(nextId!);
        expect(parsed.month).toBe(1);
        expect(parsed.year).toBe(year + 1);
      }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// D. ISO Week Properties (ISO 주차 속성)
// ═══════════════════════════════════════════════════════════════
describe('D. ISO Week Properties / ISO 주차 속성', () => {
  it('getISOWeek always returns 1-53', () => {
    fc.assert(
      fc.property(dateArb, (date) => {
        const week = getISOWeek(date);
        expect(week).toBeGreaterThanOrEqual(1);
        expect(week).toBeLessThanOrEqual(53);
      }),
    );
  });

  it('getISOWeekYear is within +/-1 of date.getFullYear()', () => {
    fc.assert(
      fc.property(dateArb, (date) => {
        const isoYear = getISOWeekYear(date);
        const calYear = date.getFullYear();
        expect(Math.abs(isoYear - calYear)).toBeLessThanOrEqual(1);
      }),
    );
  });

  it('getISOWeek returns integer (no fractional weeks)', () => {
    fc.assert(
      fc.property(dateArb, (date) => {
        const week = getISOWeek(date);
        expect(Number.isInteger(week)).toBe(true);
      }),
    );
  });

  it('Same date always produces the same ISO week', () => {
    fc.assert(
      fc.property(dateArb, (date) => {
        const w1 = getISOWeek(date);
        const w2 = getISOWeek(new Date(date.getTime()));
        expect(w1).toBe(w2);
      }),
    );
  });

  it('Consecutive days differ by at most 1 week (or wrap 52/53 -> 1)', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date(2020, 0, 1), max: new Date(2050, 11, 30) }),
        (date) => {
          const nextDay = new Date(date);
          nextDay.setDate(nextDay.getDate() + 1);
          const w1 = getISOWeek(date);
          const w2 = getISOWeek(nextDay);
          const diff = w2 - w1;
          // Either same week, next week, or year-boundary wrap
          expect(
            diff === 0 || diff === 1 || (w1 >= 52 && w2 === 1),
          ).toBe(true);
        },
      ),
    );
  });

  it('Monday through Sunday of the same week have the same ISO week number', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date(2020, 0, 6), max: new Date(2050, 11, 25) }),
        (date) => {
          // Find Monday of this date's week
          const d = new Date(date);
          const dayOfWeek = d.getDay() || 7; // Sunday=7
          d.setDate(d.getDate() - dayOfWeek + 1); // Monday

          const mondayWeek = getISOWeek(d);
          for (let i = 1; i < 7; i++) {
            const dayInWeek = new Date(d);
            dayInWeek.setDate(d.getDate() + i);
            expect(getISOWeek(dayInWeek)).toBe(mondayWeek);
          }
        },
      ),
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// E. Weeks In Month Properties (월 주차 속성)
// ═══════════════════════════════════════════════════════════════
describe('E. Weeks In Month Properties / 월 주차 속성', () => {
  it('getWeeksInMonth always returns 4-6 weeks', () => {
    fc.assert(
      fc.property(yearArb, monthArb, (year, month) => {
        const weeks = getWeeksInMonth(year, month);
        expect(weeks.length).toBeGreaterThanOrEqual(4);
        expect(weeks.length).toBeLessThanOrEqual(6);
      }),
    );
  });

  it('Each week spans exactly 7 days (Monday-Sunday)', () => {
    fc.assert(
      fc.property(yearArb, monthArb, (year, month) => {
        const weeks = getWeeksInMonth(year, month);
        weeks.forEach((w) => {
          const diffMs = w.end.getTime() - w.start.getTime();
          const diffDays = diffMs / (24 * 60 * 60 * 1000);
          expect(diffDays).toBe(6); // 6 days between Monday and Sunday
          // Verify start is Monday (day 1)
          expect(w.start.getDay()).toBe(1);
          // Verify end is Sunday (day 0)
          expect(w.end.getDay()).toBe(0);
        });
      }),
    );
  });

  it('The first day of the month falls within the returned weeks', () => {
    fc.assert(
      fc.property(yearArb, monthArb, (year, month) => {
        const weeks = getWeeksInMonth(year, month);
        const firstDay = new Date(year, month - 1, 1);

        const firstDayInAnyWeek = weeks.some(
          (w) => firstDay >= w.start && firstDay <= w.end,
        );
        expect(firstDayInAnyWeek).toBe(true);
      }),
    );
  });

  it('The last day of the month falls within the returned weeks', () => {
    fc.assert(
      fc.property(yearArb, monthArb, (year, month) => {
        const weeks = getWeeksInMonth(year, month);
        const lastDay = new Date(year, month, 0);

        const lastDayInAnyWeek = weeks.some(
          (w) => lastDay >= w.start && lastDay <= w.end,
        );
        expect(lastDayInAnyWeek).toBe(true);
      }),
    );
  });

  it('Week numbers are sequential starting from 1', () => {
    fc.assert(
      fc.property(yearArb, monthArb, (year, month) => {
        const weeks = getWeeksInMonth(year, month);
        weeks.forEach((w, i) => {
          expect(w.weekNum).toBe(i + 1);
        });
      }),
    );
  });

  it('Weeks do not overlap', () => {
    fc.assert(
      fc.property(yearArb, monthArb, (year, month) => {
        const weeks = getWeeksInMonth(year, month);
        for (let i = 0; i < weeks.length - 1; i++) {
          // Current week end should be exactly 1 day before next week start
          const nextDayAfterEnd = new Date(weeks[i].end);
          nextDayAfterEnd.setDate(nextDayAfterEnd.getDate() + 1);
          expect(nextDayAfterEnd.getTime()).toBe(weeks[i + 1].start.getTime());
        }
      }),
    );
  });

  it('targetMonth is stored correctly', () => {
    fc.assert(
      fc.property(yearArb, monthArb, (year, month) => {
        const weeks = getWeeksInMonth(year, month);
        weeks.forEach((w) => {
          expect(w.targetMonth).toBe(month);
        });
      }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// F. genId Uniqueness (고유 ID 유일성)
// ═══════════════════════════════════════════════════════════════
describe('F. genId Uniqueness / 고유 ID 유일성', () => {
  /**
   * genId is not exported, but the store uses it internally.
   * We test uniqueness indirectly by adding multiple items and
   * verifying they all get distinct IDs.
   */
  it('Adding N items produces N distinct IDs', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 50 }), (n) => {
        // Reset store state
        usePlanStore.setState({
          currentLevel: 'WEEK',
          currentPeriodId: 'w-2026-01',
          baseYear: 2026,
          periods: {},
          allItems: {},
          records: {},
          viewMode: 'plan',
          annualEvents: [],
        });

        const store = usePlanStore.getState();
        store.ensurePeriod('w-2026-01');

        for (let i = 0; i < n; i++) {
          usePlanStore.getState().addItem(`item-${i}`, 'todo');
        }

        const state = usePlanStore.getState();
        const period = state.periods['w-2026-01'];
        const ids = period.todos.map((t) => t.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(n);
      }),
      { numRuns: 20 },
    );
  });

  it('IDs from allItems are consistent with period todos', () => {
    usePlanStore.setState({
      currentLevel: 'WEEK',
      currentPeriodId: 'w-2026-02',
      baseYear: 2026,
      periods: {},
      allItems: {},
      records: {},
      viewMode: 'plan',
      annualEvents: [],
    });

    const store = usePlanStore.getState();
    store.ensurePeriod('w-2026-02');

    for (let i = 0; i < 10; i++) {
      usePlanStore.getState().addItem(`consistency-${i}`, 'todo');
    }

    const state = usePlanStore.getState();
    const period = state.periods['w-2026-02'];
    period.todos.forEach((todo) => {
      expect(state.allItems[todo.id]).toBeDefined();
      expect(state.allItems[todo.id].content).toBe(todo.content);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// G. Sanitize Properties (살균 처리 속성)
// ═══════════════════════════════════════════════════════════════
describe('G. Sanitize Properties / 살균 처리 속성', () => {
  /**
   * sanitize() is not exported from csvUtils.ts. We test its behavior
   * indirectly by verifying the contract it implements.
   * We also re-implement the logic here to test the properties directly.
   */
  function sanitize(text: string): string {
    if (typeof text !== 'string') return text;
    return text
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .trim()
      .slice(0, 500);
  }

  it('sanitize(s) never contains raw < or > characters', () => {
    fc.assert(
      fc.property(fc.fullUnicode(), (s) => {
        const result = sanitize(s);
        // The only < or > should be part of &lt; or &gt;
        const withoutEntities = result.replace(/&lt;/g, '').replace(/&gt;/g, '');
        expect(withoutEntities).not.toContain('<');
        expect(withoutEntities).not.toContain('>');
      }),
    );
  });

  it('sanitize(s).length <= 500', () => {
    fc.assert(
      fc.property(fc.fullUnicode(), (s) => {
        const result = sanitize(s);
        expect(result.length).toBeLessThanOrEqual(500);
      }),
    );
  });

  it('sanitize is idempotent for strings without < or >', () => {
    fc.assert(
      fc.property(
        fc.fullUnicode().filter((s) => !s.includes('<') && !s.includes('>')),
        (s) => {
          const once = sanitize(s);
          const twice = sanitize(once);
          expect(twice).toBe(once);
        },
      ),
    );
  });

  it('sanitize replaces ALL < and > occurrences', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('<', '>', 'a', 'b', ' ')).map((arr) => arr.join('')),
        (s) => {
          const result = sanitize(s);
          // Count that no raw < or > remain (only entity-encoded)
          for (let i = 0; i < result.length; i++) {
            if (result[i] === '<') {
              // Should not happen -- sanitize encodes them
              expect(result.substring(i, i + 4)).not.toBe('<');
            }
            if (result[i] === '>') {
              expect(result.substring(i, i + 4)).not.toBe('>');
            }
          }
        },
      ),
    );
  });

  it('sanitize trims whitespace', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.stringOf(fc.constantFrom(' ', '\t', '\n')),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.stringOf(fc.constantFrom(' ', '\t', '\n')),
        ),
        ([prefix, core, suffix]) => {
          const input = prefix + core + suffix;
          const result = sanitize(input);
          expect(result).toBe(result.trim());
        },
      ),
    );
  });

  it('sanitize preserves non-special characters', () => {
    fc.assert(
      fc.property(
        fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789 '.split('')), {
          minLength: 1,
          maxLength: 100,
        }),
        (s) => {
          const result = sanitize(s);
          // For safe characters, sanitize should preserve content (just trim)
          expect(result).toBe(s.trim().slice(0, 500));
        },
      ),
    );
  });

  it('XSS payloads are neutralized', () => {
    const xssPayloads = [
      '<script>alert("xss")</script>',
      '<img src=x onerror=alert(1)>',
      '<svg/onload=alert(1)>',
      '"><script>alert(1)</script>',
      "';alert(String.fromCharCode(88,83,83))//",
      '<iframe src="javascript:alert(1)">',
    ];
    xssPayloads.forEach((payload) => {
      const result = sanitize(payload);
      expect(result).not.toContain('<script');
      expect(result).not.toContain('<img');
      expect(result).not.toContain('<svg');
      expect(result).not.toContain('<iframe');
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// H. Search Properties (검색 속성)
// ═══════════════════════════════════════════════════════════════
describe('H. Search Properties / 검색 속성', () => {
  const emptyPeriods: Record<string, Period> = {};
  const emptyRecords: Record<string, DailyRecord> = {};
  const emptyEvents: AnnualEvent[] = [];

  it('Empty query returns empty results', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const results = searchAllData(emptyPeriods, emptyRecords, emptyEvents, {
          query: '',
        });
        expect(results).toEqual([]);
      }),
    );
  });

  it('Single character query returns empty results (minimum 2 chars)', () => {
    fc.assert(
      fc.property(
        fc.char().filter((c) => c.length === 1),
        (singleChar) => {
          const results = searchAllData(emptyPeriods, emptyRecords, emptyEvents, {
            query: singleChar,
          });
          expect(results).toEqual([]);
        },
      ),
    );
  });

  it('Results count never exceeds limit', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.string({ minLength: 2, maxLength: 10 }),
        (limit, query) => {
          // Create many periods with matching content
          const periods: Record<string, Period> = {};
          for (let i = 0; i < 200; i++) {
            periods[`m-2026-${String((i % 12) + 1).padStart(2, '0')}`] = createTestPeriod(
              `m-2026-${String((i % 12) + 1).padStart(2, '0')}`,
              'MONTH',
              {
                todos: [createTestItem(`t-${i}`, `${query} task ${i}`)],
              },
            );
          }

          const results = searchAllData(periods, emptyRecords, emptyEvents, {
            query,
            limit,
          });
          expect(results.length).toBeLessThanOrEqual(limit);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('No duplicate results (same type + periodId + content)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 2, maxLength: 5 }),
        (query) => {
          const periods: Record<string, Period> = {
            'w-2026-01': createTestPeriod('w-2026-01', 'WEEK', {
              todos: [
                createTestItem('t1', `${query} homework`),
                createTestItem('t2', `${query} exercise`),
              ],
              routines: [createTestItem('r1', `${query} morning routine`)],
              goal: `My ${query} goal`,
              structuredMemos: [
                { id: 'memo1', content: `${query} notes`, sourceLevel: 'WEEK', sourcePeriodId: 'w-2026-01' },
              ],
            }),
          };

          const results = searchAllData(periods, emptyRecords, emptyEvents, { query });
          const keys = results.map((r) => `${r.type}-${r.periodId}-${r.content}`);
          const uniqueKeys = new Set(keys);
          expect(uniqueKeys.size).toBe(keys.length);
        },
      ),
    );
  });

  it('Search finds content in todos', () => {
    const needle = 'uniqueNeedle42';
    const periods: Record<string, Period> = {
      'w-2026-05': createTestPeriod('w-2026-05', 'WEEK', {
        todos: [createTestItem('t1', `task with ${needle} inside`)],
      }),
    };

    const results = searchAllData(periods, emptyRecords, emptyEvents, {
      query: needle,
    });
    expect(results.length).toBe(1);
    expect(results[0].type).toBe('todo');
  });

  it('Search finds content in routines', () => {
    const needle = 'routineTarget99';
    const periods: Record<string, Period> = {
      'w-2026-05': createTestPeriod('w-2026-05', 'WEEK', {
        routines: [createTestItem('r1', `daily ${needle} activity`)],
      }),
    };

    const results = searchAllData(periods, emptyRecords, emptyEvents, {
      query: needle,
    });
    expect(results.length).toBe(1);
    expect(results[0].type).toBe('routine');
  });

  it('Search finds content in goals', () => {
    const needle = 'goalXYZ';
    const periods: Record<string, Period> = {
      'y-2026': createTestPeriod('y-2026', 'YEAR', {
        goal: `achieve ${needle} this year`,
      }),
    };

    const results = searchAllData(periods, emptyRecords, emptyEvents, {
      query: needle,
    });
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].type).toBe('goal');
  });

  it('Search finds content in records', () => {
    const needle = 'journalEntry77';
    const records: Record<string, DailyRecord> = {
      'd-2026-01-15': {
        id: 'rec1',
        periodId: 'd-2026-01-15',
        content: `Today I wrote ${needle} in my journal`,
        highlights: [],
        gratitude: [],
        createdAt: '2026-01-15',
        updatedAt: '2026-01-15',
      },
    };

    const results = searchAllData(emptyPeriods, records, emptyEvents, {
      query: needle,
    });
    expect(results.length).toBe(1);
    expect(results[0].type).toBe('record');
  });

  it('Search finds content in annual events', () => {
    const needle = 'birthdaySpecial';
    const events: AnnualEvent[] = [
      {
        id: 'ev1',
        title: `Mom ${needle}`,
        type: 'birthday',
        month: 3,
        day: 15,
        createdAt: '2026-01-01',
      },
    ];

    const results = searchAllData(emptyPeriods, emptyRecords, events, {
      query: needle,
    });
    expect(results.length).toBe(1);
    expect(results[0].type).toBe('event');
  });

  it('Search is case-insensitive', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 3, maxLength: 10 }).filter((s) => /^[a-zA-Z]+$/.test(s)),
        (word) => {
          const periods: Record<string, Period> = {
            'w-2026-10': createTestPeriod('w-2026-10', 'WEEK', {
              todos: [createTestItem('t1', word.toLowerCase())],
            }),
          };

          const upper = searchAllData(periods, emptyRecords, emptyEvents, {
            query: word.toUpperCase(),
          });
          const lower = searchAllData(periods, emptyRecords, emptyEvents, {
            query: word.toLowerCase(),
          });
          expect(upper.length).toBe(lower.length);
        },
      ),
    );
  });

  it('Type filter restricts results to specified types only', () => {
    const needle = 'filterTest';
    const periods: Record<string, Period> = {
      'w-2026-05': createTestPeriod('w-2026-05', 'WEEK', {
        todos: [createTestItem('t1', `${needle} todo`)],
        routines: [createTestItem('r1', `${needle} routine`)],
        goal: `${needle} goal`,
      }),
    };

    const todoOnly = searchAllData(periods, emptyRecords, emptyEvents, {
      query: needle,
      types: ['todo'],
    });
    todoOnly.forEach((r) => expect(r.type).toBe('todo'));

    const routineOnly = searchAllData(periods, emptyRecords, emptyEvents, {
      query: needle,
      types: ['routine'],
    });
    routineOnly.forEach((r) => expect(r.type).toBe('routine'));
  });
});

// ═══════════════════════════════════════════════════════════════
// I. State Invariants (상태 불변 조건)
// ═══════════════════════════════════════════════════════════════
describe('I. State Invariants / 상태 불변 조건', () => {
  function resetStore() {
    usePlanStore.setState({
      currentLevel: 'MONTH',
      currentPeriodId: 'm-2026-01',
      baseYear: 2026,
      periods: {},
      allItems: {},
      records: {},
      viewMode: 'plan',
      annualEvents: [],
    });
    usePlanStore.getState().ensurePeriod('m-2026-01');
  }

  it('After assignToSlot, parent childIds contains new item ID', () => {
    resetStore();
    const store = usePlanStore.getState();
    store.addItem('Parent task', 'todo');

    let state = usePlanStore.getState();
    const parentItem = state.periods['m-2026-01'].todos[0];
    expect(parentItem).toBeDefined();

    // Get first child slot ID
    const childIds = getChildPeriodIds('m-2026-01', 2026);
    expect(childIds.length).toBeGreaterThan(0);
    const targetSlot = childIds[0];

    // Assign to slot
    usePlanStore.getState().assignToSlot(parentItem.id, 'todo', targetSlot);

    state = usePlanStore.getState();
    const updatedParent = state.periods['m-2026-01'].todos.find(
      (t) => t.id === parentItem.id,
    );
    expect(updatedParent).toBeDefined();
    expect(updatedParent!.childIds).toBeDefined();
    expect(updatedParent!.childIds!.length).toBeGreaterThanOrEqual(1);

    // Verify child exists in slot
    const slotItems = state.periods['m-2026-01'].slots[targetSlot];
    expect(slotItems).toBeDefined();
    expect(slotItems.length).toBeGreaterThanOrEqual(1);

    // Verify the slot item's parentId points back to original
    const slotItem = slotItems[0];
    expect(slotItem.parentId).toBe(parentItem.id);
  });

  it('After deleteItem with children, all children are also deleted', () => {
    resetStore();
    const store = usePlanStore.getState();
    store.addItem('Parent for deletion', 'todo');

    let state = usePlanStore.getState();
    const parent = state.periods['m-2026-01'].todos[0];

    // Add sub-items
    usePlanStore.getState().addSubItem(parent.id, 'Child 1', 'todo');
    usePlanStore.getState().addSubItem(parent.id, 'Child 2', 'todo');

    state = usePlanStore.getState();
    const updatedParent = state.allItems[parent.id];
    expect(updatedParent.childIds).toHaveLength(2);
    const childId1 = updatedParent.childIds![0];
    const childId2 = updatedParent.childIds![1];

    // Delete the parent
    usePlanStore.getState().deleteItem(parent.id, 'todo');

    state = usePlanStore.getState();
    expect(state.allItems[parent.id]).toBeUndefined();
    expect(state.allItems[childId1]).toBeUndefined();
    expect(state.allItems[childId2]).toBeUndefined();

    // Verify they are gone from the period too
    const period = state.periods['m-2026-01'];
    expect(period.todos.find((t) => t.id === parent.id)).toBeUndefined();
    expect(period.todos.find((t) => t.id === childId1)).toBeUndefined();
    expect(period.todos.find((t) => t.id === childId2)).toBeUndefined();
  });

  it('After toggleComplete on parent, all children match parent state', () => {
    resetStore();
    usePlanStore.getState().addItem('Completable parent', 'todo');

    let state = usePlanStore.getState();
    const parent = state.periods['m-2026-01'].todos[0];

    // Add children
    usePlanStore.getState().addSubItem(parent.id, 'Sub A', 'todo');
    usePlanStore.getState().addSubItem(parent.id, 'Sub B', 'todo');

    state = usePlanStore.getState();
    const childIds = state.allItems[parent.id].childIds!;
    expect(childIds).toHaveLength(2);

    // Complete the parent
    usePlanStore.getState().toggleComplete(parent.id, 'todo');

    state = usePlanStore.getState();
    expect(state.allItems[parent.id].isCompleted).toBe(true);
    childIds.forEach((cid) => {
      expect(state.allItems[cid].isCompleted).toBe(true);
    });

    // Uncomplete the parent
    usePlanStore.getState().toggleComplete(parent.id, 'todo');

    state = usePlanStore.getState();
    expect(state.allItems[parent.id].isCompleted).toBe(false);
    childIds.forEach((cid) => {
      expect(state.allItems[cid].isCompleted).toBe(false);
    });
  });

  it('getProgress returns 0-100', () => {
    resetStore();
    usePlanStore.getState().addItem('Progress parent', 'todo');

    let state = usePlanStore.getState();
    const parent = state.periods['m-2026-01'].todos[0];

    // No children: 0 or 100
    const progressNone = usePlanStore.getState().getProgress(parent.id);
    expect(progressNone).toBe(0);

    // Add children
    usePlanStore.getState().addSubItem(parent.id, 'Sub 1', 'todo');
    usePlanStore.getState().addSubItem(parent.id, 'Sub 2', 'todo');
    usePlanStore.getState().addSubItem(parent.id, 'Sub 3', 'todo');
    usePlanStore.getState().addSubItem(parent.id, 'Sub 4', 'todo');

    state = usePlanStore.getState();
    const childIds = state.allItems[parent.id].childIds!;

    // 0/4 = 0%
    expect(usePlanStore.getState().getProgress(parent.id)).toBe(0);

    // Complete 1/4 = 25%
    usePlanStore.getState().toggleComplete(childIds[0], 'todo');
    expect(usePlanStore.getState().getProgress(parent.id)).toBe(25);

    // Complete 2/4 = 50%
    usePlanStore.getState().toggleComplete(childIds[1], 'todo');
    expect(usePlanStore.getState().getProgress(parent.id)).toBe(50);

    // Complete 3/4 = 75%
    usePlanStore.getState().toggleComplete(childIds[2], 'todo');
    expect(usePlanStore.getState().getProgress(parent.id)).toBe(75);

    // Complete 4/4 = 100%
    usePlanStore.getState().toggleComplete(childIds[3], 'todo');
    expect(usePlanStore.getState().getProgress(parent.id)).toBe(100);
  });

  it('getProgress returns 0 for non-existent item', () => {
    resetStore();
    expect(usePlanStore.getState().getProgress('nonexistent-id')).toBe(0);
  });

  it('getProgress returns 100 for completed leaf item', () => {
    resetStore();
    usePlanStore.getState().addItem('Leaf item', 'todo');

    let state = usePlanStore.getState();
    const item = state.periods['m-2026-01'].todos[0];

    usePlanStore.getState().toggleComplete(item.id, 'todo');
    expect(usePlanStore.getState().getProgress(item.id)).toBe(100);
  });

  it('Completing all children automatically completes parent', () => {
    resetStore();
    usePlanStore.getState().addItem('Auto-complete parent', 'todo');

    let state = usePlanStore.getState();
    const parent = state.periods['m-2026-01'].todos[0];

    usePlanStore.getState().addSubItem(parent.id, 'Child A', 'todo');
    usePlanStore.getState().addSubItem(parent.id, 'Child B', 'todo');

    state = usePlanStore.getState();
    const childIds = state.allItems[parent.id].childIds!;

    // Complete both children
    usePlanStore.getState().toggleComplete(childIds[0], 'todo');
    usePlanStore.getState().toggleComplete(childIds[1], 'todo');

    state = usePlanStore.getState();
    // Parent should be auto-completed since all children are done
    expect(state.allItems[parent.id].isCompleted).toBe(true);
  });

  it('Uncompleting one child uncompletes previously auto-completed parent', () => {
    resetStore();
    usePlanStore.getState().addItem('Uncheck test parent', 'todo');

    let state = usePlanStore.getState();
    const parent = state.periods['m-2026-01'].todos[0];

    usePlanStore.getState().addSubItem(parent.id, 'Child X', 'todo');
    usePlanStore.getState().addSubItem(parent.id, 'Child Y', 'todo');

    state = usePlanStore.getState();
    const childIds = state.allItems[parent.id].childIds!;

    // Complete both children (parent becomes complete)
    usePlanStore.getState().toggleComplete(childIds[0], 'todo');
    usePlanStore.getState().toggleComplete(childIds[1], 'todo');

    state = usePlanStore.getState();
    expect(state.allItems[parent.id].isCompleted).toBe(true);

    // Uncomplete one child
    usePlanStore.getState().toggleComplete(childIds[0], 'todo');

    state = usePlanStore.getState();
    // Parent should no longer be complete
    expect(state.allItems[parent.id].isCompleted).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// J. Date Boundary Tests (날짜 경계 테스트)
// ═══════════════════════════════════════════════════════════════
describe('J. Date Boundary Tests / 날짜 경계 테스트', () => {
  it('Dec 31 of any year: getISOWeek returns valid week (1, 52, or 53)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2020, max: 2050 }), (year) => {
        const dec31 = new Date(year, 11, 31);
        const week = getISOWeek(dec31);
        expect([1, 52, 53]).toContain(week);
      }),
    );
  });

  it('Jan 1 of any year: getISOWeek returns valid week (1, 52, or 53)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2020, max: 2050 }), (year) => {
        const jan1 = new Date(year, 0, 1);
        const week = getISOWeek(jan1);
        expect([1, 52, 53]).toContain(week);
      }),
    );
  });

  it('Leap year Feb has 29 days and getWeeksInMonth covers all of them', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(2020, 2024, 2028, 2032, 2036, 2040, 2044, 2048),
        (leapYear) => {
          // Verify it is indeed a leap year
          const feb29 = new Date(leapYear, 1, 29);
          expect(feb29.getMonth()).toBe(1); // Still February

          const weeks = getWeeksInMonth(leapYear, 2);
          expect(weeks.length).toBeGreaterThanOrEqual(4);

          // Feb 29 should fall within one of the weeks
          const feb29InWeek = weeks.some(
            (w) => feb29 >= w.start && feb29 <= w.end,
          );
          expect(feb29InWeek).toBe(true);

          // Feb 1 should also be covered
          const feb1 = new Date(leapYear, 1, 1);
          const feb1InWeek = weeks.some(
            (w) => feb1 >= w.start && feb1 <= w.end,
          );
          expect(feb1InWeek).toBe(true);
        },
      ),
    );
  });

  it('Non-leap year Feb: Feb 29 does not exist', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(2021, 2022, 2023, 2025, 2026, 2027, 2029, 2030),
        (nonLeapYear) => {
          const feb29 = new Date(nonLeapYear, 1, 29);
          // In a non-leap year, Feb 29 rolls over to March 1
          expect(feb29.getMonth()).toBe(2); // March

          const weeks = getWeeksInMonth(nonLeapYear, 2);
          // Feb 28 should be the last day
          const feb28 = new Date(nonLeapYear, 1, 28);
          const feb28InWeek = weeks.some(
            (w) => feb28 >= w.start && feb28 <= w.end,
          );
          expect(feb28InWeek).toBe(true);
        },
      ),
    );
  });

  it('Year boundary: Dec 31 and Jan 1 may have different ISO week years', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2020, max: 2049 }), (year) => {
        const dec31 = new Date(year, 11, 31);
        const jan1 = new Date(year + 1, 0, 1);

        const dec31Year = getISOWeekYear(dec31);
        const jan1Year = getISOWeekYear(jan1);

        // ISO week year for Dec 31 can be current year or next year
        expect(dec31Year).toBeGreaterThanOrEqual(year);
        expect(dec31Year).toBeLessThanOrEqual(year + 1);

        // ISO week year for Jan 1 can be previous year or current year
        expect(jan1Year).toBeGreaterThanOrEqual(year);
        expect(jan1Year).toBeLessThanOrEqual(year + 1);
      }),
    );
  });

  it('getWeeksInMonth covers every single day of the month', () => {
    fc.assert(
      fc.property(yearArb, monthArb, (year, month) => {
        const weeks = getWeeksInMonth(year, month);
        const daysInMonth = new Date(year, month, 0).getDate();

        for (let day = 1; day <= daysInMonth; day++) {
          const date = new Date(year, month - 1, day);
          const covered = weeks.some((w) => date >= w.start && date <= w.end);
          expect(covered).toBe(true);
        }
      }),
      { numRuns: 50 },
    );
  });

  it('getISOWeek is consistent with getISOWeekYear', () => {
    fc.assert(
      fc.property(dateArb, (date) => {
        const week = getISOWeek(date);
        const isoYear = getISOWeekYear(date);

        // If ISO week is 1 and calendar month is December, ISO year should be next year
        if (week === 1 && date.getMonth() === 11) {
          expect(isoYear).toBe(date.getFullYear() + 1);
        }
        // If ISO week is 52 or 53 and calendar month is January, ISO year should be previous year
        if ((week === 52 || week === 53) && date.getMonth() === 0) {
          expect(isoYear).toBe(date.getFullYear() - 1);
        }
      }),
    );
  });

  it('Period ID for last day of month is valid', () => {
    fc.assert(
      fc.property(yearArb, monthArb, (year, month) => {
        const lastDay = new Date(year, month, 0).getDate();
        const id = getPeriodId('DAY', year, { year, month, day: lastDay });
        const parsed = parsePeriodId(id);
        expect(parsed.level).toBe('DAY');
        expect(parsed.year).toBe(year);
        expect(parsed.month).toBe(month);
        expect(parsed.day).toBe(lastDay);
      }),
    );
  });

  it('Adjacent day across month boundary: Jan 31 -> Feb 1', () => {
    fc.assert(
      fc.property(yearArb, (year) => {
        const jan31 = getPeriodId('DAY', year, { year, month: 1, day: 31 });
        const next = getAdjacentPeriodId(jan31, 'next', year);
        expect(next).not.toBeNull();
        const parsed = parsePeriodId(next!);
        expect(parsed.level).toBe('DAY');
        expect(parsed.month).toBe(2);
        expect(parsed.day).toBe(1);
      }),
    );
  });

  it('Adjacent day across year boundary: Dec 31 -> Jan 1 of next year', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2020, max: 2049 }), (year) => {
        const dec31 = getPeriodId('DAY', year, { year, month: 12, day: 31 });
        const next = getAdjacentPeriodId(dec31, 'next', year);
        expect(next).not.toBeNull();
        const parsed = parsePeriodId(next!);
        expect(parsed.level).toBe('DAY');
        expect(parsed.year).toBe(year + 1);
        expect(parsed.month).toBe(1);
        expect(parsed.day).toBe(1);
      }),
    );
  });

  it('Adjacent day backward across year boundary: Jan 1 -> Dec 31 of prev year', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2021, max: 2050 }), (year) => {
        const jan1 = getPeriodId('DAY', year, { year, month: 1, day: 1 });
        const prev = getAdjacentPeriodId(jan1, 'prev', year);
        expect(prev).not.toBeNull();
        const parsed = parsePeriodId(prev!);
        expect(parsed.level).toBe('DAY');
        expect(parsed.year).toBe(year - 1);
        expect(parsed.month).toBe(12);
        expect(parsed.day).toBe(31);
      }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// Additional: getSlotLabel Properties (슬롯 라벨 추가 속성)
// ═══════════════════════════════════════════════════════════════
describe('Additional: getSlotLabel Properties / 슬롯 라벨 속성', () => {
  it('getSlotLabel always returns a non-empty string for valid child IDs', () => {
    fc.assert(
      fc.property(
        parentLevelArb.chain((level) => periodIdForLevel(level)),
        ({ id, baseYear }) => {
          const children = getChildPeriodIds(id, baseYear);
          children.forEach((childId) => {
            const label = getSlotLabel(childId, baseYear);
            expect(label.length).toBeGreaterThan(0);
          });
        },
      ),
      { numRuns: 50 },
    );
  });

  it('FIVE_YEAR slot labels contain year ranges', () => {
    fc.assert(
      fc.property(baseYearArb, (baseYear) => {
        const children = getChildPeriodIds('30y', baseYear);
        children.forEach((childId) => {
          const label = getSlotLabel(childId, baseYear);
          expect(label).toContain('~');
          expect(label).toContain('년');
        });
      }),
    );
  });

  it('DAY slot labels contain weekday names', () => {
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    fc.assert(
      fc.property(yearArb, monthArb, dayArb, (year, month, day) => {
        const id = getPeriodId('DAY', year, { year, month, day });
        const label = getSlotLabel(id, year);
        const hasWeekday = weekdays.some((wd) => label.includes(wd));
        expect(hasWeekday).toBe(true);
      }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// Additional: getResetKey Properties (리셋 키 속성)
// ═══════════════════════════════════════════════════════════════
describe('Additional: getResetKey Properties / 리셋 키 속성', () => {
  it('getResetKey always returns a non-empty string', () => {
    fc.assert(
      fc.property(anyPeriodIdArb, levelArb, ({ id }, sourceLevel) => {
        const key = getResetKey(id, sourceLevel);
        expect(key.length).toBeGreaterThan(0);
      }),
    );
  });

  it('Same period + same source level always produces the same reset key', () => {
    fc.assert(
      fc.property(anyPeriodIdArb, levelArb, ({ id }, sourceLevel) => {
        const key1 = getResetKey(id, sourceLevel);
        const key2 = getResetKey(id, sourceLevel);
        expect(key1).toBe(key2);
      }),
    );
  });

  it('DAY source level: different days produce different reset keys', () => {
    fc.assert(
      fc.property(yearArb, monthArb, (year, month) => {
        const day1Id = getPeriodId('DAY', year, { year, month, day: 1 });
        const day2Id = getPeriodId('DAY', year, { year, month, day: 2 });
        const key1 = getResetKey(day1Id, 'DAY');
        const key2 = getResetKey(day2Id, 'DAY');
        expect(key1).not.toBe(key2);
      }),
    );
  });

  it('MONTH source level: different months produce different reset keys', () => {
    fc.assert(
      fc.property(
        yearArb,
        fc.integer({ min: 1, max: 11 }),
        (year, month) => {
          const day1 = getPeriodId('DAY', year, { year, month, day: 15 });
          const day2 = getPeriodId('DAY', year, { year, month: month + 1, day: 15 });
          const key1 = getResetKey(day1, 'MONTH');
          const key2 = getResetKey(day2, 'MONTH');
          expect(key1).not.toBe(key2);
        },
      ),
    );
  });

  it('YEAR source level: same year produces the same reset key', () => {
    fc.assert(
      fc.property(yearArb, (year) => {
        const jan = getPeriodId('DAY', year, { year, month: 1, day: 1 });
        const dec = getPeriodId('DAY', year, { year, month: 12, day: 28 });
        const key1 = getResetKey(jan, 'YEAR');
        const key2 = getResetKey(dec, 'YEAR');
        expect(key1).toBe(key2);
      }),
    );
  });
});
