import { createPreferences } from '../lib/preferences.ts'

export const pageSizeOptions = [50, 100, 250, 500, 1000]

export type DataPreferences = {
  pageSize: number
  nullLabel: 'NULL' | '—' | '(null)'
  wrapText: boolean
  density: 'compact' | 'comfortable'
}

export const dataPreferences = createPreferences<DataPreferences>(
  'zap.dataPreferences',
  {
    pageSize: 100,
    nullLabel: 'NULL',
    wrapText: false,
    density: 'compact'
  },
  (value) => {
    const saved = value as Partial<DataPreferences> | null
    const result: Partial<DataPreferences> = {}

    if (!saved || typeof saved !== 'object') return result
    if (pageSizeOptions.includes(saved.pageSize!)) result.pageSize = saved.pageSize
    if (['NULL', '—', '(null)'].includes(saved.nullLabel!)) result.nullLabel = saved.nullLabel
    if (typeof saved.wrapText === 'boolean') result.wrapText = saved.wrapText
    if (['compact', 'comfortable'].includes(saved.density!)) result.density = saved.density

    return result
  }
)
