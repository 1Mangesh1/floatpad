import { useRef, useState, useCallback, useEffect } from 'react'
import { useWidgetStore } from '../../store/widgetStore'

const COLORS = [
  { name: 'Amber',   hex: '#f59e0b' },
  { name: 'Rose',    hex: '#f43f5e' },
  { name: 'Sky',     hex: '#0ea5e9' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Violet',  hex: '#8b5cf6' },
  { name: 'Orange',  hex: '#f97316' },
]

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`
}

export function StickyNote({ widgetId }) {
  const widget = useWidgetStore(s => s.widgets.find(w => w.id === widgetId))
  const updateData = useWidgetStore(s => s.updateData)
  const timerRef = useRef(null)

  const text = widget?.data?.text ?? ''
  const color = widget?.data?.color ?? '#f59e0b'

  const [localText, setLocalText] = useState(text)
  const [hoveredColor, setHoveredColor] = useState(null)

  // Sync from store when external changes come in (e.g. undo)
  const lastSavedRef = useRef(text)
  if (text !== lastSavedRef.current) {
    lastSavedRef.current = text
  }

  const handleTextChange = useCallback((e) => {
    const val = e.target.value
    setLocalText(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      lastSavedRef.current = val
      updateData(widgetId, { text: val })
    }, 300)
  }, [widgetId, updateData])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleColorChange = useCallback((hex) => {
    updateData(widgetId, { color: hex })
  }, [widgetId, updateData])

  if (!widget) return null

  const rgb = hexToRgb(color)

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      gap: 10,
      fontFamily: "'IBM Plex Mono', monospace",
    }}>
      {/* Color swatches */}
      <div style={{
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        flexShrink: 0,
        paddingBottom: 6,
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
      }}>
        {COLORS.map(({ name, hex }) => {
          const isSelected = color === hex
          const isHovered = hoveredColor === hex
          const swatchRgb = hexToRgb(hex)
          return (
            <button
              key={hex}
              title={name}
              onClick={() => handleColorChange(hex)}
              onMouseEnter={() => setHoveredColor(hex)}
              onMouseLeave={() => setHoveredColor(null)}
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: hex,
                border: `2px solid ${isSelected ? hex : 'transparent'}`,
                cursor: 'pointer',
                padding: 0,
                flexShrink: 0,
                transition: 'all 0.3s ease',
                boxShadow: isSelected
                  ? `0 0 8px rgba(${swatchRgb}, 0.5), 0 0 2px rgba(${swatchRgb}, 0.3)`
                  : isHovered
                    ? `0 0 6px rgba(${swatchRgb}, 0.3)`
                    : 'none',
                transform: isHovered && !isSelected ? 'scale(1.15)' : 'scale(1)',
                outline: 'none',
              }}
            />
          )
        })}
      </div>

      {/* Textarea area with color accent */}
      <div style={{
        flex: 1,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        background: `rgba(${rgb}, 0.08)`,
        borderLeft: `3px solid rgba(${rgb}, 0.3)`,
        borderRadius: 4,
        transition: 'background 0.3s ease, border-color 0.3s ease',
      }}>
        <textarea
          className={`sticky-textarea-${widgetId.replace(/[^a-zA-Z0-9]/g, '')}`}
          value={localText}
          onChange={handleTextChange}
          placeholder="Type your thoughts..."
          spellCheck={false}
          style={{
            flex: 1,
            width: '100%',
            background: 'transparent',
            color: '#e0e0f0',
            border: 'none',
            outline: 'none',
            resize: 'none',
            padding: '10px 12px',
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 13,
            lineHeight: 1.6,
            letterSpacing: '0.01em',
            boxSizing: 'border-box',
            minHeight: 0,
            caretColor: color,
          }}
        />
        {/* Placeholder color override via style tag */}
        <style>{`
          .sticky-textarea-${widgetId.replace(/[^a-zA-Z0-9]/g, '')}::placeholder {
            color: rgba(${rgb}, 0.3) !important;
            font-style: italic;
          }
          .sticky-textarea-${widgetId.replace(/[^a-zA-Z0-9]/g, '')}::-webkit-scrollbar {
            width: 4px;
          }
          .sticky-textarea-${widgetId.replace(/[^a-zA-Z0-9]/g, '')}::-webkit-scrollbar-track {
            background: transparent;
          }
          .sticky-textarea-${widgetId.replace(/[^a-zA-Z0-9]/g, '')}::-webkit-scrollbar-thumb {
            background: rgba(${rgb}, 0.2);
            border-radius: 2px;
          }
          .sticky-textarea-${widgetId.replace(/[^a-zA-Z0-9]/g, '')}::-webkit-scrollbar-thumb:hover {
            background: rgba(${rgb}, 0.35);
          }
        `}</style>

        {/* Character count */}
        <div style={{
          position: 'absolute',
          bottom: 6,
          right: 10,
          fontSize: 11,
          fontFamily: "'IBM Plex Mono', monospace",
          color: '#e0e0f0',
          opacity: 0.3,
          pointerEvents: 'none',
          userSelect: 'none',
        }}>
          {localText.length} chars
        </div>
      </div>
    </div>
  )
}
