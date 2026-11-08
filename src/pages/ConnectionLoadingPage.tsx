import { Spinner } from '@mnml-tools/ui'
import { AppShell } from '../components/templates/AppShell'
import type { Connection } from '../types/connection'

export function ConnectionLoadingPage({ connection }: { connection?: Connection }) {
  return (
    <AppShell
      variant="app"
      status="Restoring connections"
      footerLeft="Zap / 0.7.1"
      footerRight="PostgreSQL · MySQL · SQLite"
    >
      <main className="connection-loading" aria-busy="true">
        <div role="status" aria-live="polite">
          <Spinner size={24} />
          <h1>{connection ? 'Reconnecting…' : 'Loading connections…'}</h1>
          <p>{connection ? `Restoring your connection to ${connection.title}.` : 'Getting your workspace ready.'}</p>
        </div>
      </main>
    </AppShell>
  )
}
