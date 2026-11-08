import { Play } from 'lucide-react'
import type { QueryResult } from '../../types/query'
import { Spinner } from '@mnml-tools/ui'
import { QueryResultTabs } from '../molecules/QueryResultTabs'
import { ReadOnlyTable } from './ReadOnlyTable'

type Props = {
  running: boolean
  result: QueryResult | null
  active: number
  onSelect: (index: number) => void
}

export function QueryResults({ running, result, active, onSelect }: Props) {
  const selected = result?.results[active]

  if (running)
    return (
      <div className="query-empty">
        <Spinner size={18} />
        <p>Running query…</p>
      </div>
    )

  if (!result)
    return (
      <div className="query-empty">
        <Play size={24} strokeWidth={1} />
        <p>Run your query to see results here.</p>
      </div>
    )

  return (
    <>
      <QueryResultTabs results={result.results} active={active} duration={result.durationMs} onSelect={onSelect} />
      {selected?.columns.length ? (
        <div className="grid-wrap">
          <ReadOnlyTable columns={selected.columns} rows={selected.rows} />
        </div>
      ) : (
        <div className="query-empty">
          <p>{selected ? `Statement completed. ${selected.rowsAffected} rows affected.` : 'Query completed.'}</p>
        </div>
      )}
      {selected?.truncated && (
        <div className="table-notice">
          Showing the first 1,000 of {selected.rowCount.toLocaleString()} returned rows. Add LIMIT or refine the query
          to see a smaller result.
        </div>
      )}
    </>
  )
}
