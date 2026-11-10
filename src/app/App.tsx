import { useUpdates } from '../hooks/useUpdates'
import { Updates } from '../services/updates'
import { SavedConnections } from '../services/savedConnections'
import { UpdateDialog } from '@mnml-tools/ui/tauri'
import { api } from '../services/api'
import type { ApiRequest } from '../services/api'
import { useConnections } from '../hooks/useConnections'
import { ConnectionsPage } from '../pages/ConnectionsPage'
import { WorkspacePage } from '../pages/WorkspacePage'
import { ConnectionLoadingPage } from '../pages/ConnectionLoadingPage'

export function App({ request = api }: { request?: ApiRequest }) {
  const connections = useConnections(request)

  const updates = useUpdates()
  const { update, dismiss } = updates

  return (
    <Updates.Provider value={updates}>
      <SavedConnections.Provider value={connections.connections}>
        {connections.restoring ? (
          <ConnectionLoadingPage
            connection={connections.connections.find((connection) => connection.id === connections.busy)}
          />
        ) : connections.id ? (
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
        {update && (
          <UpdateDialog
            update={update}
            appName="Zap"
            releaseNotesUrl="https://github.com/mnml-tools/zap/releases/latest"
            onOpenReleaseNotes={() => api('open_latest_release')}
            busyMessage="Wait for database operations to finish before updating."
            discardMessage="Unsaved SQL, table edits, and structure changes will be discarded. Cancel to save your work first, or discard changes and update."
            onDismiss={dismiss}
          />
        )}
      </SavedConnections.Provider>
    </Updates.Provider>
  )
}
