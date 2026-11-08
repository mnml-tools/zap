import { useEffect, useState } from 'react'
import type { ApiRequest } from '../../services/api'
import type { Table, TableMode } from '../../types/table'
import { Message, Spinner } from '@mnml-tools/ui'
import type { WorkspaceController } from '../../hooks/useWorkspace'
import { isView } from '../../lib/tableState'
import { structureFields, TableStructureEditor } from './TableStructureEditor'
import { ReadOnlyTable } from './ReadOnlyTable'

type Props = {
  id: string
  table: Table
  mode: Exclude<TableMode, 'data'>
  request: ApiRequest
  model: WorkspaceController
}

type Catalog = { rows: (string | null)[][] } | { error: string }

export function TableCatalogView({ id, table, mode, request, model }: Props) {
  const [catalog, setCatalog] = useState<Catalog>()
  const structure = mode === 'structure'

  useEffect(() => {
    let current = true

    request<(string | null)[][]>(structure ? 'table_columns' : 'table_indexes', { id, table })
      .then((rows) => {
        if (current) setCatalog({ rows })
      })
      .catch((error) => {
        if (current) setCatalog({ error: String(error) })
      })

    return () => {
      current = false
    }
  }, [id, table, structure, request])

  // Views can't be altered here, so their columns are shown like the index list.
  if (structure && catalog && 'rows' in catalog && !isView(table))
    return <TableStructureEditor model={model} rows={catalog.rows} />

  return (
    <div className="grid-wrap" aria-busy={!catalog}>
      {!catalog ? (
        <div className="table-message" role="status">
          <Spinner size={19} />
          {structure ? 'Loading structure…' : 'Loading indexes…'}
        </div>
      ) : 'error' in catalog ? (
        <Message tone="error">{catalog.error}</Message>
      ) : catalog.rows.length ? (
        <ReadOnlyTable
          columns={structure ? structureFields : ['Index', 'Kind', 'Position', 'Field']}
          rows={catalog.rows}
        />
      ) : (
        <div className="table-message">This {isView(table) ? 'view' : 'table'} has no indexes.</div>
      )}
    </div>
  )
}
