import { Database, Check } from 'lucide-react'
import { drivers, driverNames } from '../../lib/connections'
import { Button } from '@mnml-tools/ui'

export function DriverPicker({ value, onChange }: { value: string; onChange: (driver: string) => void }) {
  return (
    <div className="driver-options">
      {drivers.map((driver) => (
        <Button
          key={driver}
          type="button"
          className={value === driver ? 'selected' : ''}
          onClick={() => onChange(driver)}
        >
          <Database size={18} />
          {driverNames[driver]}
          {value === driver && <Check size={14} />}
        </Button>
      ))}
    </div>
  )
}
