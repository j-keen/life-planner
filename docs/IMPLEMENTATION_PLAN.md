# IMPLEMENTATION_PLAN - Day Nav & Sub-Items Update

## 1. Day View Navigation (Implemented)
- **Status**: ✅ Working
- **UI**: Added `< Prev` and `Next >` buttons in Day View header.
- **Logic**: Directly manipulates `currentDate` state (+/- 1 day).

## 2. Fractal Breakdown (Sub-Items)
- **Status**: ✅ Implemented
- **Data Model**: Adopted **Flat List + Parent Linking** strategy.
  - Sub-items are stored in the main `todoList` / `routines` array.
  - Linked via `parentId`.
- **UI**:
  - Recursive rendering in `FractalView` via `buildTree` helper.
  - Indented display for sub-items.
  - `+` button on hover to quick-add sub-items (via Prompt).

## 3. Quantum Linking (Drag & Count)
- **Status**: ✅ Working
- **Logic**:
  - Dragging a sub-item (with `parentId`) triggers **Template Mode**.
  - Source item remains in panel (Persist).
  - New instance created in Time Slot.
- **Counting**:
  - Implemented `countDeployed` helper.
  - Top-level items show a **"N 배정"** badge if any of their instance (or self) is in the schedule.

## Next Steps
1. **Deep Counting**: Ensure sub-item badges also appear in the panel (currently only top-level).
2. **Inline Input for Sub-Items**: Replace `window.prompt` with the custom `InlineInput` component for better UX.
3. **Complex Recursion**: Support more than 1 level of nesting (requires UI refactoring).
