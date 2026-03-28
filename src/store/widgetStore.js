// src/store/widgetStore.js
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { REGISTRY } from '../widgets/_registry'

export const useWidgetStore = create(
  persist(
    (set) => ({
      widgets: [],
      spawn: (type) =>
        set((s) => {
          const reg = REGISTRY.find((r) => r.id === type)
          return {
            widgets: [
              ...s.widgets,
              {
                id: `${type}-${crypto.randomUUID()}`,
                type,
                pos: { x: 80 + Math.random() * 200, y: 80 + Math.random() * 100 },
                size: { w: reg?.w ?? 320, h: reg?.h ?? 360 },
                minimized: false,
                zIndex: 0,
                data: {},
              },
            ],
          }
        }),
      close: (id) =>
        set((s) => ({ widgets: s.widgets.filter((w) => w.id !== id) })),
      minimize: (id) =>
        set((s) => ({
          widgets: s.widgets.map((w) =>
            w.id === id ? { ...w, minimized: !w.minimized } : w
          ),
        })),
      move: (id, pos) =>
        set((s) => ({
          widgets: s.widgets.map((w) => (w.id === id ? { ...w, pos } : w)),
        })),
      resize: (id, size) =>
        set((s) => ({
          widgets: s.widgets.map((w) => (w.id === id ? { ...w, size } : w)),
        })),
      resizeAndMove: (id, size, pos) =>
        set((s) => ({
          widgets: s.widgets.map((w) =>
            w.id === id ? { ...w, size, pos } : w
          ),
        })),
      bringToFront: (id) =>
        set((s) => {
          const maxZ = s.widgets.reduce((m, w) => Math.max(m, w.zIndex ?? 0), 0)
          return {
            widgets: s.widgets.map((w) =>
              w.id === id ? { ...w, zIndex: maxZ + 1 } : w
            ),
          }
        }),
      updateData: (id, data) =>
        set((s) => ({
          widgets: s.widgets.map((w) =>
            w.id === id ? { ...w, data: { ...w.data, ...data } } : w
          ),
        })),
    }),
    { name: 'floatpad-widgets' }
  )
)
