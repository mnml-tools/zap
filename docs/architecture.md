# React architecture

Zap uses atomic design for rendering and feature hooks for behavior. Each React component lives in its own file. The refactor preserves the existing DOM classes so the light/dark themes and native title bar keep their appearance.

## UI layers

- `src/components/atoms`: small primitives such as Button, Spinner, StatusDot, DirtyIndicator, ErrorMessage, and NullValue.
- `src/components/molecules`: focused combinations such as a connection row, filter row, column header, cell input, SQL input, or toolbar.
- `src/components/organisms`: complete feature sections such as the connection dialog, workspace sidebar, editable table, filter panel, or query editor.
- `src/components/templates`: the shared application shell with its header, content, footer, and dialogs.
- `src/pages`: screen composition for saved connections and the connected workspace.
- `src/app/App.tsx`: switches between the two screens; `src/main.tsx` only mounts the app and loads styles.

UI components compose their own level or lower layers. Atoms do not know about database commands. Molecules receive values and callbacks rather than invoking database operations. Organisms coordinate their UI sections; pages connect those sections to feature hooks. Component imports are explicit, and the barrel in `src/types` exports types only.

## Behavior and boundaries

- `useConnections`: connection listing, create/edit/test/save/remove, and connection navigation.
- `useWorkspaceTabs`: table discovery and table-tab selection.
- `useTableViewState`: table loading, pagination, sorting, filters, and per-tab view preferences.
- `useTableDrafts`: cell editors, pending edits, saving, and reverting drafts.
- `useSavedQueries`: saved-query definitions, open query tabs, and dirty/busy state.
- `useQueryEditor`: local SQL/title changes, query saving, and execution/results state.
- `useSqlCompletion`: loads columns for the tables a query references and returns the editor's completion provider. Ranking and item building live in `src/lib/sqlCompletion.ts`, and clause order and expression state live in `src/lib/sqlClauses.ts`.
- `useReferencePanel`: the referenced-row panel opened from foreign-key cells, with a back stack for following further references.
- `useTabSwitcher`: the Ctrl+Tab switcher over open table and query tabs, ordered by most recent use. It listens in the capture phase so the SQL editor and other shortcuts do not see the keys while it is open. Ordering and stepping live in `src/lib/tabSwitcher.ts`.
- `useWorkspace`: coordinates those features for cross-feature actions such as closing a connection or protecting unsaved changes.
- `useUnsavedChanges`, `useContextMenu`, `useSidebarResize`, and `useTheme`: focused interaction and platform lifecycle hooks.

`src/services` owns Tauri invocation and the persistent theme store. `ApiRequest` is injectable so fixtures can exercise the real screens without native credentials or databases. `src/lib` contains non-React helpers such as connection defaults, SQL tokenization, draft transitions, foreign-key references, and the three-state sort cycle. `src/types` contains separate connection, table, filter, and query models.

Table and query editor components remain mounted or retain drafts using the same tab identities as before. Changing pages, filters, or sorting stages the active cell before navigation. The workspace coordinates discard prompts rather than making individual cells or tabs decide when data may be lost.

## Validation

Use Node 22.19+ or Node 24:

```sh
npm run build
npm test
npm run format:check
```

`npm test` checks SQL tokenization, SQL completion contexts, and immutable table-draft/sort transitions. During `npm run dev`, `/tests/editor.html` exercises the workspace, and `/tests/connections.html` exercises the full connection-to-workspace flow. Both use the isolated mock in `tests/fixtures/database.ts`; neither accesses real databases or Keychain credentials.

Use `npm run format` to format React, TypeScript, CSS, and fixture files consistently. TypeScript also checks unused locals and parameters.
