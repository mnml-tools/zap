import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { updatePreferences } from '../services/updatePreferences'

export function useUpdates() {
  const preferences = useSyncExternalStore(updatePreferences.subscribe, updatePreferences.getSnapshot)
  const [update, setUpdate] = useState<Update | null>(null)
  const [checking, setChecking] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const current = useRef<Update | null>(null)
  const busy = useRef(false)
  const mounted = useRef(true)
  const supported = isTauri()

  const checkForUpdates = useCallback(async () => {
    if (!isTauri() || busy.current) return false

    busy.current = true
    setChecking(true)
    setError('')
    setMessage('')

    try {
      const next = await check({ timeout: 15000 })

      if (!mounted.current) {
        await next?.close()
        return false
      }

      void current.current?.close().catch(() => {})
      current.current = next
      setUpdate(next)
      setMessage(next ? `Version ${next.version} is available.` : 'You’re up to date.')

      return !!next
    } catch (error) {
      if (mounted.current) setError(`Could not check for updates: ${String(error)}`)

      return false
    } finally {
      busy.current = false
      if (mounted.current) setChecking(false)
    }
  }, [])

  useEffect(() => {
    mounted.current = true

    return () => {
      mounted.current = false
      void current.current?.close().catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (preferences.automatic && !import.meta.env.DEV) void checkForUpdates()
  }, [preferences.automatic, checkForUpdates])

  const dismiss = () => {
    void current.current?.close().catch(() => {})
    current.current = null
    setUpdate(null)
  }

  return { update, dismiss, checking, message, error, supported, checkForUpdates }
}
