import { useSyncExternalStore } from 'react'
import { dataPreferences } from '../../services/dataPreferences'

export function NullValue() {
  const { nullLabel } = useSyncExternalStore(dataPreferences.subscribe, dataPreferences.getSnapshot)

  return (
    <span className="null" aria-label="NULL">
      {nullLabel}
    </span>
  )
}
