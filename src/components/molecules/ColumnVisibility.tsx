import { Columns3 } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { isDialogBackdropClick } from '../../lib/dialog'
import { Button } from '../atoms/Button'
import { SearchField } from './SearchField'

type Props = {
  columns: string[]
  hidden: string[]
  disabled: boolean
  onChange: (hidden: string[]) => void
}

export function ColumnVisibility({ columns, hidden, disabled, onChange }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const title = useId()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const hiddenSet = new Set(hidden)
  const matches = columns.filter((column) => column.toLowerCase().includes(search.trim().toLowerCase()))

  useEffect(() => {
    if (open) dialog.current?.showModal()
  }, [open])

  return (
    <>
      <Button type="button" aria-haspopup="dialog" disabled={disabled} onClick={() => setOpen(true)}>
        <Columns3 size={13} aria-hidden="true" />
        Columns
      </Button>
      <dialog
        ref={dialog}
        className="modal error-dialog columns-dialog"
        aria-labelledby={title}
        onClick={(event) => {
          if (isDialogBackdropClick(event)) event.currentTarget.close()
        }}
        onClose={() => {
          setOpen(false)
          setSearch('')
        }}
      >
        <div className="modal-heading">
          <h2 id={title}>Visible columns</h2>
        </div>
        <div className="columns-dialog-body">
          <SearchField label="Search columns" placeholder="Search columns…" value={search} onChange={setSearch} />
          <div className="export-selection">
            <span>
              {columns.filter((column) => !hiddenSet.has(column)).length} of {columns.length} visible
            </span>
            <Button type="button" onClick={() => onChange([])}>
              Check all
            </Button>
            <Button type="button" onClick={() => onChange(columns)}>
              Uncheck all
            </Button>
          </div>
          <div className="export-tables-list" role="group" aria-label="Columns">
            {matches.map((column) => (
              <label key={column} title={column}>
                <input
                  type="checkbox"
                  checked={!hiddenSet.has(column)}
                  onChange={(event) => {
                    if (event.target.checked) hiddenSet.delete(column)
                    else hiddenSet.add(column)

                    onChange([...hiddenSet])
                  }}
                />
                <span>{column}</span>
              </label>
            ))}
            {!matches.length && <p>No matching columns.</p>}
          </div>
        </div>
        <div className="discard-actions">
          <Button type="button" onClick={() => dialog.current?.close()}>
            Done
          </Button>
        </div>
      </dialog>
    </>
  )
}
