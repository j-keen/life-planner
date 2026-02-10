import { Period, Item, DailyRecord, AnnualEvent, Level, LEVEL_CONFIG } from '../types/plan';

// 검색 결과 타입
export type SearchResultType = 'todo' | 'routine' | 'memo' | 'goal' | 'record' | 'event';

export interface SearchResult {
  type: SearchResultType;
  periodId: string;
  periodLevel?: Level;
  content: string;
  highlight: string; // 검색어가 포함된 컨텍스트
  item?: Item;
  record?: DailyRecord;
  event?: AnnualEvent;
}

export interface SearchOptions {
  query: string;
  types?: SearchResultType[];
  limit?: number;
}

// 하이라이트 매칭 (검색어 주변 컨텍스트 추출)
function highlightMatch(text: string, query: string): string {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) return text.slice(0, 100);

  const start = Math.max(0, index - 30);
  const end = Math.min(text.length, index + query.length + 30);
  let result = text.slice(start, end);

  if (start > 0) result = '...' + result;
  if (end < text.length) result = result + '...';

  return result;
}

// 기간 ID에서 읽기 좋은 제목 생성
function getPeriodLabel(periodId: string): string {
  if (periodId === '30y') return '30년 계획';

  const parts = periodId.split('-');
  const prefix = parts[0];

  switch (prefix) {
    case '5y':
      return `${parts[1]}~${parseInt(parts[1]) + 4}년`;
    case 'y':
      return `${parts[1]}년`;
    case 'q':
      return `${parts[1]}년 ${parts[2]}분기`;
    case 'm':
      return `${parts[1]}년 ${parseInt(parts[2])}월`;
    case 'w':
      return `${parts[1]}년 ${parseInt(parts[2])}주차`;
    case 'd':
      return `${parts[1]}년 ${parseInt(parts[2])}월 ${parseInt(parts[3])}일`;
    default:
      return periodId;
  }
}

// 전체 데이터 검색
export function searchAllData(
  periods: Record<string, Period>,
  records: Record<string, DailyRecord>,
  annualEvents: AnnualEvent[],
  options: SearchOptions
): SearchResult[] {
  const { query, types, limit = 50 } = options;

  if (!query || query.length < 2) return [];

  const results: SearchResult[] = [];
  const lowerQuery = query.toLowerCase();

  // 검색 대상 타입 (기본: 전체)
  const searchTypes = types || ['todo', 'routine', 'memo', 'goal', 'record', 'event'];

  // 1. Periods 검색 (할일, 루틴, 메모, 목표)
  for (const [periodId, period] of Object.entries(periods)) {
    // 목표 검색
    if (searchTypes.includes('goal')) {
      if (period.goal?.toLowerCase().includes(lowerQuery)) {
        results.push({
          type: 'goal',
          periodId,
          periodLevel: period.level,
          content: `${LEVEL_CONFIG[period.level].label} 목표: ${period.goal}`,
          highlight: highlightMatch(period.goal, query),
        });
      }
      if (period.motto?.toLowerCase().includes(lowerQuery)) {
        results.push({
          type: 'goal',
          periodId,
          periodLevel: period.level,
          content: `${LEVEL_CONFIG[period.level].label} 다짐: ${period.motto}`,
          highlight: highlightMatch(period.motto, query),
        });
      }
    }

    // 할일 검색
    if (searchTypes.includes('todo')) {
      for (const todo of period.todos || []) {
        if (todo.content.toLowerCase().includes(lowerQuery)) {
          results.push({
            type: 'todo',
            periodId,
            periodLevel: period.level,
            content: todo.content,
            highlight: highlightMatch(todo.content, query),
            item: todo,
          });
        }
        if (todo.note?.toLowerCase().includes(lowerQuery)) {
          results.push({
            type: 'todo',
            periodId,
            periodLevel: period.level,
            content: `${todo.content} (메모)`,
            highlight: highlightMatch(todo.note, query),
            item: todo,
          });
        }
      }

      // slots 내의 할일도 검색
      for (const slotItems of Object.values(period.slots || {})) {
        for (const item of slotItems) {
          if (item.content.toLowerCase().includes(lowerQuery)) {
            results.push({
              type: 'todo',
              periodId,
              periodLevel: period.level,
              content: item.content,
              highlight: highlightMatch(item.content, query),
              item,
            });
          }
        }
      }

      // timeSlots 내의 항목도 검색 (DAY 레벨)
      if (period.timeSlots) {
        for (const timeSlotItems of Object.values(period.timeSlots)) {
          for (const item of timeSlotItems) {
            if (item.content.toLowerCase().includes(lowerQuery)) {
              results.push({
                type: 'todo',
                periodId,
                periodLevel: period.level,
                content: item.content,
                highlight: highlightMatch(item.content, query),
                item,
              });
            }
          }
        }
      }
    }

    // 루틴 검색
    if (searchTypes.includes('routine')) {
      for (const routine of period.routines || []) {
        if (routine.content.toLowerCase().includes(lowerQuery)) {
          results.push({
            type: 'routine',
            periodId,
            periodLevel: period.level,
            content: routine.content,
            highlight: highlightMatch(routine.content, query),
            item: routine,
          });
        }
        if (routine.note?.toLowerCase().includes(lowerQuery)) {
          results.push({
            type: 'routine',
            periodId,
            periodLevel: period.level,
            content: `${routine.content} (메모)`,
            highlight: highlightMatch(routine.note, query),
            item: routine,
          });
        }
      }
    }

    // 메모 검색
    if (searchTypes.includes('memo')) {
      for (const memo of period.structuredMemos || []) {
        if (memo.content.toLowerCase().includes(lowerQuery)) {
          results.push({
            type: 'memo',
            periodId,
            periodLevel: period.level,
            content: memo.content.slice(0, 100),
            highlight: highlightMatch(memo.content, query),
          });
        }
      }
      // 기존 메모 배열도 검색 (하위 호환)
      for (const memoContent of period.memos || []) {
        if (memoContent.toLowerCase().includes(lowerQuery)) {
          results.push({
            type: 'memo',
            periodId,
            periodLevel: period.level,
            content: memoContent.slice(0, 100),
            highlight: highlightMatch(memoContent, query),
          });
        }
      }
    }
  }

  // 2. Records 검색 (일일 기록)
  if (searchTypes.includes('record')) {
    for (const [, record] of Object.entries(records)) {
      if (record.content?.toLowerCase().includes(lowerQuery)) {
        results.push({
          type: 'record',
          periodId: record.periodId,
          content: `${getPeriodLabel(record.periodId)} 기록`,
          highlight: highlightMatch(record.content, query),
          record,
        });
      }
      for (const hl of record.highlights || []) {
        if (hl.toLowerCase().includes(lowerQuery)) {
          results.push({
            type: 'record',
            periodId: record.periodId,
            content: `${getPeriodLabel(record.periodId)} 하이라이트`,
            highlight: highlightMatch(hl, query),
            record,
          });
        }
      }
      for (const gr of record.gratitude || []) {
        if (gr.toLowerCase().includes(lowerQuery)) {
          results.push({
            type: 'record',
            periodId: record.periodId,
            content: `${getPeriodLabel(record.periodId)} 감사`,
            highlight: highlightMatch(gr, query),
            record,
          });
        }
      }
    }
  }

  // 3. AnnualEvents 검색 (기념일)
  if (searchTypes.includes('event')) {
    for (const event of annualEvents) {
      if (event.title.toLowerCase().includes(lowerQuery)) {
        results.push({
          type: 'event',
          periodId: `event-${event.id}`,
          content: `${event.month}월 ${event.day}일: ${event.title}`,
          highlight: highlightMatch(event.title, query),
          event,
        });
      }
      if (event.note?.toLowerCase().includes(lowerQuery)) {
        results.push({
          type: 'event',
          periodId: `event-${event.id}`,
          content: `${event.title} (메모)`,
          highlight: highlightMatch(event.note, query),
          event,
        });
      }
    }
  }

  // 중복 제거 (동일 periodId + type + content)
  const seen = new Set<string>();
  const uniqueResults = results.filter(r => {
    const key = `${r.type}-${r.periodId}-${r.content}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return uniqueResults.slice(0, limit);
}

// 타입별 라벨
export function getTypeLabel(type: SearchResultType): string {
  const labels: Record<SearchResultType, string> = {
    todo: '할일',
    routine: '루틴',
    memo: '메모',
    goal: '목표',
    record: '기록',
    event: '기념일',
  };
  return labels[type];
}

// 타입별 배지 색상
export function getTypeBadgeColor(type: SearchResultType): string {
  const colors: Record<SearchResultType, string> = {
    todo: 'bg-blue-100 text-blue-700',
    routine: 'bg-purple-100 text-purple-700',
    memo: 'bg-amber-100 text-amber-700',
    goal: 'bg-green-100 text-green-700',
    record: 'bg-cyan-100 text-cyan-700',
    event: 'bg-pink-100 text-pink-700',
  };
  return colors[type];
}
