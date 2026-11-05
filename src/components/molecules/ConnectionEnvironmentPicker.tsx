import { useId } from 'react'
import type { Connection } from '../../types/connection'

type Props = {
  value: Connection['environment']
  onChange: (environment: Connection['environment']) => void
}

export function ConnectionEnvironmentPicker({ value, onChange }: Props) {
  const name = useId()

  return (
    <fieldset className="full environment-picker">
      <legend>Environment</legend>
      <div className="environment-options">
        {(['local', 'prod'] as const).map((environment) => (
          <label key={environment} className="environment-choice">
            <input
              type="radio"
              name={name}
              value={environment}
              data-environment={environment}
              checked={value === environment}
              onChange={() => onChange(environment)}
            />
            <span>{environment === 'local' ? 'Local' : 'Prod'}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
