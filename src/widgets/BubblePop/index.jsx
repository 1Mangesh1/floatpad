import { useRef, useEffect, useCallback, useState } from 'react'
import { useWidgetStore } from '../../store/widgetStore'

/* ─── palette ─── */
const COLORS = ['#ff9ff3', '#feca57', '#48dbfb', '#ff6b6b', '#1dd1a1', '#c084fc', '#f368e0']

/* ─── helpers ─── */
let _bubbleId = 0
function nextId() { return ++_bubbleId }

function randomColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)]
}

function createBubble(canvasW, canvasH) {
  const radius = 20 + Math.random() * 30
  return {
    id: nextId(),
    x: radius + Math.random() * (canvasW - radius * 2),
    y: canvasH + radius,
    vy: -(0.3 + Math.random() * 0.5),          // upward speed
    radius,
    baseRadius: radius,
    color: randomColor(),
    phase: Math.random() * Math.PI * 2,         // for horizontal drift
    driftAmp: 0.3 + Math.random() * 0.5,        // sine amplitude px/frame
    driftFreq: 0.01 + Math.random() * 0.015,    // sine frequency
    breathPhase: Math.random() * Math.PI * 2,
    opacity: 1,
    popping: false,
    popTime: 0,
  }
}

function createParticles(x, y, color) {
  const count = 6 + Math.floor(Math.random() * 3) // 6-8
  const particles = []
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 / count) * i + (Math.random() - 0.5) * 0.4
    const speed = 1.5 + Math.random() * 2
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 2 + Math.random() * 3,
      color,
      life: 1, // 1 → 0
    })
  }
  return particles
}

/* ─── audio context (lazy singleton) ─── */
let _audioCtx = null
function getAudioCtx() {
  if (!_audioCtx) {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  return _audioCtx
}

function playPopSound() {
  try {
    const ctx = getAudioCtx()
    if (ctx.state === 'suspended') ctx.resume()

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(800 + Math.random() * 400, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.03)

    gain.gain.setValueAtTime(0.1, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.06)
  } catch (_) {
    /* audio failure is non-critical */
  }
}

/* ─── component ─── */
export function BubblePop({ widgetId }) {
  const widget = useWidgetStore(s => s.widgets.find(w => w.id === widgetId))
  const updateData = useWidgetStore(s => s.updateData)

  const totalPops = widget?.data?.totalPops ?? 0
  const highScore = widget?.data?.highScore ?? 0

  const [sessionPops, setSessionPops] = useState(0)

  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const rafRef = useRef(null)
  const sizeRef = useRef({ w: 0, h: 0 })
  const bubblesRef = useRef([])
  const particlesRef = useRef([])
  const spawnTimerRef = useRef(0)
  const frameRef = useRef(0)
  const sessionPopsRef = useRef(0)
  const totalPopsRef = useRef(totalPops)

  // Keep mutable refs in sync
  useEffect(() => { totalPopsRef.current = totalPops }, [totalPops])

  const persistPops = useCallback((newSession) => {
    const newTotal = totalPopsRef.current + 1
    const newHigh = Math.max(newSession, widget?.data?.highScore ?? 0)
    updateData(widgetId, { totalPops: newTotal, highScore: newHigh })
  }, [widgetId, updateData, widget?.data?.highScore])

  /* ─── click handler ─── */
  const handleClick = useCallback((e) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const scaleX = (canvas.width / dpr) / rect.width
    const scaleY = (canvas.height / dpr) / rect.height
    const mx = (e.clientX - rect.left) * scaleX
    const my = (e.clientY - rect.top) * scaleY

    const bubbles = bubblesRef.current
    // Check from front (last drawn) to back
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i]
      if (b.popping) continue
      const dx = mx - b.x
      const dy = my - b.y
      if (dx * dx + dy * dy <= b.radius * b.radius) {
        // Pop it
        b.popping = true
        b.popTime = 0

        // Particles
        particlesRef.current.push(...createParticles(b.x, b.y, b.color))

        // Sound
        playPopSound()

        // Score
        sessionPopsRef.current += 1
        setSessionPops(sessionPopsRef.current)
        persistPops(sessionPopsRef.current)

        break // only pop one
      }
    }
  }, [persistPops])

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
    }

    const ro = new ResizeObserver(resize)
    ro.observe(container)
    resize()

    const tick = () => {
      frameRef.current++
      const { w, h } = sizeRef.current
      if (w === 0 || h === 0) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }

      const bubbles = bubblesRef.current
      const particles = particlesRef.current

      /* ── spawn ── */
      spawnTimerRef.current--
      if (spawnTimerRef.current <= 0 && bubbles.filter(b => !b.popping).length < 15) {
        bubbles.push(createBubble(w, h))
        // Next spawn in 0.8-1.5 seconds (~48-90 frames at 60fps)
        spawnTimerRef.current = 48 + Math.floor(Math.random() * 42)
      }

      /* ── update bubbles ── */
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i]

        if (b.popping) {
          b.popTime += 1 / 60
          const t = b.popTime / 0.2 // 0→1 over 0.2s
          b.radius = b.baseRadius * (1 + t * 0.5) // expand to 1.5x
          b.opacity = 1 - t
          if (t >= 1) {
            bubbles.splice(i, 1)
          }
          continue
        }

        // Float upward
        b.y += b.vy

        // Horizontal sine drift
        b.x += Math.sin(frameRef.current * b.driftFreq + b.phase) * b.driftAmp

        // Breathing radius
        b.breathPhase += 0.03
        b.radius = b.baseRadius + Math.sin(b.breathPhase) * 2

        // Remove if off top
        if (b.y + b.radius < -10) {
          bubbles.splice(i, 1)
        }
      }

      /* ── update particles ── */
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.x += p.vx
        p.y += p.vy
        p.vx *= 0.96
        p.vy *= 0.96
        p.life -= 1 / 24 // ~0.4s at 60fps
        p.radius *= 0.97
        if (p.life <= 0 || p.radius < 0.3) {
          particles.splice(i, 1)
        }
      }

      /* ── draw ── */
      ctx.clearRect(0, 0, w, h)

      // Background
      ctx.fillStyle = '#0a0a14'
      ctx.fillRect(0, 0, w, h)

      // Faint upward flow lines
      ctx.save()
      ctx.globalAlpha = 0.03
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1
      const flowOffset = (frameRef.current * 0.5) % 40
      for (let lx = 30; lx < w; lx += 60) {
        ctx.beginPath()
        for (let ly = h + 20 - flowOffset; ly > -20; ly -= 40) {
          const sx = lx + Math.sin(ly * 0.02 + lx * 0.01) * 8
          if (ly === h + 20 - flowOffset) {
            ctx.moveTo(sx, ly)
          } else {
            ctx.lineTo(sx, ly)
          }
        }
        ctx.stroke()
      }
      ctx.restore()

      // Draw bubbles
      for (const b of bubbles) {
        ctx.save()
        ctx.globalAlpha = Math.max(0, b.opacity ?? 1)

        // Glow
        ctx.shadowBlur = 12
        ctx.shadowColor = b.color + '4d' // ~0.3 opacity

        // Main radial gradient
        const grad = ctx.createRadialGradient(
          b.x - b.radius * 0.2, b.y - b.radius * 0.2, b.radius * 0.1,
          b.x, b.y, b.radius
        )
        grad.addColorStop(0, lightenColor(b.color, 60))
        grad.addColorStop(0.6, b.color)
        grad.addColorStop(1, darkenColor(b.color, 30))

        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2)
        ctx.fill()

        // White reflection highlight
        ctx.shadowBlur = 0
        ctx.shadowColor = 'transparent'
        const hlx = b.x - b.radius * 0.3
        const hly = b.y - b.radius * 0.3
        const hlr = b.radius * 0.18
        const hlGrad = ctx.createRadialGradient(hlx, hly, 0, hlx, hly, hlr)
        hlGrad.addColorStop(0, 'rgba(255,255,255,0.7)')
        hlGrad.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = hlGrad
        ctx.beginPath()
        ctx.arc(hlx, hly, hlr, 0, Math.PI * 2)
        ctx.fill()

        ctx.restore()
      }

      // Draw particles
      for (const p of particles) {
        ctx.save()
        ctx.globalAlpha = Math.max(0, p.life)
        ctx.fillStyle = p.color
        ctx.shadowBlur = 4
        ctx.shadowColor = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, Math.max(0, p.radius), 0, Math.PI * 2)
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
  }, [])

  return (
    <>
      <style>{`
        .bubble-wrapper {
          position: relative;
          margin: -14px;
          width: calc(100% + 28px);
          height: calc(100% + 28px);
          overflow: hidden;
          border-radius: 0 0 12px 12px;
          background: #0a0a14;
          cursor: pointer;
        }
        .bubble-canvas {
          display: block;
          width: 100%;
          height: 100%;
        }
        .bubble-score {
          position: absolute;
          top: 8px;
          right: 12px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.35);
          font-family: inherit;
          pointer-events: none;
          user-select: none;
          letter-spacing: 0.5px;
        }
        .bubble-stats {
          position: absolute;
          bottom: 8px;
          left: 12px;
          font-size: 10px;
          color: rgba(255, 255, 255, 0.2);
          font-family: inherit;
          pointer-events: none;
          user-select: none;
        }
      `}</style>

      <div className="bubble-wrapper" ref={containerRef}>
        <canvas
          ref={canvasRef}
          className="bubble-canvas"
          onClick={handleClick}
        />
        <div className="bubble-score">
          🫧 {sessionPops}
        </div>
        <div className="bubble-stats">
          all-time {totalPops} · best {highScore}
        </div>
      </div>
    </>
  )
}

/* ─── colour utils ─── */
function hexToRgb(hex) {
  const m = hex.replace('#', '')
  return {
    r: parseInt(m.substring(0, 2), 16),
    g: parseInt(m.substring(2, 4), 16),
    b: parseInt(m.substring(4, 6), 16),
  }
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(c =>
    Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')
  ).join('')
}

function lightenColor(hex, amount) {
  const { r, g, b } = hexToRgb(hex)
  return rgbToHex(
    r + (255 - r) * (amount / 100),
    g + (255 - g) * (amount / 100),
    b + (255 - b) * (amount / 100),
  )
}

function darkenColor(hex, amount) {
  const { r, g, b } = hexToRgb(hex)
  return rgbToHex(
    r * (1 - amount / 100),
    g * (1 - amount / 100),
    b * (1 - amount / 100),
  )
}
