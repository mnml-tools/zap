import test from 'node:test'
import assert from 'node:assert/strict'
import { activeParameters, inferParameter, parameterNames, parameterSql } from '../src/lib/queryParameters.ts'

test('discovers repeated names while ignoring quoted SQL, comments and casts', () => {
  assert.deepEqual(
    parameterNames(`SELECT :id, :id::int, :other, ':ignored', " :column", $$:body$$ /* :comment */ -- :line\n`),
    ['id', 'other']
  )
  assert.deepEqual(
    activeParameters('SELECT :id', [
      { name: 'id', type: 'number', value: '42' },
      { name: 'old', type: 'text', value: '' }
    ]),
    [{ name: 'id', type: 'number', value: '42' }]
  )
})

test('renders values safely for every driver and reuses repeated parameters', () => {
  const parameters = [
    { name: 'id', type: 'number', value: '42' },
    { name: 'text', type: 'text', value: "'); DROP TABLE bikes; --\\" }
  ]
  for (const driver of ['sqlite', 'postgresql', 'mysql']) {
    const sql = parameterSql('SELECT :id, :id, :text', parameters, driver)
    assert.ok(sql.startsWith('SELECT (42), (42), '))
    assert.ok(!sql.includes('DROP TABLE'))
  }
  assert.throws(
    () => parameterSql('SELECT :id', [{ name: 'id', type: 'number', value: '1; DROP TABLE bikes' }], 'sqlite'),
    /valid number/
  )
  assert.throws(() => parameterSql('SELECT :id', [], 'sqlite'), /Set a value/)
  assert.equal(
    parameterSql(
      'SELECT :n, :b',
      [
        { name: 'n', type: 'null', value: '' },
        { name: 'b', type: 'boolean', value: 'false' }
      ],
      'sqlite'
    ),
    'SELECT NULL, FALSE'
  )
})

test('infers types from a single value field without treating SQL as code', () => {
  for (const [value, type, expected] of [
    ['42', 'number', '42'],
    [' 1.5 ', 'number', '1.5'],
    ['TRUE', 'boolean', 'true'],
    ['NULL', 'null', 'null'],
    ['', 'text', ''],
    ['hello', 'text', 'hello'],
    ['1; DROP TABLE bikes', 'text', '1; DROP TABLE bikes']
  ])
    assert.deepEqual(inferParameter('id', value), { name: 'id', type, value: expected })
})
