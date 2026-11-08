import type { WorkspaceController } from '../../hooks/useWorkspace'
import type { Table, TableMode } from '../../types/table'
import { TableViewSwitch } from '../molecules/TableViewSwitch'
import { TableCatalogView } from './TableCatalogView'
import { TableDataView } from './TableDataView'

// Plain views have no indexes of their own; materialized views can.
const tableModes = (table: Table): readonly TableMode[] =>
  table.kind === 'view' ? ['data', 'structure'] : ['data', 'structure', 'indexes']

export function TableView(model: WorkspaceController) {
  const { table, tableMode, active, id, request, selectTableMode } = model

  if (!table) return null

  return (
    <>
      {tableMode === 'data' ? (
        <TableDataView {...model} />
      ) : (
        <TableCatalogView
          key={JSON.stringify([active, tableMode, model.structureRevision])}
          id={id}
          table={table}
          mode={tableMode}
          request={request}
          model={model}
        />
      )}
      <TableViewSwitch mode={tableMode} available={tableModes(table)} onChange={selectTableMode} />
    </>
  )
}
