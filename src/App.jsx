import { useWidgetStore } from './store/widgetStore'
import { FloatingWidget } from './components/FloatingWidget'
import { Dock } from './components/Dock'
import { widgetComponent } from './widgets/_registry'
import './App.css'

export default function App() {
  const widgets = useWidgetStore((s) => s.widgets)
  return (
    <div className="canvas">
      {widgets.map((w) => {
        const Component = widgetComponent(w.type)
        return (
          <FloatingWidget key={w.id} widget={w}>
            {Component ? <Component widgetId={w.id} /> : <div>Unknown widget</div>}
          </FloatingWidget>
        )
      })}
      <Dock />
    </div>
  )
}
