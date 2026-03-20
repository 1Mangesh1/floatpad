// src/components/Dock.jsx
import { REGISTRY } from '../widgets/_registry'
import { useWidgetStore } from '../store/widgetStore'

export function Dock() {
  const spawn = useWidgetStore((s) => s.spawn)
  return (
    <div className="dock">
      {REGISTRY.map((w) => (
        <button key={w.id} className="dock-btn" onClick={() => spawn(w.id)} title={w.label}>
          <span className="dock-icon">{w.icon}</span>
          <span className="dock-label">{w.label}</span>
        </button>
      ))}
    </div>
  )
}
