# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm run dev      # Start development server (localhost:3000)
npm run build    # Production build
npm run lint     # Run ESLint
npm run start    # Run production build
```

## Architecture Overview

This is a **Life Planner** app (Korean: 일정관리) - a 7-level fractal hierarchical life planning system. UI text is in Korean.

**Tech Stack**: Next.js 16 (App Router), React 19, TypeScript, Zustand (state), @dnd-kit (drag-and-drop), Tailwind CSS 4

### Project Structure

```
life-planner/
├── src/
│   ├── app/              # Next.js App Router pages
│   │   ├── page.tsx      # Main entry - renders Shell + FractalView/RecordView
│   │   ├── routines/     # Routine management page
│   │   ├── events/       # Annual events (birthdays, anniversaries) page
│   │   └── api/chat/     # Gemini AI chat endpoint
│   ├── components/
│   │   ├── layout/Shell.tsx  # Main layout with nav header
│   │   ├── ChatAssistant.tsx # Floating AI chat widget
│   │   └── CloudSync.tsx     # Supabase sync UI
│   ├── views/
│   │   ├── FractalView.tsx   # Main planning view (3-column drag-drop UI)
│   │   └── RecordView.tsx    # Daily journaling/reflection view
│   ├── store/
│   │   └── usePlanStore.ts   # Zustand store with all state + actions
│   ├── types/
│   │   └── plan.ts           # TypeScript interfaces + constants
│   └── lib/
│       ├── supabase.ts       # Supabase client singleton
│       └── sync.ts           # Cloud sync upload/download logic
```

### 7-Level Hierarchy

Core concept: fractal drill-down structure for planning across time scales.

| Level | Label | Contains | Grid Layout |
|-------|-------|----------|-------------|
| THIRTY_YEAR | 30년 | 6 x 5-year periods | 3×2 |
| FIVE_YEAR | 5년 | 5 x years | 5×1 |
| YEAR | 1년 | 4 x quarters | 4×1 |
| QUARTER | 분기 | 3 x months | 3×1 |
| MONTH | 월 | 5 x weeks | 5×1 |
| WEEK | 주 | 7 x days | 7×1 |
| DAY | 일 | 8 x time slots | 4×2 |

### Period ID System

Period IDs defined in `usePlanStore.ts` (functions: `getPeriodId`, `parsePeriodId`):
- `30y` - 30-year period
- `5y-{0-5}` - 5-year segment index
- `y-{year}` - Year (e.g., `y-2025`)
- `q-{year}-{1-4}` - Quarter
- `m-{year}-{01-12}` - Month
- `w-{year}-{01-53}` - ISO week (Monday-start)
- `d-{year}-{month}-{day}` - Day

### Key Data Structures (src/types/plan.ts)

- **Item**: Todo/routine with content, completion status, category, tree structure (parentId/childIds), source tracking, note
- **Period**: Contains goal/motto/memos header, todos list, routines list, slots (child period assignments), timeSlots (DAY level)
- **DailyRecord**: Journal entry with mood, content, highlights, gratitude
- **AnnualEvent**: Recurring events (birthdays, anniversaries, holidays)

### State Management (src/store/usePlanStore.ts)

Zustand store with localStorage persistence (`life-planner-storage`). Key actions:
- `navigateTo(periodId)` - Navigate to specific period
- `drillDown(childPeriodId)` / `drillUp()` - Hierarchy navigation
- `addItem(content, 'todo'|'routine', targetCount?, category?)` - Add items
- `assignToSlot(itemId, from, targetSlotId)` - Drag item to child period (creates child item + propagates)
- `assignToTimeSlot(itemId, from, timeSlot)` - DAY level time slot assignment
- `toggleComplete(itemId, location, slotId?)` - Toggle completion (cascades to children/parents)
- `addAnnualEvent` / `updateAnnualEvent` / `deleteAnnualEvent` - Manage annual events

### Core UI (src/views/FractalView.tsx)

Three-column layout:
- **Left panel**: Todos organized by 6 categories
- **Center**: Grid of child periods (droppable) or time slots (DAY level)
- **Right panel**: Routines organized by 6 categories

Drag-and-drop: Items dragged from side panels to center grid cells. Uses @dnd-kit with PointerSensor.

### Category System

6 categories with color coding:
- `work` - 업무/학습 (blue)
- `health` - 건강/운동 (green)
- `relationship` - 관계/소통 (rose)
- `finance` - 재정/생활 (amber)
- `growth` - 성장/취미 (purple)
- `uncategorized` - 미분류 (gray)

### Time Slots (DAY level)

8 slots in 4×2 grid: dawn (0-6), morning_early (6-9), morning_late (9-12), afternoon_early (12-15), afternoon_late (15-18), evening_early (18-21), evening_late (21-24), anytime

### Additional Pages

- `/routines` - Manage routines across all periods
- `/events` - Manage annual events (birthdays, anniversaries, memorial days, holidays)

### AI Assistant (src/components/ChatAssistant.tsx)

Floating chat widget that reads current period data and provides planning advice via Google Gemini API (`/api/chat` route). Requires `GEMINI_API_KEY`.

## Key Implementation Notes

- ISO week calculation uses Monday-start weeks (`getISOWeek`, `getISOWeekYear`)
- Routines support target counts: format "내용 / 횟수" (e.g., "운동 / 3" = exercise 3 times)
- Tree structure: Items have parent/child relationships for task breakdown
- Source tracking: Items remember origin level/type with `sourceLevel` and `sourceType`
- Auto-reset: Routines reset counts based on source period level via `resetRoutinesIfNeeded`
- Item propagation: When assigned to slot, item is also added to child period's todos

## Environment Variables

```bash
# AI Assistant (optional - enables chat feature)
GEMINI_API_KEY=your-api-key

# Supabase (optional - enables cloud sync)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Development Status

Based on task.md, remaining work:
- CRUD operations (create/edit/delete items modal)
- Polish: glassmorphism styling, transitions, micro-animations
