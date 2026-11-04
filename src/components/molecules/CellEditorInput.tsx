import { Button } from '../atoms/Button'

type Props = {
  value: string | null
  column: string
  rowNumber: number
  onChange: (value: string | null) => void
  onCommit: () => void
  onCancel: () => void
  onNull?: () => void
  choices?: string[]
}

export function CellEditorInput({ value, column, rowNumber, onChange, onCommit, onCancel, onNull, choices }: Props) {
  if (choices) {
    return (
      <div className="cell-editor">
        <select
          aria-label={`Edit ${column} in row ${rowNumber}`}
          autoFocus
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onCommit}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              onCancel()
            }
          }}
        >
          {choices.map((choice) => (
            <option key={choice}>{choice}</option>
          ))}
        </select>
      </div>
    )
  }

  return (
    <div className="cell-editor">
      <textarea
        rows={1}
        aria-label={`Edit ${column} in row ${rowNumber}`}
        autoFocus
        value={value ?? ''}
        placeholder={value === null ? 'NULL' : undefined}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onCommit}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            onCancel()
          } else if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            event.currentTarget.blur()
          }
        }}
      />
      {onNull && (
        <Button
          type="button"
          title="Set to NULL"
          aria-label="Set cell to NULL"
          onMouseDown={(event) => event.preventDefault()}
          onClick={onNull}
        >
          NULL
        </Button>
      )}
    </div>
  )
}
