import { useEffect, useRef, useState } from 'react'
import { useShortcut } from '../../hooks/useShortcut'
import { filterTablesShortcut } from '../../lib/shortcuts'
import { ArrowBigUp, ArrowLeft, Plus, Zap } from 'lucide-react'
import type { WorkspaceController } from '../../hooks/useWorkspace'
import { ResizableSidebar } from './ResizableSidebar'
import { Button } from '../atoms/Button'
import { Spinner } from '../atoms/Spinner'
import { StatusDot } from '../atoms/StatusDot'
import { ErrorMessage } from '../atoms/ErrorMessage'
import { tableKey, isView } from '../../lib/tableState'
import { SidebarSqlMenu } from '../molecules/SidebarSqlMenu'
import { SidebarSwitch } from '../molecules/SidebarSwitch'
import { SearchField } from '../molecules/SearchField'
import { TableList } from './TableList'
import { SavedQueryList } from './SavedQueryList'

type Props = { onChooseExportTables: () => void } & Pick<
  WorkspaceController,
  | 'closing'
  | 'saving'
  | 'anyQueryBusy'
  | 'closeConnection'
  | 'sidebar'
  | 'setSidebar'
  | 'search'
  | 'setSearch'
  | 'tables'
  | 'active'
  | 'pending'
  | 'openTable'
  | 'copyTableName'
  | 'exportTable'
  | 'importSql'
  | 'deleteTable'
  | 'tableActionBusy'
  | 'structureSaving'
  | 'querySearch'
  | 'setQuerySearch'
  | 'queries'
  | 'queryError'
  | 'queryDirty'
  | 'newQuickQuery'
  | 'newQuery'
  | 'openQuery'
>

export function WorkspaceSidebar(props: Props) {
  const { closing, saving, anyQueryBusy, closeConnection, sidebar, setSidebar } = props

  const tableSearch = useRef<HTMLInputElement>(null)
  const [focusRequest, setFocusRequest] = useState(0)

  useShortcut(filterTablesShortcut, !closing, () => {
    setSidebar('tables')
    setFocusRequest((count) => count + 1)
  })

  useEffect(() => {
    if (!focusRequest) return

    tableSearch.current?.focus()
    tableSearch.current?.select()
  }, [focusRequest])

  const activeTable = props.tables.find((table) => tableKey(table) === props.active)
  const tableCount = props.tables.filter((table) => !isView(table)).length

  return (
    <ResizableSidebar>
      <Button
        className="close-connection"
        disabled={closing || saving || anyQueryBusy || props.tableActionBusy}
        onClick={closeConnection}
      >
        {closing ? <Spinner size={14} /> : <ArrowLeft size={14} />}{' '}
        {closing ? 'Closing connection…' : 'Close connection'}
      </Button>
      <div className="sidebar-navigation">
        <SidebarSwitch value={sidebar} onChange={setSidebar} />
        <Button
          className="quick-query"
          aria-label="Quick Query"
          title="Quick Query"
          disabled={closing || saving || props.structureSaving || props.tableActionBusy}
          onClick={props.newQuickQuery}
        >
          <Zap size={13} aria-hidden="true" />
        </Button>
      </div>
      {sidebar === 'tables' ? (
        <>
          <SearchField
            inputRef={tableSearch}
            className="table-filter-search"
            shortcutLabel="Press Shift twice"
            shortcutHint={
              <>
                <ArrowBigUp size={12} aria-hidden="true" />
                <ArrowBigUp size={12} aria-hidden="true" />
              </>
            }
            label="Filter tables"
            placeholder="Filter tables…"
            value={props.search}
            onChange={props.setSearch}
          />
          <div className="sidebar-label">
            TABLES <span>{tableCount}</span>
          </div>
          <TableList
            tables={props.tables}
            search={props.search}
            active={props.active}
            pending={props.pending}
            disabled={saving || props.structureSaving || props.tableActionBusy}
            onOpen={props.openTable}
            onCopy={props.copyTableName}
            onExport={props.exportTable}
            onDelete={props.deleteTable}
          />
        </>
      ) : (
        <>
          <SearchField
            label="Filter queries"
            placeholder="Filter queries…"
            value={props.querySearch}
            onChange={props.setQuerySearch}
          />
          <div className="sidebar-label">
            QUERIES{' '}
            <div className="query-list-actions">
              <span>{props.queries.length}</span>
              <Button aria-label="New query" title="New query" disabled={saving} onClick={props.newQuery}>
                <Plus size={13} />
              </Button>
            </div>
          </div>
          {props.queryError && <ErrorMessage message={props.queryError} />}
          <SavedQueryList
            queries={props.queries}
            search={props.querySearch}
            active={props.active}
            dirty={props.queryDirty}
            disabled={saving}
            onOpen={props.openQuery}
            onCreate={props.newQuery}
          />
        </>
      )}
      <div className="sidebar-bottom">
        <StatusDot />
        Connection active
        <SidebarSqlMenu
          disabled={closing || saving || props.structureSaving || props.tableActionBusy}
          importDisabled={anyQueryBusy}
          onImport={props.importSql}
          onExportTables={tableCount ? props.onChooseExportTables : undefined}
          onExport={activeTable && !isView(activeTable) ? () => props.exportTable(activeTable) : undefined}
        />
      </div>
    </ResizableSidebar>
  )
}
