import { Level, LEVEL_CONFIG } from '../../types/plan';

// ═══════════════════════════════════════════════════════════════
// 주간 헬퍼 함수 (ISO 주차, 월요일 시작)
// ═══════════════════════════════════════════════════════════════

// 특정 날짜의 ISO 주차 계산
export const getISOWeek = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // 일요일=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // 목요일 기준
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

// ISO 주차의 연도 (1월 초가 전년도 52/53주, 12월 말이 다음해 1주일 수 있음)
export const getISOWeekYear = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // 목요일 기준
  return d.getUTCFullYear();
};

// 특정 연도의 특정 ISO 주차의 월요일 날짜 계산
export const getMondayOfWeek = (year: number, week: number): Date => {
  // 1월 4일은 항상 첫 번째 ISO 주에 포함됨
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7; // 일요일=7
  // 첫 번째 주의 월요일
  const firstMonday = new Date(jan4);
  firstMonday.setDate(jan4.getDate() - jan4Day + 1);
  // 원하는 주의 월요일
  const targetMonday = new Date(firstMonday);
  targetMonday.setDate(firstMonday.getDate() + (week - 1) * 7);
  return targetMonday;
};

// 특정 날짜가 속한 주의 월요일 계산
export const getMondayOfDate = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay() || 7; // 일요일=7
  d.setDate(d.getDate() - day + 1); // 월요일로 이동
  return d;
};

// 특정 월의 주차 정보 계산 (풀 주차: 항상 월~일 7일)
export const getWeeksInMonth = (year: number, month: number): { weekNum: number; start: Date; end: Date; targetMonth: number }[] => {
  const weeks: { weekNum: number; start: Date; end: Date; targetMonth: number }[] = [];
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);

  // 첫 주의 월요일 찾기 (1일이 포함된 주의 월요일)
  const firstDayOfWeek = firstDay.getDay(); // 0=일, 1=월, ..., 6=토
  const firstMonday = new Date(firstDay);
  if (firstDayOfWeek === 0) {
    // 1일이 일요일이면 6일 전이 월요일
    firstMonday.setDate(firstDay.getDate() - 6);
  } else if (firstDayOfWeek !== 1) {
    // 1일이 월요일이 아니면 해당 주의 월요일로 이동
    firstMonday.setDate(firstDay.getDate() - (firstDayOfWeek - 1));
  }

  let weekNum = 1;
  let currentMonday = new Date(firstMonday);

  // 마지막 날이 포함된 주까지 반복
  while (true) {
    const weekSunday = new Date(currentMonday);
    weekSunday.setDate(currentMonday.getDate() + 6);

    weeks.push({
      weekNum: weekNum++,
      start: new Date(currentMonday),
      end: new Date(weekSunday),
      targetMonth: month  // 기준 월 저장 (다른 달 날짜 회색 처리용)
    });

    // 이 주가 마지막 날을 포함하면 종료
    if (weekSunday >= lastDay) break;

    currentMonday.setDate(currentMonday.getDate() + 7);
  }

  return weeks;
};

// ═══════════════════════════════════════════════════════════════
// ID 체계 (실제 날짜 기반)
// ═══════════════════════════════════════════════════════════════
// THIRTY_YEAR: "30y"
// FIVE_YEAR:   "5y-0" ~ "5y-5" (0번째~5번째 5년 구간)
// YEAR:        "y-2025"
// QUARTER:     "q-2025-1" ~ "q-2025-4"
// MONTH:       "m-2025-01" ~ "m-2025-12"
// WEEK:        "w-2025-01" ~ "w-2025-53" (ISO 주차)
// DAY:         "d-2025-01-01"

export const getPeriodId = (level: Level, baseYear: number, params?: {
  fiveYearIndex?: number;  // 0-5
  year?: number;
  quarter?: number;  // 1-4
  month?: number;    // 1-12
  week?: number;     // 1-53
  day?: number;      // 1-31
}): string => {
  const p = params || {};
  const year = p.year || baseYear;

  switch (level) {
    case 'THIRTY_YEAR':
      return '30y';
    case 'FIVE_YEAR':
      return `5y-${p.fiveYearIndex ?? 0}`;
    case 'YEAR':
      return `y-${year}`;
    case 'QUARTER':
      return `q-${year}-${p.quarter ?? 1}`;
    case 'MONTH':
      return `m-${year}-${String(p.month ?? 1).padStart(2, '0')}`;
    case 'WEEK':
      return `w-${year}-${String(p.week ?? 1).padStart(2, '0')}`;
    case 'DAY':
      return `d-${year}-${String(p.month ?? 1).padStart(2, '0')}-${String(p.day ?? 1).padStart(2, '0')}`;
    default:
      return '30y';
  }
};

// ID에서 정보 파싱
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
      // 새 형식: w-2026-05-2 (연-월-주차)
      if (parts.length === 4) {
        return { level: 'WEEK', year: parseInt(parts[1]), month: parseInt(parts[2]), week: parseInt(parts[3]) };
      }
      // 기존 형식 호환: w-2026-17 (ISO 주차)
      return { level: 'WEEK', year: parseInt(parts[1]), week: parseInt(parts[2]) };
    case 'd':
      return { level: 'DAY', year: parseInt(parts[1]), month: parseInt(parts[2]), day: parseInt(parts[3]) };
    default:
      return { level: 'THIRTY_YEAR' };
  }
};

// 하위 기간 ID들 생성
export const getChildPeriodIds = (parentId: string, baseYear: number): string[] => {
  const parsed = parsePeriodId(parentId);
  const { level } = parsed;
  const childLevel = LEVEL_CONFIG[level].childLevel;
  if (!childLevel) return [];

  const ids: string[] = [];

  switch (level) {
    case 'THIRTY_YEAR':
      // 6개의 5년 구간
      for (let i = 0; i < 6; i++) {
        ids.push(getPeriodId('FIVE_YEAR', baseYear, { fiveYearIndex: i }));
      }
      break;

    case 'FIVE_YEAR': {
      // 5개 년도 (fiveYearIndex를 0-5로 제한)
      const validIndex = Math.max(0, Math.min(5, parsed.fiveYearIndex || 0));
      const startYear = baseYear + validIndex * 5;
      for (let i = 0; i < 5; i++) {
        ids.push(getPeriodId('YEAR', baseYear, { year: startYear + i }));
      }
      break;
    }

    case 'YEAR':
      // 4분기
      for (let q = 1; q <= 4; q++) {
        ids.push(getPeriodId('QUARTER', baseYear, { year: parsed.year, quarter: q }));
      }
      break;

    case 'QUARTER':
      // 3개월
      const startMonth = ((parsed.quarter || 1) - 1) * 3 + 1;
      for (let i = 0; i < 3; i++) {
        ids.push(getPeriodId('MONTH', baseYear, { year: parsed.year, month: startMonth + i }));
      }
      break;

    case 'MONTH': {
      // 해당 월의 실제 주차들 (월 기준 주차 시스템)
      const year = parsed.year || baseYear;
      const month = parsed.month || 1;
      const weeks = getWeeksInMonth(year, month);

      weeks.forEach(w => {
        // 새 형식: w-연도-월-주차번호
        ids.push(`w-${year}-${String(month).padStart(2, '0')}-${w.weekNum}`);
      });
      break;
    }

    case 'WEEK': {
      if (parsed.month) {
        // 새 형식: 해당 월-주차의 날짜만 표시
        const weeks = getWeeksInMonth(parsed.year || baseYear, parsed.month);
        const weekInfo = weeks.find(w => w.weekNum === parsed.week);
        if (weekInfo) {
          let current = new Date(weekInfo.start);
          while (current <= weekInfo.end) {
            ids.push(getPeriodId('DAY', baseYear, {
              year: current.getFullYear(),
              month: current.getMonth() + 1,
              day: current.getDate()
            }));
            current.setDate(current.getDate() + 1);
          }
        }
      } else {
        // 기존 형식 (ISO 주차): 7일 (월요일 ~ 일요일)
        const monday = getMondayOfWeek(parsed.year || baseYear, parsed.week || 1);
        for (let d = 0; d < 7; d++) {
          const date = new Date(monday);
          date.setDate(monday.getDate() + d);
          ids.push(getPeriodId('DAY', baseYear, {
            year: date.getFullYear(),
            month: date.getMonth() + 1,
            day: date.getDate()
          }));
        }
      }
      break;
    }
  }

  return ids;
};

// 리셋 키 생성 (같은 키면 같은 리셋 주기)
export const getResetKey = (periodId: string, sourceLevel: Level): string => {
  const parsed = parsePeriodId(periodId);

  // 출처 레벨에 따라 리셋 주기 결정
  switch (sourceLevel) {
    case 'DAY':
      // 일간 루틴: 날짜가 바뀌면 리셋
      if (parsed.level === 'DAY') {
        return `day-${parsed.year}-${parsed.month}-${parsed.day}`;
      }
      return periodId;

    case 'WEEK':
      // 주간 루틴: 주가 바뀌면 리셋
      if (parsed.level === 'DAY') {
        // 일에서 주차 계산
        const date = new Date(parsed.year!, parsed.month! - 1, parsed.day);
        const startOfYear = new Date(parsed.year!, 0, 1);
        const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
        const weekNum = Math.ceil((days + 1) / 7);
        return `week-${parsed.year}-${weekNum}`;
      }
      return `week-${parsed.year}-${parsed.week}`;

    case 'MONTH':
      // 월간 루틴: 월이 바뀌면 리셋
      if (parsed.level === 'DAY') {
        return `month-${parsed.year}-${parsed.month}`;
      }
      if (parsed.level === 'WEEK') {
        // EC-26 fix: Use actual date instead of Math.ceil(week/4)
        if (parsed.month) {
          return `month-${parsed.year}-${parsed.month}`;
        }
        const monday = getMondayOfWeek(parsed.year || 0, parsed.week || 1);
        return `month-${parsed.year}-${monday.getMonth() + 1}`;
      }
      return `month-${parsed.year}-${parsed.month}`;

    case 'QUARTER':
      // 분기 루틴: 분기가 바뀌면 리셋
      if (parsed.level === 'MONTH') {
        const quarter = Math.ceil(parsed.month! / 3);
        return `quarter-${parsed.year}-${quarter}`;
      }
      return `quarter-${parsed.year}-${parsed.quarter}`;

    case 'YEAR':
      // 연간 루틴: 연도가 바뀌면 리셋
      return `year-${parsed.year}`;

    case 'FIVE_YEAR':
      // 5년 루틴: 5년 구간이 바뀌면 리셋
      return `5year-${parsed.fiveYearIndex}`;

    default:
      // 기본값: 기간 ID 자체
      return periodId;
  }
};

// 이전/다음 기간 ID 찾기
export const getAdjacentPeriodId = (
  currentId: string,
  direction: 'prev' | 'next',
  baseYear: number
): string | null => {
  const parsed = parsePeriodId(currentId);
  const delta = direction === 'next' ? 1 : -1;

  switch (parsed.level) {
    case 'THIRTY_YEAR':
      // 30년은 이동 없음
      return null;

    case 'FIVE_YEAR': {
      const newIndex = (parsed.fiveYearIndex || 0) + delta;
      if (newIndex < 0 || newIndex > 5) return null;
      return getPeriodId('FIVE_YEAR', baseYear, { fiveYearIndex: newIndex });
    }

    case 'YEAR': {
      const newYear = (parsed.year || baseYear) + delta;
      return getPeriodId('YEAR', baseYear, { year: newYear });
    }

    case 'QUARTER': {
      let newQuarter = (parsed.quarter || 1) + delta;
      let newYear = parsed.year || baseYear;
      if (newQuarter < 1) {
        newQuarter = 4;
        newYear--;
      } else if (newQuarter > 4) {
        newQuarter = 1;
        newYear++;
      }
      return getPeriodId('QUARTER', baseYear, { year: newYear, quarter: newQuarter });
    }

    case 'MONTH': {
      let newMonth = (parsed.month || 1) + delta;
      let newYear = parsed.year || baseYear;
      if (newMonth < 1) {
        newMonth = 12;
        newYear--;
      } else if (newMonth > 12) {
        newMonth = 1;
        newYear++;
      }
      return getPeriodId('MONTH', baseYear, { year: newYear, month: newMonth });
    }

    case 'WEEK': {
      let newWeek = (parsed.week || 1) + delta;
      let newYear = parsed.year || baseYear;
      if (newWeek < 1) {
        newWeek = 52;
        newYear--;
      } else if (newWeek > 52) {
        newWeek = 1;
        newYear++;
      }
      return getPeriodId('WEEK', baseYear, { year: newYear, week: newWeek });
    }

    case 'DAY': {
      const currentDate = new Date(parsed.year!, parsed.month! - 1, parsed.day);
      currentDate.setDate(currentDate.getDate() + delta);
      return getPeriodId('DAY', baseYear, {
        year: currentDate.getFullYear(),
        month: currentDate.getMonth() + 1,
        day: currentDate.getDate(),
      });
    }

    default:
      return null;
  }
};

// 부모 기간 ID 찾기
export const getParentPeriodId = (childId: string, baseYear: number): string | null => {
  const parsed = parsePeriodId(childId);

  switch (parsed.level) {
    case 'THIRTY_YEAR':
      return null;
    case 'FIVE_YEAR':
      return '30y';
    case 'YEAR': {
      // fiveYearIndex를 0-5 범위로 제한 (30년 내)
      const rawIndex = Math.floor((parsed.year! - baseYear) / 5);
      const fiveYearIndex = Math.max(0, Math.min(5, rawIndex));
      return `5y-${fiveYearIndex}`;
    }
    case 'QUARTER':
      return `y-${parsed.year}`;
    case 'MONTH': {
      const quarter = Math.ceil(parsed.month! / 3);
      return `q-${parsed.year}-${quarter}`;
    }
    case 'WEEK': {
      if (parsed.month) {
        // 새 형식: 직접 월로 돌아가기
        return `m-${parsed.year}-${String(parsed.month).padStart(2, '0')}`;
      }
      // 기존 형식: ISO 주차에서 월 추정 (EC-12 fix: 13이상 방지)
      const monday = getMondayOfWeek(parsed.year || baseYear, parsed.week || 1);
      const estimatedMonth = monday.getMonth() + 1;
      return `m-${parsed.year}-${String(estimatedMonth).padStart(2, '0')}`;
    }
    case 'DAY': {
      // 해당 날짜가 속한 월의 몇 번째 주인지 계산
      const year = parsed.year!;
      const month = parsed.month!;
      const day = parsed.day!;
      const weeks = getWeeksInMonth(year, month);

      // 해당 날짜가 속하는 주차 찾기
      const targetDate = new Date(year, month - 1, day);
      for (const week of weeks) {
        if (targetDate >= week.start && targetDate <= week.end) {
          return `w-${year}-${String(month).padStart(2, '0')}-${week.weekNum}`;
        }
      }

      // 찾지 못하면 1주차로 기본값
      return `w-${year}-${String(month).padStart(2, '0')}-1`;
    }
    default:
      return null;
  }
};
