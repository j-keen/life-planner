import { Level } from '../../types/plan';

// ═══════════════════════════════════════════════════════════════
// 현재 기간 제목 생성
// ═══════════════════════════════════════════════════════════════
export const getPeriodTitle = (
  currentLevel: Level,
  parsed: {
    level?: string;
    year?: number;
    quarter?: number;
    month?: number;
    week?: number;
    day?: number;
    fiveYearIndex?: number;
  },
  baseYear: number,
  currentPeriodId: string,
): string => {
  switch (currentLevel) {
    case 'THIRTY_YEAR':
      return `${baseYear}~${baseYear + 29} (30년)`;
    case 'FIVE_YEAR': {
      // fiveYearIndex를 0-5로 제한
      const validIndex = Math.max(0, Math.min(5, parsed.fiveYearIndex || 0));
      const startYear = baseYear + validIndex * 5;
      const endYear = startYear + 4;
      return `${startYear}~${endYear} (5년)`;
    }
    case 'YEAR':
      return `${parsed.year}년`;
    case 'QUARTER':
      return `${parsed.year}년 ${parsed.quarter}분기`;
    case 'MONTH':
      return `${parsed.year}년 ${parsed.month}월`;
    case 'WEEK':
      if (parsed.month) {
        return `${parsed.year}년 ${parsed.month}월 ${parsed.week}주차`;
      }
      return `${parsed.year}년 ${parsed.week}주차`;
    case 'DAY':
      return `${parsed.year}년 ${parsed.month}월 ${parsed.day}일`;
    default:
      return currentPeriodId;
  }
};

// ═══════════════════════════════════════════════════════════════
// 레벨별 최적 그리드 레이아웃 (반응형)
// ═══════════════════════════════════════════════════════════════
export const getGridStyle = (currentLevel: Level, isMobile: boolean = false): React.CSSProperties => {
  if (isMobile) {
    // 모바일: 세로 스크롤 레이아웃
    switch (currentLevel) {
      case 'THIRTY_YEAR':
        return { gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: 'repeat(3, minmax(120px, auto))' };
      case 'FIVE_YEAR':
        return { gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: 'repeat(3, minmax(100px, auto))' };
      case 'YEAR':
        return { gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: 'repeat(2, minmax(120px, auto))' };
      case 'QUARTER':
        return { gridTemplateColumns: '1fr', gridTemplateRows: 'repeat(3, minmax(100px, auto))' };
      case 'MONTH':
        return { gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: 'repeat(3, minmax(80px, auto))' };
      case 'WEEK':
        return { gridTemplateColumns: '1fr', gridTemplateRows: 'repeat(7, minmax(80px, auto))' };
      default:
        return { gridTemplateColumns: '1fr' };
    }
  }
  // 데스크톱
  switch (currentLevel) {
    case 'THIRTY_YEAR':
      return { gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(2, 1fr)' };
    case 'FIVE_YEAR':
      return { gridTemplateColumns: 'repeat(5, 1fr)', gridTemplateRows: '1fr' };
    case 'YEAR':
      return { gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: '1fr' };
    case 'QUARTER':
      return { gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: '1fr' };
    case 'MONTH':
      return { gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(2, 1fr)' };
    case 'WEEK':
      return { gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'repeat(2, 1fr)' };
    default:
      return { gridTemplateColumns: 'repeat(4, 1fr)' };
  }
};
