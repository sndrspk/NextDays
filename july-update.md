# NextDays July Update Roadmap

> Roadmap created on 2026-07-18. This document is the source of truth for the next batch of work. Each item is written so a future Claude session can pick it up without re-deriving the design from the codebase.

---

## Scope

Implement the following seven items, grouped into three milestones. The grouping balances risk, dependencies, and user-facing impact.

| # | Item | Group | Size |
|---|---|---|---|
| 1 | Fix `fetch-ics` Edge Function dead code (security bug) | Security & Foundation | S |
| 2 | Add `parseTaskTitle` to `AddTaskView` | Consistency | XS |
| 3 | Global tag view / tag click navigation | Navigation | M |
| 5 | Undo toasts for destructive actions | UX | M |
| 7 | Dedicated drag handle on task cards | Calendar UX | S |
| 8 | Show recurring glyph in project view | Consistency | XS |
| - | PWA support (manifest + service worker) | Platform | M |

---

## Milestone A: Security & Foundation (do first)

### A1. Fix `fetch-ics` Edge Function dead code

**Problem:** `supabase/functions/fetch-ics/index.ts` currently contains two code paths. The first path performs an unhardened `fetch()` with `redirect: "follow"` and returns immediately, so the second path (which calls `safeFetch()` from `safe-fetch.ts`) is unreachable. The SSRF hardening is therefore not active.

**Goal:** Remove the unhardened fetch path and route every request through `safeFetch()`.

**Files to change:**
- `supabase/functions/fetch-ics/index.ts`

**Implementation notes:**
- Delete the `target` protocol check and the `fetch(target.toString(), ...)` block.
- Keep the CORS preflight handling (`OPTIONS`) and the JSON body parsing.
- Call `safeFetch(rawUrl)` directly after validating that `rawUrl` is a non-empty string.
- Return the same response shape: `{ text }` on success, `{ error }` with status on failure.
- The `safeFetch` helper already validates the URL, resolves DNS, checks private/reserved ranges, handles redirects manually, caps the body, and sniffs for `BEGIN:VCALENDAR`.

**Manual test plan:**
- Deploy the function.
- Add a Google Calendar ICS URL in Settings. It should still work.
- Add a URL that returns HTML (e.g. a random webpage). It should fail with “Response is not an iCalendar document.”
- Add a URL resolving to `169.254.169.254`. It should fail with a private-address error.

**Acceptance criteria:**
- Only `safeFetch` is used in the handler.
- Existing calendar subscriptions continue to sync.
- Malicious/private URLs are rejected.

---

### A2. Add `parseTaskTitle` to `AddTaskView`

**Problem:** The full-screen Add task form does not support the inline `@Project` and `#tag` syntax that every quick-add input supports. This is inconsistent and surprising.

**Goal:** When the user types `@ProjectName` or `#tag` in the Add task title field, strip those tokens and set the matching project/tags on insert, exactly like `QuickAdd` does.

**Files to change:**
- `src/components/calendar/AddTaskView.tsx`
- `src/hooks/useTaskMutations.ts` (no change needed if `useCreateTask` already accepts optional `project_id` and `tags`)

**Implementation notes:**
- Import `parseTaskTitle` from `../../lib/parseTaskTitle` and `useProjects` from `../../hooks/useProjects`.
- In the `submit()` function, after trimming the title, call `parseTaskTitle(trimmed, projectsQuery.data ?? [])`.
- Use `parsed.project_id` and `parsed.tags` when calling `create.mutate`.
- If the user has also selected a project in the Project dropdown, the parsed `@Project` should override the dropdown (same behaviour as `ProjectQuickAdd`). If no `@Project` is parsed, keep the dropdown value.
- Update the placeholder or helper text to mention the syntax, e.g. “Type `@Project` or `#tag` inline”.

**Manual test plan:**
- Open Add task, type “Call client @Work #followup”, save. The task should be created with project Work and tag followup, and the title should be “Call client”.
- Select a project in the dropdown, then type an explicit `@OtherProject`. The explicit one wins.
- Select a project in the dropdown, type no `@`. The dropdown project is used.

**Acceptance criteria:**
- `@Project` and `#tag` work in Add task view.
- Explicit `@Project` overrides the dropdown.
- The title stored in the database has the tokens stripped.

---

### A3. Show recurring glyph in project view

**Problem:** Recurring tasks show a `↻` glyph in the calendar and Focus views (`TaskCard.tsx`) but not in the project view (`ProjectTaskRow`).

**Goal:** Add the same recurring indicator to project rows.

**Files to change:**
- `src/components/projects/ProjectView.tsx` (`ProjectTaskRow`)

**Implementation notes:**
- In `ProjectTaskRow`, next to the title, render `task.template_id && <span aria-label="Recurring" title="Recurring" className="ml-1 text-stone-400">↻</span>`.
- Match the styling used in `TaskCard.tsx` exactly.

**Manual test plan:**
- Open a project containing a recurring task. The `↻` glyph appears.
- Open a non-recurring task in the same project. No glyph appears.

**Acceptance criteria:**
- Recurring glyph is visible in project view.
- No visual regression for non-recurring tasks.

---

## Milestone B: Navigation & Calendar UX

### B1. Global tag view / tag click navigation

**Problem:** Tags are only useful inside a single project. There is no cross-project way to see all tasks with a given tag, and clicking a tag chip does nothing.

**Goal:** Add a global tag view that lists all tasks matching one or more tags. Allow clicking any tag chip to jump to that view.

**Files to change:**
- `src/state/view.tsx` — add `{ kind: "tag"; tag: string }` to the `View` union.
- `src/App.tsx` — route `view.kind === "tag"` to a new `TagView` component.
- `src/components/tags/TagView.tsx` — new component (create the `tags` folder if needed).
- `src/components/sidebar/Sidebar.tsx` — optional: add a “Tags” section listing all tags, or keep the entry point as tag chips only.
- `src/components/calendar/TaskCard.tsx` — make tag chips clickable? No, `TaskCard` currently does not render tag chips. Skip for now.
- `src/components/projects/ProjectView.tsx` — make tag chips in `ProjectTaskRow` clickable, jumping to `{ kind: "tag", tag }`.
- `src/components/settings/TagsSection.tsx` — make each tag row clickable, jumping to the tag view.
- `src/hooks/useTasks.ts` or new `src/hooks/useTaggedTasks.ts` — query tasks by tag.

**Implementation notes:**
- Create `useTaggedTasks(tag: string)` hook that queries `tasks` where `tags` contains the tag. Use Supabase `.contains("tags", [tag])`.
- `TagView` should reuse `TaskCard` for each task, with the same sorting as Focus view (active first, then completed, due-date sort). It should also show a header with the tag name, a count, and a back button.
- Tag chips in `ProjectTaskRow` should become buttons. When clicked, call `setView({ kind: "tag", tag })` and stop propagation so the row click does not open the detail panel.
- In `TagsSection`, clicking the tag pill should also navigate to the tag view.
- Consider whether the tag view should support multiple tags (OR/AND). For this milestone, keep it single-tag only. The URL/view state can be extended later.

**Manual test plan:**
- Create tasks with tag `#work` across two projects.
- Click the `#work` chip in project view. A new view lists all `#work` tasks across projects.
- Click a tag in Settings. Same view opens.
- Complete a task from the tag view. It moves to the completed section or disappears depending on the toggle.

**Acceptance criteria:**
- A `tag` view exists and is reachable from project rows and Settings.
- It shows all tasks with the selected tag, sorted consistently with other views.
- Clicking a tag chip does not open the task detail panel.

---

### B2. Dedicated drag handle on task cards

**Problem:** The entire `TaskCard` is a drag target. This can interfere with clicking the card to open the detail panel or clicking the checkbox, especially on touch devices.

**Goal:** Add a small drag handle on the left side of the card. Only the handle initiates drag; the rest of the card behaves normally.

**Files to change:**
- `src/components/calendar/TaskCard.tsx`
- `src/components/calendar/DayColumn.tsx` (maybe, if layout needs adjustment)

**Implementation notes:**
- Move the `useDraggable` hook and `listeners`/`attributes` from the outer `<li>` to a new child element, e.g. a `<span className="drag-handle">` with a grip icon.
- The outer `<li>` keeps `onClick` for opening the detail panel and the checkbox button stays separate.
- Remove `cursor-grab` from the outer `<li>` and apply it only to the drag handle.
- Use a small SVG grip icon (six dots or two horizontal lines) in `stone-400`.
- Ensure the handle is at least 24×24 px for touch accessibility.

**Manual test plan:**
- Drag a task by the handle. It moves to another day.
- Click the task title/body. The detail panel opens.
- Click the checkbox. The task completes.
- On mobile, try to tap the checkbox without dragging. The handle should not interfere.

**Acceptance criteria:**
- Only the drag handle initiates drag.
- Clicking the card body opens the detail panel.
- Checkbox remains easy to tap.

---

## Milestone C: Platform & Polish

### C1. Undo toasts for destructive actions

**Problem:** Completing, deleting, or moving a task happens immediately with no undo. Users sometimes mis-click.

**Goal:** Add a lightweight toast system with an Undo action for destructive or reversible actions.

**Files to change:**
- `src/state/toast.tsx` — new context/provider for toast state.
- `src/main.tsx` — wrap app in `ToastProvider`.
- `src/components/common/Toast.tsx` — toast UI component.
- `src/components/calendar/TaskCard.tsx` — show undo toast on complete.
- `src/components/calendar/TaskDetailPanel.tsx` — show undo toast on delete.
- `src/components/projects/ProjectView.tsx` — show undo toast on bulk complete / bulk delete.
- `src/hooks/useTaskMutations.ts` — `useToggleTaskCompleted` and `useDeleteTask` should support an optional delay or revert callback.

**Implementation notes:**
- Keep the toast system simple: a single global stack of toasts, each with `message`, `actionLabel`, `onAction`, and `onDismiss`.
- For task completion: when the user clicks the checkbox, perform the mutation immediately, then show a toast “Task completed” with “Undo”. If Undo is clicked, call `useToggleTaskCompleted` again on the same task to revert it.
- For task deletion: perform a soft-delete pattern? No schema change needed. Instead, delay the actual delete by 5 seconds and show a toast. If Undo is clicked, cancel the delete. This requires storing a pending delete timer in the hook or component state.
- For moves via drag-and-drop: show a toast “Moved to Friday” with “Undo” that moves the task back.
- For bulk operations in project view: show a count toast with Undo that reverts the action.
- Do not add toasts for low-risk actions like creating a task or saving a note.

**Manual test plan:**
- Complete a task. Toast appears. Click Undo. Task reverts to incomplete.
- Delete a task. Toast appears. Click Undo. Task remains.
- Move a task to another day. Toast appears. Click Undo. Task returns.
- Bulk complete two tasks. Toast shows count. Undo reverts both.

**Acceptance criteria:**
- Undo toasts appear for complete, delete, and move actions.
- Undo reliably reverts the action.
- Toasts auto-dismiss after a few seconds if not interacted with.

---

### C2. PWA support (manifest + service worker)

**Problem:** The app is responsive but not installable. It does not work offline, and there is no app icon on mobile home screens.

**Goal:** Add minimal PWA support: a web manifest, icons, and a service worker that caches the static shell.

**Files to change:**
- `index.html` — add `<link rel="manifest" href="/manifest.json">` and theme/meta tags.
- `public/manifest.json` — new manifest file.
- `public/icons/` — add icon files (at minimum 192×192 and 512×512). Use generated simple icons or SVG fallbacks if no assets are available.
- `vite.config.ts` — add `vite-plugin-pwa` or a custom service worker via `workbox-window`.
- `src/service-worker.ts` — new service worker file (or let `vite-plugin-pwa` generate one).
- `src/main.tsx` — register the service worker.

**Implementation notes:**
- Use `vite-plugin-pwa` if it is compatible with the current Vite 8 / Tailwind 4 setup. If not, write a minimal custom service worker.
- The service worker should cache the app shell (index.html, JS, CSS, fonts) and serve it offline. Dynamic data from Supabase should not be cached by the SW; rely on the existing TanStack Query cache and localStorage for offline data.
- Add `theme-color` and `background-color` to the manifest matching the app’s indigo accent (`#6366f1`) and light background (`#eef2ff`).
- The `start_url` should be `/NextDays/` in production (matching the `base` path) and `/` locally. Use the same `GITHUB_ACTIONS` check as `vite.config.ts`.
- If generating icons, keep them simple: a rounded square with “ND” or a calendar glyph in the accent colour.

**Manual test plan:**
- Build the app. The manifest is present in `dist/`.
- Open the deployed app in Chrome. Lighthouse PWA audit passes the installable criteria (manifest + icons + service worker + HTTPS).
- On Android, the browser offers “Add to Home screen”.
- With the network offline, the app shell still loads (data will be missing until the network returns).

**Acceptance criteria:**
- Manifest is valid and linked.
- Icons exist in required sizes.
- Service worker registers and caches the shell.
- App is installable on supported devices.

---

## Suggested execution order

1. **Milestone A** — security fix first, then the two small consistency items. These are safe and can be shipped in one PR.
2. **Milestone B** — tag view and drag handle. These touch navigation and the calendar, so test thoroughly across desktop and mobile.
3. **Milestone C** — undo toasts and PWA. These are larger and can each be their own PR.

Each milestone should be developed on its own branch per the working agreements in `CLAUDE.md`, with a PR into `main` at the end. Update `VERSIONS.md` and `CLAUDE.md` after each meaningful change.

---

## Open questions to resolve before starting

- **Tag view scope:** Should it support multiple selected tags (AND/OR)? Recommendation: single-tag only for this batch.
- **Undo delete timing:** Is a 5-second delayed delete acceptable, or should we implement a true soft-delete column (`deleted_at`)? Recommendation: delayed delete with a timer, no schema change.
- **PWA icons:** Do you have brand assets, or should we generate simple icons? Recommendation: generate simple SVG/PNG icons with the “ND” monogram.
- **Drag handle placement:** Left of the checkbox or right of the title? Recommendation: left of the checkbox, consistent with most task apps.

---

## Cross-cutting concerns

- **Mobile:** Every UI change must be tested on narrow viewports. The off-canvas sidebar, bottom-sheet panel, and stacked calendar all interact with new elements.
- **Keyboard:** The app is “keyboard-first”. Ensure tag chips and drag handles are reachable via keyboard. The drag handle should have an `aria-label` and be focusable.
- **Accessibility:** Toasts should use `role="status"` or `role="alert"` and not auto-focus. Undo actions should be keyboard-accessible.
- **Type safety:** Extend the `View` union carefully; TypeScript will surface every switch statement that needs updating.

---

## Related files for quick reference

- `src/state/view.tsx` — view routing state.
- `src/App.tsx` — view switcher.
- `src/components/calendar/TaskCard.tsx` — task row in calendar and focus.
- `src/components/projects/ProjectView.tsx` — project task list.
- `src/components/settings/TagsSection.tsx` — tag management.
- `src/lib/parseTaskTitle.ts` — inline `@Project` / `#tag` parser.
- `supabase/functions/fetch-ics/index.ts` — ICS proxy (needs security fix).
- `vite.config.ts` — build config, base path, CSP plugin.
- `CLAUDE.md` — working agreements and milestone rules.
- `VERSIONS.md` — changelog.
