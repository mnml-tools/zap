import test from 'node:test'
import assert from 'node:assert/strict'
import { orderConnections } from '../src/lib/connectionOrder.ts'

test('sorts connection titles alphabetically ignoring case and surrounding whitespace', () => {
  const connections = ['zebra', ' Banana ', 'apple', 'cherry'].map((title) => ({ title }))
  assert.deepEqual(
    orderConnections(connections).map((item) => item.title),
    ['apple', ' Banana ', 'cherry', 'zebra']
  )
  assert.deepEqual(
    connections.map((item) => item.title),
    ['zebra', ' Banana ', 'apple', 'cherry']
  )
})

test('sorts numbers naturally and preserves equal-title order', () => {
  const connections = [
    { title: 'Server 10', id: 'a' },
    { title: 'Server 2', id: 'b' },
    { title: 'server 2', id: 'c' }
  ]
  assert.deepEqual(
    orderConnections(connections).map((item) => item.id),
    ['b', 'c', 'a']
  )
  assert.deepEqual(orderConnections([]), [])
})

test('same-name connections put Local before Prod while keeping alphabetical order primary', () => {
  const connections = [
    { title: 'Beta', environment: 'prod' },
    { title: 'beta', environment: 'local' },
    { title: 'Alpha', environment: 'prod' },
    { title: 'Beta', environment: null }
  ]
  assert.deepEqual(orderConnections(connections), [connections[2], connections[1], connections[3], connections[0]])
})

test('environment order groups local first and production last, sorting names within groups', () => {
  const connections = [
    { title: 'Alpha', environment: 'prod' },
    { title: 'Zebra', environment: 'local' },
    { title: 'Beta' },
    { title: 'Alpha', environment: 'local' }
  ]
  assert.deepEqual(orderConnections(connections, 'environment'), [
    connections[3],
    connections[1],
    connections[2],
    connections[0]
  ])
})
