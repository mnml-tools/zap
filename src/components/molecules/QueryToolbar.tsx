import { Play, Save, Trash2 } from 'lucide-react'
import { Button } from '../atoms/Button'
import { Spinner } from '../atoms/Spinner'

type Props = {
  title: string
  sql: string
  dirty: boolean
  busy: 'save' | 'run' | null
  onTitleChange: (value: string) => void
  onSave: () => void
  onRun: () => void
  onDelete: () => void
}

export function QueryToolbar({ title, sql, dirty, busy, onTitleChange, onSave, onRun, onDelete }: Props) {
  return (
    <div className="query-toolbar">
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
      <div className="query-actions">
        {dirty && (
          <Button disabled={!!busy || !title.trim() || !sql.trim()} onClick={onSave}>
            <Save size={13} />
            {busy === 'save' ? 'Saving…' : 'Save query'}
          </Button>
        )}
        <Button className="primary" disabled={!!busy || !sql.trim()} title="Run query (⌘/Ctrl+Enter)" onClick={onRun}>
          {busy === 'run' ? <Spinner size={13} /> : <Play size={13} />} {busy === 'run' ? 'Running…' : 'Run query'}
        </Button>
        <Button aria-label="Delete query" title="Delete query" disabled={!!busy} onClick={onDelete}>
          <Trash2 size={13} />
        </Button>
      </div>
    </div>
  )
}
