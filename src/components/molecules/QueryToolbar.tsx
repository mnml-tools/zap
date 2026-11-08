import { Play, Save, Trash2 } from 'lucide-react'
import { Button, Spinner } from '@mnml-tools/ui'

type Props = {
  quick: boolean
  canConvertQuick: boolean
  onConvertQuick: () => void
  title: string
  sql: string
  dirty: boolean
  busy: 'save' | 'run' | null
  onTitleChange: (value: string) => void
  onSave: () => void
  onRun: () => void
  onDelete: () => void
}

export function QueryToolbar({
  quick,
  canConvertQuick,
  onConvertQuick,
  title,
  sql,
  dirty,
  busy,
  onTitleChange,
  onSave,
  onRun,
  onDelete
}: Props) {
  return (
    <div className={`query-toolbar${quick ? ' quick-query-toolbar' : ''}`}>
      {!quick && (
        <label>
          Title
          <input
            aria-label="Query title"
            placeholder="Query title"
            value={title}
            disabled={!!busy}
            onChange={(event) => onTitleChange(event.target.value)}
          />
        </label>
      )}
      <div className="query-actions">
        {quick && canConvertQuick && (
          <Button disabled={!!busy} onClick={onConvertQuick}>
            <Save size={13} />
            Save query
          </Button>
        )}
        {!quick && dirty && (
          <Button disabled={!!busy || !title.trim() || !sql.trim()} onClick={onSave}>
            <Save size={13} />
            {busy === 'save' ? 'Saving…' : 'Save query'}
          </Button>
        )}
        <Button variant="primary" disabled={!!busy || !sql.trim()} title="Run query (⌘/Ctrl+Enter)" onClick={onRun}>
          {busy === 'run' ? <Spinner size={13} /> : <Play size={13} />} {busy === 'run' ? 'Running…' : 'Run query'}
        </Button>
        {!quick && (
          <Button aria-label="Delete query" title="Delete query" disabled={!!busy} onClick={onDelete}>
            <Trash2 size={13} />
          </Button>
        )}
      </div>
    </div>
  )
}
