import { api } from '../services/api'
import type { ApiRequest } from '../services/api'
import { useConnections } from '../hooks/useConnections'
import { ConnectionsPage } from '../pages/ConnectionsPage'
import { WorkspacePage } from '../pages/WorkspacePage'

export function App({ request = api }: { request?: ApiRequest }) {
  const connections = useConnections(request)

  if (connections.id)
    return (
      <WorkspacePage
        id={connections.id}
        connection={connections.connections.find((connection) => connection.id === connections.id)}
        onClose={connections.close}
        request={request}
      />
    )

  return <ConnectionsPage connections={connections} />
}
