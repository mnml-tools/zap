import test from 'node:test'
import assert from 'node:assert/strict'
import { queryNeedsConfirmation } from '../src/lib/queryConfirmation.ts'

test('asks before changes in batches and CTEs', () => {
  for (const sql of [
    'DELETE FROM people',
    'select 1; DROP TABLE people',
    'WITH removed AS (DELETE FROM people RETURNING *) SELECT * FROM removed',
    'UPDATE people SET name = :name',
    'CREATE TABLE t (id int)',
    'CALL update_people()'
  ])
    assert.equal(queryNeedsConfirmation(sql), true, sql)
})

test('ignores change keywords in comments, literals, identifiers and row locks', () => {
  for (const sql of [
    'SELECT 1',
    "SELECT 'DELETE' AS message",
    'SELECT "UPDATE" FROM t',
    'SELECT $$DROP TABLE people$$',
    '-- DELETE FROM people\nSELECT 1',
    '/* DROP TABLE t */ SELECT 1',
    'SELECT * FROM t FOR UPDATE'
  ])
    assert.equal(queryNeedsConfirmation(sql), false, sql)
})
