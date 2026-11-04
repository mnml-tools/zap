import type { TableFilter } from '../types/filter'

export const filterOperators = [
  ['eq', '='],
  ['ne', '≠'],
  ['gt', '>'],
  ['gte', '≥'],
  ['lt', '<'],
  ['lte', '≤'],
  ['contains', 'Contains'],
  ['not_contains', 'Not contains'],
  ['starts_with', 'Starts with'],
  ['ends_with', 'Ends with'],
  ['in', 'IN'],
  ['not_in', 'NOT IN'],
  ['is_null', 'IS NULL'],
  ['is_not_null', 'IS NOT NULL']
]

export const newFilter = (columns: string[]): TableFilter => ({
  id: crypto.randomUUID(),
  column: columns[0] || '',
  operator: 'eq',
  value: '',
  enabled: true
})

export const comparableFilters = (rows: TableFilter[]) =>
  JSON.stringify(
    rows
      .filter((r) => r.enabled)
      .map(({ column, operator, value }) => ({
        column,
        operator,
        value: operator === 'is_null' || operator === 'is_not_null' ? '' : value
      }))
  )
