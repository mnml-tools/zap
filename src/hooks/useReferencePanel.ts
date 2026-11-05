import { useRef, useState } from 'react'
import type { ApiRequest } from '../services/api'
import type { Page } from '../types/table'
import type { Reference } from '../lib/relations'
import { referenceFilters } from '../lib/relations'

export type ReferenceOrigin = { tab: string; rowKey: string; columns: number[] }

export type ReferenceEntry = {
  reference: Reference
  data?: Page
  error?: string
}

type Options = { id: string; request: ApiRequest }

const maximumDepth = 20

export function useReferencePanel({ id, request }: Options) {
  const [stack, setStack] = useState<ReferenceEntry[]>([]),
    [origin, setOrigin] = useState<ReferenceOrigin | null>(null)
  const latest = useRef(0)
  const current = stack.at(-1)

  // Only the newest request may update the panel, so fast clicks cannot show an older row.
  const load = (reference: Reference, base: ReferenceEntry[]) => {
    const ticket = ++latest.current
    const entry: ReferenceEntry = { reference }
    const next = [...base, entry].slice(-maximumDepth)

    setStack(next)
    request<Page>('table_page', {
      id,
      table: reference.key.target,
      page: 0,
      filters: referenceFilters(reference),
      sort: null
    })
      .then((data) => ({ ...entry, data }))
      .catch((error) => ({ ...entry, error: String(error) }))
      .then((loaded) => {
        if (ticket === latest.current) setStack([...next.slice(0, -1), loaded])
      })
  }

  const open = (reference: Reference, from: ReferenceOrigin) => {
    setOrigin(from)
    load(reference, [])
  }

  const follow = (reference: Reference) => load(reference, stack)

  const back = () => {
    if (stack.length < 2) return

    latest.current++
    setStack(stack.slice(0, -1))
  }

  const close = () => {
    latest.current++
    setStack([])
    setOrigin(null)
  }

  return { current, depth: stack.length, origin, open, follow, back, close }
}
