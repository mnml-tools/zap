import test from 'node:test'
import assert from 'node:assert/strict'
import { stageCell, countChanges, nextSort } from '../src/lib/tableState.ts'
const cell = (overrides = {}) => ({
  tab: 'people',
  rowKey: '[1]',
  row: ['1', 'Before', null],
  column: 1,
  value: 'After',
  columns: ['id', 'name', 'email'],
  ...overrides
})
test('staging is immutable and reverting a value removes its pending change', () => {
  const original = {}
  const first = stageCell(original, cell())
  assert.deepEqual(original, {})
  assert.equal(countChanges(first.people), 1)
  assert.equal(first.people.rows['[1]'].original[1], 'Before')
  const reverted = stageCell(first, cell({ value: 'Before' }))
  assert.deepEqual(reverted, {})
  assert.equal(countChanges(first.people), 1)
})
test('edits remain independent across rows and tabs, including NULL versus empty text', () => {
  let drafts = stageCell({}, cell())
  drafts = stageCell(drafts, cell({ rowKey: '[101]', row: ['101', 'Last', null], column: 2, value: '' }))
  drafts = stageCell(drafts, cell({ tab: 'events', rowKey: '[1]', value: 'Event' }))
  assert.equal(countChanges(drafts.people), 2)
  assert.equal(countChanges(drafts.events), 1)
  const restored = stageCell(drafts, cell({ rowKey: '[101]', row: ['101', 'Last', null], column: 2, value: null }))
  assert.equal(countChanges(restored.people), 1)
  assert.equal(countChanges(restored.events), 1)
})
test('sorting cycles ascending, descending, none and restarts for another column', () => {
  const asc = nextSort(undefined, 'id')
  assert.deepEqual(asc, { column: 'id', direction: 'asc' })
  const desc = nextSort(asc, 'id')
  assert.deepEqual(desc, { column: 'id', direction: 'desc' })
  assert.equal(nextSort(desc, 'id'), undefined)
  assert.deepEqual(nextSort(desc, 'name'), { column: 'name', direction: 'asc' })
})
