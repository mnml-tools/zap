import test from 'node:test'
import assert from 'node:assert/strict'
import { duplicateRowsShortcut, matchesShortcut, formatShortcut } from '../src/lib/shortcuts.ts'

const event = (overrides = {}) => ({
  key: 'd',
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...overrides
})

test('duplicate uses Command on macOS and Control on other platforms', () => {
  assert.equal(matchesShortcut(event({ metaKey: true }), duplicateRowsShortcut, true), true)
  assert.equal(matchesShortcut(event({ ctrlKey: true }), duplicateRowsShortcut, false), true)
  assert.equal(matchesShortcut(event({ ctrlKey: true }), duplicateRowsShortcut, true), false)
  assert.equal(matchesShortcut(event({ metaKey: true }), duplicateRowsShortcut, false), false)
  assert.equal(matchesShortcut(event(), duplicateRowsShortcut, false), false)
})

test('extra modifiers and other keys do not trigger duplicate', () => {
  for (const overrides of [{ shiftKey: true }, { altKey: true }, { metaKey: true }, { key: 's' }]) {
    assert.equal(matchesShortcut(event({ ctrlKey: true, ...overrides }), duplicateRowsShortcut, false), false)
  }

  assert.equal(formatShortcut(duplicateRowsShortcut, true), '⌘D')
  assert.equal(formatShortcut(duplicateRowsShortcut, false), 'Ctrl+D')
})
