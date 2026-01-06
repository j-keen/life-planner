# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run lint     # Run ESLint
```

## Architecture Overview

This is a **Life Planner** app - a 7-level fractal hierarchical life planning system built with Next.js 16.1.1 (App Router), React 19, TypeScript, Zustand, and @dnd-kit.

### 7-Level Hierarchy

The core concept is a fractal drill-down structure for planning across different time scales:

| Level | Label | Contains |
|-------|-------|----------|
| THIRTY_YEAR | 30년 | 6 x 5-year periods |
| FIVE_YEAR | 5년 | 5 x years |
| YEAR | 1년 | 4 x quarters |
| QUARTER | 분기 | 3 x months |
| MONTH | 월 | 5 x weeks |
| WEEK | 주 | 7 x days |
| DAY | 일 | 8 x time slots |

### Period ID System

Period IDs follow a structured format defined in `usePlanStore.ts`:
- `30y` - 30-year period
- `5y-{0-5}` - 5-year segment index
- `y-{year}` - Year (e.g., `y-2025`)
- `q-{year}-{1-4}` - Quarter
- `m-{year}-{01-12}` - Month
- `w-{year}-{01-53}` - ISO week number
- `d-{year}-{month}-{day}` - Day

### Key Data Structures (src/types/plan.ts)

- **Item**: Todo/routine with content, completion status, category, tree structure (parentId/childIds), source tracking
- **Period**: Contains goal/motto/memo header, todos list, routines list, slots (child period assignments), timeSlots (DAY level only)
- **Category**: 5 life areas - work, health, relationship, finance, growth

### State Management (src/store/usePlanStore.ts)

Zustand store with persistence. Key actions:
- `navigateTo(periodId)` - Navigate to specific period
- `drillDown(childPeriodId)` / `drillUp()` - Hierarchy navigation
- `addItem(content, 'todo'|'routine', targetCount?, category?)` - Add items
- `assignToSlot(itemId, from, targetSlotId)` - Drag item to child period
- `assignToTimeSlot(itemId, from, timeSlot)` - DAY level time slot assignment

### Core UI (src/views/FractalView.tsx)

Three-column layout:
- **Left panel**: Todos organized by 5 categories
- **Center**: Grid of child periods (droppable) or time slots (DAY level)
- **Right panel**: Routines organized by 5 categories

Items are dragged from side panels to center grid cells. Drag-and-drop uses @dnd-kit.

### Time Slots (DAY level only)

8 slots in 4x2 grid: dawn, morning_early, morning_late, afternoon_early, afternoon_late, evening_early, evening_late, anytime

### Record View (src/views/RecordView.tsx)

Daily journaling/reflection page with:
- **Mood tracker**: 5 mood options (great/good/okay/bad/terrible)
- **Content**: Free-form text for daily reflection
- **Highlights**: List of achievements/good things
- **Gratitude**: List of things to be thankful for

Toggle between Plan and Record views via header buttons.

### AI Assistant (src/components/ChatAssistant.tsx)

Floating chat widget that reads current period data:
- Analyzes todos, routines, and records
- Provides personalized planning advice
- Uses Google Gemini API via `/api/chat` route

Requires `GEMINI_API_KEY` environment variable.

### Category System

6 categories for organizing items:
- `work` - 업무/학습 (blue)
- `health` - 건강/운동 (green)
- `relationship` - 관계/소통 (rose)
- `finance` - 재정/생활 (amber)
- `growth` - 성장/취미 (purple)
- `uncategorized` - 미분류 (gray)

## Key Implementation Notes

- ISO week calculation uses Monday-start weeks
- Routines support target counts (e.g., "운동 / 3" = exercise 3 times)
- Tree structure: Items can have parent/child relationships for task breakdown
- Source tracking: Items remember origin level/type for context display
- Auto-reset: Routines reset counts based on their source period level

## Environment Variables

```bash
# AI Assistant (required for chat)
GEMINI_API_KEY=your-api-key

# Supabase (optional - for cloud sync)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Deployment Guide

### 1. Supabase Setup

1. Create a project at https://supabase.com
2. Go to SQL Editor and run `supabase-schema.sql`
3. Copy URL and anon key from Project Settings > API

### 2. Vercel Deployment

1. Push to GitHub
2. Import project at https://vercel.com
3. Add environment variables:
   - `GEMINI_API_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy

### Cloud Sync

- Without Supabase: Uses localStorage only (single device)
- With Supabase: Upload/download buttons sync data across devices
