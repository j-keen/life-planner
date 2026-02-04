import { parsePeriodId, getWeeksInMonth, getMondayOfWeek } from './periodUtils';
import { TimeSlot } from '../../types/plan';

// 슬롯 라벨 생성 (상세)
export const getSlotLabel = (childId: string, baseYear: number): string => {
  const parsed = parsePeriodId(childId);

  switch (parsed.level) {
    case 'FIVE_YEAR': {
      // fiveYearIndex를 0-5로 제한
      const validIndex = Math.max(0, Math.min(5, parsed.fiveYearIndex || 0));
      const startYear = baseYear + validIndex * 5;
      const endYear = startYear + 4;
      return `${startYear}~${endYear}년`;
    }
    case 'YEAR':
      return `${parsed.year}년`;
    case 'QUARTER': {
      // "2026년 1분기 (1~3월)" 형식으로 상세 표시
      const q = parsed.quarter || 1;
      const startMonth = (q - 1) * 3 + 1;
      const endMonth = startMonth + 2;
      return `${parsed.year}년 ${q}분기 (${startMonth}~${endMonth}월)`;
    }
    case 'MONTH':
      // 연도와 함께 표시: "2026년 1월"
      return `${parsed.year}년 ${parsed.month}월`;
    case 'WEEK': {
      if (parsed.month) {
        // 새 형식: 월 기준 주차
        const weeks = getWeeksInMonth(parsed.year || baseYear, parsed.month);
        const weekInfo = weeks.find(w => w.weekNum === parsed.week);
        if (weekInfo) {
          const startStr = `${weekInfo.start.getMonth() + 1}/${weekInfo.start.getDate()}`;
          const endStr = `${weekInfo.end.getMonth() + 1}/${weekInfo.end.getDate()}`;
          return `${parsed.week}주차 (${startStr}~${endStr})`;
        }
        return `${parsed.week}주차`;
      }
      // 기존 형식 (ISO 주차)
      const monday = getMondayOfWeek(parsed.year || baseYear, parsed.week || 1);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const startStr = `${monday.getMonth() + 1}/${monday.getDate()}`;
      const endStr = `${sunday.getMonth() + 1}/${sunday.getDate()}`;
      return `${parsed.week}주차 (${startStr}~${endStr})`;
    }
    case 'DAY': {
      // "1월 6일 (월)" 형식으로 더 읽기 쉽게
      const date = new Date(parsed.year!, parsed.month! - 1, parsed.day);
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      return `${parsed.month}월 ${parsed.day}일 (${days[date.getDay()]})`;
    }
    default:
      return childId;
  }
};

// 간단한 슬롯 라벨 (공간이 좁을 때 사용)
export const getSlotLabelShort = (childId: string, baseYear: number): string => {
  const parsed = parsePeriodId(childId);

  switch (parsed.level) {
    case 'FIVE_YEAR': {
      const validIndex = Math.max(0, Math.min(5, parsed.fiveYearIndex || 0));
      const startYear = baseYear + validIndex * 5;
      return `${startYear}~`;
    }
    case 'YEAR':
      return `${parsed.year}`;
    case 'QUARTER':
      return `${parsed.quarter}분기`;
    case 'MONTH':
      return `${parsed.month}월`;
    case 'WEEK': {
      if (parsed.month) {
        // 새 형식: 월 기준 주차 (시작 날짜만)
        const weeks = getWeeksInMonth(parsed.year || baseYear, parsed.month);
        const weekInfo = weeks.find(w => w.weekNum === parsed.week);
        if (weekInfo) {
          return `${weekInfo.start.getMonth() + 1}/${weekInfo.start.getDate()}~`;
        }
        return `${parsed.week}주`;
      }
      // 기존 형식 (ISO 주차)
      const monday = getMondayOfWeek(parsed.year || baseYear, parsed.week || 1);
      return `${monday.getMonth() + 1}/${monday.getDate()}~`;
    }
    case 'DAY': {
      const date = new Date(parsed.year!, parsed.month! - 1, parsed.day);
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      return `${parsed.day}(${days[date.getDay()]})`;
    }
    default:
      return childId;
  }
};

// 시간대 슬롯 ID 생성 (일 뷰 전용)
export const getTimeSlotId = (periodId: string, timeSlot: TimeSlot): string => {
  return `ts-${periodId}-${timeSlot}`;
};

// 시간대 슬롯 ID 파싱
export const parseTimeSlotId = (slotId: string): { periodId: string; timeSlot: TimeSlot } | null => {
  if (!slotId.startsWith('ts-')) return null;
  const parts = slotId.split('-');
  // ts-d-2025-01-06-morning -> periodId: d-2025-01-06, timeSlot: morning
  const timeSlot = parts[parts.length - 1] as TimeSlot;
  const periodId = parts.slice(1, -1).join('-');
  return { periodId, timeSlot };
};
