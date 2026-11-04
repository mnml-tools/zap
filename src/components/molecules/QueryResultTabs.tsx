import type { QueryResultSet } from '../../types/query'
import { Button } from '../atoms/Button'

type Props = {
  results: QueryResultSet[]
  active: number
  duration: number
  onSelect: (index: number) => void
}

export function QueryResultTabs({ results, active, duration, onSelect }: Props) {
  return (
    <div className="query-result-tabs" aria-label="Query results">
      {results.map((result, index) => (
        <Button key={index} className={index === active ? 'active' : ''} onClick={() => onSelect(index)}>
          Result {index + 1}
          <span>{result.columns.length ? `${result.rows.length} rows` : `${result.rowsAffected} affected`}</span>
        </Button>
      ))}
      <span className="query-duration">{duration} ms</span>
    </div>
  )
}
