import test from 'node:test'
import assert from 'node:assert/strict'
import { shortcutPreview } from '../src/lib/shortcutPreview.ts'

const key = (key, modifiers = {}) => ({
  key,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...modifiers
})

test('previews modifiers before a key and the completed combination', () => {
  assert.equal(shortcutPreview(key('Meta', { metaKey: true }), true), '⌘')
  assert.equal(shortcutPreview(key('Shift', { metaKey: true, shiftKey: true }), true), '⌘⇧')
  assert.equal(shortcutPreview(key('k', { metaKey: true, shiftKey: true }), true), '⌘⇧K')
  assert.equal(shortcutPreview(key('Control', { ctrlKey: true }), false), 'Ctrl')
  assert.equal(shortcutPreview(key('k', { ctrlKey: true, altKey: true }), false), 'Ctrl+Alt+K')
})

test('key release shows remaining held modifiers, including stale modifier flags', () => {
  assert.equal(shortcutPreview(key('k', { metaKey: true }), true, true), '⌘')
  assert.equal(shortcutPreview(key('Meta', { metaKey: true }), true, true), '')
  assert.equal(shortcutPreview(key('Shift', { metaKey: true, shiftKey: true }), true, true), '⌘')
})
