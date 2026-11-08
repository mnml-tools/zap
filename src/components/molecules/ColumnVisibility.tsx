import { Columns3 } from 'lucide-react'
import { useState } from 'react'
import { Button, Dialog, SearchField } from '@mnml-tools/ui'

type Props = {
  columns: string[]
  hidden: string[]
  disabled: boolean
  onChange: (hidden: string[]) => void
}

export function ColumnVisibility({ columns, hidden, disabled, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const hiddenSet = new Set(hidden)
  const matches = columns.filter((column) => column.toLowerCase().includes(search.trim().toLowerCase()))

  const close = () => {
    setOpen(false)
    setSearch('')
  }

  return (
    <>
      <Button type="button" aria-haspopup="dialog" disabled={disabled} onClick={() => setOpen(true)}>
        <Columns3 size={13} aria-hidden="true" />
        Columns
      </Button>
      <Dialog title="Visible columns" open={open} className="columns-dialog" onDismiss={close}>
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
        <div className="mnml-dialog-actions">
          <Button type="button" onClick={close}>
            Done
          </Button>
        </div>
      </Dialog>
    </>
  )
}
