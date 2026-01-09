// 한국 공휴일 유틸리티
import { holidaysKR } from '@hyunbinseo/holidays-kr';

// 특정 날짜가 공휴일인지 확인
export function isKoreanHoliday(date: Date): boolean {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const holidays = holidaysKR.get(year);
  if (!holidays) return false;

  return holidays.some(h => h.date === dateStr);
}

// 특정 날짜의 공휴일 이름 반환 (없으면 null)
export function getHolidayName(date: Date): string | null {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const holidays = holidaysKR.get(year);
  if (!holidays) return null;

  const holiday = holidays.find(h => h.date === dateStr);
  return holiday?.name || null;
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
