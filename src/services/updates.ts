import { createContext } from 'react'
import type { useUpdates } from '../hooks/useUpdates'

export const Updates = createContext<ReturnType<typeof useUpdates> | null>(null)
