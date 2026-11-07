import test from 'node:test'
import assert from 'node:assert/strict'
import { isSwitchRelease, isTabSwitch, recentTabs, stepTab, touchTab } from '../src/lib/tabSwitcher.ts'

test('tabs are listed most recently used first, then in tab bar order', () => {
  let history = []
  for (const key of ['users', 'query:1', 'orders', 'users']) history = touchTab(history, key)

  assert.deepEqual(history, ['users', 'orders', 'query:1'])
  assert.deepEqual(recentTabs(['users', 'orders', 'query:1', 'query:2', 'items'], history), [
    'users',
    'orders',
    'query:1',
    'query:2',
    'items'
  ])
})

test('closed tabs drop out and an empty active key is not recorded', () => {
  const history = touchTab(['orders', 'users'], '')

  assert.deepEqual(history, ['orders', 'users'])
  assert.deepEqual(recentTabs(['users', 'items'], history), ['users', 'items'])
  assert.deepEqual(recentTabs([], history), [])
})

test('stepping wraps in both directions and starts on the previous tab', () => {
  assert.equal(stepTab(0, 3, false), 1)
  assert.equal(stepTab(2, 3, false), 0)
  assert.equal(stepTab(0, 3, true), 2)
  assert.equal(stepTab(1, 3, true), 0)
  assert.equal(stepTab(0, 1, false), 0)
  assert.equal(stepTab(0, 1, true), 0)
})

test('only Control+Tab, with or without Shift, opens the switcher', () => {
  const event = (overrides) => ({ key: 'Tab', ctrlKey: true, metaKey: false, altKey: false, ...overrides })

  assert.equal(isTabSwitch(event({})), true)
  assert.equal(isTabSwitch(event({ shiftKey: true })), true)
  assert.equal(isTabSwitch(event({ ctrlKey: false })), false)
  assert.equal(isTabSwitch(event({ ctrlKey: false, metaKey: true })), false)
  assert.equal(isTabSwitch(event({ altKey: true })), false)
  assert.equal(isTabSwitch(event({ key: 'q' })), false)
})

test('releasing Ctrl finishes the switch even when WebKitGTK still reports ctrlKey', () => {
  assert.equal(isSwitchRelease({ key: 'Control', ctrlKey: false }), true)
  assert.equal(isSwitchRelease({ key: 'Control', ctrlKey: true }), true)
  assert.equal(isSwitchRelease({ key: 'Shift', ctrlKey: false }), true)
  assert.equal(isSwitchRelease({ key: 'Tab', ctrlKey: true }), false)
  assert.equal(isSwitchRelease({ key: 'Shift', ctrlKey: true }), false)
})
