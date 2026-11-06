# Changelog

Changes are grouped by version, with the newest version first. Dates use the tagged commits for tagged releases and the release preparation date for versions awaiting a tag.

## [0.5.0] — 2026-11-06

### Added

- Check for updates automatically at startup and offer Install and restart, with download progress, retry handling, and confirmation before discarding unsaved SQL, table edits, or structure changes.
- Publish signed Linux and universal macOS update packages and an update manifest through the release workflow, with signing setup documented in the README.
- Run one-time SQL queries in quick query tabs without creating a saved query, with an option to convert them to saved queries.
- Choose the number of rows displayed per page.
- Save pending changes with Command+S on macOS or Ctrl+S on other platforms.
- Remember and reopen the last connection at startup.

### Changed

- Improve active workspace tab styling so the selected tab integrates with the workspace.

### Fixed

- Restore the window's screen position and maximized state between launches.
- Decode database text metadata returned as BLOB values, including MySQL column types, defaults, comments, and index information, while preserving NULL values and reporting invalid UTF-8.

## [0.4.0] — 2026-11-05

### Added

- Preview foreign-key references in a side panel, follow related records through a back stack, and open referenced tables in filtered tabs.
- Insert new rows, duplicate selected rows, and stage row deletions before saving changes.
- Add keyboard shortcuts for duplicating and removing rows, Tab navigation between editable cells, and shortcut hints in context menus.
- Focus the table search from anywhere by pressing Shift twice.
- Label connections by environment and display the environment in the workspace.
- Import and export saved connections, including passwords, through JSON files.
- Add automated Rust tests and desktop builds for Linux x86_64 and universal macOS, with packages published to GitHub Releases on version tags.
- Add a source-available license and document the project's use of AI assistance.

### Changed

- Add a subtle window border on Linux.
- Improve the README and workspace screenshot.

### Fixed

- Improve macOS icon generation and correct the macOS CI build step.

## [0.3.0] — 2026-11-04

### Fixed

- Apply Linux window decoration settings when the window is created to address the extra native title bar on KDE/KWin.
- Update the macOS application icon.

## [0.2.0] — 2026-11-04

### Added

- Select a range of cells in one column with dragging or Shift-click and copy their values as comma-separated text through the context menu.
- Copy a column's values from the current page through its header context menu, including pending edits.
- Add custom minimize, maximize, and close controls on Linux.
- Add Linux capability schemas.
- Enable MySQL structure edits for data types, nullability, default values, and comments, preserving existing character set and collation attributes where applicable.
- Add project documentation, build instructions, and a workspace screenshot to the README.

### Changed

- Keep at least one filter row available. Clearing filters resets the panel to one blank row, and the last row cannot be removed.
- Default to Light mode and offer Light and Dark appearance options.
- Keep table columns at their content width instead of stretching them across the available space.
- Show failed connection attempts in an error popup.
- Allow popups to close when clicking outside them.
- Prevent horizontal scrolling and overscroll bounce across the entire app.

### Fixed

- Allow the app window to close while a connection is open and complete closing after confirming that pending changes should be discarded.
- Decode MySQL text values returned through the BLOB protocol.
- Display MySQL binary, BLOB, bit, and spatial values as hexadecimal while keeping those fields read-only.

## [0.1.0] — 2026-11-04

Initial tagged release.

### Added

- Minimal desktop database manager built with Tauri, React, TypeScript, and Rust.
- PostgreSQL, MySQL, and SQLite connections, with connection testing and saved connection creation, editing, and removal.
- Native SQLite file selection and operating-system credential storage for saved passwords.
- SSH connections for PostgreSQL and MySQL.
- A connection workspace with a searchable table sidebar and closable table tabs.
- Table browsing with 100 rows per page, filters, column visibility controls, and ascending, descending, and unsorted column-header states.
- Inline cell editing with pending-change indicators, explicit save and discard actions, and transactional updates.
- Data, Structure, and Indexes views for each table.
- Structure inspection with column names, types, nullability, defaults, and comments.
- Table renaming and adding fields, with driver-specific data type choices and supported structure edits.
- Saved SQL queries per connection, a syntax-highlighted SQL editor, query execution, and result tabs.
- Table context-menu actions to copy names, export SQL, and delete tables.
- Tab context-menu actions to close a tab, neighboring tabs, other tabs, or all tabs.
- SQL file import and single-table or selected-table export, with an option to include data.
- Built-in PostgreSQL export and SQL import support without requiring separately installed PostgreSQL command-line tools.
- Light, Dark, and System appearance modes with Pink, Blue, Orange, Green, and Purple accent colours.
- Persistent appearance preferences, window size, and resizable sidebar width.
- Confirmation for discarding unsaved changes and popup error reporting.
- Application icons, development fixtures, automated tests, and architecture documentation.

[0.5.0]: https://github.com/rafmst/zap/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/rafmst/zap/compare/0.3.0...v0.4.0
[0.3.0]: https://github.com/rafmst/zap/compare/0.2.0...0.3.0
[0.2.0]: https://github.com/rafmst/zap/compare/0.1.0...0.2.0
[0.1.0]: https://github.com/rafmst/zap/releases/tag/0.1.0
