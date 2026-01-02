# Project Context: Life Planner (Fractal System)

## 1. Project Overview
- **Goal**: A hierarchical life management system connecting high-level goals (One Thing) to daily actions.
- **Architecture**: Fractal View System (ERA -> TERM -> YEAR -> MONTH -> WEEK -> DAY).
- **Tech Stack**: Next.js 15, React 19, Zustand (Store), dnd-kit (Drag & Drop), TailwindCSS.

## 2. Current State (As of 2025-12-29)
The application has stabilized the core UI and basic interactions. We moved away from `window.prompt` to inline inputs and fixed SSR issues.

### ✅ Completed Core Features
1.  **Fractal Navigation**:
    - Complete hierarchy: `ERA (36y)` > `TERM (6y)` > `YEAR` > `MONTH` > `WEEK` > `DAY`.
    - Removed legacy `LIFE` view.
2.  **Smart Date Logic**:
    - Views now correctly calculate and display precise dates (e.g., Week view shows "Mon 12.29").
    - `getFractalData` handles dynamic subtitle generation for all views.
3.  **Interaction**:
    - **Inline Input**: Users can add items directly via UI input fields (No prompts).
    - **SSR Safety**: `FractalView` now includes a `mounted` check to prevent `document is not defined` errors during drag-and-drop initialization.
4.  **Data Logic**:
    - **Cascade Propagation (Implemented in Store)**: Logic exists in `assignItemToSlot` to propagate items from parent views to child views (e.g., Dropping on a Week cell adds to Day's todo list).
    - **Store Structure**: `usePlanStore.ts` manages `lifePlan` and `periodPlans` with `immer`-like immutable updates.

## 3. Immediate Next Steps (For Next Session)
The system logic is ready, but the **Cascade Propagation** needs final behavioral verification in a stable environment.

**👉 Start Here:**
1.  **Verify Cascade Logic**:
    - Open `src/store/usePlanStore.ts` and review `assignItemToSlot`.
    - Verify that dragging an item in `WEEK` view to a `day-N` cell correctly creates a `DAY` period entry in the store.
    - *Note*: Previous browser tests showed drop events firing, but UI didn't update immediately. This might be a hydration or re-render timing issue.
2.  **Implement "Routine Quantization"**:
    - Allow setting routines like "3 times/week".
    - Logic: Dropping a generic routine into a specific day consumes 1 "count" but keeps the routine active in the parent view until the target count is met.
3.  **Implement "Upward Feedback"**:
    - When a child item (Day Task) is checked, update the parent item (Week Grid) status (e.g., progress bar or checkmark).
