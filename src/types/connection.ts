export type Connection = {
  id: string
  title: string
  driver: string
  host: string
  port: number
  authentication: string
  user: string
  password: string
  database: string
  ssh?: SshSettings | null
}

export type SshSettings = {
  host: string
  port: number
  user: string
  keyPath: string
}
