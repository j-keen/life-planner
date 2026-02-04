#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// Tool implementations
import { getPeriod, getCurrentPeriod, getChildPeriods, getPeriodSummary, suggestPlan } from './tools/period-tools.js';
import { addItem, updateItem, deleteItem, toggleComplete, searchItems } from './tools/item-tools.js';
import { assignToSlot, assignToTimeSlot } from './tools/slot-tools.js';
import { getRecord, updateRecord } from './tools/record-tools.js';
import { listEvents, addEvent } from './tools/event-tools.js';
import { updatePeriodHeader } from './tools/progress-tools.js';

const DEFAULT_BASE_YEAR = new Date().getFullYear();

const server = new McpServer({
  name: 'life-planner',
  version: '1.0.0',
});

// ═══════════════════════════════════════════════════════════════
// 읽기 도구
// ═══════════════════════════════════════════════════════════════

server.tool(
  'get_period',
  '기간(Period) 데이터를 조회합니다. 목표, 할일, 루틴, 슬롯 배정 등 전체 데이터를 반환합니다.',
  {
    period_id: z.string().describe('기간 ID (예: "30y", "y-2026", "m-2026-02", "w-2026-02-1", "d-2026-02-03")'),
  },
  async ({ period_id }) => {
    const period = await getPeriod(period_id);
    if (!period) {
      return { content: [{ type: 'text' as const, text: JSON.stringify({ error: `기간 ${period_id}이(가) 존재하지 않습니다.` }) }] };
    }
    return { content: [{ type: 'text' as const, text: JSON.stringify(period, null, 2) }] };
  }
);

server.tool(
  'get_current_period',
  '현재 날짜 기준으로 해당 레벨의 기간을 조회합니다.',
  {
    level: z.enum(['THIRTY_YEAR', 'FIVE_YEAR', 'YEAR', 'QUARTER', 'MONTH', 'WEEK', 'DAY']).describe('기간 레벨'),
    base_year: z.number().optional().describe('30년 계획 기준 연도 (기본값: 올해)'),
  },
  async ({ level, base_year }) => {
    const result = await getCurrentPeriod(level, base_year ?? DEFAULT_BASE_YEAR);
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          periodId: result.periodId,
          period: result.period,
        }, null, 2),
      }],
    };
  }
);

server.tool(
  'get_child_periods',
  '하위 기간 목록과 각 기간의 요약 통계를 조회합니다.',
  {
    period_id: z.string().describe('부모 기간 ID'),
    base_year: z.number().optional().describe('30년 계획 기준 연도 (기본값: 올해)'),
  },
  async ({ period_id, base_year }) => {
    const result = await getChildPeriods(period_id, base_year ?? DEFAULT_BASE_YEAR);
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'get_period_summary',
  '기간의 완료율, 항목 수, 할일/루틴 목록 등 요약 정보를 조회합니다.',
  {
    period_id: z.string().describe('기간 ID'),
  },
  async ({ period_id }) => {
    const result = await getPeriodSummary(period_id);
    if (!result) {
      return { content: [{ type: 'text' as const, text: JSON.stringify({ error: `기간 ${period_id}이(가) 존재하지 않습니다.` }) }] };
    }
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'search_items',
  '할일/루틴을 텍스트로 검색합니다.',
  {
    query: z.string().describe('검색어'),
    level: z.enum(['THIRTY_YEAR', 'FIVE_YEAR', 'YEAR', 'QUARTER', 'MONTH', 'WEEK', 'DAY']).optional().describe('특정 레벨만 검색'),
    completed: z.boolean().optional().describe('완료 상태 필터 (true/false)'),
  },
  async ({ query, level, completed }) => {
    const results = await searchItems({ query, level, completed });
    return { content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }] };
  }
);

server.tool(
  'get_record',
  '일일 기록(일지/회고)을 조회합니다.',
  {
    period_id: z.string().describe('DAY 기간 ID (예: "d-2026-02-03")'),
  },
  async ({ period_id }) => {
    const record = await getRecord(period_id);
    if (!record) {
      return { content: [{ type: 'text' as const, text: JSON.stringify({ message: `기록이 없습니다: ${period_id}` }) }] };
    }
    return { content: [{ type: 'text' as const, text: JSON.stringify(record, null, 2) }] };
  }
);

server.tool(
  'list_events',
  '기념일/이벤트 목록을 조회합니다.',
  {
    month: z.number().optional().describe('특정 월만 조회 (1-12)'),
    upcoming_days: z.number().optional().describe('향후 N일 이내 이벤트만 조회'),
  },
  async ({ month, upcoming_days }) => {
    const events = await listEvents({ month, upcomingDays: upcoming_days });
    return { content: [{ type: 'text' as const, text: JSON.stringify(events, null, 2) }] };
  }
);

server.tool(
  'suggest_plan',
  '상위 목표 체인을 수집하여 계획 수립에 필요한 컨텍스트를 제공합니다.',
  {
    period_id: z.string().describe('계획을 세울 기간 ID'),
    base_year: z.number().optional().describe('30년 계획 기준 연도 (기본값: 올해)'),
  },
  async ({ period_id, base_year }) => {
    const result = await suggestPlan(period_id, base_year ?? DEFAULT_BASE_YEAR);
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

// ═══════════════════════════════════════════════════════════════
// 쓰기 도구
// ═══════════════════════════════════════════════════════════════

server.tool(
  'add_item',
  '할일 또는 루틴을 추가합니다. content에는 짧은 제목, note에는 상세 내용을 입력합니다.',
  {
    period_id: z.string().describe('추가할 기간 ID'),
    content: z.string().describe('항목 내용'),
    type: z.enum(['todo', 'routine']).describe('유형 (todo: 할일, routine: 루틴)'),
    category: z.string().optional().describe('루틴 카테고리 (work/health/relationship/finance/growth/uncategorized)'),
    todo_category: z.string().optional().describe('할일 카테고리 (personal/work/other)'),
    target_count: z.number().optional().describe('루틴 목표 횟수'),
    note: z.string().optional().describe('상세 메모 (항목 클릭 시 표시되는 세부 내용)'),
  },
  async ({ period_id, content, type, category, todo_category, target_count, note }) => {
    const result = await addItem({
      periodId: period_id,
      content,
      type,
      category,
      todoCategory: todo_category,
      targetCount: target_count,
      note,
    });
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'update_item',
  '항목의 내용, 메모, 색상을 수정합니다.',
  {
    period_id: z.string().describe('항목이 속한 기간 ID'),
    item_id: z.string().describe('수정할 항목 ID'),
    content: z.string().optional().describe('새 내용'),
    note: z.string().optional().describe('새 메모'),
    color: z.string().optional().describe('새 색상 (Tailwind 배경색 클래스, 예: bg-red-100)'),
  },
  async ({ period_id, item_id, content, note, color }) => {
    const result = await updateItem({ periodId: period_id, itemId: item_id, content, note, color });
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'delete_item',
  '항목을 삭제합니다. 하위 항목도 연쇄 삭제됩니다.',
  {
    period_id: z.string().describe('항목이 속한 기간 ID'),
    item_id: z.string().describe('삭제할 항목 ID'),
  },
  async ({ period_id, item_id }) => {
    const result = await deleteItem({ periodId: period_id, itemId: item_id });
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'toggle_complete',
  '항목의 완료 상태를 토글합니다. 상위/하위 항목에 연쇄 반영됩니다.',
  {
    period_id: z.string().describe('항목이 속한 기간 ID'),
    item_id: z.string().describe('토글할 항목 ID'),
  },
  async ({ period_id, item_id }) => {
    const result = await toggleComplete({ periodId: period_id, itemId: item_id });
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'assign_to_slot',
  '할일/루틴을 하위 기간 슬롯에 배정합니다. 하위 기간에도 전파됩니다.',
  {
    period_id: z.string().describe('현재 기간 ID'),
    item_id: z.string().describe('배정할 항목 ID'),
    target_slot_id: z.string().describe('배정 대상 하위 기간 ID'),
    sub_content: z.string().optional().describe('세부 내용 (예: "팔굽혀펴기" → "운동: 팔굽혀펴기")'),
  },
  async ({ period_id, item_id, target_slot_id, sub_content }) => {
    const result = await assignToSlot({
      periodId: period_id,
      itemId: item_id,
      targetSlotId: target_slot_id,
      subContent: sub_content,
    });
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'assign_to_time_slot',
  '할일/루틴을 시간대 슬롯에 배정합니다 (DAY 레벨 전용).',
  {
    period_id: z.string().describe('DAY 기간 ID'),
    item_id: z.string().describe('배정할 항목 ID'),
    time_slot: z.enum([
      'morning_early', 'morning_late',
      'afternoon_early', 'afternoon_late',
      'evening_early', 'evening_late',
      'anytime', 'dawn',
    ]).describe('시간대 슬롯'),
    sub_content: z.string().optional().describe('세부 내용'),
  },
  async ({ period_id, item_id, time_slot, sub_content }) => {
    const result = await assignToTimeSlot({
      periodId: period_id,
      itemId: item_id,
      timeSlot: time_slot,
      subContent: sub_content,
    });
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'update_period_header',
  '기간의 목표와 좌우명을 수정합니다.',
  {
    period_id: z.string().describe('기간 ID'),
    goal: z.string().optional().describe('새 목표'),
    motto: z.string().optional().describe('새 좌우명'),
  },
  async ({ period_id, goal, motto }) => {
    const result = await updatePeriodHeader({ periodId: period_id, goal, motto });
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'update_record',
  '일일 기록을 작성/수정합니다.',
  {
    period_id: z.string().describe('DAY 기간 ID'),
    content: z.string().optional().describe('기록 내용 (마크다운)'),
    mood: z.enum(['great', 'good', 'okay', 'bad', 'terrible']).optional().describe('오늘의 기분'),
    highlights: z.array(z.string()).optional().describe('하이라이트/성취 목록'),
    gratitude: z.array(z.string()).optional().describe('감사한 것들 목록'),
  },
  async ({ period_id, content, mood, highlights, gratitude }) => {
    const result = await updateRecord({
      periodId: period_id,
      content,
      mood,
      highlights,
      gratitude,
    });
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'add_event',
  '기념일/이벤트를 추가합니다.',
  {
    title: z.string().describe('이벤트 제목'),
    type: z.enum(['birthday', 'anniversary', 'memorial', 'holiday', 'other']).describe('이벤트 유형'),
    month: z.number().describe('월 (1-12)'),
    day: z.number().describe('일 (1-31)'),
    lunar_date: z.boolean().optional().describe('음력 여부'),
    note: z.string().optional().describe('메모'),
  },
  async ({ title, type, month, day, lunar_date, note }) => {
    const result = await addEvent({
      title,
      type,
      month,
      day,
      lunarDate: lunar_date,
      note,
    });
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

// ═══════════════════════════════════════════════════════════════
// 서버 시작
// ═══════════════════════════════════════════════════════════════

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Life Planner MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
