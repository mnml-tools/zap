import { useState } from 'react'
import type { Connection } from '../types/connection'
import { moveConnection, orderConnections } from '../lib/connectionOrder'

const storageKey = 'zap.connectionOrder'

export function useConnectionOrder(connections: Connection[]) {
  const [order, setOrder] = useState<string[]>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]')
      return Array.isArray(saved) ? [...new Set(saved.filter((id): id is string => typeof id === 'string'))] : []
    } catch {
      return []
    }
  })
  const ordered = orderConnections(connections, order)

  const move = (source: string, target: string) => {
    const next = moveConnection(ordered, source, target)
    if (next === ordered) return

    const ids = next.map((connection) => connection.id)
    setOrder(ids)

    try {
      localStorage.setItem(storageKey, JSON.stringify(ids))
    } catch {
      /* Keep reordering usable if storage is unavailable. */
    }
  }

  return { ordered, move }
}
