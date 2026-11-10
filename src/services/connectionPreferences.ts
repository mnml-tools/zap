import { createPreferences } from '../lib/preferences.ts'

export type ConnectionPreferences = {
  startup: 'last' | 'picker' | 'specific'
  startupId: string
  order: 'name' | 'environment'
}

export const connectionPreferences = createPreferences<ConnectionPreferences>(
  'zap.connectionPreferences',
  {
    startup: 'last',
    startupId: '',
    order: 'name'
  },
  (value) => {
    const saved = value as Partial<ConnectionPreferences> | null
    const result: Partial<ConnectionPreferences> = {}

    if (!saved || typeof saved !== 'object') return result
    if (['last', 'picker', 'specific'].includes(saved.startup!)) result.startup = saved.startup
    if (typeof saved.startupId === 'string') result.startupId = saved.startupId
    if (['name', 'environment'].includes(saved.order!)) result.order = saved.order

    return result
  }
)

export function startupConnection<T extends { id: string }>(
  connections: T[],
  lastId: string | null,
  preferences: ConnectionPreferences
) {
  const id = preferences.startup === 'specific' ? preferences.startupId : preferences.startup === 'last' ? lastId : null

  return connections.find((connection) => connection.id === id)
}
