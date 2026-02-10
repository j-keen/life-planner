import { Category, TodoCategory } from '../../types/plan';

// ═══════════════════════════════════════════════════════════════
// 할일 카테고리별 힌트 텍스트
// ═══════════════════════════════════════════════════════════════
export const TODO_PLACEHOLDER: Record<TodoCategory, string> = {
  personal: '+ 개인 할일 추가',
  work: '+ 업무 할일 추가',
  other: '+ 기타 할일 추가',
};

// ═══════════════════════════════════════════════════════════════
// 루틴 카테고리별 힌트 텍스트
// ═══════════════════════════════════════════════════════════════
export const ROUTINE_PLACEHOLDER: Record<Category, string> = {
  work: '+ 이메일 확인 / 2',
  health: '+ 운동 / 3',
  relationship: '+ 연락하기 / 2',
  finance: '+ 가계부 정리 / 1',
  growth: '+ 독서 30분 / 5',
  uncategorized: '+ 루틴 / 횟수',
};

// ═══════════════════════════════════════════════════════════════
// 할일 카테고리 border 색상
// ═══════════════════════════════════════════════════════════════
export const getTodoCategoryBorderColor = (category: TodoCategory): string => {
  const colors: Record<TodoCategory, string> = {
    personal: '#06b6d4',    // cyan-500
    work: '#6366f1',        // indigo-500
    other: '#64748b',       // slate-500
  };
  return colors[category];
};

// ═══════════════════════════════════════════════════════════════
// 루틴 카테고리 border 색상
// ═══════════════════════════════════════════════════════════════
export const getCategoryBorderColor = (category: Category): string => {
  const colors: Record<Category, string> = {
    work: '#3b82f6',        // blue-500
    health: '#22c55e',      // green-500
    relationship: '#f43f5e', // rose-500
    finance: '#f59e0b',     // amber-500
    growth: '#a855f7',      // purple-500
    uncategorized: '#9ca3af', // gray-400
  };
  return colors[category];
};
