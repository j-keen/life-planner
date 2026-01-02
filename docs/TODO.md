# To-Do List

## 🔥 High Priority (Next Session)
- [ ] **Debug & Fix Cascade Propagation**:
    - Ensure `assignItemToSlot` correctly calculates the child ID (e.g., `2025-12-29`) from the parent slot (`day-0`) and week ID.
    - Validate that the UI refreshes immediately after a drop.
- [ ] **Implement Routine Quantization**:
    - Add `targetCount` (e.g., 3) to `PlanItem`.
    - Modify drag logic: If `targetCount > 1`, decrement count or track "clones" instead of moving the item entirely.
- [ ] **Implement Upward Feedback (Sync)**:
    - Add `originId` to propagated items to track their parent.
    - When a child item is completed, update the parent item's visual state (progress bar or completion).

## 🚀 Medium Priority (Features)
- [ ] **Move/Defer Functionality**:
    - Add a way to move unfinished tasks to the next day/week/month easily.
- [ ] **Persistence Layer**:
    - Currently using in-memory store. Needs LocalStorage or Database (Supabase/SQLite) integration to save data between reloads.
- [ ] **Visual Polish**:
    - Add drag previews and better drop indicators.
    - Improve the "Goal/Motto" editing UI.

## 🧊 Low Priority (Backlog)
- [ ] **Mobile Optimization**: Better touch controls for drag-and-drop on phones.
- [ ] **Analytics**: Visualize completion rates over time.
- [ ] **Keyboards Shortcuts**: Quick add (Cmd+K), Navigate views (Arrow keys).
