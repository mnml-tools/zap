import { useEffect, useRef, useState } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import type { Connection } from '../types/connection'
import { api } from '../services/api'
import type { ApiRequest } from '../services/api'
import { newConnection } from '../lib/connections'

export function useConnections(request: ApiRequest = api) {
  const [connections, setConnections] = useState<Connection[]>([]),
    [form, setForm] = useState<Connection | null>(null),
    [search, setSearch] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(''),
    [tested, setTested] = useState(false)
  const [id, setId] = useState<string | null>(null)
  const opening = useRef(false)
  const [menu, setMenu] = useState<{ connection: Connection; x: number; y: number } | null>(null)
  const menuRow = useRef<HTMLElement | null>(null)
  const removing = useRef(false)

  const dismissMenu = () => {
    setMenu(null)
    menuRow.current?.focus()
  }

  const editing = !!form && connections.some((c) => c.id === form.id)

  const edit = (c: Connection) => {
    setMenu(null)
    setError('')
    setTested(false)
    setForm({ ...c, password: '' })
  }

  const remove = async (c: Connection) => {
    if (removing.current || opening.current) return

    removing.current = true
    setMenu(null)
    setBusy(c.id)
    setError('')

    try {
      await request('remove_connection', { id: c.id })
      setConnections((all) => all.filter((item) => item.id !== c.id))
    } catch (e) {
      setError(String(e))
      menuRow.current?.focus()
    } finally {
      removing.current = false
      setBusy('')
    }
  }

  const load = () => {
    if (isTauri() || request !== api)
      request<Connection[]>('list_connections')
        .then(setConnections)
        .catch((e) => setError(String(e)))
  }

  useEffect(load, [])

  const open = async (c: Connection) => {
    if (opening.current || removing.current) return

    setMenu(null)
    opening.current = true
    setBusy(c.id)
    setError('')

    try {
      await request('open_connection', { id: c.id })
      setId(c.id)
    } catch (e) {
      setError(String(e))
    } finally {
      opening.current = false
      setBusy('')
    }
  }

  const close = async () => {
    if (!id) return

    await request('close_connection', { id })
    setId(null)
  }

  const create = () => {
    setForm(newConnection())
    setError('')
    setTested(false)
  }

  const changeForm = (next: Connection, resetTest = true) => {
    setForm(next)

    if (resetTest) setTested(false)
  }

  const cancelForm = () => setForm(null)

  const saveForm = async () => {
    if (!form) return

    setBusy('save')
    setError('')

    try {
      await request('save_connection', { connection: form })
      setForm(null)
      load()
    } catch (error) {
      setError(String(error))
    } finally {
      setBusy('')
    }
  }

  const testForm = async () => {
    if (!form) return

    setBusy('test')
    setError('')
    setTested(false)

    try {
      await request('test_connection', { connection: form })
      setTested(true)
    } catch (error) {
      setError(String(error))
    } finally {
      setBusy('')
    }
  }

  const showMenu = (connection: Connection, target: HTMLElement, x: number, y: number) => {
    if (busy) return

    menuRow.current = target
    setMenu({ connection, x, y })
  }

  return {
    connections,
    form,
    search,
    setSearch,
    error,
    busy,
    tested,
    id,
    menu,
    editing,
    dismissMenu,
    edit,
    remove,
    open,
    close,
    create,
    changeForm,
    cancelForm,
    saveForm,
    testForm,
    showMenu
  }
}
