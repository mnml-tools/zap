import { Avatar } from '@mnml-tools/ui'
import type { Connection } from '../../types/connection'
import { connectionAvatarColor, connectionInitial } from '../../lib/connectionAvatar'

type Props = { connection: Pick<Connection, 'id' | 'title'>; size?: 'small' | 'normal'; color?: string }

export function ConnectionAvatar({ connection, size = 'normal', color }: Props) {
  return (
    <Avatar color={color ?? connectionAvatarColor(connection.id)} size={size}>
      {connectionInitial(connection.title)}
    </Avatar>
  )
}
