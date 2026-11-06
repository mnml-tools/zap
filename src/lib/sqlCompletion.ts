import { highlightSql, isSqlKeyword } from './sqlHighlight.ts'
import { clauseContext, isPunct, keywordOf, referenceModifiers } from './sqlClauses.ts'
import type { SqlToken as Token } from './sqlClauses.ts'
import type { Table } from '../types/table'

export type SqlColumn = { name: string; type: string }

export type CompletionItem = { kind: 'table' | 'column' | 'keyword'; label: string; detail: string; insert: string }

export type Completion = { start: number; end: number; prefix: string; items: CompletionItem[] }

export type CompletionSchema = {
  driver: string
  tables: Table[]
  columns: (table: Table) => SqlColumn[] | undefined
}

export type TableReference = { table: Table; alias: string | null }

const referenceKeywords = new Set(['FROM', 'JOIN', 'UPDATE', 'INTO', 'TABLE', 'TRUNCATE', 'DESCRIBE'])

const maxItems = 100

/** Suggests tables, columns, and keywords for the word being typed at `cursor`. */

export function completeSql(sql: string, cursor: number, schema: CompletionSchema): Completion | null {
  const before = sql.slice(0, cursor)

  if (insideLiteral(before)) return null

  const prefix = /[A-Za-z_][\w$]*$/.exec(before)?.[0] ?? ''
  const start = cursor - prefix.length

  if (/[\w$:@]$/.test(sql.slice(0, start))) return null

  const statement = statementAround(lex(sql), start)
  const refs = references(statement, schema.tables)
  const leading = statement.filter((token) => token.end <= start)
  const dot = leading.at(-1)
  let items: CompletionItem[]

  if (dot && isPunct(dot, '.') && dot.end === start) {
    const owner = leading.at(-2)

    if (!owner || owner.end !== dot.start || !['word', 'identifier', 'keyword'].includes(owner.kind)) return null

    items = qualifiedItems(nameOf(owner), refs, schema)
  } else {
    const context = clauseContext(statement, start, schema.driver)
    const keywords = keywordItems(context.keywords, prefix)

    if (context.kind === 'none') return null

    if (context.kind === 'table') items = schema.tables.map((table) => tableItem(table, schema, true))
    else if (context.kind === 'column') items = [...columnItems(refs, schema), ...(prefix ? keywords : [])]
    else items = keywords
  }

  items = rank(items, prefix)

  if (!items.length || (items.length === 1 && items[0].insert.toLowerCase() === prefix.toLowerCase())) return null

  return { start, end: cursor, prefix, items: items.slice(0, maxItems) }
}

/** Distinct known tables referenced anywhere in the SQL, used to decide which columns to load. */

export function referencedTables(sql: string, tables: Table[]) {
  const found = new Set<Table>()

  for (const ref of references(lex(sql), tables)) found.add(ref.table)

  return [...found]
}

export function quoteIdentifier(name: string, driver: string) {
  const plain =
    /^[A-Za-z_][A-Za-z0-9_$]*$/.test(name) &&
    !isSqlKeyword(name) &&
    (driver !== 'postgresql' || name === name.toLowerCase())

  if (plain) return name

  const quote = driver === 'mysql' ? '`' : '"'

  return quote + name.replaceAll(quote, quote + quote) + quote
}

function insideLiteral(before: string) {
  // A trailing probe character joins the last token only when that token is still open.
  let offset = 0

  for (const token of highlightSql(before + ' ')) {
    offset += token.text.length

    if (offset > before.length) return ['string', 'comment', 'identifier'].includes(token.kind)
  }

  return false
}

function lex(sql: string) {
  const tokens: Token[] = []
  let offset = 0

  for (const token of highlightSql(sql)) {
    const start = offset
    offset += token.text.length

    if (token.kind === 'comment') continue

    if (token.kind === 'text' || token.kind === 'function') {
      for (const match of token.text.matchAll(/\s+|[A-Za-z_][\w$]*|\S/g)) {
        if (/^\s/.test(match[0])) continue

        tokens.push({
          kind: /^[A-Za-z_]/.test(match[0]) ? 'word' : 'punct',
          text: match[0],
          start: start + match.index,
          end: start + match.index + match[0].length
        })
      }

      continue
    }

    const kind =
      token.kind === 'keyword' || token.kind === 'identifier' || token.kind === 'operator' ? token.kind : 'value'
    tokens.push({ kind, text: token.text, start, end: offset })
  }

  return tokens
}

function statementAround(tokens: Token[], position: number) {
  let from = 0,
    to = tokens.length

  tokens.forEach((token, index) => {
    if (!isPunct(token, ';')) return

    if (token.end <= position) from = index + 1
    else if (to === tokens.length) to = index
  })

  return tokens.slice(from, to)
}

function references(tokens: Token[], tables: Table[]) {
  const found: TableReference[] = []

  tokens.forEach((token, index) => {
    const keyword = keywordOf(token)

    if (!referenceKeywords.has(keyword)) return

    let next = index + 1

    while (tokens[next]?.kind === 'keyword' && referenceModifiers.has(tokens[next].text.toUpperCase())) next++

    for (;;) {
      const parsed = parseReference(tokens, next, tables)

      if (!parsed) break

      if (parsed.ref) found.push(parsed.ref)

      next = parsed.next

      if (keyword !== 'FROM' || !tokens[next] || !isPunct(tokens[next], ',')) break

      next++
    }
  })

  return found
}

function parseReference(tokens: Token[], index: number, tables: Table[]) {
  const first = tokens[index]

  if (!first) return null

  const knownName = (token: Token) => tables.some((table) => table.name.toLowerCase() === token.text.toLowerCase())

  if (first.kind !== 'word' && first.kind !== 'identifier' && !(first.kind === 'keyword' && knownName(first)))
    return null

  let schema: string | null = null,
    name = nameOf(first),
    next = index + 1
  const second = tokens[next + 1]

  if (tokens[next] && isPunct(tokens[next], '.') && second && ['word', 'identifier', 'keyword'].includes(second.kind)) {
    schema = name
    name = nameOf(second)
    next += 2
  }

  let alias: string | null = null
  const following = tokens[next]

  if (following?.kind === 'keyword' && following.text.toUpperCase() === 'AS' && isAlias(tokens[next + 1])) {
    alias = nameOf(tokens[next + 1])
    next += 2
  } else if (isAlias(following)) {
    alias = nameOf(following)
    next++
  }

  const table = resolveTable(tables, schema, name)

  return { ref: table ? { table, alias } : null, next }
}

function resolveTable(tables: Table[], schema: string | null, name: string) {
  const matches = tables.filter(
    (table) =>
      table.name.toLowerCase() === name.toLowerCase() &&
      (schema === null || table.schema.toLowerCase() === schema.toLowerCase())
  )

  return (
    matches.find((table) => table.name === name) ?? matches.find((table) => table.schema === 'public') ?? matches[0]
  )
}

function columnItems(refs: TableReference[], schema: CompletionSchema) {
  const items: CompletionItem[] = [],
    seen = new Set<string>()
  const distinct = refs.filter((ref, index) => refs.findIndex((other) => sameRef(other, ref)) === index)
  const owners = new Map<string, number>()

  for (const ref of distinct)
    for (const column of schema.columns(ref.table) ?? []) owners.set(column.name, (owners.get(column.name) ?? 0) + 1)

  for (const ref of distinct) {
    const owner = ref.alias ?? ref.table.name

    for (const column of schema.columns(ref.table) ?? []) {
      const key = JSON.stringify([owner, column.name])

      if (seen.has(key)) continue

      seen.add(key)

      const ambiguous = (owners.get(column.name) ?? 0) > 1
      items.push({
        kind: 'column',
        label: column.name,
        detail: distinct.length > 1 ? [column.type, owner].filter(Boolean).join(' · ') : column.type,
        insert:
          (ambiguous ? quoteIdentifier(owner, schema.driver) + '.' : '') + quoteIdentifier(column.name, schema.driver)
      })
    }
  }

  return items
}

function qualifiedItems(owner: string, refs: TableReference[], schema: CompletionSchema) {
  const lower = owner.toLowerCase()
  const ref =
    refs.find((item) => item.alias?.toLowerCase() === lower) ??
    refs.find((item) => item.table.name.toLowerCase() === lower)

  if (ref) {
    return (schema.columns(ref.table) ?? []).map((column): CompletionItem => ({
      kind: 'column',
      label: column.name,
      detail: column.type,
      insert: quoteIdentifier(column.name, schema.driver)
    }))
  }

  return schema.tables
    .filter((table) => table.schema && table.schema.toLowerCase() === lower)
    .map((table) => tableItem(table, schema, false))
}

function tableItem(table: Table, schema: CompletionSchema, qualify: boolean): CompletionItem {
  const postgres = schema.driver === 'postgresql'
  const needsSchema =
    qualify &&
    postgres &&
    !!table.schema &&
    (table.schema !== 'public' || schema.tables.some((other) => other !== table && other.name === table.name))

  return {
    kind: 'table',
    label: table.name,
    detail: postgres ? table.schema : '',
    insert:
      (needsSchema ? quoteIdentifier(table.schema, schema.driver) + '.' : '') +
      quoteIdentifier(table.name, schema.driver)
  }
}

function keywordItems(keywords: string[], prefix: string) {
  const lower = /[a-z]/.test(prefix) && prefix === prefix.toLowerCase()

  return [...new Set(keywords)].map((keyword): CompletionItem => ({
    kind: 'keyword',
    label: keyword,
    detail: '',
    insert: lower ? keyword.toLowerCase() : keyword
  }))
}

function rank(items: CompletionItem[], prefix: string) {
  const needle = prefix.toLowerCase()

  // Short prefixes match only at the start; longer ones also find names that contain them.
  const infix = needle.length >= 3

  if (!needle) return items

  return items
    .map((item, index) => {
      const label = item.label.toLowerCase()
      const score =
        label === needle
          ? 0
          : label.startsWith(needle)
            ? 1
            : infix && item.kind !== 'keyword' && label.includes(needle)
              ? 2
              : -1

      return { item, index, score }
    })
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map((entry) => entry.item)
}

function nameOf(token: Token) {
  if (token.kind !== 'identifier') return token.text

  const close = token.text[0] === '[' ? ']' : token.text[0]
  const body = token.text.length > 1 && token.text.endsWith(close) ? token.text.slice(1, -1) : token.text.slice(1)

  return body.replaceAll(close + close, close)
}

function isAlias(token: Token | undefined) {
  return token?.kind === 'word' || token?.kind === 'identifier'
}

function sameRef(a: TableReference, b: TableReference) {
  return a.table === b.table && a.alias === b.alias
}
