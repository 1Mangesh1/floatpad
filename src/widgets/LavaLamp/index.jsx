import { useRef, useEffect, useCallback } from 'react'
import { useWidgetStore } from '../../store/widgetStore'

/* ─── colour themes ─── */
const THEMES = {
  classic: { label: 'Classic', colors: ['#ff4757', '#ff6348', '#ff7f50'] },
  ocean:   { label: 'Ocean',   colors: ['#0ea5e9', '#06b6d4', '#2dd4bf'] },
  alien:   { label: 'Alien',   colors: ['#00ff87', '#2ed573', '#7bed9f'] },
  cosmos:  { label: 'Cosmos',  colors: ['#c084fc', '#f472b6', '#818cf8'] },
  sunset:  { label: 'Sunset',  colors: ['#feca57', '#ff6b6b', '#ff9ff3'] },
}
const THEME_KEYS = Object.keys(THEMES)

/* ─── blob factory ─── */
function createBlob(w, h, colors, index, total) {
  const radius = 40 + Math.random() * 40 // 40-80 px
  // Spread blobs vertically across the lamp
  const ySlice = h / (total + 1)
  return {
    x: w * 0.2 + Math.random() * w * 0.6,
    y: ySlice * (index + 1) + (Math.random() - 0.5) * ySlice * 0.6,
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.5) * 0.4,
    radius,
    color: colors[index % colors.length],
    // Sinusoidal motion parameters
    phaseX: Math.random() * Math.PI * 2,
    phaseY: Math.random() * Math.PI * 2,
    freqX: 0.3 + Math.random() * 0.4,  // cycles per second-ish
    freqY: 0.2 + Math.random() * 0.3,
    ampX: 0.15 + Math.random() * 0.2,
    ampY: 0.3 + Math.random() * 0.4,
  }
}

const NUM_BLOBS = 7

export function LavaLamp({ widgetId }) {
  const widget = useWidgetStore(s => s.widgets.find(w => w.id === widgetId))
  const updateData = useWidgetStore(s => s.updateData)

  const theme = widget?.data?.theme || 'classic'
  const speed = widget?.data?.speed ?? 1

  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const blobsRef = useRef(null)
  const rafRef = useRef(null)
  const sizeRef = useRef({ w: 0, h: 0 })
  const timeRef = useRef(0)
  const lastFrameRef = useRef(0)

  // Keep mutable refs for theme / speed so the animation loop reads fresh values
  const themeRef = useRef(theme)
  const speedRef = useRef(speed)
  useEffect(() => { themeRef.current = theme }, [theme])
  useEffect(() => { speedRef.current = speed }, [speed])

  // Re-color blobs when theme changes
  useEffect(() => {
    if (!blobsRef.current) return
    const colors = THEMES[theme].colors
    for (let i = 0; i < blobsRef.current.length; i++) {
      blobsRef.current[i].color = colors[i % colors.length]
    }
  }, [theme])

  const setTheme = useCallback(t => updateData(widgetId, { theme: t }), [widgetId, updateData])
  const setSpeed = useCallback(s => updateData(widgetId, { speed: s }), [widgetId, updateData])

  /* ─── main canvas effect ─── */
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')

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

      if (!blobsRef.current) {
        const colors = THEMES[themeRef.current].colors
        blobsRef.current = Array.from({ length: NUM_BLOBS }, (_, i) =>
          createBlob(w, h, colors, i, NUM_BLOBS)
        )
      } else {
        // Re-clamp blobs into visible area on resize
        for (const b of blobsRef.current) {
          if (b.x - b.radius > w) b.x = w * 0.5
          if (b.y - b.radius > h) b.y = h * 0.5
        }
      }
    }

    const ro = new ResizeObserver(resize)
    ro.observe(container)
    resize()

    lastFrameRef.current = performance.now()

    const tick = (now) => {
      const dt = Math.min((now - lastFrameRef.current) / 1000, 0.05) // cap delta
      lastFrameRef.current = now
      const spd = speedRef.current
      timeRef.current += dt * spd

      const { w, h } = sizeRef.current
      const blobs = blobsRef.current
      if (!blobs || w === 0) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }

      const t = timeRef.current

      // --- physics ---
      for (const b of blobs) {
        // Sinusoidal acceleration (lava lamp heat convection feel)
        const sinForceX = Math.sin(t * b.freqX + b.phaseX) * b.ampX
        const sinForceY = Math.cos(t * b.freqY + b.phaseY) * b.ampY

        b.vx += sinForceX * dt * 2
        b.vy += sinForceY * dt * 2

        // Gentle random perturbation
        b.vx += (Math.random() - 0.5) * 0.04
        b.vy += (Math.random() - 0.5) * 0.04

        // Damping
        b.vx *= 0.995
        b.vy *= 0.995

        // Clamp velocity
        const maxV = 1.2 * spd
        const v = Math.sqrt(b.vx * b.vx + b.vy * b.vy)
        if (v > maxV) {
          b.vx = (b.vx / v) * maxV
          b.vy = (b.vy / v) * maxV
        }

        b.x += b.vx * spd * 60 * dt
        b.y += b.vy * spd * 60 * dt

        // Soft edge bounce
        const pad = b.radius * 0.3
        if (b.x < pad)     { b.x = pad;     b.vx = Math.abs(b.vx) * 0.5 }
        if (b.x > w - pad) { b.x = w - pad; b.vx = -Math.abs(b.vx) * 0.5 }
        if (b.y < pad)     { b.y = pad;     b.vy = Math.abs(b.vy) * 0.5 }
        if (b.y > h - pad) { b.y = h - pad; b.vy = -Math.abs(b.vy) * 0.5 }
      }

      // --- draw ---
      // Black background (critical for the CSS contrast trick)
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, w, h)

      // Draw each blob as a radial gradient disc
      for (const b of blobs) {
        // Subtle pulsing radius
        const pulse = 1 + Math.sin(t * 1.5 + b.phaseX) * 0.08
        const r = b.radius * pulse

        const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r)
        grad.addColorStop(0, b.color)
        grad.addColorStop(0.5, b.color + 'cc') // semi-transparent
        grad.addColorStop(1, 'transparent')

        ctx.globalCompositeOperation = 'lighter'
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(b.x, b.y, r, 0, Math.PI * 2)
        ctx.fill()
      }

      // Reset composite
      ctx.globalCompositeOperation = 'source-over'

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
        .lava-wrapper {
          position: relative;
          margin: -14px;
          width: calc(100% + 28px);
          height: calc(100% + 28px);
          overflow: hidden;
          border-radius: 0 0 12px 12px;
          background: #000;
        }
        .lava-filter {
          width: 100%;
          height: 100%;
          filter: contrast(20) blur(4px) brightness(0.7);
        }
        .lava-canvas {
          display: block;
          width: 100%;
          height: 100%;
        }
        /* ── Controls bar ── */
        .lava-controls {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 10px;
          background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%);
          pointer-events: none;
        }
        .lava-controls > * {
          pointer-events: auto;
        }
        .lava-dots {
          display: flex;
          gap: 6px;
          align-items: center;
        }
        .lava-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          border: none;
          cursor: pointer;
          padding: 0;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .lava-dot:hover {
          transform: scale(1.25);
        }
        .lava-dot--active {
          box-shadow: 0 0 0 2px rgba(255,255,255,0.6), 0 0 8px var(--glow);
          transform: scale(1.15);
        }
        /* ── Speed slider ── */
        .lava-speed {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .lava-speed-label {
          font-size: 10px;
          color: rgba(255,255,255,0.45);
          font-family: inherit;
          user-select: none;
        }
        .lava-slider {
          -webkit-appearance: none;
          appearance: none;
          width: 64px;
          height: 3px;
          border-radius: 2px;
          background: rgba(255,255,255,0.15);
          outline: none;
          cursor: pointer;
        }
        .lava-slider::-webkit-slider-thumb {
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
        .lava-slider::-webkit-slider-thumb:hover {
          background: #fff;
        }
        .lava-slider::-moz-range-thumb {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: rgba(255,255,255,0.7);
          border: none;
          cursor: pointer;
        }
      `}</style>

      <div className="lava-wrapper" ref={containerRef}>
        {/* The CSS filter wrapper creates the metaball merging effect */}
        <div className="lava-filter">
          <canvas ref={canvasRef} className="lava-canvas" />
        </div>

        {/* Overlay controls */}
        <div className="lava-controls">
          {/* Theme dots */}
          <div className="lava-dots">
            {THEME_KEYS.map(t => (
              <button
                key={t}
                title={THEMES[t].label}
                className={`lava-dot${theme === t ? ' lava-dot--active' : ''}`}
                style={{
                  background: THEMES[t].colors[0],
                  '--glow': THEMES[t].colors[0],
                }}
                onClick={() => setTheme(t)}
              />
            ))}
          </div>

          {/* Speed slider */}
          <div className="lava-speed">
            <span className="lava-speed-label">{speed.toFixed(1)}x</span>
            <input
              type="range"
              className="lava-slider"
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
