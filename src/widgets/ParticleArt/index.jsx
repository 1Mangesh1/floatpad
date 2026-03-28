import { useRef, useEffect, useCallback } from 'react'
import { useWidgetStore } from '../../store/widgetStore'

const THEMES = {
  aurora:  ['#00ff87', '#60efff', '#00b4d8'],
  sunset:  ['#ff6b6b', '#feca57', '#ff9ff3'],
  ocean:   ['#0ea5e9', '#06b6d4', '#2dd4bf'],
  nebula:  ['#c084fc', '#f472b6', '#818cf8'],
  fire:    ['#ff4757', '#ff6348', '#ffa502'],
}

const THEME_KEYS = Object.keys(THEMES)
const MODES = ['attract', 'repel', 'orbit']
const NUM_PARTICLES = 120
const INTERACTION_RADIUS = 120
const CONNECTION_DIST = 80
const DAMPING = 0.98
const DRIFT_FORCE = 0.08

function createParticle(w, h, colors) {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.5,
    vy: (Math.random() - 0.5) * 0.5,
    radius: 2 + Math.random() * 2,
    color: colors[Math.floor(Math.random() * colors.length)],
  }
}

export function ParticleArt({ widgetId }) {
  const widget = useWidgetStore(s => s.widgets.find(w => w.id === widgetId))
  const updateData = useWidgetStore(s => s.updateData)

  const theme = widget?.data?.theme || 'aurora'
  const mode = widget?.data?.mode || 'attract'

  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const particlesRef = useRef(null)
  const mouseRef = useRef({ x: -9999, y: -9999, active: false })
  const rafRef = useRef(null)
  const sizeRef = useRef({ w: 0, h: 0 })

  // Re-color particles when theme changes
  const themeRef = useRef(theme)
  const modeRef = useRef(mode)
  useEffect(() => { themeRef.current = theme }, [theme])
  useEffect(() => { modeRef.current = mode }, [mode])

  useEffect(() => {
    if (!particlesRef.current) return
    const colors = THEMES[theme]
    for (const p of particlesRef.current) {
      p.color = colors[Math.floor(Math.random() * colors.length)]
    }
  }, [theme])

  const setTheme = useCallback((t) => updateData(widgetId, { theme: t }), [widgetId, updateData])
  const setMode = useCallback((m) => updateData(widgetId, { mode: m }), [widgetId, updateData])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')

    // Sizing
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

      // Initialise particles on first size or re-clamp
      if (!particlesRef.current) {
        const colors = THEMES[themeRef.current]
        particlesRef.current = Array.from({ length: NUM_PARTICLES }, () =>
          createParticle(w, h, colors)
        )
      } else {
        for (const p of particlesRef.current) {
          if (p.x > w) p.x = Math.random() * w
          if (p.y > h) p.y = Math.random() * h
        }
      }
    }

    const ro = new ResizeObserver(resize)
    ro.observe(container)
    resize()

    // Animation loop
    const tick = () => {
      const { w, h } = sizeRef.current
      const particles = particlesRef.current
      if (!particles || w === 0) { rafRef.current = requestAnimationFrame(tick); return }

      // Trail fade
      ctx.fillStyle = 'rgba(10, 10, 20, 0.05)'
      ctx.fillRect(0, 0, w, h)

      const mx = mouseRef.current.x
      const my = mouseRef.current.y
      const mouseActive = mouseRef.current.active
      const currentMode = modeRef.current

      // Update physics
      for (const p of particles) {
        // Random drift
        p.vx += (Math.random() - 0.5) * DRIFT_FORCE
        p.vy += (Math.random() - 0.5) * DRIFT_FORCE

        // Mouse interaction
        if (mouseActive) {
          const dx = mx - p.x
          const dy = my - p.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < INTERACTION_RADIUS && dist > 1) {
            const force = (1 - dist / INTERACTION_RADIUS) * 0.6
            const nx = dx / dist
            const ny = dy / dist

            if (currentMode === 'attract') {
              p.vx += nx * force
              p.vy += ny * force
            } else if (currentMode === 'repel') {
              p.vx -= nx * force * 1.2
              p.vy -= ny * force * 1.2
            } else {
              // orbit — tangential force + mild attraction
              p.vx += (-ny * force * 0.8) + (nx * force * 0.15)
              p.vy += ( nx * force * 0.8) + (ny * force * 0.15)
            }
          }
        }

        // Damping
        p.vx *= DAMPING
        p.vy *= DAMPING

        // Clamp velocity
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy)
        if (speed > 4) {
          p.vx = (p.vx / speed) * 4
          p.vy = (p.vy / speed) * 4
        }

        // Move
        p.x += p.vx
        p.y += p.vy

        // Bounce off edges
        if (p.x < p.radius) { p.x = p.radius; p.vx *= -0.7 }
        if (p.x > w - p.radius) { p.x = w - p.radius; p.vx *= -0.7 }
        if (p.y < p.radius) { p.y = p.radius; p.vy *= -0.7 }
        if (p.y > h - p.radius) { p.y = h - p.radius; p.vy *= -0.7 }
      }

      // Connection lines — use spatial bucketing for performance
      const bucketSize = CONNECTION_DIST
      const cols = Math.ceil(w / bucketSize) + 1
      const buckets = new Map()

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        const col = Math.floor(p.x / bucketSize)
        const row = Math.floor(p.y / bucketSize)
        const key = row * cols + col
        if (!buckets.has(key)) buckets.set(key, [])
        buckets.get(key).push(i)
      }

      ctx.lineWidth = 0.5
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i]
        const col = Math.floor(a.x / bucketSize)
        const row = Math.floor(a.y / bucketSize)

        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const key = (row + dr) * cols + (col + dc)
            const bucket = buckets.get(key)
            if (!bucket) continue
            for (const j of bucket) {
              if (j <= i) continue
              const b = particles[j]
              const dx = a.x - b.x
              const dy = a.y - b.y
              const dist = Math.sqrt(dx * dx + dy * dy)
              if (dist < CONNECTION_DIST) {
                const alpha = (1 - dist / CONNECTION_DIST) * 0.15
                ctx.strokeStyle = a.color.slice(0, 7) + Math.round(alpha * 255).toString(16).padStart(2, '0')
                ctx.beginPath()
                ctx.moveTo(a.x, a.y)
                ctx.lineTo(b.x, b.y)
                ctx.stroke()
              }
            }
          }
        }
      }

      // Draw particles with glow
      for (const p of particles) {
        ctx.save()
        ctx.shadowBlur = 8
        ctx.shadowColor = p.color
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      ro.disconnect()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, []) // intentionally stable — theme/mode read via refs

  const handleMouseMove = useCallback((e) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    mouseRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      active: true,
    }
  }, [])

  const handleMouseLeave = useCallback(() => {
    mouseRef.current = { x: -9999, y: -9999, active: false }
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        margin: -14,
        width: 'calc(100% + 28px)',
        height: 'calc(100% + 28px)',
        overflow: 'hidden',
        borderRadius: '0 0 12px 12px',
        background: '#0a0a14',
      }}
    >
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />

      {/* Theme selector — top left */}
      <div style={{
        position: 'absolute', top: 8, left: 8,
        display: 'flex', gap: 5, alignItems: 'center',
      }}>
        {THEME_KEYS.map(t => (
          <button
            key={t}
            onClick={() => setTheme(t)}
            title={t}
            style={{
              width: 14, height: 14, borderRadius: '50%',
              border: theme === t ? '2px solid rgba(255,255,255,0.7)' : '1.5px solid rgba(255,255,255,0.15)',
              background: THEMES[t][0],
              cursor: 'pointer', padding: 0,
              boxShadow: theme === t ? `0 0 6px ${THEMES[t][0]}` : 'none',
              transition: 'border 0.2s, box-shadow 0.2s',
            }}
          />
        ))}
      </div>

      {/* Mode selector — top right */}
      <div style={{
        position: 'absolute', top: 8, right: 8,
        display: 'flex', gap: 4,
      }}>
        {MODES.map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              padding: '2px 8px',
              fontSize: 10, fontWeight: 500,
              fontFamily: 'inherit',
              borderRadius: 9,
              border: 'none',
              cursor: 'pointer',
              color: mode === m ? '#fff' : 'rgba(255,255,255,0.5)',
              background: mode === m ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)',
              transition: 'background 0.2s, color 0.2s',
              lineHeight: '16px',
              letterSpacing: '0.3px',
              textTransform: 'capitalize',
            }}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  )
}
