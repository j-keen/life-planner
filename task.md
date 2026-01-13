# Task Checklist: Feature Updates (2026-01-13)

- [x] **Step 1: Fix Memo Propagation**
    - [x] Debug `getInheritedMemos` usage in `FractalView` header.
    - [x] Ensure parent level memos are visible in child views.
- [x] **Step 2: Continuous Entry UX**
    - [x] Modify `AddItemInput` to keep focus after submission in `FractalView`.
- [x] **Step 3: Nested DnD UI**
    - [x] Update `CellDraggableItem` to support expand/collapse for parent items.
    - [x] Implement rendering logic to hide collapsed children.
- [x] **Step 4: Notepad Feature**
    - [x] Create `src/app/notepad/page.tsx`.
    - [x] Implement `src/views/NotepadView.tsx` with CRUD operations.
    - [x] Add navigation link to Header.
- [x] **Step 5: CSV Management**
    - [x] Create `src/lib/csvUtils.ts` with secure parsing and formatting.
    - [x] Add CSV Routine Import/Export UI.
    - [x] Add CSV Anniversary Import/Export UI.
