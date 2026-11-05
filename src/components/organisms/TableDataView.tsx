import type { WorkspaceController } from '../../hooks/useWorkspace'
import { ColumnVisibility } from '../molecules/ColumnVisibility'
import { TableToolbar } from '../molecules/TableToolbar'
import { TablePagination } from '../molecules/TablePagination'
import { ErrorDialog } from '../molecules/ErrorDialog'
import { Spinner } from '../atoms/Spinner'
import { TableFilters } from './TableFilters'
import { EditableTable } from './EditableTable'

type Props = Pick<
  WorkspaceController,
  | 'table'
  | 'currentFilters'
  | 'enabledFilters'
  | 'columns'
  | 'hiddenColumns'
  | 'setHiddenColumns'
  | 'saving'
  | 'loading'
  | 'changeCount'
  | 'toggleFilters'
  | 'discard'
  | 'save'
  | 'refresh'
  | 'changeFilters'
  | 'applyFilters'
  | 'removeFilter'
  | 'clearFilters'
  | 'hideFilters'
  | 'error'
  | 'dismissError'
  | 'data'
  | 'page'
  | 'active'
  | 'pending'
  | 'editor'
  | 'sort'
  | 'toggleSort'
  | 'beginEdit'
  | 'setCellValue'
  | 'commitCell'
  | 'cancelCell'
  | 'nullCell'
  | 'referenceOrigin'
  | 'openReference'
  | 'previousPage'
  | 'nextPage'
>

export function TableDataView(props: Props) {
  const { table, data, loading, saving, currentFilters } = props

  if (!table) return null

  const hidden = new Set(props.hiddenColumns)
  const visibleColumns = data?.columns.flatMap((column, index) => (hidden.has(column) ? [] : [index])) ?? []

  return (
    <>
      <TableToolbar
        table={table}
        filtersOpen={!!currentFilters?.open}
        filterCount={props.enabledFilters}
        canFilter={!!props.columns.length}
        columnPicker={
          <ColumnVisibility
            key={props.active}
            columns={props.columns}
            hidden={props.hiddenColumns}
            disabled={saving || loading || !data?.columns.length}
            onChange={props.setHiddenColumns}
          />
        }
        saving={saving}
        loading={loading}
        changeCount={props.changeCount}
        onToggleFilters={props.toggleFilters}
        onDiscard={props.discard}
        onSave={props.save}
        onRefresh={props.refresh}
      />
      {currentFilters?.open && (
        <TableFilters
          columns={props.columns}
          rows={currentFilters.draft}
          applied={currentFilters.applied}
          disabled={saving || loading}
          onChange={props.changeFilters}
          onApply={props.applyFilters}
          onRemove={props.removeFilter}
          onClear={props.clearFilters}
          onHide={props.hideFilters}
        />
      )}
      {props.error && <ErrorDialog title="Table error" message={props.error} onDismiss={props.dismissError} />}
      {data?.readOnlyReason && <div className="table-notice">{data.readOnlyReason}</div>}
      <div className="grid-wrap" aria-busy={loading || saving}>
        {loading ? (
          <div className="table-message">
            <Spinner size={19} />
            Loading rows…
          </div>
        ) : (
          data &&
          (visibleColumns.length ? (
            <EditableTable
              key={props.active}
              visibleColumns={visibleColumns}
              data={data}
              page={props.page}
              active={props.active}
              draft={props.pending[props.active]}
              editor={props.editor}
              saving={saving}
              sort={props.sort}
              onSort={props.toggleSort}
              onBegin={props.beginEdit}
              onValueChange={props.setCellValue}
              onCommit={props.commitCell}
              onCancel={props.cancelCell}
              onNull={props.nullCell}
              referenceOrigin={props.referenceOrigin}
              onOpenReference={props.openReference}
            />
          ) : (
            <div className="table-message">No columns are visible. Use Columns to show fields.</div>
          ))
        )}
        {!loading && visibleColumns.length > 0 && data?.rows.length === 0 && (
          <div className="table-message">
            {props.enabledFilters ? 'No rows match the active filters.' : 'This table has no rows on this page.'}
          </div>
        )}
      </div>
      <TablePagination
        total={data?.total}
        page={props.page}
        filtered={props.enabledFilters > 0}
        disabled={loading || saving}
        onPrevious={props.previousPage}
        onNext={props.nextPage}
      />
    </>
  )
}
