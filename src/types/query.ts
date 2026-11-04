export type SavedQuery = { id: string; connectionId: string; title: string; sql: string }

export type QueryDocument = SavedQuery & { isNew?: boolean }

export type QueryResultSet = {
  columns: string[]
  rows: (string | null)[][]
  rowsAffected: number
  rowCount: number
  truncated: boolean
}

export type QueryResult = { results: QueryResultSet[]; durationMs: number }
