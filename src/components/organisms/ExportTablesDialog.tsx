import { useState } from 'react'
import { tableKey } from '../../lib/tableState'
import type { Table } from '../../types/table'
import { Button, Dialog } from '@mnml-tools/ui'

type Props = { tables: Table[]; onCancel: () => void; onExport: (tables: Table[], includeData: boolean) => void }

export function ExportTablesDialog({ tables, onCancel, onExport }: Props) {
  const [selected, setSelected] = useState(() => new Set(tables.map(tableKey)))
  const [includeData, setIncludeData] = useState(true)
  const chosen = tables.filter((table) => selected.has(tableKey(table)))

  return (
    <Dialog title="Export tables as SQL" className="export-dialog" onDismiss={onCancel}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (chosen.length) onExport(chosen, includeData)
        }}
      >
        <div className="export-selection">
          <span>
            {chosen.length} of {tables.length} selected
          </span>
          <Button type="button" onClick={() => setSelected(new Set(tables.map(tableKey)))}>
            Select all
          </Button>
          <Button type="button" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
        <div className="export-tables-list" role="group" aria-label="Tables to export">
          {tables.map((table) => {
            const key = tableKey(table)
            const name = table.schema ? `${table.schema}.${table.name}` : table.name

            return (
              <label key={key} title={name}>
                <input
                  type="checkbox"
                  checked={selected.has(key)}
                  onChange={(event) => {
                    const checked = event.target.checked
                    setSelected((previous) => {
                      const next = new Set(previous)
                      if (checked) next.add(key)
                      else next.delete(key)

                      return next
                    })
                  }}
                />
                <span>{name}</span>
              </label>
            )
          })}
        </div>
        <label className="export-include-data">
          <input type="checkbox" checked={includeData} onChange={(event) => setIncludeData(event.target.checked)} />
          Include data
        </label>
        <div className="mnml-dialog-actions">
          <Button type="button" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={!chosen.length}>
            Export…
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
