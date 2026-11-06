import { useEffect, useRef, useState } from 'react'
import type { Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { inspectUpdateSafety, updateDecision } from '../../services/updateGuard'
import { Button } from '../atoms/Button'

export function UpdateDialog({ update, onDismiss }: { update: Update; onDismiss: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const installing = useRef(false)
  const installed = useRef(false)
  const [phase, setPhase] = useState<'ready' | 'confirm' | 'installing' | 'installed'>('ready')
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('')

  useEffect(() => {
    const element = dialog.current!
    element.showModal()

    return () => element.close()
  }, [])

  const install = async () => {
    if (installing.current) return

    const decision = updateDecision(inspectUpdateSafety(), phase === 'confirm', installed.current)

    if (decision === 'busy') {
      setError('Wait for database operations to finish before updating.')
      return
    }
    if (decision === 'confirm') {
      setPhase('confirm')
      return
    }

    installing.current = true
    setError('')
    setPhase('installing')

    try {
      if (!installed.current) {
        let received = 0
        let total: number | undefined
        await update.downloadAndInstall((event) => {
          if (event.event === 'Started') total = event.data.contentLength
          if (event.event === 'Progress') {
            received += event.data.chunkLength
            setProgress(total ? `${Math.round((received / total) * 100)}%` : `${Math.round(received / 1024)} KB`)
          }
          if (event.event === 'Finished') setProgress('Installing…')
        })
        installed.current = true
      }
      setPhase('installed')
      await relaunch()
    } catch (error) {
      setError(String(error))
      setPhase(installed.current ? 'installed' : 'ready')
      installing.current = false
    }
  }

  return (
    <dialog
      ref={dialog}
      className="modal error-dialog"
      aria-labelledby="update-title"
      onCancel={(event) => {
        event.preventDefault()
        if (!installing.current) onDismiss()
      }}
    >
      <div className="modal-heading">
        <h2 id="update-title">Zap {update.version} is available</h2>
      </div>
      <p>
        {phase === 'confirm'
          ? 'Unsaved SQL, table edits, and structure changes will be discarded. Cancel to save your work first, or discard changes and update.'
          : phase === 'installed'
            ? 'The update is installed. Restart Zap to finish.'
            : phase === 'installing'
              ? `Updating Zap… ${progress}`
              : 'Install the update and restart Zap.'}
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="discard-actions">
        <Button disabled={phase === 'installing'} onClick={onDismiss}>
          {phase === 'confirm' ? 'Cancel' : 'Later'}
        </Button>
        <Button className="primary" disabled={phase === 'installing'} onClick={() => void install()}>
          {phase === 'confirm'
            ? 'Discard changes and update'
            : phase === 'installed'
              ? 'Restart Zap'
              : 'Install and restart'}
        </Button>
      </div>
    </dialog>
  )
}
