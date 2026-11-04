import type { Connection } from '../types/connection'

export const drivers = ['postgresql', 'mysql', 'sqlite']

export const driverNames: Record<string, string> = {
  postgresql: 'PostgreSQL',
  mysql: 'MySQL',
  sqlite: 'SQLite'
}

export const newConnection = (): Connection => ({
  id: crypto.randomUUID(),
  title: '',
  driver: 'postgresql',
  host: 'localhost',
  port: 5432,
  authentication: 'password',
  user: 'postgres',
  password: '',
  database: ''
})

export const matchesConnection = (connection: Connection, search: string) =>
  `${connection.title} ${connection.database} ${connection.driver}`.toLowerCase().includes(search.toLowerCase())
