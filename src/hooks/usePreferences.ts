import { useState, useSyncExternalStore } from 'react'
import type { createPreferences } from '../lib/preferences'

export function usePreferences<T extends object>(store: ReturnType<typeof createPreferences<T>>) {
  const values = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const [error, setError] = useState('')

  const persist = (run: () => void) => {
    try {
      run()
      setError('')
    } catch {
      setError('Could not save settings. Please try again.')
    }
  }

  return {
    values,
    error,
    update: (changes: Partial<T>) => persist(() => store.update(changes)),
    reset: () => persist(store.reset)
  }
}
