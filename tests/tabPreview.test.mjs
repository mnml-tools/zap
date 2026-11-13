import test from 'node:test'
import assert from 'node:assert/strict'
import { createPreviewStore, loadedAgo, previewGrid, previewResult, previewSql } from '../src/lib/tabPreview.ts'

test('grid previews keep a few short cells and count what was left out', () => {
  const columns = Array.from({ length: 11 }, (_, index) => `c${index}`)
  const rows = Array.from({ length: 30 }, (_, row) => columns.map((_, column) => (column === 1 ? null : `${row}`)))
  rows[0][0] = 'x'.repeat(200)
  const grid = previewGrid(columns, rows, 520431)

  assert.equal(grid.columns.length, 8)
  assert.equal(grid.hiddenColumns, 3)
  assert.equal(grid.rows.length, 8)
  assert.ok(grid.rows.every((row) => row.length === 8))
  assert.equal(grid.rows[0][0], `${'x'.repeat(80)}…`)
  assert.equal(grid.rows[0][1], null)
  assert.equal(grid.total, 520431)
  assert.deepEqual(previewGrid(['id'], [], 0), { columns: ['id'], rows: [], total: 0, hiddenColumns: 0 })
})

test('query results preview the selected set and fall back to the first', () => {
  const set = (rowCount, rowsAffected = 0) => ({
    columns: rowCount ? ['id'] : [],
    rows: Array.from({ length: rowCount }, (_, index) => [`${index}`]),
    rowCount,
    rowsAffected,
    truncated: false
  })
  const result = { results: [set(3), set(0, 7)], durationMs: 12 }

  assert.equal(previewResult(null, 0), null)
  assert.equal(previewResult({ results: [], durationMs: 1 }, 0), null)
  assert.deepEqual(previewResult(result, 1), {
    columns: [],
    rows: [],
    total: 0,
    hiddenColumns: 0,
    rowsAffected: 7,
    durationMs: 12,
    sets: 2
  })
  assert.equal(previewResult(result, 5).total, 3)
})

test('SQL previews skip leading blank lines and cap lines and length', () => {
  assert.deepEqual(previewSql('\n  \nselect 1\n\n'), { text: 'select 1', more: false })

  const long = Array.from({ length: 20 }, (_, index) => `line ${index}`).join('\n')
  const preview = previewSql(long)
  assert.equal(preview.text.split('\n').length, 12)
  assert.equal(preview.more, true)
  assert.equal(previewSql('a'.repeat(300)).text, `${'a'.repeat(160)}…`)
})

test('load age is shown in minutes, then hours', () => {
  assert.equal(loadedAgo(0, 59_000), 'just now')
  assert.equal(loadedAgo(0, 60_000), '1 min ago')
  assert.equal(loadedAgo(0, 59 * 60_000), '59 min ago')
  assert.equal(loadedAgo(0, 3 * 3_600_000), '3 h ago')
})

test('preview store reads on demand and only notifies subscribed listeners', () => {
  const store = createPreviewStore()
  let value = 1,
    calls = 0
  const unregister = store.register('query:1', () => value)
  const unsubscribe = store.subscribe(() => calls++)

  value = 2
  assert.equal(store.read('query:1'), 2)
  store.changed()
  unsubscribe()
  store.changed()
  assert.equal(calls, 1)

  // A remounted editor that registered again is not removed by the old cleanup.
  const replacement = store.register('query:1', () => 3)
  unregister()
  assert.equal(store.read('query:1'), 3)
  replacement()
  assert.equal(store.read('query:1'), undefined)
})
