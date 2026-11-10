import { createPreferences } from '../lib/preferences.ts'

export type EditorPreferences = { fontSize: number; indentSize: number; autoComplete: boolean; confirmChanges: boolean }

export const editorPreferences = createPreferences<EditorPreferences>(
  'zap.editorPreferences',
  {
    fontSize: 12,
    indentSize: 2,
    autoComplete: true,
    confirmChanges: false
  },
  (value) => {
    const saved = value as Partial<EditorPreferences> | null
    const result: Partial<EditorPreferences> = {}

    if (!saved || typeof saved !== 'object') return result
    if ([11, 12, 13, 14, 16, 18].includes(saved.fontSize!)) result.fontSize = saved.fontSize
    if ([2, 4, 8].includes(saved.indentSize!)) result.indentSize = saved.indentSize
    if (typeof saved.autoComplete === 'boolean') result.autoComplete = saved.autoComplete
    if (typeof saved.confirmChanges === 'boolean') result.confirmChanges = saved.confirmChanges

    return result
  }
)
