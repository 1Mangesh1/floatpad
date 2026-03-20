// src/store/widgetStore.js
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

let nextId = 1

export const useWidgetStore = create(
  persist(
    (set) => ({
      widgets: [],
      spawn: (type) =>
        set((s) => ({
          widgets: [
            ...s.widgets,
            {
              id: `${type}-${nextId++}`,
              type,
              pos: { x: 80 + Math.random() * 200, y: 80 + Math.random() * 100 },
              size: { w: 320, h: 360 },
              minimized: false,
              data: {},
            },
          ],
        })),
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
