import test from 'node:test'
import assert from 'node:assert/strict'
import { completeSql, quoteIdentifier, referencedTables } from '../src/lib/sqlCompletion.ts'
const tables = [
  { schema: 'public', name: 'departments' },
  { schema: 'public', name: 'devices' },
  { schema: 'public', name: 'users' },
  { schema: 'public', name: 'orders' },
  { schema: 'audit', name: 'events' },
  { schema: 'public', name: 'Order Lines' }
]
const columns = {
  users: [
    { name: 'id', type: 'integer' },
    { name: 'name', type: 'text' },
    { name: 'email', type: 'text' }
  ],
  orders: [
    { name: 'id', type: 'integer' },
    { name: 'user_id', type: 'integer' },
    { name: 'total', type: 'numeric' }
  ]
}
const schema = (driver = 'postgresql') => ({ driver, tables, columns: (table) => columns[table.name] })
const complete = (text, driver) => completeSql(text.replace('|', ''), text.indexOf('|'), schema(driver))
const inserts = (text, driver) => complete(text, driver)?.items.map((item) => item.insert) ?? null
test('table clauses suggest tables that start with the typed prefix', () => {
  assert.deepEqual(inserts('SELECT * FROM de|'), ['departments', 'devices'])
  assert.deepEqual(inserts('select * from users u join or|'), ['orders', '"Order Lines"'])
  assert.deepEqual(inserts('SELECT * FROM users, o|'), ['orders', '"Order Lines"'])
  assert.deepEqual(inserts('DROP TABLE IF EXISTS dep|'), ['departments'])
  assert.deepEqual(complete('SELECT * FROM de|'), {
    start: 14,
    end: 16,
    prefix: 'de',
    items: [
      { kind: 'table', label: 'departments', detail: 'public', insert: 'departments' },
      { kind: 'table', label: 'devices', detail: 'public', insert: 'devices' }
    ]
  })
})
test('tables outside the default schema are qualified, and a schema prefix lists its tables', () => {
  assert.deepEqual(inserts('SELECT * FROM ev|'), ['audit.events'])
  assert.deepEqual(inserts('SELECT * FROM audit.|'), ['events'])
  assert.deepEqual(inserts('SELECT * FROM ev|', 'mysql'), ['events'])
})
test('column clauses suggest only columns of tables in the statement', () => {
  assert.deepEqual(inserts('SELECT na| FROM users'), ['name'])
  assert.deepEqual(inserts('SELECT * FROM users WHERE id = 1 AND |'), ['id', 'name', 'email'])
  assert.deepEqual(inserts('SELECT * FROM users ORDER BY id DESC, |'), ['id', 'name', 'email'])
  assert.deepEqual(inserts('UPDATE users SET |'), ['id', 'name', 'email'])
  assert.deepEqual(inserts('INSERT INTO orders (|'), ['id', 'user_id', 'total'])
  assert.deepEqual(inserts('SELECT 1 FROM users; SELECT | FROM orders'), ['id', 'user_id', 'total'])
  assert.deepEqual(inserts('SELECT na|'), null)
})
test('aliases resolve qualified columns and disambiguate shared names', () => {
  assert.deepEqual(inserts('SELECT u.| FROM users u'), ['id', 'name', 'email'])
  assert.deepEqual(inserts('SELECT * FROM "users" AS u WHERE u.em|'), ['email'])
  assert.deepEqual(inserts('SELECT | FROM users u JOIN orders o ON o.user_id = u.id'), [
    'u.id',
    'name',
    'email',
    'o.id',
    'user_id',
    'total'
  ])
})
test('keywords follow the typed case and are offered after complete expressions', () => {
  assert.deepEqual(inserts('se|'), ['select'])
  assert.deepEqual(inserts('SELECT * FROM users WH|'), ['WHERE'])
  assert.deepEqual(inserts('SELECT * FROM users ORDER BY id l|'), ['limit'])
  assert.equal(inserts('|')[0], 'SELECT')
})
test('nothing is suggested inside literals, comments, aliases, parameters, or exact matches', () => {
  for (const text of [
    "SELECT * FROM users WHERE name = 'de|",
    'SELECT * FROM users -- de|',
    'SELECT * FROM users /* de|',
    'SELECT * FROM "de|',
    'SELECT id AS |',
    'SELECT * FROM users WHERE id = :na|',
    'SELECT x::te|',
    'SELECT * FROM users LIMIT 10|',
    'SELECT * FROM users from|'
  ])
    assert.equal(complete(text), null, text)
  assert.deepEqual(inserts("SELECT 'it''s' FROM de|"), ['departments', 'devices'])
})
test('identifiers are quoted only when the driver needs it', () => {
  assert.equal(quoteIdentifier('users', 'postgresql'), 'users')
  assert.equal(quoteIdentifier('Users', 'postgresql'), '"Users"')
  assert.equal(quoteIdentifier('Users', 'mysql'), 'Users')
  assert.equal(quoteIdentifier('order lines', 'mysql'), '`order lines`')
  assert.equal(quoteIdentifier('a"b', 'sqlite'), '"a""b"')
  assert.equal(quoteIdentifier('select', 'sqlite'), '"select"')
})
test('referenced tables include joins, comma lists, and DML targets once each', () => {
  const sql = 'SELECT * FROM users u, orders JOIN audit.events e ON true; UPDATE users SET name = 1; FROM missing'
  assert.deepEqual(
    referencedTables(sql, tables).map((table) => table.name),
    ['users', 'orders', 'events']
  )
})
test('clauses already written are not suggested again, and later clauses bound what comes before them', () => {
  assert.equal(complete('SELECT * FROM users WHERE id = 1 w|'), null)
  assert.equal(inserts('SELECT * FROM users WHERE id = 1 |').includes('WHERE'), false)
  assert.deepEqual(inserts('SELECT * FROM users WHERE id = 1 |').slice(0, 3), ['AND', 'OR', 'GROUP BY'])
  assert.deepEqual(inserts('SELECT * FROM users ORDER BY id |'), ['ASC', 'DESC', 'LIMIT', 'OFFSET'])
  assert.deepEqual(inserts('SELECT * FROM users ORDER BY id DESC |'), ['LIMIT', 'OFFSET'])
  assert.deepEqual(inserts('SELECT * FROM users LIMIT 10 |'), ['OFFSET'])
  assert.equal(complete('SELECT * FROM users LIMIT 10 OFFSET 5 |'), null)
  assert.equal(inserts('SELECT * FROM users WHERE id = 1 | LIMIT 5').includes('LIMIT'), false)
  assert.equal(inserts('SELECT * FROM users | ORDER BY id').includes('ORDER BY'), false)
  assert.deepEqual(inserts('SELECT id |'), ['AS', 'FROM'])
  assert.deepEqual(inserts('SELECT id AS x |'), ['FROM'])
})
test('predicates distinguish a pending comparison from a complete one', () => {
  assert.deepEqual(inserts('SELECT * FROM users WHERE id |').slice(0, 3), ['IN', 'NOT IN', 'LIKE'])
  assert.deepEqual(inserts('SELECT * FROM users WHERE id IS |'), ['NULL', 'NOT NULL', 'TRUE', 'FALSE'])
  assert.deepEqual(inserts('SELECT * FROM users WHERE id IS NOT |'), ['NULL', 'TRUE', 'FALSE'])
  assert.deepEqual(inserts('SELECT * FROM users WHERE id BETWEEN 1 AND |'), ['id', 'name', 'email'])
  assert.deepEqual(inserts('SELECT * FROM users WHERE id BETWEEN 1 AND 5 |').slice(0, 2), ['AND', 'OR'])
  assert.deepEqual(inserts('SELECT CASE WHEN id = 1 THEN 2 |'), ['WHEN', 'ELSE', 'END'])
})
test('each statement type follows its own clause order', () => {
  assert.deepEqual(inserts('UPDATE users |'), ['AS', 'SET'])
  assert.deepEqual(inserts('UPDATE users SET name = 1 |'), ['FROM', 'WHERE', 'RETURNING'])
  assert.deepEqual(inserts('DELETE |'), ['FROM'])
  assert.deepEqual(inserts('DELETE FROM users WHERE id = 1 |'), ['AND', 'OR', 'RETURNING'])
  assert.deepEqual(inserts('INSERT INTO users (id, name) |'), ['VALUES', 'SELECT', 'DEFAULT VALUES'])
  assert.deepEqual(inserts('INSERT INTO users VALUES (1, 2) |'), ['ON CONFLICT', 'RETURNING'])
  assert.deepEqual(inserts('SELECT * FROM users UNION ALL |'), ['SELECT'])
  assert.deepEqual(inserts('SELECT * FROM users u LEFT |'), ['JOIN', 'OUTER JOIN'])
  assert.deepEqual(inserts('SELECT * FROM users |', 'mysql').includes('FULL JOIN'), false)
})
test('subqueries are completed by their own clauses', () => {
  const inner = inserts('SELECT * FROM users WHERE id IN (SELECT user_id FROM orders WHERE id = 1 |)')
  assert.deepEqual(inner.slice(0, 3), ['AND', 'OR', 'GROUP BY'])
  assert.deepEqual(inserts('SELECT * FROM users WHERE id IN (|'), ['SELECT', 'WITH'])
})
