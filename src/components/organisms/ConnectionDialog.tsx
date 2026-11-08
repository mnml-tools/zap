import { Plus, Check } from 'lucide-react'
import type { Connection } from '../../types/connection'
import { Button, Dialog, Message, Spinner, StatusDot } from '@mnml-tools/ui'
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
    <Dialog
      title={editing ? 'Edit connection' : 'New connection'}
      closeLabel="Close dialog"
      dismissible={!busy}
      onDismiss={onCancel}
    >
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
        {error && <Message tone="error">{error}</Message>}
        {tested && (
          <Message tone="success">
            <Check size={15} />
            Connection successful. You’re all set.
          </Message>
        )}
        <div className="modal-actions">
          <Button type="button" disabled={!!busy || !form.database} onClick={onTest}>
            {busy === 'test' ? <Spinner /> : <StatusDot />}Test connection
          </Button>
          <div>
            <Button type="button" disabled={!!busy} onClick={onCancel}>
              Cancel
            </Button>
            <Button variant="primary" disabled={!!busy || (form.driver === 'sqlite' && !form.database)} type="submit">
              {busy === 'save' ? <Spinner /> : editing ? <Check size={15} /> : <Plus size={15} />}{' '}
              {editing ? 'Save changes' : 'Save connection'}
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  )
}
