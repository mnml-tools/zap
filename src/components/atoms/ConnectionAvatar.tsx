import type { CSSProperties } from 'react'
import type { Connection } from '../../types/connection'
import { connectionAvatarColor, connectionInitial } from '../../lib/connectionAvatar'

type Props = { connection: Pick<Connection, 'id' | 'title'>; size?: 'small' | 'normal'; color?: string }

export function ConnectionAvatar({ connection, size = 'normal', color }: Props) {
  return (
    <span
      className={`connection-avatar connection-avatar-${size}`}
      style={{ '--avatar-color': color ?? connectionAvatarColor(connection.id) } as CSSProperties}
      aria-hidden="true"
    >
      {connectionInitial(connection.title)}
    </span>
  )
}
