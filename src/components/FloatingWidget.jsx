// src/components/FloatingWidget.jsx
import { Rnd } from 'react-rnd'
import { useWidgetStore } from '../store/widgetStore'

export function FloatingWidget({ widget, children }) {
  const { close, minimize, move, resize } = useWidgetStore()
  const { id, pos, size, minimized } = widget

  return (
    <Rnd
      position={{ x: pos.x, y: pos.y }}
      size={{ width: size.w, height: minimized ? 42 : size.h }}
      onDragStop={(_, d) => move(id, { x: d.x, y: d.y })}
      onResizeStop={(_, __, ref, ___, position) => {
        resize(id, { w: ref.offsetWidth, h: ref.offsetHeight })
        move(id, position)
      }}
      minWidth={240}
      minHeight={42}
      style={{ zIndex: 10 }}
      dragHandleClassName="drag-handle"
    >
      <div className="widget-shell">
        <div className="drag-handle widget-titlebar">
          <span className="widget-title">{widget.type}</span>
          <div className="widget-controls">
            <button onClick={() => minimize(id)}>─</button>
            <button onClick={() => close(id)}>✕</button>
          </div>
        </div>
        {!minimized && <div className="widget-body">{children}</div>}
      </div>
    </Rnd>
  )
}
