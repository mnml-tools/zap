import type { CSSProperties } from 'react'
import { Check } from 'lucide-react'
import type { Connection } from '../../types/connection'
import { connectionAvatarColor, connectionAvatarColors } from '../../lib/connectionAvatar'
import { ConnectionAvatar } from '../atoms/ConnectionAvatar'

const names = ['Pink', 'Blue', 'Orange', 'Green', 'Purple', 'Red', 'Yellow', 'Emerald', 'Indigo', 'Cyan', 'Lettuce']

type Props = { connection: Connection; onChange: (color: string) => void }

export function ConnectionAvatarPicker({ connection, onChange }: Props) {
  const selected = connection.avatarColor ?? connectionAvatarColor(connection.id)

  return (
    <fieldset className="connection-avatar-picker mnml-field-full">
      <legend>Avatar color</legend>
      <div className="connection-avatar-picker-content">
        <ConnectionAvatar connection={connection} color={selected} />
        <div className="connection-avatar-swatches" role="group" aria-label="Avatar color">
          {connectionAvatarColors.map((color, index) => (
            <button
              key={color}
              type="button"
              aria-label={names[index]}
              title={names[index]}
              aria-pressed={selected === color}
              style={{ '--swatch-color': color } as CSSProperties}
              onClick={() => onChange(color)}
            >
              {selected === color && <Check size={13} aria-hidden="true" />}
            </button>
          ))}
        </div>
      </div>
    </fieldset>
  )
}
