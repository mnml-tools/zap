import test from 'node:test'
import assert from 'node:assert/strict'
import {
  connectionAvatarColors,
  pickAvatarColor,
  assignConnectionAvatarColors,
  connectionAvatarColor,
  setConnectionAvatarColor
} from '../src/lib/connectionAvatar.ts'

test('uses the full palette before repeating and distributes subsequent colors evenly', () => {
  const used = []
  for (let cycle = 0; cycle < 3; cycle++) {
    const batch = []
    for (let i = 0; i < connectionAvatarColors.length; i++) {
      const color = pickAvatarColor(used)
      used.push(color)
      batch.push(color)
    }
    assert.equal(new Set(batch).size, connectionAvatarColors.length)
  }
})

test('repairs existing duplicates and preserves assigned colors when the list reloads', () => {
  const storage = new Map()
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value)
  }
  try {
    const ids = Array.from({ length: connectionAvatarColors.length }, (_, i) => `avatar-test-${i}`)
    for (const id of ids) storage.set(`zap.connectionAvatar.${id}`, connectionAvatarColors[0])
    assignConnectionAvatarColors(ids)
    const first = ids.map(connectionAvatarColor)
    assert.equal(new Set(first).size, connectionAvatarColors.length)
    assignConnectionAvatarColors(ids)
    assert.deepEqual(ids.map(connectionAvatarColor), first)
  } finally {
    delete globalThis.localStorage
  }
})

test('first eleven connections remain unique even when they prefer the same color', () => {
  assert.equal(connectionAvatarColors.length, 11)
  const used = []
  for (let i = 0; i < 11; i++) {
    used.push(pickAvatarColor(used, connectionAvatarColors[0]))
  }
  assert.equal(new Set(used).size, 11)
  assert.ok(used.includes(pickAvatarColor(used)))
})

test('replaces removed shades with colors from the approved palette', () => {
  const storage = new Map()
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value)
  }
  try {
    const ids = Array.from({ length: 11 }, (_, i) => `old-avatar-${i}`)
    for (const id of ids) storage.set(`zap.connectionAvatar.${id}`, '#bf4b85')
    assignConnectionAvatarColors(ids)
    const assigned = ids.map(connectionAvatarColor)
    assert.equal(new Set(assigned).size, 11)
    assert.ok(assigned.every((color) => connectionAvatarColors.includes(color)))
    assert.ok(ids.every((id) => storage.get(`zap.connectionAvatar.${id}`) === connectionAvatarColor(id)))
  } finally {
    delete globalThis.localStorage
  }
})

test('saved custom choices survive automatic assignment, including intentional repeats', () => {
  const storage = new Map()
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value)
  }
  try {
    const chosen = connectionAvatarColors[5]
    setConnectionAvatarColor('custom-a', chosen)
    setConnectionAvatarColor('custom-b', chosen)
    assignConnectionAvatarColors(['auto-a', 'custom-a', 'auto-b', 'custom-b'])
    assert.equal(connectionAvatarColor('custom-a'), chosen)
    assert.equal(connectionAvatarColor('custom-b'), chosen)
    assert.notEqual(connectionAvatarColor('auto-a'), chosen)
    assert.notEqual(connectionAvatarColor('auto-b'), chosen)
    assert.equal(storage.get('zap.connectionAvatarChoice.custom-a'), chosen)
    setConnectionAvatarColor('custom-a', 'invalid')
    assert.equal(connectionAvatarColor('custom-a'), chosen)
  } finally {
    delete globalThis.localStorage
  }
})
