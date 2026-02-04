import { Level, Item, Period, TimeSlot, Category, TodoCategory, DailyRecord, Mood, AnnualEvent, Memo } from '../../types/plan';

// 고유 ID 생성 (crypto.randomUUID 우선, 폴백으로 Math.random)
export const genId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substr(2, 9);
};

// 빈 기간 생성
export const createEmptyPeriod = (id: string, level: Level): Period => {
  const base: Period = {
    id,
    level,
    goal: '',
    motto: '',
    memo: '',
    memos: [],  // deprecated: 하위호환용
    structuredMemos: [],  // 새로운 구조화된 메모 배열
    todos: [],
    routines: [],
    slots: {},
  };

  // DAY 레벨은 timeSlots 초기화 (8칸)
  if (level === 'DAY') {
    base.timeSlots = {
      dawn: [],
      morning_early: [],
      morning_late: [],
      afternoon_early: [],
      afternoon_late: [],
      evening_early: [],
      evening_late: [],
      anytime: [],
    };
  }

  return base;
};

// ═══════════════════════════════════════════════════════════════
// 스토어 인터페이스
// ═══════════════════════════════════════════════════════════════
export interface PlanStore {
  // 상태
  currentLevel: Level;
  currentPeriodId: string;
  baseYear: number;
  periods: Record<string, Period>;
  allItems: Record<string, Item>;
  records: Record<string, DailyRecord>;
  viewMode: 'plan' | 'record';

  // 네비게이션
  setBaseYear: (year: number) => void;
  navigateTo: (periodId: string) => void;
  drillDown: (childPeriodId: string) => void;
  drillUp: () => void;

  // 뷰 모드 토글
  setViewMode: (mode: 'plan' | 'record') => void;
  toggleViewMode: () => void;

  // 기간 헤더 수정
  updatePeriodHeader: (field: 'goal' | 'motto' | 'memo', value: string) => void;
  addMemo: (text: string) => void;
  removeMemo: (index: number) => void;
  getInheritedMemos: (periodId: string) => Memo[];  // 상위 기간 메모 수집

  // 항목 CRUD
  addItem: (content: string, to: 'todo' | 'routine', targetCount?: number, category?: Category, todoCategory?: TodoCategory) => void;
  updateItemCategory: (itemId: string, category: Category | undefined, location: 'todo' | 'routine' | 'slot', slotId?: string) => void;
  updateTodoCategory: (itemId: string, todoCategory: TodoCategory) => void;
  deleteItem: (itemId: string, from: 'todo' | 'routine' | 'slot', slotId?: string) => void;
  updateItemContent: (itemId: string, content: string, location: 'todo' | 'routine' | 'slot', slotId?: string) => void;
  updateItemColor: (itemId: string, color: string, location: 'todo' | 'routine' | 'slot', slotId?: string) => void;
  updateItemNote: (itemId: string, note: string, location: 'todo' | 'routine' | 'slot', slotId?: string) => void;

  // 드래그 → 슬롯 배정 (핵심!)
  assignToSlot: (itemId: string, from: 'todo' | 'routine', targetSlotId: string, subContent?: string) => void;

  // 시간대 슬롯 배정 (일 뷰 전용)
  assignToTimeSlot: (itemId: string, from: 'todo' | 'routine', timeSlot: TimeSlot, subContent?: string) => void;

  // 슬롯 간 아이템 이동
  moveSlotItem: (itemId: string, fromSlotId: string, toSlotId: string) => void;

  // 시간대 슬롯 간 아이템 이동
  moveTimeSlotItem: (itemId: string, fromSlotId: string, toSlotId: string) => void;

  // 쪼개기: 하위 항목 추가
  addSubItem: (parentId: string, content: string, location: 'todo' | 'routine') => void;

  // 접기/펼치기 토글
  toggleExpand: (itemId: string, location: 'todo' | 'routine') => void;

  // 완료 토글
  toggleComplete: (itemId: string, location: 'todo' | 'routine' | 'slot', slotId?: string) => void;

  // 달성률 계산
  getProgress: (itemId: string) => number;

  // 기간 확보 (없으면 생성)
  ensurePeriod: (periodId: string) => Period;

  // 현재 기간 가져오기
  getCurrentPeriod: () => Period;

  // 루틴 자동 리셋 (새 기간 진입 시)
  resetRoutinesIfNeeded: (periodId: string) => void;

  // ═══════════════════════════════════════════════════════════════
  // 기록 (Record) 관련
  // ═══════════════════════════════════════════════════════════════
  getRecord: (periodId: string) => DailyRecord | null;
  updateRecordContent: (periodId: string, content: string) => void;
  updateRecordMood: (periodId: string, mood: Mood | undefined) => void;
  addHighlight: (periodId: string, text: string) => void;
  removeHighlight: (periodId: string, index: number) => void;
  addGratitude: (periodId: string, text: string) => void;
  removeGratitude: (periodId: string, index: number) => void;

  // ═══════════════════════════════════════════════════════════════
  // 연간 기념일 관련
  // ═══════════════════════════════════════════════════════════════
  annualEvents: AnnualEvent[];
  addAnnualEvent: (event: Omit<AnnualEvent, 'id' | 'createdAt'>) => void;
  updateAnnualEvent: (id: string, updates: Partial<Omit<AnnualEvent, 'id' | 'createdAt'>>) => void;
  deleteAnnualEvent: (id: string) => void;
  getUpcomingEvents: (days?: number) => Array<AnnualEvent & { daysUntil: number; nextDate: Date }>;
}
