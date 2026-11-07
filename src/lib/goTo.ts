import type { SavedQuery } from '../types/query'
import type { Table } from '../types/table'
import { tableKey } from './tableState.ts'

export type GoToScope = 'all' | 'tables' | 'queries'

export type TextMatch = { rank: number; indices: number[] }

export type GoToItem = { key: string; rank: number; label: string; matches: number[] } & (
  { kind: 'table'; table: Table; schemaMatches: number[] } | { kind: 'query'; query: SavedQuery }
)

export const goToScopes: { value: GoToScope; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'tables', label: 'Tables' },
  { value: 'queries', label: 'Queries' }
]

const separator = /[^\p{L}\p{N}]/u

const range = (start: number, length: number) => Array.from({ length }, (_, index) => start + index)

function wordStart(text: string, index: number) {
  if (index === 0) return true

  const previous = text[index - 1]
  const current = text[index]

  return (
    separator.test(previous) ||
    (previous !== previous.toUpperCase() && current !== current.toLowerCase()) ||
    (/\d/.test(current) && !/\d/.test(previous))
  )
}

// Each query fragment must start at a word start, and later characters either continue the
// previous match or begin another word: "mvd" and "vir_dep" both find my_virtual_departments.
function matchWords(text: string, lower: string, query: string) {
  const chars: { char: string; start: boolean }[] = []
  let afterSeparator = true

  for (const char of query) {
    if (separator.test(char)) afterSeparator = true
    else {
      chars.push({ char, start: afterSeparator })
      afterSeparator = false
    }
  }

  if (!chars.length) return null

  const failed = new Set<string>()
  const indices: number[] = []

  const match = (position: number, previous: number): boolean => {
    if (position === chars.length) return true

    const memo = `${position}:${previous}`
    if (failed.has(memo)) return false

    const { char, start } = chars[position]
    for (let index = previous + 1; index < lower.length; index++) {
      if (lower[index] !== char) continue
      if (!wordStart(text, index) && (start || index !== previous + 1)) continue

      indices.push(index)
      if (match(position + 1, index)) return true
      indices.pop()
    }

    failed.add(memo)

    return false
  }

  return match(0, -1) ? indices : null
}

export function matchText(text: string, search: string): TextMatch | null {
  const query = search.trim().toLowerCase()
  const lower = text.toLowerCase()

  if (!query) return { rank: 0, indices: [] }
  if (lower === query) return { rank: 0, indices: range(0, query.length) }
  if (lower.startsWith(query)) return { rank: 1, indices: range(0, query.length) }

  let first = -1
  for (let index = lower.indexOf(query); index >= 0; index = lower.indexOf(query, index + 1)) {
    if (wordStart(text, index)) return { rank: 2, indices: range(index, query.length) }
    if (first < 0) first = index
  }

  if (first >= 0) return { rank: 3, indices: range(first, query.length) }

  const indices = matchWords(text, lower, query)

  return indices ? { rank: 4, indices } : null
}

function matchTable(table: Table, search: string): GoToItem | null {
  const qualified = search.includes('.') && table.schema
  const match = matchText(qualified ? `${table.schema}.${table.name}` : table.name, search)

  if (!match) return null

  const offset = qualified ? table.schema.length + 1 : 0

  return {
    kind: 'table',
    key: `table:${tableKey(table)}`,
    rank: match.rank,
    label: table.name,
    table,
    matches: match.indices.filter((index) => index >= offset).map((index) => index - offset),
    schemaMatches: match.indices.filter((index) => index < offset - 1)
  }
}

function matchQuery(query: SavedQuery, search: string): GoToItem | null {
  const match = matchText(query.title, search)

  return (
    match && {
      kind: 'query',
      key: `query:${query.id}`,
      rank: match.rank,
      label: query.title,
      query,
      matches: match.indices
    }
  )
}

export function searchGoTo(tables: Table[], queries: SavedQuery[], scope: GoToScope, search: string) {
  const items = [
    ...(scope === 'queries' ? [] : tables.map((table) => matchTable(table, search))),
    ...(scope === 'tables' ? [] : queries.map((query) => matchQuery(query, search)))
  ].filter((item) => item !== null)

  if (!search.trim()) return items

  return items.sort(
    (a, b) =>
      a.rank - b.rank ||
      a.label.length - b.label.length ||
      a.label.localeCompare(b.label) ||
      (a.kind === b.kind ? 0 : a.kind === 'table' ? -1 : 1)
  )
}
