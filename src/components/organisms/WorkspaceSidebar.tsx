import { useEffect, useRef, useState } from 'react'
import { filterTablesShortcut } from '../../lib/shortcuts'
import { ArrowBigUp, ArrowLeft, Plus, Zap } from 'lucide-react'
import type { WorkspaceController } from '../../hooks/useWorkspace'
import {
  Button,
  Message,
  ResizableSidebar,
  SearchField,
  SidebarFooter,
  SidebarLabel,
  Spinner,
  StatusDot,
  useShortcut
} from '@mnml-tools/ui'
import { tableKey, isView } from '../../lib/tableState'
import { SidebarSqlMenu } from '../molecules/SidebarSqlMenu'
import { SidebarSwitch } from '../molecules/SidebarSwitch'
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
    <ResizableSidebar id="table-sidebar" storageKey="zap.sidebarWidth">
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
          <SidebarLabel>
            TABLES <span>{tableCount}</span>
          </SidebarLabel>
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
          <SidebarLabel>
            QUERIES{' '}
            <div className="query-list-actions">
              <span>{props.queries.length}</span>
              <Button aria-label="New query" title="New query" disabled={saving} onClick={props.newQuery}>
                <Plus size={13} />
              </Button>
            </div>
          </SidebarLabel>
          {props.queryError && <Message tone="error">{props.queryError}</Message>}
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
      <SidebarFooter>
        <StatusDot />
        Connection active
        <SidebarSqlMenu
          disabled={closing || saving || props.structureSaving || props.tableActionBusy}
          importDisabled={anyQueryBusy}
          onImport={props.importSql}
          onExportTables={tableCount ? props.onChooseExportTables : undefined}
          onExport={activeTable && !isView(activeTable) ? () => props.exportTable(activeTable) : undefined}
        />
      </SidebarFooter>
    </ResizableSidebar>
  )
}
