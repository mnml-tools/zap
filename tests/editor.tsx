// Isolated workspace fixture; all database calls use local mock data.
import { createRoot } from 'react-dom/client'
import { WorkspacePage } from '../src/pages/WorkspacePage'
import { request, failNextSave } from './fixtures/database'
import '../src/style.css'
const root = createRoot(document.getElementById('root')!)
root.render(
  <>
    <WorkspacePage
      id="fixture"
      request={request}
      connection={{
        id: 'fixture',
        title: 'Editor fixture',
        driver: 'postgresql',
        host: 'localhost',
        port: 5432,
        authentication: 'none',
        user: '',
        password: '',
        database: 'fixture'
      }}
      onClose={async () => {
        root.render(<p>Connection closed</p>)
      }}
    />
    <button
      style={{ position: 'fixed', bottom: 1, left: 180, fontSize: 9, minHeight: 20, padding: 2 }}
      onClick={() => {
        failNextSave()
      }}
    >
      Simulate next save failing
    </button>
  </>
)
