// src/components/Dock.jsx
import { REGISTRY } from '../widgets/_registry'
import { useWidgetStore } from '../store/widgetStore'

export function Dock() {
  const { spawn, widgets } = useWidgetStore()
  const openTypes = new Set(widgets.map((w) => w.type))

  return (
    <div className="dock">
      {REGISTRY.map((w) => {
        const isOpen = openTypes.has(w.id)
        return (
          <button
            key={w.id}
            className={`dock-btn${isOpen ? ' dock-btn--open' : ''}`}
            onClick={() => !isOpen && spawn(w.id)}
            title={w.label}
            aria-label={isOpen ? `${w.label} (open)` : `Open ${w.label}`}
          >
            <span className="dock-icon" aria-hidden="true">{w.icon}</span>
            <span className="dock-label">{w.label}</span>
          </button>
        )
      })}
    </div>
  )
}
