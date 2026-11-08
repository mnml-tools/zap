import { Plus, Minus } from 'lucide-react'
import type { TableFilter } from '../../types/filter'
import { filterOperators } from '../../lib/filters'
import { Button } from '@mnml-tools/ui'

type Props = {
  row: TableFilter
  index: number
  columns: string[]
  disabled: boolean
  canAdd: boolean
  canRemove: boolean
  onChange: (patch: Partial<TableFilter>) => void
  onApply: () => void
  onRemove: () => void
  onAdd: () => void
}

export function FilterRow({
  row,
  index,
  columns,
  disabled,
  canAdd,
  canRemove,
  onChange,
  onApply,
  onRemove,
  onAdd
}: Props) {
  const noValue = row.operator === 'is_null' || row.operator === 'is_not_null'

  return (
    <div className={row.enabled ? 'filter-row' : 'filter-row disabled-filter'}>
      <input
        type="checkbox"
        aria-label={`Enable filter ${index + 1}`}
        checked={row.enabled}
        disabled={disabled}
        onChange={(event) => onChange({ enabled: event.target.checked })}
      />
      <select
        aria-label={`Column for filter ${index + 1}`}
        value={row.column}
        disabled={disabled}
        onChange={(event) => onChange({ column: event.target.value })}
      >
        {columns.map((column) => (
          <option key={column} value={column}>
            {column}
          </option>
        ))}
      </select>
      <select
        aria-label={`Operator for filter ${index + 1}`}
        value={row.operator}
        disabled={disabled}
        onChange={(event) => onChange({ operator: event.target.value })}
      >
        {filterOperators.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <input
        className="filter-value"
        aria-label={`Value for filter ${index + 1}`}
        value={row.value}
        disabled={disabled || noValue}
        placeholder={
          noValue
            ? 'No value needed'
            : row.operator === 'in' || row.operator === 'not_in'
              ? "1, 2, 3 or 'value, with comma'"
              : 'Value'
        }
        onChange={(event) => onChange({ value: event.target.value })}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.metaKey && !event.ctrlKey) {
            event.preventDefault()
            onApply()
          }
        }}
      />
      <Button disabled={disabled || !row.column} onClick={onApply}>
        Apply
      </Button>
      <Button
        aria-label={`Remove filter ${index + 1}`}
        title="Remove filter"
        disabled={disabled || !canRemove}
        onClick={onRemove}
      >
        <Minus size={13} />
      </Button>
      <Button
        aria-label={`Add filter after ${index + 1}`}
        title="Add filter"
        disabled={disabled || !canAdd}
        onClick={onAdd}
      >
        <Plus size={13} />
      </Button>
    </div>
  )
}
