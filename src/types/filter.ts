export type TableFilter = {
  id: string
  column: string
  operator: string
  value: string
  enabled: boolean
}

export type FilterState = { open: boolean; draft: TableFilter[]; applied: TableFilter[] }
