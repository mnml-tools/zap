# Zap

A minimal desktop database explorer built with Tauri 2, React, TypeScript, and Rust/SQLx. White surfaces, warm gray borders, and charcoal text.

## Run

Install Node.js, Rust, and the [Tauri platform prerequisites](https://v2.tauri.app/start/prerequisites/), then:

```sh
npm install
npm run tauri dev
```

Build the macOS application and DMG with your `src/assets/AppIcon.svg` icon:

```sh
npm run build:mac
```

This regenerates the platform icon assets, including `src-tauri/icons/icon.icns`, before running Tauri's release build. Outputs are `src-tauri/target/release/bundle/macos/Zap.app` and a DMG in `src-tauri/target/release/bundle/dmg/`. Run `npm run icons` whenever you only need to regenerate icons.

Create other desktop packages with `npm run tauri build`. `npm run dev` previews the interface in a browser; database operations require the desktop runtime.

## Features

- PostgreSQL, MySQL, and SQLite connections with connection testing.
- Right-click and choose **Edit connection** to update saved settings. Leave the password blank to keep the saved credential; connection testing reuses it.
- Right-click a saved connection and choose **Remove connection** to delete its saved settings and credential. This does not delete the database or SQLite file. The menu also opens with Shift+F10.
- Named connections persisted in the OS application-data directory. Passwords are kept in the OS credential store rather than the JSON file.
- Double-click a saved connection (or use its arrow / Enter) to explore it in the same window. Use **Close connection** to disconnect and return to your saved connections.
- Switch the sidebar between **Tables** and **Queries**. Create named SQL queries per connection, save them locally, and reopen each in its own closable editor tab. SQL syntax colors cover keywords, strings, comments, numbers, functions, identifiers, and parameters in both themes. Run with the button or Cmd/Ctrl+Enter; save query definitions with Cmd/Ctrl+S.
- Query results appear below the code with separate result tabs for SQL scripts, elapsed time, affected-row counts, errors, and a 1,000-row display limit per result. Unsaved code survives tab switches.
- Searchable table sidebar, closable tabs, refresh, and 100-row pagination with a separate page position for each tab.
- The table toolbar’s **Filters** button opens a collapsible condition panel. Choose a column, operator, and value, then Apply a row or Apply all. Enabled conditions combine with AND. IN/NOT IN accept comma-separated values with quoted commas; text searches treat `%` and `_` literally. Clear removes all conditions.
- Click a table column header to cycle ascending → descending → no sort; an arrow shows the active direction. Sorting uses native database values before pagination, stays scoped to the table tab, and preserves pending edits.
- Filters run against the whole database table before pagination and counting. Each table tab keeps its own conditions; hiding the panel keeps applied filters active and shows their count on the button. Filtering preserves pending cell edits.
- Schema-aware, quoted table and column identifiers. Database values are displayed as text, with NULL shown explicitly.
- Double-click a cell to edit. Blur or Enter stages the value, highlights the row, and updates **Save X changes**. Escape cancels the current edit; NULL and empty text remain distinct.
- Pending edits survive page and tab navigation. Save commits the current table’s edits across pages in one transaction; errors keep drafts intact. Discard, refresh, closing a dirty tab/connection, or quitting asks before dropping changes.
- Editing requires a primary key and writable columns. Generated and binary columns stay read-only; MySQL editing requires InnoDB. Stale row snapshots cause the entire save to roll back.
- SQLite opens an existing database in read/write mode; use an absolute file path. Read-only database permissions still apply.

The table grid has no row insertion/deletion actions, SSH tunnels, or advanced TLS configuration. The SQL editor can execute statements allowed by the database account, including writes. Each run uses a dedicated connection and a 60-second timeout; session variables and temporary tables do not persist across runs. Multi-statement behavior follows the database’s transaction rules, so earlier statements may commit before a later error. Tables with primary keys use stable key ordering. Pagination uses LIMIT/OFFSET; changing database contents can shift rows between pages. Binary values and database-specific types may need dedicated formatting in a future version. PostgreSQL and MySQL accounts should have read-only permissions when used for browsing.

## Validate

```sh
npm run build
npm test
npm run format:check
cargo test --manifest-path src-tauri/Cargo.toml
```

For isolated UI checks, run the Vite server and visit `/tests/editor.html`. This fixture uses an in-memory mock and supports a simulated save failure, without connecting to a real database.

## macOS Keychain prompts

Zap stores saved passwords in the OS credential store. Once macOS authorizes a password read, Zap retains that password only in Rust memory for the current process, so reopening or testing the same connection does not request it again. Replacing a password updates this cache; removing a connection clears it. The cache is lost on exit and is never written to the settings file or sent to the interface.

In the Keychain prompt, **Allow** grants one access; **Always Allow** remembers permission for that app. Use your login Keychain password (usually your Mac login password), rather than the database password. Development rebuilds may change the executable identity and cause macOS to request permission again. A release signed with a consistent Developer ID is the appropriate distribution setup; configure `APPLE_SIGNING_IDENTITY` when building. Zap does not alter Keychain access controls.

References: [Apple: allow apps to access your keychain](https://support.apple.com/en-gb/guide/mac-help/kychn002/26/mac/26), [Tauri: macOS code signing](https://tauri.app/distribute/sign/macos/).

## Frontend architecture

The React UI uses atomic design with one component per file, feature hooks for state and side effects, and separate services, models, and pure helpers. See [React architecture](docs/architecture.md) for the folder structure and contribution guidelines.
