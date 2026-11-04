import { Search } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../services/api'
import { Button } from '../atoms/Button'
import { ErrorMessage } from '../atoms/ErrorMessage'

type Props = { path: string; onChange: (path: string) => void }

export function SqliteFilePicker({ path, onChange }: Props) {
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState('')

  const browse = async () => {
    setPicking(true)
    setError('')

    try {
      const selected = await api<string | null>('pick_sqlite_file')
      if (selected !== null) onChange(selected)
    } catch (error) {
      setError(String(error))
    } finally {
      setPicking(false)
    }
  }

  return (
    <div className="full sqlite-file-field">
      <span id="sqlite-file-label">Database file</span>
      <Button
        type="button"
        className="sqlite-file-picker"
        aria-describedby="sqlite-file-label"
        disabled={picking}
        title={path || undefined}
        onClick={browse}
      >
        <Search size={14} aria-hidden="true" />
        <span className={path ? undefined : 'placeholder'}>{path || 'Find a SQLite database…'}</span>
      </Button>
      {error && <ErrorMessage message={error} />}
    </div>
  )
}
