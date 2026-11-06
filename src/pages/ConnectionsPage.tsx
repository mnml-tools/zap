import { Plus } from 'lucide-react'
import type { useConnections } from '../hooks/useConnections'
import { AppShell } from '../components/templates/AppShell'
import { Button } from '../components/atoms/Button'
import { ErrorMessage } from '../components/atoms/ErrorMessage'
import { ErrorDialog } from '../components/molecules/ErrorDialog'
import { SearchField } from '../components/molecules/SearchField'
import { ConnectionTransferMenu } from '../components/molecules/ConnectionTransferMenu'
import { ConnectionContextMenu } from '../components/molecules/ConnectionContextMenu'
import { ConnectionsList } from '../components/organisms/ConnectionsList'
import { ConnectionsEmptyState } from '../components/organisms/ConnectionsEmptyState'
import { ConnectionDialog } from '../components/organisms/ConnectionDialog'

type Props = { connections: ReturnType<typeof useConnections> }

export function ConnectionsPage({ connections: c }: Props) {
  return (
    <AppShell
      variant="app"
      status="Local workspace"
      footerLeft="Zap / 0.5.0"
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
            <Button className="primary" onClick={c.create} disabled={!!c.busy}>
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
            shortcut
          />
          <span>
            {c.connections.length} saved connection{c.connections.length !== 1 ? 's' : ''}
          </span>
        </div>
        {c.error && !c.form && <ErrorMessage message={c.error} />}
        {c.connections.length === 0 ? (
          <ConnectionsEmptyState onCreate={c.create} />
        ) : (
          <ConnectionsList
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
            Stored on your device<span className="footer-dot">·</span>Credentials in system keychain
          </span>
        </div>
      </main>
    </AppShell>
  )
}
