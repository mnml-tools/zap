import test from 'node:test'
import assert from 'node:assert/strict'
import {
  stageCell,
  countChanges,
  nextSort,
  toggleRowRemoval,
  toggleRowsRemoval,
  duplicateRows
} from '../src/lib/tableState.ts'
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

test('row removal preserves edits for restore and cannot be overwritten by cell commits', () => {
  const page = { primaryKeys: [0], columns: cell().columns }
  const edited = stageCell({}, cell({ rowKey: '["1"]' }))
  const removed = toggleRowRemoval(edited, 'people', cell().row, page)
  assert.equal(edited.people.rows['["1"]'].deleted, undefined)
  assert.equal(removed.people.rows['["1"]'].deleted, true)
  assert.equal(countChanges(removed.people), 1)
  assert.equal(stageCell(removed, cell({ rowKey: '["1"]', value: 'Late blur' })), removed)
  const restored = toggleRowRemoval(removed, 'people', cell().row, page)
  assert.equal(restored.people.rows['["1"]'].changes[1], 'After')
  assert.equal(restored.people.rows['["1"]'].deleted, false)
})

test('restoring an unedited row clears its draft and leaves other tabs intact', () => {
  const page = { primaryKeys: [0, 1], columns: cell().columns }
  const existing = stageCell({}, cell({ tab: 'events' }))
  const removed = toggleRowRemoval(existing, 'people', cell().row, page)
  assert.equal(countChanges(removed.people), 1)
  const restored = toggleRowRemoval(removed, 'people', cell().row, page)
  assert.deepEqual(restored, existing)
})

test('removing a mixed selection marks every row and restoring preserves edits', () => {
  const page = { primaryKeys: [0], columns: cell().columns }
  const rows = [cell().row, ['2', 'Second', null], ['3', 'Third', null]]
  const edited = stageCell({}, cell({ rowKey: '["1"]' }))
  const partiallyRemoved = toggleRowRemoval(edited, 'people', rows[1], page)
  const removed = toggleRowsRemoval(partiallyRemoved, 'people', rows, page)
  assert.equal(countChanges(removed.people), 3)
  assert.ok(rows.every((row) => removed.people.rows[JSON.stringify([row[0]])].deleted))
  assert.equal(partiallyRemoved.people.rows['["1"]'].deleted, undefined)
  const restored = toggleRowsRemoval(removed, 'people', rows, page)
  assert.equal(countChanges(restored.people), 1)
  assert.equal(restored.people.rows['["1"]'].changes[1], 'After')
  assert.equal(restored.people.rows['["2"]'], undefined)
  assert.equal(restored.people.rows['["3"]'], undefined)
})

test('new rows remain pending with defaults and preserve explicit NULL values', () => {
  const original = {
    people: {
      columns: cell().columns,
      rows: {
        'new:one': { original: [null, null, null], changes: {}, inserted: true },
        'new:two': { original: [null, null, null], changes: {}, inserted: true }
      }
    }
  }
  assert.equal(countChanges(original.people), 2)
  const staged = stageCell(original, cell({ rowKey: 'new:one', row: [null, null, null], value: null }))
  assert.equal(staged.people.rows['new:one'].inserted, true)
  assert.deepEqual(staged.people.rows['new:one'].changes, { 1: null })
  assert.deepEqual(staged.people.rows['new:two'].changes, {})
  assert.equal(countChanges(staged.people), 2)
  assert.deepEqual(original.people.rows['new:one'].changes, {})
})

test('duplicating rows stages independent inserts with edited values, NULLs and database defaults', () => {
  const page = {
    columns: ['id', 'name', 'email', 'computed'],
    primaryKeys: [0],
    editable: [true, true, true, false]
  }
  const rows = [
    ['1', 'Before', null, 'generated'],
    ['2', 'Second', '', 'generated']
  ]
  const drafts = stageCell({}, cell({ rowKey: '["1"]', columns: page.columns, row: rows[0] }))
  const result = duplicateRows(drafts, 'people', rows, page)
  const inserted = Object.values(result.people.rows).filter((row) => row.inserted)

  assert.equal(inserted.length, 2)
  assert.deepEqual(
    inserted.map((row) => row.changes),
    [
      { 1: 'After', 2: null },
      { 1: 'Second', 2: '' }
    ]
  )
  assert.deepEqual(inserted[0].original, [null, null, null, null])
  assert.equal(result.people.rows['["1"]'], drafts.people.rows['["1"]'])
  assert.equal(Object.keys(drafts.people.rows).length, 1)
  assert.equal(countChanges(result.people), 3)

  const repeated = duplicateRows(result, 'people', [rows[0]], page)
  assert.equal(Object.values(repeated.people.rows).filter((row) => row.inserted).length, 3)
  assert.equal(Object.values(result.people.rows).filter((row) => row.inserted).length, 2)
})
