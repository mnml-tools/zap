import { isTauri } from '@tauri-apps/api/core'

export const nativeMac = isTauri() && /Mac/.test(navigator.platform)

export const nativeLinux = isTauri() && /Linux/.test(navigator.platform)
