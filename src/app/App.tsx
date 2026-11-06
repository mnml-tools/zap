import { useAppUpdate } from '../hooks/useAppUpdate'
import { UpdateDialog } from '../components/organisms/UpdateDialog'
import { api } from '../services/api'
import type { ApiRequest } from '../services/api'
import { useConnections } from '../hooks/useConnections'
import { ConnectionsPage } from '../pages/ConnectionsPage'
import { WorkspacePage } from '../pages/WorkspacePage'

export function App({ request = api }: { request?: ApiRequest }) {
  const connections = useConnections(request)

  const { update, dismiss } = useAppUpdate()

  return (
    <>
      {connections.id ? (
        <WorkspacePage
          key={connections.id}
          connections={connections.connections}
          onSwitch={connections.switchConnection}
          id={connections.id}
          connection={connections.connections.find((connection) => connection.id === connections.id)}
          onClose={connections.close}
          request={request}
        />
      ) : (
        <ConnectionsPage connections={connections} />
      )}
      {update && <UpdateDialog update={update} onDismiss={dismiss} />}
    </>
  )
}
