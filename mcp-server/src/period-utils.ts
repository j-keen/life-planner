import { Level, LEVEL_CONFIG } from './types.js';

// ISO 주차 계산
export const getISOWeek = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

export const getISOWeekYear = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  return d.getUTCFullYear();
};

export const getMondayOfWeek = (year: number, week: number): Date => {
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const firstMonday = new Date(jan4);
  firstMonday.setDate(jan4.getDate() - jan4Day + 1);
  const targetMonday = new Date(firstMonday);
  targetMonday.setDate(firstMonday.getDate() + (week - 1) * 7);
  return targetMonday;
};

export const getMondayOfDate = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return d;
};

export const getWeeksInMonth = (year: number, month: number): { weekNum: number; start: Date; end: Date; targetMonth: number }[] => {
  const weeks: { weekNum: number; start: Date; end: Date; targetMonth: number }[] = [];
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);

  const firstDayOfWeek = firstDay.getDay();
  const firstMonday = new Date(firstDay);
  if (firstDayOfWeek === 0) {
    firstMonday.setDate(firstDay.getDate() - 6);
  } else if (firstDayOfWeek !== 1) {
    firstMonday.setDate(firstDay.getDate() - (firstDayOfWeek - 1));
  }

  let weekNum = 1;
  let currentMonday = new Date(firstMonday);

  while (true) {
    const weekSunday = new Date(currentMonday);
    weekSunday.setDate(currentMonday.getDate() + 6);

    weeks.push({
      weekNum: weekNum++,
      start: new Date(currentMonday),
      end: new Date(weekSunday),
      targetMonth: month,
    });

    if (weekSunday >= lastDay) break;
    currentMonday.setDate(currentMonday.getDate() + 7);
  }

  return weeks;
};

export const getPeriodId = (level: Level, baseYear: number, params?: {
  fiveYearIndex?: number;
  year?: number;
  quarter?: number;
  month?: number;
  week?: number;
  day?: number;
}): string => {
  const p = params || {};
  const year = p.year || baseYear;

  switch (level) {
    case 'THIRTY_YEAR': return '30y';
    case 'FIVE_YEAR': return `5y-${p.fiveYearIndex ?? 0}`;
    case 'YEAR': return `y-${year}`;
    case 'QUARTER': return `q-${year}-${p.quarter ?? 1}`;
    case 'MONTH': return `m-${year}-${String(p.month ?? 1).padStart(2, '0')}`;
    case 'WEEK': return `w-${year}-${String(p.week ?? 1).padStart(2, '0')}`;
    case 'DAY': return `d-${year}-${String(p.month ?? 1).padStart(2, '0')}-${String(p.day ?? 1).padStart(2, '0')}`;
    default: return '30y';
  }
};

export const parsePeriodId = (id: string): {
  level: Level;
  fiveYearIndex?: number;
  year?: number;
  quarter?: number;
  month?: number;
  week?: number;
  day?: number;
} => {
  if (id === '30y') return { level: 'THIRTY_YEAR' };

  const parts = id.split('-');
  const prefix = parts[0];

  switch (prefix) {
    case '5y':
      return { level: 'FIVE_YEAR', fiveYearIndex: parseInt(parts[1]) };
    case 'y':
      return { level: 'YEAR', year: parseInt(parts[1]) };
    case 'q':
      return { level: 'QUARTER', year: parseInt(parts[1]), quarter: parseInt(parts[2]) };
    case 'm':
      return { level: 'MONTH', year: parseInt(parts[1]), month: parseInt(parts[2]) };
    case 'w':
      if (parts.length === 4) {
        return { level: 'WEEK', year: parseInt(parts[1]), month: parseInt(parts[2]), week: parseInt(parts[3]) };
      }
      return { level: 'WEEK', year: parseInt(parts[1]), week: parseInt(parts[2]) };
    case 'd':
      return { level: 'DAY', year: parseInt(parts[1]), month: parseInt(parts[2]), day: parseInt(parts[3]) };
    default:
      return { level: 'THIRTY_YEAR' };
  }
};

export const getChildPeriodIds = (parentId: string, baseYear: number): string[] => {
  const parsed = parsePeriodId(parentId);
  const { level } = parsed;
  const childLevel = LEVEL_CONFIG[level].childLevel;
  if (!childLevel) return [];

  const ids: string[] = [];

  switch (level) {
    case 'THIRTY_YEAR':
      for (let i = 0; i < 6; i++) {
        ids.push(getPeriodId('FIVE_YEAR', baseYear, { fiveYearIndex: i }));
      }
      break;

    case 'FIVE_YEAR': {
      const validIndex = Math.max(0, Math.min(5, parsed.fiveYearIndex || 0));
      const startYear = baseYear + validIndex * 5;
      for (let i = 0; i < 5; i++) {
        ids.push(getPeriodId('YEAR', baseYear, { year: startYear + i }));
      }
      break;
    }

    case 'YEAR':
      for (let q = 1; q <= 4; q++) {
        ids.push(getPeriodId('QUARTER', baseYear, { year: parsed.year, quarter: q }));
      }
      break;

    case 'QUARTER': {
      const startMonth = ((parsed.quarter || 1) - 1) * 3 + 1;
      for (let i = 0; i < 3; i++) {
        ids.push(getPeriodId('MONTH', baseYear, { year: parsed.year, month: startMonth + i }));
      }
      break;
    }

    case 'MONTH': {
      const year = parsed.year || baseYear;
      const month = parsed.month || 1;
      const weeks = getWeeksInMonth(year, month);
      weeks.forEach(w => {
        ids.push(`w-${year}-${String(month).padStart(2, '0')}-${w.weekNum}`);
      });
      break;
    }

    case 'WEEK': {
      if (parsed.month) {
        const weeks = getWeeksInMonth(parsed.year || baseYear, parsed.month);
        const weekInfo = weeks.find(w => w.weekNum === parsed.week);
        if (weekInfo) {
          let current = new Date(weekInfo.start);
          while (current <= weekInfo.end) {
            ids.push(getPeriodId('DAY', baseYear, {
              year: current.getFullYear(),
              month: current.getMonth() + 1,
              day: current.getDate(),
            }));
            current.setDate(current.getDate() + 1);
          }
        }
      } else {
        const monday = getMondayOfWeek(parsed.year || baseYear, parsed.week || 1);
        for (let d = 0; d < 7; d++) {
          const date = new Date(monday);
          date.setDate(monday.getDate() + d);
          ids.push(getPeriodId('DAY', baseYear, {
            year: date.getFullYear(),
            month: date.getMonth() + 1,
            day: date.getDate(),
          }));
        }
      }
      break;
    }
  }

  return ids;
};

export const getParentPeriodId = (childId: string, baseYear: number): string | null => {
  const parsed = parsePeriodId(childId);

  switch (parsed.level) {
    case 'THIRTY_YEAR': return null;
    case 'FIVE_YEAR': return '30y';
    case 'YEAR': {
      const rawIndex = Math.floor((parsed.year! - baseYear) / 5);
      const fiveYearIndex = Math.max(0, Math.min(5, rawIndex));
      return `5y-${fiveYearIndex}`;
    }
    case 'QUARTER': return `y-${parsed.year}`;
    case 'MONTH': {
      const quarter = Math.ceil(parsed.month! / 3);
      return `q-${parsed.year}-${quarter}`;
    }
    case 'WEEK': {
      if (parsed.month) {
        return `m-${parsed.year}-${String(parsed.month).padStart(2, '0')}`;
      }
      const monday = getMondayOfWeek(parsed.year || baseYear, parsed.week || 1);
      const estimatedMonth = monday.getMonth() + 1;
      return `m-${parsed.year}-${String(estimatedMonth).padStart(2, '0')}`;
    }
    case 'DAY': {
      const year = parsed.year!;
      const month = parsed.month!;
      const day = parsed.day!;
      const weeks = getWeeksInMonth(year, month);
      const targetDate = new Date(year, month - 1, day);
      for (const week of weeks) {
        if (targetDate >= week.start && targetDate <= week.end) {
          return `w-${year}-${String(month).padStart(2, '0')}-${week.weekNum}`;
        }
      }
      return `w-${year}-${String(month).padStart(2, '0')}-1`;
    }
    default: return null;
  }
};

// 현재 날짜 기준 Period ID 생성
export const getCurrentPeriodId = (level: Level, baseYear: number): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  switch (level) {
    case 'THIRTY_YEAR': return '30y';
    case 'FIVE_YEAR': {
      const fiveYearIndex = Math.max(0, Math.min(5, Math.floor((year - baseYear) / 5)));
      return getPeriodId('FIVE_YEAR', baseYear, { fiveYearIndex });
    }
    case 'YEAR': return getPeriodId('YEAR', baseYear, { year });
    case 'QUARTER': {
      const quarter = Math.ceil(month / 3);
      return getPeriodId('QUARTER', baseYear, { year, quarter });
    }
    case 'MONTH': return getPeriodId('MONTH', baseYear, { year, month });
    case 'WEEK': {
      const weeks = getWeeksInMonth(year, month);
      const targetDate = new Date(year, month - 1, day);
      for (const week of weeks) {
        if (targetDate >= week.start && targetDate <= week.end) {
          return `w-${year}-${String(month).padStart(2, '0')}-${week.weekNum}`;
        }
      }
      return `w-${year}-${String(month).padStart(2, '0')}-1`;
    }
    case 'DAY': return getPeriodId('DAY', baseYear, { year, month, day });
    default: return '30y';
  }
};
