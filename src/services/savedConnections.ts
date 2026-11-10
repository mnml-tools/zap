import { createContext } from 'react'
import type { Connection } from '../types/connection'

export const SavedConnections = createContext<Connection[]>([])
