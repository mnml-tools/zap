import test from 'node:test'
import assert from 'node:assert/strict'
import {
  duplicateRowsShortcut,
  discardChangesShortcut,
  matchesShortcut,
  formatShortcut,
  createDoubleShiftDetector
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

const shift = (type, timeStamp, overrides = {}) => ({
  ...event({ key: 'Shift' }),
  type,
  timeStamp,
  repeat: false,
  ...overrides
})

test('double Shift fires once after two quick press and release cycles', () => {
  const detector = createDoubleShiftDetector()

  assert.equal(detector.handle(shift('keydown', 0)), false)
  assert.equal(detector.handle(shift('keyup', 50)), false)
  assert.equal(detector.handle(shift('keydown', 150)), false)
  assert.equal(detector.handle(shift('keyup', 200)), true)
  assert.equal(detector.handle(shift('keydown', 250)), false)
  assert.equal(detector.handle(shift('keyup', 300)), false)
})

test('double Shift ignores long holds, slow taps, repeated keys, and intervening typing', () => {
  const scenarios = [
    [shift('keydown', 0), shift('keyup', 350)],
    [shift('keydown', 0), shift('keyup', 20), shift('keydown', 600), shift('keyup', 620)],
    [shift('keydown', 0), shift('keydown', 20, { repeat: true }), shift('keyup', 30)],
    [shift('keydown', 0), shift('keyup', 20), shift('keydown', 30, { key: 'A' })],
    [shift('keydown', 0, { ctrlKey: true }), shift('keyup', 20)]
  ]

  for (const events of scenarios) {
    const detector = createDoubleShiftDetector()
    for (const item of events) assert.equal(detector.handle(item), false)
    assert.equal(detector.handle(shift('keydown', 1200)), false)
    assert.equal(detector.handle(shift('keyup', 1250)), false)
  }
})

test('resetting double Shift discards a tap from a previous window or dialog', () => {
  const detector = createDoubleShiftDetector()
  detector.handle(shift('keydown', 0))
  detector.handle(shift('keyup', 50))
  detector.reset()

  assert.equal(detector.handle(shift('keydown', 100)), false)
  assert.equal(detector.handle(shift('keyup', 150)), false)
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
