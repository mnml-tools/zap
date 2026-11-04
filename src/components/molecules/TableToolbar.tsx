import { SlidersHorizontal, Check, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Table } from '../../types/table'
import { Button } from '../atoms/Button'
import { Spinner } from '../atoms/Spinner'

type Props = {
  table: Table
  filtersOpen: boolean
  filterCount: number
  canFilter: boolean
  columnPicker: ReactNode
  saving: boolean
  loading: boolean
  changeCount: number
  onToggleFilters: () => void
  onDiscard: () => void
  onSave: () => void
  onRefresh: () => void
}

export function TableToolbar({
  table,
  filtersOpen,
  filterCount,
  canFilter,
  columnPicker,
  saving,
  loading,
  changeCount,
  onToggleFilters,
  onDiscard,
  onSave,
  onRefresh
}: Props) {
  return (
    <div className="table-toolbar">
      <div>
        <span className="eyebrow">{table.schema || 'DATABASE'}</span>
        <h2>{table.name}</h2>
      </div>
      <div className="table-actions">
        <Button
          className={filtersOpen || filterCount ? 'filters-toggle active' : 'filters-toggle'}
          aria-expanded={filtersOpen}
          aria-controls="table-filters"
          disabled={saving || !canFilter}
          onClick={onToggleFilters}
        >
          <SlidersHorizontal size={13} />
          Filters{filterCount > 0 && <span className="filter-count">{filterCount}</span>}
        </Button>
        {columnPicker}
        {changeCount > 0 && (
          <Button disabled={saving} onClick={onDiscard}>
            Discard
          </Button>
        )}
        {(changeCount > 0 || saving) && (
          <Button className="save-changes" disabled={saving || loading} onClick={onSave}>
            {saving ? <Spinner size={13} /> : <Check size={13} />}{' '}
            {saving ? 'Saving…' : `Save ${changeCount} change${changeCount === 1 ? '' : 's'}`}
          </Button>
        )}
        <Button aria-label="Refresh table" disabled={loading || saving} onClick={onRefresh}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
        </Button>
      </div>
    </div>
  )
}
