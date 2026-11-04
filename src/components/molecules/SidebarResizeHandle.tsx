import type { useSidebarResize } from '../../hooks/useSidebarResize'

export function SidebarResizeHandle({
  width,
  minimum,
  maximum,
  dragging,
  handlers
}: ReturnType<typeof useSidebarResize>) {
  return (
    <div
      role="separator"
      aria-label="Resize sidebar"
      aria-controls="table-sidebar"
      aria-orientation="vertical"
      aria-valuemin={minimum}
      aria-valuemax={maximum}
      aria-valuenow={width}
      aria-valuetext={`${width} pixels`}
      tabIndex={0}
      className={dragging ? 'sidebar-resizer dragging' : 'sidebar-resizer'}
      {...handlers}
    />
  )
}
