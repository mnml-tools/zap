import { useConnectionView } from '../hooks/useConnectionView'
import { ConnectionViewSwitch } from '../components/molecules/ConnectionViewSwitch'
import { Plus } from 'lucide-react'
import type { useConnections } from '../hooks/useConnections'
import { AppShell } from '../components/templates/AppShell'
import { Button, ErrorDialog, Message, SearchField, Separator } from '@mnml-tools/ui'
import { ConnectionTransferMenu } from '../components/molecules/ConnectionTransferMenu'
import { ConnectionContextMenu } from '../components/molecules/ConnectionContextMenu'
import { ConnectionsList } from '../components/organisms/ConnectionsList'
import { ConnectionsEmptyState } from '../components/organisms/ConnectionsEmptyState'
import { ConnectionDialog } from '../components/organisms/ConnectionDialog'

type Props = { connections: ReturnType<typeof useConnections> }

export function ConnectionsPage({ connections: c }: Props) {
  const { view, changeView } = useConnectionView()

  return (
    <AppShell
      variant="app"
      status="Local workspace"
      footerLeft="Zap / 0.7.0"
      footerRight="PostgreSQL · MySQL · SQLite"
      dialogs={
        <>
          {c.transferMessage && <ErrorDialog {...c.transferMessage} onDismiss={c.dismissTransferMessage} />}
          {c.openError && (
            <ErrorDialog title="Could not open connection" message={c.openError} onDismiss={c.dismissOpenError} />
          )}
          {c.menu && (
            <ConnectionContextMenu
              {...c.menu}
              onDismiss={c.dismissMenu}
              onEdit={() => c.edit(c.menu!.connection)}
              onRemove={() => c.remove(c.menu!.connection)}
            />
          )}
          {c.form && (
            <ConnectionDialog
              connection={c.form}
              editing={c.editing}
              busy={c.busy}
              error={c.error}
              tested={c.tested}
              onChange={c.changeForm}
              onCancel={c.cancelForm}
              onSave={c.saveForm}
              onTest={c.testForm}
            />
          )}
        </>
      }
    >
      <main className="home">
        <div className="heading">
          <div>
            <h1>
              Connections<span className="count">{c.connections.length}</span>
            </h1>
            <p>Saved databases</p>
          </div>
          <div className="connection-actions">
            <ConnectionTransferMenu
              busy={!!c.busy}
              canExport={c.connections.length > 0}
              onImport={c.importConnections}
              onExport={c.exportConnections}
            />
            <Button variant="primary" onClick={c.create} disabled={!!c.busy}>
              <Plus size={16} />
              New connection
            </Button>
          </div>
        </div>
        <div className="toolbar">
          <SearchField
            label="Search connections"
            placeholder="Find a connection…"
            value={c.search}
            onChange={c.setSearch}
            size={15}
          />
          <div className="connection-view-controls">
            <span>
              {c.connections.length} saved connection{c.connections.length !== 1 ? 's' : ''}
            </span>
            <ConnectionViewSwitch view={view} onChange={changeView} />
          </div>
        </div>
        {c.error && !c.form && <Message tone="error">{c.error}</Message>}
        {c.connections.length === 0 ? (
          <ConnectionsEmptyState onCreate={c.create} />
        ) : (
          <ConnectionsList
            view={view}
            connections={c.connections}
            search={c.search}
            activeId={c.menu?.connection.id}
            busy={c.busy}
            onOpen={c.open}
            onMenu={c.showMenu}
          />
        )}
        <div className="home-bottom">
          <span>
            <span className="tiny-square" />
            Local connections
          </span>
          <span>
            Stored on your device
            <Separator />
            Credentials in system keychain
          </span>
        </div>
      </main>
    </AppShell>
  )
}
