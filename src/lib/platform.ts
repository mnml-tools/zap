import { isTauri } from '@tauri-apps/api/core'

export const nativeMac = isTauri() && /Mac/.test(navigator.platform)
