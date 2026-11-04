import { useEffect, useRef, useState } from 'react'
import type { PointerEvent, KeyboardEvent } from 'react'

const minimum = 160,
  maximum = 500,
  storageKey = 'zap.sidebarWidth'

let rememberedWidth = 220

const clamp = (width: number) => Math.min(maximum, Math.max(minimum, Math.round(width)))

function initialWidth() {
  try {
    const saved = localStorage.getItem(storageKey)

    if (saved !== null && saved.trim() !== '' && Number.isFinite(Number(saved))) return clamp(Number(saved))
  } catch {}

  return rememberedWidth
}

export function useSidebarResize() {
  const [width, setWidth] = useState(initialWidth),
    [dragging, setDragging] = useState(false)
  const drag = useRef<{ pointerId: number; x: number; width: number } | null>(null)

  const resize = (next: number) => {
    const value = clamp(next)
    rememberedWidth = value
    setWidth(value)

    try {
      localStorage.setItem(storageKey, String(value))
    } catch {}
  }

  const finish = () => {
    drag.current = null
    setDragging(false)
    document.documentElement.classList.remove('sidebar-resizing')
  }

  useEffect(
    () => () => {
      document.documentElement.classList.remove('sidebar-resizing')
    },
    []
  )

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !event.isPrimary) return

    event.preventDefault()
    event.currentTarget.focus()
    drag.current = { pointerId: event.pointerId, x: event.clientX, width }
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
    document.documentElement.classList.add('sidebar-resizing')
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current

    if (start?.pointerId === event.pointerId) resize(start.width + event.clientX - start.x)
  }

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return

    finish()

    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    let next = width

    if (event.key === 'ArrowLeft') next -= event.shiftKey ? 50 : 10
    else if (event.key === 'ArrowRight') next += event.shiftKey ? 50 : 10
    else if (event.key === 'Home') next = minimum
    else if (event.key === 'End') next = maximum
    else return

    event.preventDefault()
    resize(next)
  }

  return {
    width,
    dragging,
    minimum,
    maximum,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: finish,
      onLostPointerCapture: finish,
      onKeyDown
    }
  }
}
