import { createPreferences } from '../lib/preferences.ts'

export const updatePreferences = createPreferences('zap.updatePreferences', { automatic: true }, (value) => {
  const saved = value as { automatic?: unknown } | null

  return saved && typeof saved.automatic === 'boolean' ? { automatic: saved.automatic } : {}
})
