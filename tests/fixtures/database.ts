import type { ForeignKey, Page, Table, SavedQuery, TableFilter, TableSort } from '../../src/types/index'
import type { ApiRequest } from '../../src/services/api'
const rows = Array.from({ length: 101 }, (_, i) => [
  String(i + 1),
  `Person ${i + 1}`,
  i === 0 ? null : `person${i + 1}@example.test`
])
// Events reference people and their parent event; event 3 has no person and event 4 points at a missing one.
const eventRows = Array.from({ length: 6 }, (_, i) => [
  String(i + 1),
  `Event ${i + 1}`,
  i === 2 ? null : i === 3 ? '999' : String(i * 7 + 2),
  i === 0 ? null : String(i)
])
const fixtureTables: Record<string, { columns: string[]; rows: (string | null)[][]; foreignKeys: ForeignKey[] }> = {
  people: { columns: ['id', 'name', 'email'], rows, foreignKeys: [] },
  events: {
    columns: ['id', 'title', 'person_id', 'parent_id'],
    rows: eventRows,
    foreignKeys: [
      { columns: [2], target: { schema: 'public', name: 'people' }, targetColumns: ['id'] },
      { columns: [3], target: { schema: 'public', name: 'events' }, targetColumns: ['id'] }
    ]
  }
}
let failNext = false
const savedQueries: SavedQuery[] = JSON.parse(localStorage.getItem('zap.fixtureQueries') || '[]')

export const request: ApiRequest = async <T>(command: string, args?: Record<string, unknown>) => {
  if (command === 'list_queries') return [...savedQueries] as T
  if (command === 'save_query') {
    if (failNext) {
      failNext = false
      throw new Error('Simulated query save failure')
    }
    const query = { ...(args!.query as SavedQuery) }
    query.title = query.title.trim()
    const index = savedQueries.findIndex((q) => q.id === query.id)
    if (index < 0) savedQueries.push(query)
    else savedQueries[index] = query
    localStorage.setItem('zap.fixtureQueries', JSON.stringify(savedQueries))
    return query as T
  }
  if (command === 'remove_query') {
    const index = savedQueries.findIndex((q) => q.id === args!.queryId)
    if (index >= 0) savedQueries.splice(index, 1)
    localStorage.setItem('zap.fixtureQueries', JSON.stringify(savedQueries))
    return undefined as T
  }
  if (command === 'run_query') {
    if (String(args!.sql).includes('missing')) throw new Error('relation "missing" does not exist')
    return {
      results: [
        {
          columns: ['id', 'name'],
          rows: [
            ['1', 'Person 1'],
            ['2', 'Person 2']
          ],
          rowsAffected: 2,
          rowCount: 2,
          truncated: false
        }
      ],
      durationMs: 3
    } as T
  }
  if (command === 'list_tables')
    return [
      { schema: 'public', name: 'people' },
      { schema: 'public', name: 'events' }
    ] as T
  if (command === 'table_page') {
    const table = fixtureTables[(args!.table as Table).name]
    let filtered = table.rows
    for (const filter of (args!.filters || []) as TableFilter[]) {
      if (!filter.enabled) continue
      const column = table.columns.indexOf(filter.column)
      filtered = filtered.filter((row) => {
        const value = row[column]
        switch (filter.operator) {
          case 'is_null':
            return value === null
          case 'is_not_null':
            return value !== null
          case 'eq':
            return value === filter.value
          case 'ne':
            return value !== null && value !== filter.value
          case 'gt':
            return value !== null && Number(value) > Number(filter.value)
          case 'gte':
            return value !== null && Number(value) >= Number(filter.value)
          case 'lt':
            return value !== null && Number(value) < Number(filter.value)
          case 'lte':
            return value !== null && Number(value) <= Number(filter.value)
          case 'in':
            return (
              value !== null &&
              filter.value
                .split(',')
                .map((v) => v.trim())
                .includes(value)
            )
          case 'not_in':
            return (
              value !== null &&
              !filter.value
                .split(',')
                .map((v) => v.trim())
                .includes(value)
            )
          case 'contains':
            return value !== null && value.includes(filter.value)
          case 'not_contains':
            return value !== null && !value.includes(filter.value)
          case 'starts_with':
            return value !== null && value.startsWith(filter.value)
          case 'ends_with':
            return value !== null && value.endsWith(filter.value)
          default:
            return true
        }
      })
    }
    const sort = args!.sort as TableSort | undefined
    if (sort) {
      const column = table.columns.indexOf(sort.column)
      filtered = [...filtered].sort((a, b) => {
        let result = 0
        if (a[column] === null) result = b[column] === null ? 0 : -1
        else if (b[column] === null) result = 1
        else result = column === 0 ? Number(a[column]) - Number(b[column]) : a[column]!.localeCompare(b[column]!)
        return (sort.direction === 'desc' ? -result : result) || Number(a[0]) - Number(b[0])
      })
    }
    return {
      columns: table.columns,
      rows: filtered.slice(Number(args!.page) * 100, Number(args!.page) * 100 + 100).map((r) => [...r]),
      total: filtered.length,
      primaryKeys: [0],
      editable: table.columns.map(() => true),
      readOnlyReason: null,
      foreignKeys: table.foreignKeys
    } satisfies Page as T
  }
  if (command === 'save_table_changes') {
    if (failNext) {
      failNext = false
      throw new Error('Simulated save failure. Your changes are still pending.')
    }
    const table = fixtureTables[(args!.table as Table).name]
    for (const row of args!.edits as {
      original: (string | null)[]
      changes: { column: string; value: string | null }[]
    }[]) {
      const target = table.rows.find((r) => r[0] === row.original[0])!
      for (const change of row.changes) target[table.columns.indexOf(change.column)] = change.value
    }
    return undefined as T
  }
  throw new Error('Unexpected command')
}

export const failNextSave = () => {
  failNext = true
}
