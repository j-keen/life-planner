// 한국 공휴일 유틸리티
import { isHoliday, getHolidayNames } from '@hyunbinseo/holidays-kr';

// 특정 날짜가 공휴일인지 확인
export function isKoreanHoliday(date: Date): boolean {
  return isHoliday(date);
}

// 특정 날짜의 공휴일 이름 반환 (없으면 null)
export function getHolidayName(date: Date): string | null {
  const names = getHolidayNames(date);
  return names ? names[0] : null;
}

// 토요일인지 확인 (0=일, 6=토)
export function isSaturday(date: Date): boolean {
  return date.getDay() === 6;
}

// 일요일인지 확인
export function isSunday(date: Date): boolean {
  return date.getDay() === 0;
}

// 주말 또는 공휴일인지 확인
export function isHolidayOrWeekend(date: Date): {
  isHoliday: boolean;
  isSaturday: boolean;
  isSunday: boolean;
  holidayName: string | null;
} {
  return {
    isHoliday: isKoreanHoliday(date),
    isSaturday: isSaturday(date),
    isSunday: isSunday(date),
    holidayName: getHolidayName(date),
  };
}

// period ID에서 Date 객체 생성 (d-YYYY-MM-DD 형식)
export function parseDayPeriodId(periodId: string): Date | null {
  const match = periodId.match(/^d-(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const [, year, month, day] = match;
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}
