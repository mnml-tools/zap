import type { TableFilter } from '../../types/filter'
import { newFilter, comparableFilters } from '../../lib/filters'
import { FilterRow } from '../molecules/FilterRow'
import { FilterToolbar } from '../molecules/FilterToolbar'

type Props = {
  columns: string[]
  rows: TableFilter[]
  applied: TableFilter[]
  disabled: boolean
  onChange: (rows: TableFilter[]) => void
  onApply: (rows: TableFilter[]) => void
  onRemove: (id: string) => void
  onClear: () => void
  onHide: () => void
}

export function TableFilters({
  columns,
  rows,
  applied,
  disabled,
  onChange,
  onApply,
  onRemove,
  onClear,
  onHide
}: Props) {
  const update = (id: string, patch: Partial<TableFilter>) =>
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)))

  const applyOne = (row: TableFilter) =>
    onApply(
      applied.some((item) => item.id === row.id)
        ? applied.map((item) => (item.id === row.id ? row : item))
        : [...applied, row]
    )

  return (
    <section
      id="table-filters"
      className="table-filters"
      aria-label="Table filters"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          onHide()
        }

        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          event.preventDefault()

          if (!disabled) onApply(rows)
        }
      }}
    >
      <div className="filter-rows">
        {rows.map((row, index) => (
          <FilterRow
            key={row.id}
            row={row}
            index={index}
            columns={columns}
            disabled={disabled}
            canAdd={rows.length < 50}
            canRemove={rows.length > 1}
            onChange={(patch) => update(row.id, patch)}
            onApply={() => applyOne(row)}
            onRemove={() => onRemove(row.id)}
            onAdd={() => {
              const next = [...rows]
              next.splice(index + 1, 0, newFilter(columns))
              onChange(next)
            }}
          />
        ))}
      </div>
      <FilterToolbar
        disabled={disabled}
        canAdd={rows.length < 50 && !!columns.length}
        canClear={!!rows.length || !!applied.length}
        canApply={!!columns.length}
        changed={comparableFilters(rows) !== comparableFilters(applied)}
        onAdd={() => onChange([...rows, newFilter(columns)])}
        onClear={onClear}
        onApply={() => onApply(rows)}
        onHide={onHide}
      />
    </section>
  )
}
