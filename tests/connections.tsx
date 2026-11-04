// Isolated connection workflow; never reads native credentials or real databases.
import { createRoot } from 'react-dom/client'
import { App } from '../src/app/App'
import type { Connection } from '../src/types/connection'
import type { ApiRequest } from '../src/services/api'
import { request as databaseRequest } from './fixtures/database'
import '../src/style.css'
let connections: Connection[] = [
  {
    id: 'fixture',
    title: 'Editor fixture',
    driver: 'postgresql',
    host: 'localhost',
    port: 5432,
    authentication: 'password',
    user: 'postgres',
    password: '',
    database: 'fixture'
  }
]
const request: ApiRequest = async <T,>(command: string, args?: Record<string, unknown>) => {
  if (command === 'list_connections') return connections.map((connection) => ({ ...connection, password: '' })) as T
  if (command === 'save_connection') {
    const connection = args!.connection as Connection
    const index = connections.findIndex((item) => item.id === connection.id)
    if (index < 0) connections.push(connection)
    else connections[index] = connection
    return undefined as T
  }
  if (command === 'test_connection' || command === 'open_connection' || command === 'close_connection')
    return undefined as T
  if (command === 'remove_connection') {
    connections = connections.filter((connection) => connection.id !== args!.id)
    return undefined as T
  }
  return databaseRequest<T>(command, args)
}
createRoot(document.getElementById('root')!).render(<App request={request} />)
