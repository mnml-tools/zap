import test from 'node:test'
import assert from 'node:assert/strict'
import { startupConnection } from '../src/services/connectionPreferences.ts'

const connections = [{ id: 'a' }, { id: 'b' }]
const defaults = { startup: 'last', startupId: '', order: 'name' }

test('startup respects picker, last connection and explicit preference', () => {
  assert.equal(startupConnection(connections, 'a', defaults), connections[0])
  assert.equal(startupConnection(connections, 'a', { ...defaults, startup: 'picker' }), undefined)
  assert.equal(
    startupConnection(connections, 'a', { ...defaults, startup: 'specific', startupId: 'b' }),
    connections[1]
  )
  assert.equal(
    startupConnection(connections, 'a', { ...defaults, startup: 'specific', startupId: 'deleted' }),
    undefined
  )
  assert.equal(startupConnection(connections, 'deleted', defaults), undefined)
})
