import { useTheme as useAppearance } from '@mnml-tools/ui'
import { theme } from '../services/theme'

export function useTheme() {
  return useAppearance(theme)
}
