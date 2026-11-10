import test from 'node:test'
import assert from 'node:assert/strict'

const storage = new Map([
  [
    'zap.shortcuts',
    JSON.stringify({
      goTo: { key: 'k', primary: true, shift: true, alt: false, allowInInputs: false },
      saveChanges: { key: 42 },
      unknown: { key: 'x', primary: true, shift: false, alt: false }
    })
  ]
])
let failWrites = false

globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => {
    if (failWrites) throw new Error('Storage unavailable')
    storage.set(key, value)
  },
  removeItem: (key) => {
    if (failWrites) throw new Error('Storage unavailable')
    storage.delete(key)
  }
}

const { getShortcuts, resolveShortcut, saveShortcut, resetShortcuts, shortcutConflict, subscribeShortcuts } =
  await import('../src/services/shortcuts.ts')
const { goToShortcut, saveChangesShortcut, duplicateRowsShortcut } = await import('../src/lib/shortcuts.ts')

test('loads valid saved bindings while preserving input policy and ignoring malformed settings', () => {
  assert.equal(resolveShortcut(goToShortcut).key, 'k')
  assert.equal(resolveShortcut(goToShortcut).allowInInputs, true)
  assert.equal(resolveShortcut(saveChangesShortcut), saveChangesShortcut)
  assert.equal(getShortcuts().unknown, undefined)
})

test('saving bindings updates subscribers, persists preferences, and detects effective conflicts', () => {
  resetShortcuts()
  let notifications = 0
  const unsubscribe = subscribeShortcuts(() => notifications++)
  const custom = { ...goToShortcut, key: 'k', primary: true, shift: true, alt: false }

  saveShortcut('goTo', custom)
  assert.equal(notifications, 1)
  assert.equal(resolveShortcut(goToShortcut), custom)
  assert.equal(JSON.parse(storage.get('zap.shortcuts')).goTo.key, 'k')
  assert.equal(shortcutConflict('saveChanges', custom)?.id, 'goTo')
  assert.equal(shortcutConflict('goTo', custom), undefined)
  assert.equal(shortcutConflict('saveChanges', { ...custom, shift: false }), undefined)
  assert.equal(resolveShortcut(duplicateRowsShortcut), duplicateRowsShortcut)

  saveShortcut('goTo')
  assert.equal(resolveShortcut(goToShortcut), goToShortcut)
  assert.equal(notifications, 2)
  unsubscribe()
  resetShortcuts()
  assert.equal(notifications, 2)
  assert.equal(storage.has('zap.shortcuts'), false)
})

test('failed persistence keeps active shortcuts and subscribers unchanged', () => {
  const before = getShortcuts()
  let notifications = 0
  const unsubscribe = subscribeShortcuts(() => notifications++)
  failWrites = true

  assert.throws(() => saveShortcut('goTo', { ...goToShortcut, key: 'k' }), /Storage unavailable/)
  assert.throws(() => resetShortcuts(), /Storage unavailable/)
  assert.equal(getShortcuts(), before)
  assert.equal(notifications, 0)

  failWrites = false
  unsubscribe()
})
