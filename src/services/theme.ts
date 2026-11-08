import { createTheme } from '@mnml-tools/ui'
import { syncNativeTheme } from '@mnml-tools/ui/tauri'

export { accents, modes } from '@mnml-tools/ui'

export type { Accent, Theme } from '@mnml-tools/ui'

export const theme = createTheme({ storagePrefix: 'zap', onThemeChange: syncNativeTheme })
