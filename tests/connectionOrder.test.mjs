import test from 'node:test'
import assert from 'node:assert/strict'
import { moveConnection, orderConnections } from '../src/lib/connectionOrder.ts'

const connections = ['a', 'b', 'c', 'd'].map((id) => ({ id }))
const ids = (items) => items.map((item) => item.id)

test('saved order survives reloads and ignores deleted connections while appending new ones', () => {
  const persisted = JSON.parse(JSON.stringify(['c', 'deleted', 'a']))
  assert.deepEqual(ids(orderConnections(connections, persisted)), ['c', 'a', 'b', 'd'])
  assert.deepEqual(ids(connections), ['a', 'b', 'c', 'd'])
})

test('connections move forward and backward without losing hidden search results', () => {
  assert.deepEqual(ids(moveConnection(connections, 'a', 'c')), ['b', 'c', 'a', 'd'])
  assert.deepEqual(ids(moveConnection(connections, 'd', 'b')), ['a', 'd', 'b', 'c'])
  assert.deepEqual(ids(connections), ['a', 'b', 'c', 'd'])
})

test('dropping on the same connection or an unknown connection leaves the order unchanged', () => {
  assert.equal(moveConnection(connections, 'a', 'a'), connections)
  assert.equal(moveConnection(connections, 'missing', 'a'), connections)
  assert.equal(moveConnection(connections, 'a', 'missing'), connections)
})
