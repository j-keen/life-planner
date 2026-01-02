# Changelog

## 2025-12-29 (Mon)

### 18:40 - SSR Safety & Cleanup
- **Fixed**: Added `mounted` state check in `FractalView.tsx` to prevent `document is not defined` errors during Next.js server-side rendering.
- **Improved**: `assignItemToSlot` logic made more robust against ID parsing errors (safe parsing of `day-N`).

### 18:30 - Cascade Logic Implementation
- **Feature**: Implemented "Head-of-Line" propagation in `usePlanStore.ts`.
    - Dropping an item on a Week cell (`day-i`) auto-creates proper `DAY` period (`YYYY-MM-DD`) and adds the item.
    - Logic handles accurate date calculations matching the View's display logic.

### 18:20 - Date Logic & UI Updates
- **Feature**: `getFractalData` updated to calculate and display real dates/ranges.
    - WEEK View: Shows `MM.DD` for each day (e.g., "12.29").
    - YEAR/MONTH View: Shows date ranges for sub-periods.
- **Verification**: Browser validated that "Mon" correctly shows today's date ("12.29").

### 18:00 - UI/UX Improvements
- **Refactor**: Removed legacy `LIFE` view and `window.prompt`.
- **Feature**: Implemented `InlineInput` component for seamless task addition.
- **Update**: Navigation bar updated to `ERA` / `TERM` system.
