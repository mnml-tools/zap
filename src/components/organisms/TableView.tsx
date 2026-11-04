import type { WorkspaceController } from '../../hooks/useWorkspace'
import { TableViewSwitch } from '../molecules/TableViewSwitch'
import { TableCatalogView } from './TableCatalogView'
import { TableDataView } from './TableDataView'

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
      <TableViewSwitch mode={tableMode} onChange={selectTableMode} />
    </>
  )
}
