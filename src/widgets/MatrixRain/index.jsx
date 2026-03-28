import { useRef, useEffect, useCallback } from 'react'
import { useWidgetStore } from '../../store/widgetStore'

/* ─── colour themes ─── */
const THEMES = {
  green: { label: 'Classic', primary: '#00ff41', head: '#aaffaa', dim: '#003300' },
  cyan:  { label: 'Cyan',    primary: '#00ffff', head: '#ccffff', dim: '#003333' },
  amber: { label: 'Amber',   primary: '#ffbf00', head: '#ffe680', dim: '#332600' },
}
const THEME_KEYS = Object.keys(THEMES)

/* ─── character pool ─── */
const KATAKANA_START = 0x30A0
const KATAKANA_END = 0x30FF
const CHARS = (() => {
  const pool = []
  for (let c = KATAKANA_START; c <= KATAKANA_END; c++) pool.push(String.fromCharCode(c))
  for (let c = 48; c <= 57; c++) pool.push(String.fromCharCode(c)) // 0-9
  for (let c = 65; c <= 90; c++) pool.push(String.fromCharCode(c)) // A-Z
  return pool
})()
const randChar = () => CHARS[Math.floor(Math.random() * CHARS.length)]

/* ─── column factory ─── */
const FONT_SIZE = 14
const COL_SPACING = FONT_SIZE

function createColumn(x, maxY, immediate) {
  const speed = 1 + Math.random() * 2 // 1-3 px per frame base
  const trailLen = 12 + Math.floor(Math.random() * 10) // 12-21 chars
  const chars = Array.from({ length: trailLen }, () => randChar())
  return {
    x,
    y: immediate ? Math.random() * maxY : -(Math.random() * maxY * 0.5),
    speed,
    chars,
    trailLen,
    fontSize: 12 + Math.floor(Math.random() * 5), // 12-16 px size variation
    mutateTimer: 0,
  }
}

/* ════════════════════════════════════════════════════════ */
export function MatrixRain({ widgetId }) {
  const widget = useWidgetStore(s => s.widgets.find(w => w.id === widgetId))
  const updateData = useWidgetStore(s => s.updateData)

  const theme = widget?.data?.theme || 'green'
  const speed = widget?.data?.speed ?? 1

  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const columnsRef = useRef(null)
  const rafRef = useRef(null)
  const sizeRef = useRef({ w: 0, h: 0 })
  const lastFrameRef = useRef(0)
  const flashRef = useRef({ col: -1, cooldown: 0, active: 0 })

  // Mutable refs for animation loop
  const themeRef = useRef(theme)
  const speedRef = useRef(speed)
  useEffect(() => { themeRef.current = theme }, [theme])
  useEffect(() => { speedRef.current = speed }, [speed])

  const setTheme = useCallback(t => updateData(widgetId, { theme: t }), [widgetId, updateData])
  const setSpeed = useCallback(s => updateData(widgetId, { speed: s }), [widgetId, updateData])

  /* ─── main canvas effect ─── */
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')

    const initColumns = (w, h) => {
      const numCols = Math.floor(w / COL_SPACING) + 1
      columnsRef.current = Array.from({ length: numCols }, (_, i) =>
        createColumn(i * COL_SPACING, h, true)
      )
    }

    const resize = () => {
      const rect = container.getBoundingClientRect()
      const w = Math.floor(rect.width)
      const h = Math.floor(rect.height)
      const dpr = window.devicePixelRatio || 1
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      sizeRef.current = { w, h }

      if (!columnsRef.current) {
        initColumns(w, h)
      } else {
        // Adjust column count on resize
        const numCols = Math.floor(w / COL_SPACING) + 1
        const cur = columnsRef.current
        if (numCols > cur.length) {
          for (let i = cur.length; i < numCols; i++) {
            cur.push(createColumn(i * COL_SPACING, h, true))
          }
        } else if (numCols < cur.length) {
          columnsRef.current = cur.slice(0, numCols)
        }
      }
    }

    const ro = new ResizeObserver(resize)
    ro.observe(container)
    resize()

    // Fill the canvas black initially
    const { w, h } = sizeRef.current
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, w, h)

    lastFrameRef.current = performance.now()

    const tick = (now) => {
      const rawDt = (now - lastFrameRef.current) / 1000
      const dt = Math.min(rawDt, 0.05) // cap delta
      lastFrameRef.current = now
      const spd = speedRef.current

      const { w, h } = sizeRef.current
      const columns = columnsRef.current
      if (!columns || w === 0) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }

      const t = THEMES[themeRef.current]
      const primaryR = parseInt(t.primary.slice(1, 3), 16)
      const primaryG = parseInt(t.primary.slice(3, 5), 16)
      const primaryB = parseInt(t.primary.slice(5, 7), 16)

      // --- Background fade: semi-transparent black overlay ---
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'
      ctx.fillRect(0, 0, w, h)

      // --- Flash logic: occasional bright column burst ---
      const flash = flashRef.current
      flash.cooldown -= dt
      flash.active -= dt
      if (flash.cooldown <= 0) {
        flash.col = Math.floor(Math.random() * columns.length)
        flash.active = 0.12 + Math.random() * 0.08 // flash lasts 120-200ms
        flash.cooldown = 3 + Math.random() * 5     // next flash in 3-8s
      }

      // --- Update & draw columns ---
      const frameSpeed = 60 * dt * spd

      for (let ci = 0; ci < columns.length; ci++) {
        const col = columns[ci]

        // Advance position
        col.y += col.speed * frameSpeed

        // Character mutation: randomly swap chars every few frames
        col.mutateTimer += dt * spd
        if (col.mutateTimer > 0.06) {
          col.mutateTimer = 0
          const idx = Math.floor(Math.random() * col.chars.length)
          col.chars[idx] = randChar()
        }

        // Draw the column trail
        const isFlashing = ci === flash.col && flash.active > 0

        for (let j = 0; j < col.trailLen; j++) {
          const charY = col.y - j * col.fontSize
          if (charY < -col.fontSize || charY > h + col.fontSize) continue

          ctx.font = `${col.fontSize}px monospace`

          if (j === 0) {
            // Head character — brightest
            ctx.fillStyle = isFlashing ? '#ffffff' : t.head
            ctx.shadowColor = isFlashing ? '#ffffff' : t.primary
            ctx.shadowBlur = isFlashing ? 16 : 8
          } else {
            // Trail — fade from bright to dim
            const fade = 1 - j / col.trailLen
            const alpha = Math.max(0.05, fade)
            const r = Math.round(primaryR * fade)
            const g = Math.round(primaryG * fade)
            const b = Math.round(primaryB * fade)

            if (isFlashing) {
              // Flash: entire column goes whitish
              const wr = Math.round(255 * 0.4 + r * 0.6)
              const wg = Math.round(255 * 0.4 + g * 0.6)
              const wb = Math.round(255 * 0.4 + b * 0.6)
              ctx.fillStyle = `rgba(${wr}, ${wg}, ${wb}, ${alpha.toFixed(2)})`
            } else {
              ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`
            }
            ctx.shadowColor = 'transparent'
            ctx.shadowBlur = 0
          }

          ctx.fillText(col.chars[j], col.x, charY)
        }

        // Reset shadow after head char draw
        ctx.shadowColor = 'transparent'
        ctx.shadowBlur = 0

        // Reset column when head goes far below screen
        if (col.y - col.trailLen * col.fontSize > h) {
          const reset = createColumn(col.x, h, false)
          reset.y = -(Math.random() * h * 0.5 + col.trailLen * col.fontSize)
          columns[ci] = reset
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      ro.disconnect()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, []) // stable — reads theme/speed via refs

  return (
    <>
      <style>{`
        .matrix-wrapper {
          position: relative;
          margin: -14px;
          width: calc(100% + 28px);
          height: calc(100% + 28px);
          overflow: hidden;
          border-radius: 0 0 12px 12px;
          background: #000;
        }
        .matrix-canvas {
          display: block;
          width: 100%;
          height: 100%;
        }
        /* Scanline overlay — pure CSS, zero per-frame cost */
        .matrix-scanlines {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: repeating-linear-gradient(
            to bottom,
            transparent 0px,
            transparent 1px,
            rgba(0, 0, 0, 0.03) 1px,
            rgba(0, 0, 0, 0.03) 2px
          );
        }
        /* ── Controls bar ── */
        .matrix-controls {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 10px;
          background: linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%);
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        .matrix-wrapper:hover .matrix-controls {
          opacity: 1;
        }
        .matrix-controls > * {
          pointer-events: auto;
        }
        .matrix-dots {
          display: flex;
          gap: 6px;
          align-items: center;
        }
        .matrix-dot {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.2);
          cursor: pointer;
          padding: 0;
          transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
          background: var(--dot-color);
        }
        .matrix-dot:hover {
          transform: scale(1.25);
          border-color: rgba(255,255,255,0.5);
        }
        .matrix-dot--active {
          border-color: rgba(255,255,255,0.8);
          box-shadow: 0 0 6px var(--dot-color), 0 0 12px var(--dot-color);
          transform: scale(1.15);
        }
        /* ── Speed slider ── */
        .matrix-speed {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .matrix-speed-label {
          font-size: 10px;
          color: rgba(255,255,255,0.45);
          font-family: monospace;
          user-select: none;
          min-width: 26px;
          text-align: right;
        }
        .matrix-slider {
          -webkit-appearance: none;
          appearance: none;
          width: 64px;
          height: 3px;
          border-radius: 2px;
          background: rgba(255,255,255,0.15);
          outline: none;
          cursor: pointer;
        }
        .matrix-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: rgba(255,255,255,0.7);
          border: none;
          cursor: pointer;
          transition: background 0.15s;
        }
        .matrix-slider::-webkit-slider-thumb:hover {
          background: #fff;
        }
        .matrix-slider::-moz-range-thumb {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: rgba(255,255,255,0.7);
          border: none;
          cursor: pointer;
        }
      `}</style>

      <div className="matrix-wrapper" ref={containerRef}>
        <canvas ref={canvasRef} className="matrix-canvas" />
        <div className="matrix-scanlines" />

        {/* Overlay controls — visible on hover */}
        <div className="matrix-controls">
          {/* Theme dots */}
          <div className="matrix-dots">
            {THEME_KEYS.map(t => (
              <button
                key={t}
                title={THEMES[t].label}
                className={`matrix-dot${theme === t ? ' matrix-dot--active' : ''}`}
                style={{ '--dot-color': THEMES[t].primary }}
                onClick={() => setTheme(t)}
              />
            ))}
          </div>

          {/* Speed slider */}
          <div className="matrix-speed">
            <span className="matrix-speed-label">{speed.toFixed(1)}x</span>
            <input
              type="range"
              className="matrix-slider"
              min="0.5"
              max="2"
              step="0.1"
              value={speed}
              onChange={e => setSpeed(parseFloat(e.target.value))}
            />
          </div>
        </div>
      </div>
    </>
  )
}
