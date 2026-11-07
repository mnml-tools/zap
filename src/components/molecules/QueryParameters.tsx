import { useId } from 'react'
import { inferParameter } from '../../lib/queryParameters'
import type { QueryParameter } from '../../types/query'

type Props = { parameters: QueryParameter[]; disabled: boolean; onChange: (parameter: QueryParameter) => void }

export function QueryParameters({ parameters, disabled, onChange }: Props) {
  const id = useId()

  if (!parameters.length) return null

  return (
    <div className="query-parameters">
      <span className="query-parameters-heading">
        Parameters <small>Saved with this query</small>
      </span>
      {parameters.map((parameter) => (
        <div className="query-parameter" key={parameter.name}>
          <label htmlFor={`${id}-${parameter.name}`} title={`:${parameter.name}`}>
            :{parameter.name}
          </label>
          <input
            id={`${id}-${parameter.name}`}
            aria-label={`Value for :${parameter.name}`}
            value={parameter.type === 'null' ? 'NULL' : parameter.value}
            disabled={disabled}
            placeholder="Value"
            onChange={(event) => onChange(inferParameter(parameter.name, event.target.value))}
          />
        </div>
      ))}
    </div>
  )
}
