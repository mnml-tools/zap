import test from 'node:test'
import assert from 'node:assert/strict'
import { createPreferences } from '../src/lib/preferences.ts'

const saved = new Map()
let fail = false
globalThis.localStorage = {
  getItem: (key) => saved.get(key) ?? null,
  setItem: (key, value) => {
    if (fail) throw Error('unavailable')
    saved.set(key, value)
  },
  removeItem: (key) => {
    if (fail) throw Error('unavailable')
    saved.delete(key)
  }
}
const validate = (value) =>
  typeof value?.size === 'number' && [50, 100].includes(value.size) ? { size: value.size } : {}

test('preferences validate stored values, notify after persistence and reset', () => {
  saved.set('test', '{invalid')
  const store = createPreferences('test', { size: 100 }, validate)
  assert.equal(store.getSnapshot().size, 100)
  let changes = 0
  const unsubscribe = store.subscribe(() => changes++)
  store.update({ size: 50 })
  assert.equal(JSON.parse(saved.get('test')).size, 50)
  assert.equal(store.getSnapshot().size, 50)
  store.update({ size: -1 })
  assert.equal(store.getSnapshot().size, 50)
  fail = true
  assert.throws(() => store.update({ size: 100 }))
  assert.equal(store.getSnapshot().size, 50)
  assert.equal(changes, 2)
  fail = false
  store.reset()
  assert.equal(store.getSnapshot().size, 100)
  assert.equal(saved.has('test'), false)
  unsubscribe()
})

test('data preferences accept supported defaults and discard invalid fields', async () => {
  saved.set(
    'zap.dataPreferences',
    JSON.stringify({ pageSize: 250, wrapText: true, density: 'huge', nullLabel: 'NULL' })
  )
  const { dataPreferences } = await import('../src/services/dataPreferences.ts')
  assert.deepEqual(dataPreferences.getSnapshot(), {
    pageSize: 250,
    wrapText: true,
    density: 'compact',
    nullLabel: 'NULL'
  })
})
