export function createPreferences<T extends object>(
  key: string,
  defaults: T,
  validate: (value: unknown) => Partial<T>
) {
  let value = { ...defaults }
  const listeners = new Set<() => void>()

  try {
    value = { ...defaults, ...validate(JSON.parse(localStorage.getItem(key) ?? '{}')) }
  } catch {
    // Use defaults when storage is unavailable or malformed.
  }

  const publish = (next: T) => {
    value = next
    listeners.forEach((listener) => listener())
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      if (event.key !== key && event.key !== null) return

      try {
        publish({ ...defaults, ...validate(JSON.parse(event.newValue ?? '{}')) })
      } catch {
        publish({ ...defaults })
      }
    })
  }

  return {
    getSnapshot: () => value,
    subscribe: (listener: () => void) => {
      listeners.add(listener)

      return () => {
        listeners.delete(listener)
      }
    },
    update: (changes: Partial<T>) => {
      const next = { ...value, ...validate({ ...value, ...changes }) }
      localStorage.setItem(key, JSON.stringify(next))
      publish(next)
    },
    reset: () => {
      localStorage.removeItem(key)
      publish({ ...defaults })
    }
  }
}
