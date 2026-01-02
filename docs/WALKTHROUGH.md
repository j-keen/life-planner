# Walkthrough & Verification Guide

This guide explains how to use the **Life Planner** and verifies its core functionalities.

## 1. Getting Started
1.  **Run the App**: `npm run dev`
2.  **Open Browser**: `http://localhost:3000`
3.  **Initial State**: You start at the `ERA` view (Life View).

## 2. Navigation Flow (The Fractal Dive)
1.  **ERA -> TERM**: Click on a "30~35년" cell.
2.  **TERM -> YEAR**: Click on a specific Year (e.g., "2025").
3.  **YEAR -> MONTH**: Click on a bi-monthly period, then navigate/click to a Month.
4.  **MONTH -> WEEK**: Click on a Week (e.g., "1주차").
5.  **WEEK -> DAY**: Click on a Day (e.g., "월 12.29").

**Verification**: Ensure the "Title" and "Subtitle" (Dates) update correctly at each step.

## 3. Core Features Walkthrough

### **A. Adding Items (Todo / Routine)**
1.  Go to any view (e.g., WEEK).
2.  **Todo**: Click `+ 할 일 추가` on the left.
    - Type "Buy Groceries" -> Press Enter.
    - **Check**: Item appears at the bottom of the left list.
3.  **Routine**: Click `+ 루틴 추가` on the right.
    - Type "Morning Jog" -> Press Enter.
    - **Check**: Item appears at the bottom of the right list.

### **B. Planning (Drag & Drop)**
1.  Drag "Buy Groceries" from the Left Panel.
2.  Drop it onto the "Mon 12.29" cell in the center grid.
3.  **Check**: The item appears inside the Monday cell.

### **C. Cascade Propagation (The Magic)**
*This feature ensures your plan flows down to action.*
1.  **Setup**: Be in **WEEK** View.
2.  **Action**: Drag a Todo item ("Read Book") onto the **Monday** cell.
3.  **Verify**:
    - Click the **Monday** cell to enter **DAY** View.
    - Look at the "오늘 할 일" (Today's Todo) list on the left.
    - **Success Condition**: "Read Book" should be listed there automatically.

## 4. Troubleshooting
- **"document is not defined"**: Refresh the page. This was an SSR issue, now fixed with a `mounted` check.
- **Drag not working**: Ensure you are dropping precisely on the cell box.
- **Cascade not happening**: Check if the target date is valid. The console (F12) will log `[Cascade] Propagating...`.

## 5. Development Shortcuts
- **Reset Data**: Refreshing the page resets data (currently using In-Memory Store).
- **Edit Goals**: Click on the "Goal" or "Motto" text in the header to edit inline.
