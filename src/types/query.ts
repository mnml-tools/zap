export type QueryParameter = { name: string; type: 'text' | 'number' | 'boolean' | 'null'; value: string }

export type SavedQuery = { id: string; connectionId: string; title: string; sql: string; parameters?: QueryParameter[] }

export type QueryDocument = SavedQuery & { isNew?: boolean; quick?: boolean }

export type QueryResultSet = {
  columns: string[]
  rows: (string | null)[][]
  rowsAffected: number
  rowCount: number
  truncated: boolean
}

export type QueryResult = { results: QueryResultSet[]; durationMs: number }
