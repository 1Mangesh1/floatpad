// src/components/FloatingWidget.jsx
import { Rnd } from 'react-rnd'
import { useWidgetStore } from '../store/widgetStore'
import { REGISTRY } from '../widgets/_registry'

export function FloatingWidget({ widget, children }) {
  const { close, minimize, move, resizeAndMove, bringToFront } = useWidgetStore()
  const { id, pos, size, minimized, zIndex } = widget
  const label = REGISTRY.find((r) => r.id === widget.type)?.label ?? widget.type

  return (
    <Rnd
      position={{ x: pos.x, y: pos.y }}
      size={{ width: size.w, height: minimized ? 42 : size.h }}
      onDragStop={(_, d) => move(id, { x: d.x, y: d.y })}
      onResizeStop={(_, __, ref, ___, position) => {
        if (minimized) return
        resizeAndMove(id, { w: ref.offsetWidth, h: ref.offsetHeight }, position)
      }}
      onMouseDown={() => bringToFront(id)}
      enableResizing={minimized ? false : undefined}
      minWidth={240}
      minHeight={42}
      bounds="window"
      style={{ zIndex: zIndex ?? 0 }}
      dragHandleClassName="drag-handle"
    >
      <div className="widget-shell">
        <div className="drag-handle widget-titlebar">
          <span className="widget-title">{label}</span>
          <div className="widget-controls">
            <button
              onClick={() => minimize(id)}
              aria-label={minimized ? 'Restore' : 'Minimize'}
            >─</button>
            <button onClick={() => close(id)} aria-label="Close">✕</button>
          </div>
        </div>
        {!minimized && <div className="widget-body">{children}</div>}
      </div>
    </Rnd>
  )
}
