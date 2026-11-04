import type { Table, Page, TableDraft, CellEditor, TableSort } from '../types/table'

export const tableKey = (table: Table) => JSON.stringify([table.schema, table.name])

export const rowKey = (row: (string | null)[], page: Page) => JSON.stringify(page.primaryKeys.map((i) => row[i]))

export const countChanges = (draft?: TableDraft) =>
  Object.values(draft?.rows || {}).reduce((count, row) => count + Object.keys(row.changes).length, 0)

export function stageCell(drafts: Record<string, TableDraft>, cell: CellEditor | null): Record<string, TableDraft> {
  if (!cell) return drafts

  const next = { ...drafts },
    draft = next[cell.tab]
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

export function nextSort(current: TableSort | undefined, column: string): TableSort | undefined {
  if (current?.column === column && current.direction === 'desc') return undefined

  return { column, direction: current?.column === column ? 'desc' : 'asc' }
}
