import test from 'node:test'
import assert from 'node:assert/strict'
import {
  duplicateRowsShortcut,
  goToShortcut,
  discardChangesShortcut,
  matchesShortcut,
  formatShortcut
} from '../src/lib/shortcuts.ts'

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

test('go to uses Command+N on macOS and Ctrl+N elsewhere, without Shift', () => {
  assert.equal(matchesShortcut(event({ key: 'n', metaKey: true }), goToShortcut, true), true)
  assert.equal(matchesShortcut(event({ key: 'N', ctrlKey: true }), goToShortcut, false), true)
  assert.equal(matchesShortcut(event({ key: 'n', ctrlKey: true, shiftKey: true }), goToShortcut, false), false)
  assert.equal(formatShortcut(goToShortcut, false), 'Ctrl+N')
  assert.equal(formatShortcut(goToShortcut, true), '⌘N')
})

test('discard uses Command/Ctrl+Z and preserves redo and input undo', () => {
  assert.equal(matchesShortcut(event({ key: 'z', metaKey: true }), discardChangesShortcut, true), true)
  assert.equal(matchesShortcut(event({ key: 'z', ctrlKey: true }), discardChangesShortcut, false), true)
  assert.equal(
    matchesShortcut(event({ key: 'z', ctrlKey: true, shiftKey: true }), discardChangesShortcut, false),
    false
  )
  assert.equal(matchesShortcut(event({ key: 'z', ctrlKey: true, altKey: true }), discardChangesShortcut, false), false)
  assert.equal(!!discardChangesShortcut.allowInInputs, false)
  assert.equal(formatShortcut(discardChangesShortcut, true), '⌘Z')
  assert.equal(formatShortcut(discardChangesShortcut, false), 'Ctrl+Z')
})
