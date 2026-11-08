import { Eye, Layers, Table2 } from 'lucide-react'
import type { Table } from '../../types/table'

type Props = { table: Table; size: number }

export function TableIcon({ table, size }: Props) {
  if (table.kind === 'materialized_view') return <Layers size={size} aria-hidden="true" />
  if (table.kind === 'view') return <Eye size={size} aria-hidden="true" />

  return <Table2 size={size} aria-hidden="true" />
}
