import { useId } from 'react'
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
          <select
            aria-label={`Type for :${parameter.name}`}
            value={parameter.type}
            disabled={disabled}
            onChange={(event) =>
              onChange({
                ...parameter,
                type: event.target.value as QueryParameter['type'],
                value: event.target.value === 'boolean' ? 'true' : parameter.value
              })
            }
          >
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="boolean">Boolean</option>
            <option value="null">NULL</option>
          </select>
          {parameter.type === 'boolean' ? (
            <select
              id={`${id}-${parameter.name}`}
              value={parameter.value}
              disabled={disabled}
              onChange={(event) => onChange({ ...parameter, value: event.target.value })}
            >
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          ) : (
            <input
              id={`${id}-${parameter.name}`}
              aria-label={`Value for :${parameter.name}`}
              value={parameter.type === 'null' ? 'NULL' : parameter.value}
              disabled={disabled || parameter.type === 'null'}
              placeholder={parameter.type === 'text' ? 'Text value (without quotes)' : 'Number'}
              onChange={(event) => onChange({ ...parameter, value: event.target.value })}
            />
          )}
        </div>
      ))}
    </div>
  )
}
