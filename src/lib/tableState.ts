import type { Table, Page, TableDraft, CellEditor, TableSort } from '../types/table'

export const tableKey = (table: Table) => JSON.stringify([table.schema, table.name])

export const rowKey = (row: (string | null)[], page: Page) => JSON.stringify(page.primaryKeys.map((i) => row[i]))

export const countChanges = (draft?: TableDraft) =>
  Object.values(draft?.rows || {}).reduce(
    (count, row) => count + (row.deleted ? 1 : Object.keys(row.changes).length),
    0
  )

export function stageCell(drafts: Record<string, TableDraft>, cell: CellEditor | null): Record<string, TableDraft> {
  if (!cell) return drafts

  const next = { ...drafts },
    draft = next[cell.tab]

  if (draft?.rows[cell.rowKey]?.deleted) return drafts

  const original = draft?.rows[cell.rowKey]?.original || cell.row
  const changes = { ...draft?.rows[cell.rowKey]?.changes }

  if (cell.value === original[cell.column]) delete changes[cell.column]
  else changes[cell.column] = cell.value

  const rows = { ...draft?.rows }

  if (Object.keys(changes).length) rows[cell.rowKey] = { original, changes }
  else delete rows[cell.rowKey]

  if (Object.keys(rows).length) next[cell.tab] = { columns: cell.columns, rows }
  else delete next[cell.tab]

  return next
}

export function toggleRowRemoval(
  drafts: Record<string, TableDraft>,
  tab: string,
  row: (string | null)[],
  page: Page
): Record<string, TableDraft> {
  const key = rowKey(row, page)
  const draft = drafts[tab]
  const existing = draft?.rows[key]
  const rows = { ...draft?.rows }

  if (existing?.deleted) {
    if (Object.keys(existing.changes).length) rows[key] = { ...existing, deleted: false }
    else delete rows[key]
  } else {
    rows[key] = { ...(existing ?? { original: row, changes: {} }), deleted: true }
  }

  const next = { ...drafts }

  if (Object.keys(rows).length) next[tab] = { columns: page.columns, rows }
  else delete next[tab]

  return next
}

export function toggleRowsRemoval(
  drafts: Record<string, TableDraft>,
  tab: string,
  rows: (string | null)[][],
  page: Page
): Record<string, TableDraft> {
  const restore = rows.every((row) => drafts[tab]?.rows[rowKey(row, page)]?.deleted)

  return rows.reduce((next, row) => {
    const deleted = !!next[tab]?.rows[rowKey(row, page)]?.deleted

    return deleted === restore ? toggleRowRemoval(next, tab, row, page) : next
  }, drafts)
}

export function nextSort(current: TableSort | undefined, column: string): TableSort | undefined {
  if (current?.column === column && current.direction === 'desc') return undefined

  return { column, direction: current?.column === column ? 'desc' : 'asc' }
}
