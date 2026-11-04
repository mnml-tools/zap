import { invoke, isTauri } from '@tauri-apps/api/core'

export type ApiRequest = <T>(command: string, args?: Record<string, unknown>) => Promise<T>

export const api: ApiRequest = async (command, args) => {
  if (!isTauri()) throw new Error('Open Zap in the desktop app to connect to a database.')

  return invoke(command, args)
}
