export type Table = { schema: string; name: string }

export type Page = {
  columns: string[]
  rows: (string | null)[][]
  total: number
  primaryKeys: number[]
  editable: boolean[]
  readOnlyReason: string | null
}

export type TableSort = { column: string; direction: 'asc' | 'desc' }

export type DraftRow = { original: (string | null)[]; changes: Record<number, string | null>; deleted?: boolean }

export type TableDraft = { columns: string[]; rows: Record<string, DraftRow> }

export type CellEditor = {
  tab: string
  rowKey: string
  row: (string | null)[]
  column: number
  value: string | null
  columns: string[]
}

export type TableMode = 'data' | 'structure' | 'indexes'

export type StructureChange = { column: string; field: number; value: string | null }

export type NewColumn = {
  name: string
  kind: string
  nullable: string
  default: string | null
  comment: string | null
}

export type StructureDraft = { name?: string; changes: StructureChange[]; additions?: NewColumn[] }
