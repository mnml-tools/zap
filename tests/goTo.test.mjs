import test from 'node:test'
import assert from 'node:assert/strict'
import { matchText, searchGoTo } from '../src/lib/goTo.ts'

const table = (name, schema = 'public') => ({ schema, name })

const query = (id, title) => ({ id, connectionId: 'c', title, sql: 'select 1' })

const labels = (items) => items.map((item) => item.label)

test('exact, prefix, word-start and inner substrings rank in that order', () => {
  assert.deepEqual(matchText('departments', 'Departments'), { rank: 0, indices: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] })
  assert.deepEqual(matchText('departments', 'depa'), { rank: 1, indices: [0, 1, 2, 3] })
  assert.deepEqual(matchText('my_virtual_departments', 'depa'), { rank: 2, indices: [11, 12, 13, 14] })
  assert.deepEqual(matchText('subdepartments', 'depa'), { rank: 3, indices: [3, 4, 5, 6] })
})

test('a word-start substring wins over an earlier inner occurrence', () => {
  assert.deepEqual(matchText('nodes_node', 'node'), { rank: 1, indices: [0, 1, 2, 3] })
  assert.deepEqual(matchText('xorder_order', 'order'), { rank: 2, indices: [7, 8, 9, 10, 11] })
})

test('abbreviations match word starts across underscores, camel case and digits', () => {
  assert.deepEqual(matchText('my_virtual_departments', 'mvd'), { rank: 4, indices: [0, 3, 11] })
  assert.deepEqual(matchText('my_virtual_departments', 'virdep'), { rank: 4, indices: [3, 4, 5, 11, 12, 13] })
  assert.deepEqual(matchText('my_virtual_departments', 'vir_dep'), { rank: 4, indices: [3, 4, 5, 11, 12, 13] })
  assert.deepEqual(matchText('customerOrders', 'cuor'), { rank: 4, indices: [0, 1, 8, 9] })
  assert.deepEqual(matchText('orders2024', 'o20'), { rank: 4, indices: [0, 6, 7] })
})

test('abbreviations backtrack when the first candidate leads nowhere', () => {
  assert.deepEqual(matchText('user_users_settings', 'uset'), { rank: 4, indices: [0, 11, 12, 13] })
})

test('characters that are neither contiguous nor word starts do not match', () => {
  assert.equal(matchText('departments', 'dpt'), null)
  assert.equal(matchText('kids_departments', 'kid_ep'), null)
  assert.equal(matchText('people', 'xyz'), null)
  assert.equal(matchText('people', '___'), null)
})

test('an empty search keeps every item in its original order', () => {
  const tables = [table('zeta'), table('alpha')]
  const queries = [query('1', 'Monthly report')]

  assert.deepEqual(labels(searchGoTo(tables, queries, 'all', '  ')), ['zeta', 'alpha', 'Monthly report'])
  assert.deepEqual(labels(searchGoTo(tables, queries, 'tables', '')), ['zeta', 'alpha'])
  assert.deepEqual(labels(searchGoTo(tables, queries, 'queries', '')), ['Monthly report'])
})

test('results sort by rank, then shorter names, then alphabetically', () => {
  const tables = [
    'global_departments',
    'my_virtual_departments',
    'departments_log',
    'kids_departments',
    'subdepartments'
  ]
  const result = searchGoTo(
    tables.map((name) => table(name)),
    [],
    'all',
    'depa'
  )

  assert.deepEqual(labels(result), [
    'departments_log',
    'kids_departments',
    'global_departments',
    'my_virtual_departments',
    'subdepartments'
  ])
})

test('tables and saved queries are searched together and keep their identity', () => {
  const result = searchGoTo([table('orders')], [query('7', 'Orders by month')], 'all', 'order')

  assert.deepEqual(
    result.map(({ kind, key }) => [kind, key]),
    [
      ['table', 'table:["public","orders"]'],
      ['query', 'query:7']
    ]
  )
  assert.deepEqual(labels(searchGoTo([table('orders')], [query('7', 'Orders by month')], 'queries', 'order')), [
    'Orders by month'
  ])
})

test('a dotted search matches the schema-qualified name and splits the highlights', () => {
  const tables = [table('people', 'public'), table('people', 'audit'), table('events', 'audit')]
  const [item, ...rest] = searchGoTo(tables, [], 'tables', 'aud.peo')

  assert.equal(rest.length, 0)
  assert.deepEqual(item.table, table('people', 'audit'))
  assert.deepEqual(item.schemaMatches, [0, 1, 2])
  assert.deepEqual(item.matches, [0, 1, 2])
})

test('a plain search matches only the table name, not its schema', () => {
  assert.deepEqual(labels(searchGoTo([table('people', 'audit')], [], 'tables', 'aud')), [])
  assert.deepEqual(searchGoTo([table('people', 'audit')], [], 'tables', 'peo')[0].schemaMatches, [])
})
