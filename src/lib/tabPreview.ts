import type { QueryResult } from '../types/query'

export type GridPreview = {
  columns: string[]
  rows: (string | null)[][]
  total: number
  hiddenColumns: number
}

export type TablePreview = GridPreview & { loadedAt: number }

export type QueryPreview = {
  sql: string
  running: boolean
  error: string
  result: (GridPreview & { rowsAffected: number; durationMs: number; sets: number }) | null
}

export type TabPreview =
  | { kind: 'table'; subtitle: string; loading: boolean; grid?: TablePreview; pending: number }
  | { kind: 'query'; subtitle: string; query?: QueryPreview }

const maxRows = 8,
  maxColumns = 8,
  maxCell = 80,
  maxLines = 12,
  maxLine = 160

// Previews keep a few short cells so holding one per open tab costs next to nothing.
export function previewGrid(columns: string[], rows: (string | null)[][], total: number): GridPreview {
  return {
    columns: columns.slice(0, maxColumns),
    rows: rows
      .slice(0, maxRows)
      .map((row) =>
        row
          .slice(0, maxColumns)
          .map((value) => (value !== null && value.length > maxCell ? `${value.slice(0, maxCell)}…` : value))
      ),
    total,
    hiddenColumns: Math.max(0, columns.length - maxColumns)
  }
}

export function previewResult(result: QueryResult | null, index: number): QueryPreview['result'] {
  const set = result?.results[index] ?? result?.results[0]
  if (!result || !set) return null

  return {
    ...previewGrid(set.columns, set.rows, set.rowCount),
    rowsAffected: set.rowsAffected,
    durationMs: result.durationMs,
    sets: result.results.length
  }
}

export function previewSql(sql: string) {
  const lines = sql.replace(/^\s*\n/, '').split('\n')
  const shown = lines.slice(0, maxLines).map((line) => (line.length > maxLine ? `${line.slice(0, maxLine)}…` : line))

  return { text: shown.join('\n').trimEnd(), more: lines.length > maxLines }
}

export function loadedAgo(loadedAt: number, now: number) {
  const minutes = Math.floor((now - loadedAt) / 60000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`

  return `${Math.floor(minutes / 60)} h ago`
}

// Readers are pulled on demand, so typing in an editor never re-renders the tab bar. Owners call
// `changed` when something a reader returns changes while the switcher might be showing it.
export function createPreviewStore<T>() {
  const readers = new Map<string, () => T>(),
    listeners = new Set<() => void>()

  return {
    read: (key: string) => readers.get(key)?.(),
    register(key: string, reader: () => T) {
      readers.set(key, reader)

      return () => {
        if (readers.get(key) === reader) readers.delete(key)
      }
    },
    changed: () => listeners.forEach((listener) => listener()),
    subscribe(listener: () => void) {
      listeners.add(listener)

      return () => {
        listeners.delete(listener)
      }
    }
  }
}

export type PreviewStore<T> = ReturnType<typeof createPreviewStore<T>>
