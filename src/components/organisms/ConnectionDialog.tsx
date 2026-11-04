import { X, Plus, Check } from 'lucide-react'
import type { Connection } from '../../types/connection'
import { Button } from '../atoms/Button'
import { Spinner } from '../atoms/Spinner'
import { StatusDot } from '../atoms/StatusDot'
import { ErrorMessage } from '../atoms/ErrorMessage'
import { DriverPicker } from '../molecules/DriverPicker'
import { ConnectionFields } from '../molecules/ConnectionFields'

type Props = {
  connection: Connection
  editing: boolean
  busy: string
  error: string
  tested: boolean
  onChange: (connection: Connection, resetTest?: boolean) => void
  onCancel: () => void
  onSave: () => Promise<void>
  onTest: () => Promise<void>
}

export function ConnectionDialog({
  connection: form,
  editing,
  busy,
  error,
  tested,
  onChange,
  onCancel,
  onSave,
  onTest
}: Props) {
  return (
    <div
      className="overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel()
      }}
    >
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <div className="modal-heading">
          <div>
            <span className="eyebrow">CONNECTION SETTINGS</span>
            <h2 id="dialog-title">{editing ? 'Edit connection' : 'New connection'}</h2>
          </div>
          <Button aria-label="Close dialog" disabled={!!busy} onClick={onCancel}>
            <X size={19} />
          </Button>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (form.driver === 'sqlite' && !form.database) return

            void onSave()
          }}
        >
          <DriverPicker
            value={form.driver}
            onChange={(driver) =>
              onChange({
                ...form,
                driver,
                ssh: driver === 'sqlite' ? null : form.ssh,
                database: (driver === 'sqlite') !== (form.driver === 'sqlite') ? '' : form.database,
                port: driver === 'mysql' ? 3306 : 5432,
                user: driver === 'mysql' ? 'root' : 'postgres'
              })
            }
          />
          <ConnectionFields connection={form} editing={editing} onChange={onChange} />
          {error && <ErrorMessage message={error} />}
          {tested && (
            <div className="success" role="status">
              <Check size={15} />
              Connection successful. You’re all set.
            </div>
          )}
          <div className="modal-actions">
            <Button type="button" disabled={!!busy || !form.database} onClick={onTest}>
              {busy === 'test' ? <Spinner /> : <StatusDot />}Test connection
            </Button>
            <div>
              <Button type="button" disabled={!!busy} onClick={onCancel}>
                Cancel
              </Button>
              <Button
                className="primary"
                disabled={!!busy || (form.driver === 'sqlite' && !form.database)}
                type="submit"
              >
                {busy === 'save' ? <Spinner /> : editing ? <Check size={15} /> : <Plus size={15} />}{' '}
                {editing ? 'Save changes' : 'Save connection'}
              </Button>
            </div>
          </div>
        </form>
      </section>
    </div>
  )
}
