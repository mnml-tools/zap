import { Check, Plus } from 'lucide-react'
import { useState } from 'react'
import type { NewColumn } from '../../types/table'
import type { WorkspaceController } from '../../hooks/useWorkspace'
import { useShortcut } from '../../hooks/useShortcut'
import { saveChangesShortcut } from '../../lib/shortcuts'
import { Button } from '../atoms/Button'
import { Spinner } from '../atoms/Spinner'
import { ColumnTypePicker } from '../molecules/ColumnTypePicker'
import { EditableCell } from '../molecules/EditableCell'
import { ErrorDialog } from '../molecules/ErrorDialog'

const columnKeys = ['name', 'kind', 'nullable', 'default', 'comment'] as const

const fields = ['Column Name', 'Data Type', 'Nullable', 'Default', 'Comment']

type Props = {
  model: WorkspaceController
  rows: (string | null)[][]
}

export function TableStructureEditor({ model, rows }: Props) {
  const [editing, setEditing] = useState<{ row: number; field: number; original: string | null }>()
  const [error, setError] = useState('')
  const draft = model.structure ?? { changes: [] }
  const name = draft.name ?? model.table!.name
  const additions = draft.additions ?? []
  const allRows = [...rows, ...additions.map((column) => columnKeys.map((key) => column[key]))]
  const count = draft.changes.length + additions.length + Number(draft.name !== undefined)
  const invalid = additions.some((column) => !column.name.trim() || !column.kind.trim())
  const fullEditing = model.driver === 'postgresql' || model.driver === 'mysql'
  const blocked = model.changeCount > 0 || model.saving
  const canSave = count > 0 && !blocked && !model.structureSaving && !!name.trim() && !invalid

  const stage = (row: number, field: number, value: string | null) => {
    if (row >= rows.length) {
      const key = columnKeys[field]
      const next = additions.map((column, index): NewColumn =>
        index === row - rows.length ? { ...column, [key]: value } : column
      )
      model.setStructure({ ...draft, additions: next })

      return
    }

    const column = rows[row][0]!
    const changes = draft.changes.filter((change) => change.column !== column || change.field !== field)

    if (value !== rows[row][field]) changes.push({ column, field, value })

    model.setStructure({ ...draft, changes })
  }

  const addField = () => {
    const kind = model.driver === 'sqlite' ? 'TEXT' : model.driver === 'mysql' ? 'INT' : 'text'
    const column: NewColumn = { name: '', kind, nullable: 'Yes', default: null, comment: null }
    model.setStructure({ ...draft, additions: [...additions, column] })
    setEditing({ row: allRows.length, field: 0, original: '' })
  }

  const save = async () => {
    setEditing(undefined)
    setError('')

    try {
      await model.saveStructure(draft)
    } catch (error) {
      setError(String(error))
    }
  }

  useShortcut(saveChangesShortcut, canSave, save)

  return (
    <>
      <div className="table-toolbar structure-toolbar">
        <div>
          <span className="eyebrow">{model.table!.schema || 'DATABASE'}</span>
          <input
            className="structure-name"
            aria-label="Table name"
            value={name}
            disabled={model.structureSaving}
            onChange={(event) => {
              const value = event.target.value
              model.setStructure({ ...draft, name: value === model.table!.name ? undefined : value })
            }}
          />
        </div>
        <div className="table-actions">
          <Button disabled={model.structureSaving || blocked} onClick={addField}>
            <Plus size={13} />
            Add field
          </Button>
          {count > 0 && (
            <>
              <Button
                disabled={model.structureSaving}
                onClick={() => {
                  setEditing(undefined)
                  setError('')
                  model.setStructure({ changes: [] })
                }}
              >
                Discard
              </Button>
              <Button className="save-changes" disabled={!canSave} onClick={save}>
                {model.structureSaving ? <Spinner size={13} /> : <Check size={13} />}
                {model.structureSaving ? 'Saving…' : `Save ${count} ${count === 1 ? 'change' : 'changes'}`}
              </Button>
            </>
          )}
        </div>
      </div>
      {error && <ErrorDialog title="Could not save structure" message={error} onDismiss={() => setError('')} />}
      {blocked && (
        <div className="table-notice">Save or discard pending data edits before saving structure changes.</div>
      )}
      <div className="grid-wrap">
        <table>
          <thead>
            <tr>
              <th className="row-number">#</th>
              {fields.map((field) => (
                <th key={field} className={field === 'Data Type' ? 'structure-type' : undefined}>
                  {field}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allRows.map((row, index) => {
              const isNew = index >= rows.length

              return (
                <tr
                  key={isNew ? `new-${index}` : `column-${row[0]}`}
                  className={
                    isNew || draft.changes.some((change) => change.column === row[0]) ? 'row-edited' : undefined
                  }
                >
                  <td className="row-number">{index + 1}</td>
                  {row.map((original, field) => {
                    const change = isNew
                      ? undefined
                      : draft.changes.find((change) => change.column === row[0] && change.field === field)
                    const value = change ? change.value : original
                    const editable = (field === 0 || fullEditing || (isNew && field < 4)) && !model.structureSaving
                    const active = editing?.row === index && editing.field === field && editable

                    if (field === 1 && !active) {
                      return (
                        <td key={field} className={change ? 'structure-type cell-edited' : 'structure-type'}>
                          <ColumnTypePicker
                            driver={model.driver}
                            value={value ?? ''}
                            column={row[0]!}
                            saving={model.structureSaving}
                            editable={isNew || fullEditing}
                            onSelect={(type) => stage(index, field, type)}
                            onManual={() => setEditing({ row: index, field, original: value })}
                          />
                        </td>
                      )
                    }

                    return (
                      <EditableCell
                        key={field}
                        value={value}
                        editable={editable}
                        modified={!!change}
                        saving={model.structureSaving}
                        editing={active}
                        column={fields[field]}
                        rowNumber={index + 1}
                        hint={field === 3 ? 'Double-click to edit the SQL default expression' : undefined}
                        choices={field === 2 ? ['Yes', 'No'] : undefined}
                        onBegin={() => {
                          if (editable) setEditing({ row: index, field, original: value })
                        }}
                        onChange={(value) => stage(index, field, field >= 3 && value === '' ? null : value)}
                        onCommit={() => setEditing(undefined)}
                        onCancel={() => {
                          if (editing) stage(index, field, editing.original)
                          setEditing(undefined)
                        }}
                        onNull={
                          field >= 3
                            ? () => {
                                stage(index, field, null)
                                setEditing(undefined)
                              }
                            : undefined
                        }
                      />
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
