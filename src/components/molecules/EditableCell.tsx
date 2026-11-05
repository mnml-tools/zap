import type { ComponentProps } from 'react'
import { CellEditorInput } from './CellEditorInput'
import { ReferenceButton } from './ReferenceButton'
import { NullValue } from '../atoms/NullValue'
import { macPlatform } from '../../lib/platform'

type CellReference = { title: string; active: boolean; onOpen: () => void }

type Props = {
  value: string | null
  editable: boolean
  modified: boolean
  saving: boolean
  editing: boolean
  onBegin: () => void
  editOnClick?: boolean
  hint?: string
  emptyLabel?: string
  selected?: boolean
  selectionEvents?: Pick<ComponentProps<'td'>, 'onPointerDown' | 'onPointerEnter' | 'onContextMenu'>
  reference?: CellReference
} & ComponentProps<typeof CellEditorInput>

const referenceShortcut = macPlatform ? '⌘-click' : 'Ctrl+click'

export function EditableCell({
  value,
  editable,
  modified,
  saving,
  editing,
  onBegin,
  editOnClick = false,
  hint,
  emptyLabel,
  selected,
  selectionEvents,
  reference,
  ...editor
}: Props) {
  const title = editable ? (hint ?? 'Double-click to edit') : (value ?? 'NULL')
  const classes = [
    editable && 'editable-cell',
    modified && 'cell-edited',
    editing && 'cell-editing',
    reference && !editing && 'reference-cell',
    reference?.active && 'reference-active'
  ]

  return (
    <td
      {...(!editing ? selectionEvents : undefined)}
      data-selected={selected}
      tabIndex={editable && !saving ? 0 : undefined}
      className={classes.filter(Boolean).join(' ')}
      title={reference && !editing ? `${title}\n${referenceShortcut} to view the referenced row` : title}
      onClick={(event) => {
        if (reference && !editing && (macPlatform ? event.metaKey : event.ctrlKey)) {
          event.preventDefault()
          reference.onOpen()
        } else if (editOnClick && editable && !saving && !editing) {
          onBegin()
        }
      }}
      onDoubleClick={!editOnClick && editable && !saving && !editing ? onBegin : undefined}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === 'F2')) {
          event.preventDefault()
          onBegin()
        }
      }}
    >
      {editing ? (
        <CellEditorInput value={value} {...editor} />
      ) : (
        <>
          {value === null ? emptyLabel ? <span className="null">{emptyLabel}</span> : <NullValue /> : value}
          {reference && <ReferenceButton title={reference.title} onOpen={reference.onOpen} />}
        </>
      )}
    </td>
  )
}
