import { useState } from 'react'

export type ConnectionView = 'list' | 'grid'

const storageKey = 'zap.connectionView'

export function useConnectionView() {
  const [view, setView] = useState<ConnectionView>(() => {
    try {
      return localStorage.getItem(storageKey) === 'list' ? 'list' : 'grid'
    } catch {
      return 'grid'
    }
  })

  const changeView = (next: ConnectionView) => {
    setView(next)

    try {
      localStorage.setItem(storageKey, next)
    } catch {
      /* Keep the view switch usable if storage is unavailable. */
    }
  }

  return { view, changeView }
}
