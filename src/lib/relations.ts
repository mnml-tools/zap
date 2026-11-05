import type { ForeignKey, Page, Table } from '../types/table'
import type { TableFilter } from '../types/filter'

export type Reference = { key: ForeignKey; values: string[] }

export const tableLabel = (table: Table) => (table.schema ? `${table.schema}.${table.name}` : table.name)

export const foreignKeyFor = (page: Page, column: number) =>
  page.foreignKeys.find((key) => key.columns.includes(column))

// A reference exists only when every source column has a value (SQL MATCH SIMPLE).
export function referenceFrom(key: ForeignKey, row: (string | null)[]): Reference | null {
  const values = key.columns.map((column) => row[column])

  return values.every((value) => value !== null) ? { key, values: values as string[] } : null
}

export const referenceFilters = ({ key, values }: Reference): TableFilter[] =>
  key.targetColumns.map((column, index) => ({
    id: crypto.randomUUID(),
    column,
    operator: 'eq',
    value: values[index],
    enabled: true
  }))

export const referenceLabel = ({ key, values }: Reference) =>
  key.targetColumns.map((column, index) => `${column} = ${values[index]}`).join(', ')

export const referenceTitle = (key: ForeignKey) =>
  `References ${tableLabel(key.target)} (${key.targetColumns.join(', ')})`
