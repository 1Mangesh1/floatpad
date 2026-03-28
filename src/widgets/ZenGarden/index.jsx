import { useRef, useState, useCallback, useEffect } from 'react'
import { useWidgetStore } from '../../store/widgetStore'

const SAND_BG = '#1a1610'
const LINE_COLOR = 'rgba(255,235,200,'
const DEFAULT_STONES = [
  { x: 0.25, y: 0.35, r: 18, shade: 0.45 },
  { x: 0.65, y: 0.55, r: 14, shade: 0.35 },
  { x: 0.45, y: 0.75, r: 11, shade: 0.5 },
]
const MAX_STONES = 8

export function ZenGarden({ widgetId }) {
  const widget = useWidgetStore(s => s.widgets.find(w => w.id === widgetId))
  const updateData = useWidgetStore(s => s.updateData)

  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const ctxRef = useRef(null)
  const sizeRef = useRef({ w: 0, h: 0 })
  const isDrawingRef = useRef(false)
  const pointsRef = useRef([])
  const animFrameRef = useRef(null)

  const stonesData = widget?.data?.stones ?? DEFAULT_STONES
  const rakeWidthData = widget?.data?.rakeWidth ?? 5
  const toolData = widget?.data?.tool ?? 'rake'

  const [tool, setTool] = useState(toolData)
  const [rakeWidth, setRakeWidth] = useState(rakeWidthData)
  const [stones, setStones] = useState(stonesData)

  const toolRef = useRef(tool)
  const rakeWidthRef = useRef(rakeWidth)
  const stonesRef = useRef(stones)

  toolRef.current = tool
  rakeWidthRef.current = rakeWidth
  stonesRef.current = stones

  // --- Sand texture generation ---
  const drawSandTexture = useCallback((ctx, w, h) => {
    const dpr = window.devicePixelRatio || 1
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)

    // Base fill
    ctx.fillStyle = SAND_BG
    ctx.fillRect(0, 0, w * dpr, h * dpr)

    // Random subtle noise dots
    const dotCount = Math.floor((w * h) / 8)
    for (let i = 0; i < dotCount; i++) {
      const dx = Math.random() * w * dpr
      const dy = Math.random() * h * dpr
      const alpha = Math.random() * 0.06 + 0.01
      const warm = Math.random() > 0.5
      ctx.fillStyle = warm
        ? `rgba(255,230,180,${alpha})`
        : `rgba(180,160,130,${alpha})`
      const sz = Math.random() * 1.5 + 0.5
      ctx.fillRect(dx, dy, sz, sz)
    }

    ctx.restore()
  }, [])

  // --- Draw a single stone ---
  const drawStone = useCallback((ctx, cx, cy, r, shade) => {
    // Shadow
    ctx.save()
    ctx.beginPath()
    ctx.ellipse(cx + 3, cy + 4, r * 0.9, r * 0.5, 0.15, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.filter = 'blur(4px)'
    ctx.fill()
    ctx.filter = 'none'
    ctx.restore()

    // Stone body with radial gradient
    const baseGray = Math.floor(shade * 100 + 40)
    const lightGray = Math.min(baseGray + 50, 180)
    const darkGray = Math.max(baseGray - 30, 20)

    const grad = ctx.createRadialGradient(
      cx - r * 0.3, cy - r * 0.3, r * 0.1,
      cx, cy, r
    )
    grad.addColorStop(0, `rgb(${lightGray},${lightGray - 5},${lightGray - 10})`)
    grad.addColorStop(0.6, `rgb(${baseGray},${baseGray - 3},${baseGray - 8})`)
    grad.addColorStop(1, `rgb(${darkGray},${darkGray - 2},${darkGray - 5})`)

    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle = grad
    ctx.fill()

    // Subtle edge definition
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(0,0,0,0.25)`
    ctx.lineWidth = 0.5
    ctx.stroke()

    // Highlight
    ctx.beginPath()
    ctx.arc(cx - r * 0.25, cy - r * 0.25, r * 0.35, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255,255,255,0.07)`
    ctx.fill()
  }, [])

  // --- Draw all stones ---
  const drawAllStones = useCallback((ctx, w, h) => {
    const currentStones = stonesRef.current
    for (const s of currentStones) {
      drawStone(ctx, s.x * w, s.y * h, s.r, s.shade)
    }
  }, [drawStone])

  // --- Redraw full scene (sand + stones, no rake lines) ---
  const redrawScene = useCallback(() => {
    const ctx = ctxRef.current
    const { w, h } = sizeRef.current
    if (!ctx || w === 0) return
    drawSandTexture(ctx, w, h)
    drawAllStones(ctx, w, h)
  }, [drawSandTexture, drawAllStones])

  // --- Rake line drawing ---
  const drawRakeSegment = useCallback((ctx, x1, y1, x2, y2, numLines) => {
    const dx = x2 - x1
    const dy = y2 - y1
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len < 1) return

    // Perpendicular direction
    const px = -dy / len
    const py = dx / len

    const spacing = 4
    const totalWidth = (numLines - 1) * spacing
    const startOffset = -totalWidth / 2

    for (let i = 0; i < numLines; i++) {
      const offset = startOffset + i * spacing
      const ox = px * offset
      const oy = py * offset

      // Variation in opacity for natural look
      const centerDist = Math.abs(i - (numLines - 1) / 2) / ((numLines - 1) / 2 || 1)
      const baseAlpha = 0.15 - centerDist * 0.04

      // Groove simulation: slightly darker on one side, lighter on the other
      const darkAlpha = baseAlpha + 0.03
      const lightAlpha = baseAlpha - 0.02

      // Dark side of groove
      ctx.beginPath()
      ctx.moveTo(x1 + ox - px * 0.5, y1 + oy - py * 0.5)
      ctx.lineTo(x2 + ox - px * 0.5, y2 + oy - py * 0.5)
      ctx.strokeStyle = `rgba(80,65,40,${darkAlpha})`
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Light side of groove
      ctx.beginPath()
      ctx.moveTo(x1 + ox + px * 0.5, y1 + oy + py * 0.5)
      ctx.lineTo(x2 + ox + px * 0.5, y2 + oy + py * 0.5)
      ctx.strokeStyle = `${LINE_COLOR}${lightAlpha + 0.05})`
      ctx.lineWidth = 1
      ctx.stroke()

      // Center line
      ctx.beginPath()
      ctx.moveTo(x1 + ox, y1 + oy)
      ctx.lineTo(x2 + ox, y2 + oy)
      ctx.strokeStyle = `${LINE_COLOR}${baseAlpha})`
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }, [])

  // Smoothed rake drawing using quadratic bezier curves
  const drawRakeSmooth = useCallback((ctx, points, numLines) => {
    if (points.length < 2) return

    const spacing = 4
    const totalWidth = (numLines - 1) * spacing
    const startOffset = -totalWidth / 2

    for (let i = 0; i < numLines; i++) {
      const offset = startOffset + i * spacing
      const centerDist = Math.abs(i - (numLines - 1) / 2) / ((numLines - 1) / 2 || 1)
      const baseAlpha = 0.15 - centerDist * 0.04

      // Build offset points along perpendicular
      const offsetPoints = []
      for (let j = 0; j < points.length; j++) {
        let px, py
        if (j === 0) {
          const dx = points[1].x - points[0].x
          const dy = points[1].y - points[0].y
          const len = Math.sqrt(dx * dx + dy * dy) || 1
          px = -dy / len
          py = dx / len
        } else {
          const dx = points[j].x - points[j - 1].x
          const dy = points[j].y - points[j - 1].y
          const len = Math.sqrt(dx * dx + dy * dy) || 1
          px = -dy / len
          py = dx / len
        }
        offsetPoints.push({
          x: points[j].x + px * offset,
          y: points[j].y + py * offset,
        })
      }

      // Dark groove line
      ctx.beginPath()
      ctx.moveTo(offsetPoints[0].x, offsetPoints[0].y)
      for (let j = 1; j < offsetPoints.length - 1; j++) {
        const midX = (offsetPoints[j].x + offsetPoints[j + 1].x) / 2
        const midY = (offsetPoints[j].y + offsetPoints[j + 1].y) / 2
        ctx.quadraticCurveTo(offsetPoints[j].x, offsetPoints[j].y, midX, midY)
      }
      const last = offsetPoints[offsetPoints.length - 1]
      ctx.lineTo(last.x, last.y)
      ctx.strokeStyle = `rgba(80,65,40,${baseAlpha + 0.03})`
      ctx.lineWidth = 1.8
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.stroke()

      // Light groove highlight
      const lightOffsetPoints = offsetPoints.map((p, j) => {
        let lpx, lpy
        if (j === 0) {
          const dx = points[1].x - points[0].x
          const dy = points[1].y - points[0].y
          const len = Math.sqrt(dx * dx + dy * dy) || 1
          lpx = -dy / len
          lpy = dx / len
        } else {
          const dx = points[j].x - points[j - 1].x
          const dy = points[j].y - points[j - 1].y
          const len = Math.sqrt(dx * dx + dy * dy) || 1
          lpx = -dy / len
          lpy = dx / len
        }
        return { x: p.x + lpx * 1, y: p.y + lpy * 1 }
      })

      ctx.beginPath()
      ctx.moveTo(lightOffsetPoints[0].x, lightOffsetPoints[0].y)
      for (let j = 1; j < lightOffsetPoints.length - 1; j++) {
        const midX = (lightOffsetPoints[j].x + lightOffsetPoints[j + 1].x) / 2
        const midY = (lightOffsetPoints[j].y + lightOffsetPoints[j + 1].y) / 2
        ctx.quadraticCurveTo(lightOffsetPoints[j].x, lightOffsetPoints[j].y, midX, midY)
      }
      const lastL = lightOffsetPoints[lightOffsetPoints.length - 1]
      ctx.lineTo(lastL.x, lastL.y)
      ctx.strokeStyle = `${LINE_COLOR}${baseAlpha + 0.06})`
      ctx.lineWidth = 0.8
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.stroke()
    }
  }, [])

  // --- Circle ripple pattern ---
  const drawCirclePattern = useCallback((ctx, cx, cy) => {
    const rings = 6
    for (let i = 1; i <= rings; i++) {
      const r = i * 12
      const alpha = 0.18 - i * 0.02
      if (alpha <= 0) continue

      // Dark inner edge
      ctx.beginPath()
      ctx.arc(cx, cy, r - 0.5, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(80,65,40,${alpha + 0.02})`
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Light outer edge
      ctx.beginPath()
      ctx.arc(cx, cy, r + 0.5, 0, Math.PI * 2)
      ctx.strokeStyle = `${LINE_COLOR}${alpha + 0.04})`
      ctx.lineWidth = 0.8
      ctx.stroke()

      // Main ring
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.strokeStyle = `${LINE_COLOR}${alpha})`
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }, [])

  // --- Canvas position helper ---
  const getCanvasPos = useCallback((e) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }, [])

  // --- Mouse handlers ---
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return
    const pos = getCanvasPos(e)
    const ctx = ctxRef.current
    const { w, h } = sizeRef.current
    if (!ctx || w === 0) return

    const currentTool = toolRef.current

    if (currentTool === 'rake') {
      isDrawingRef.current = true
      pointsRef.current = [pos]
    } else if (currentTool === 'circle') {
      drawCirclePattern(ctx, pos.x, pos.y)
    } else if (currentTool === 'stone') {
      const currentStones = stonesRef.current
      if (currentStones.length >= MAX_STONES) return
      const newStone = {
        x: pos.x / w,
        y: pos.y / h,
        r: Math.random() * 8 + 10,
        shade: Math.random() * 0.3 + 0.3,
      }
      const updatedStones = [...currentStones, newStone]
      stonesRef.current = updatedStones
      setStones(updatedStones)
      updateData(widgetId, { stones: updatedStones })
      // Draw the new stone immediately
      drawStone(ctx, pos.x, pos.y, newStone.r, newStone.shade)
    }
  }, [getCanvasPos, drawCirclePattern, drawStone, updateData, widgetId])

  const handleMouseMove = useCallback((e) => {
    if (!isDrawingRef.current) return
    const ctx = ctxRef.current
    if (!ctx) return

    const pos = getCanvasPos(e)
    const pts = pointsRef.current

    // Only record point if moved enough distance
    const last = pts[pts.length - 1]
    const dx = pos.x - last.x
    const dy = pos.y - last.y
    if (dx * dx + dy * dy < 9) return // minimum 3px movement

    pts.push(pos)

    // Draw the last segment using smooth bezier if we have enough points
    if (pts.length >= 3) {
      const recent = pts.slice(-4) // last 4 points for smooth curve
      drawRakeSmooth(ctx, recent, rakeWidthRef.current)
    } else if (pts.length === 2) {
      drawRakeSegment(
        ctx,
        pts[0].x, pts[0].y,
        pts[1].x, pts[1].y,
        rakeWidthRef.current
      )
    }
  }, [getCanvasPos, drawRakeSmooth, drawRakeSegment])

  const handleMouseUp = useCallback(() => {
    isDrawingRef.current = false
    pointsRef.current = []
  }, [])

  const handleMouseLeave = useCallback(() => {
    isDrawingRef.current = false
    pointsRef.current = []
  }, [])

  // --- Tool changes ---
  const handleToolChange = useCallback((newTool) => {
    setTool(newTool)
    updateData(widgetId, { tool: newTool })
  }, [widgetId, updateData])

  const handleRakeWidthChange = useCallback((e) => {
    const val = parseInt(e.target.value, 10)
    setRakeWidth(val)
    updateData(widgetId, { rakeWidth: val })
  }, [widgetId, updateData])

  const handleClear = useCallback(() => {
    redrawScene()
  }, [redrawScene])

  // --- Canvas setup + resize observer ---
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctxRef.current = ctx

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

      // Redraw clean scene
      drawSandTexture(ctx, w, h)
      drawAllStones(ctx, w, h)
    }

    const ro = new ResizeObserver(resize)
    ro.observe(container)
    resize()

    const animFrame = animFrameRef.current
    return () => {
      ro.disconnect()
      if (animFrame) cancelAnimationFrame(animFrame)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync stones from store when widget data changes externally
  useEffect(() => {
    if (widget?.data?.stones) {
      stonesRef.current = widget.data.stones
      setStones(widget.data.stones)
    }
  }, [widget?.data?.stones])

  if (!widget) return null

  const cursorForTool = {
    rake: 'crosshair',
    circle: 'cell',
    stone: stones.length >= MAX_STONES ? 'not-allowed' : 'copy',
  }

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
        background: SAND_BG,
        cursor: cursorForTool[tool] || 'crosshair',
      }}
    >
      <style>{`
        .zen-slider {
          -webkit-appearance: none;
          appearance: none;
          width: 70px;
          height: 3px;
          border-radius: 2px;
          background: rgba(255,235,200,0.12);
          outline: none;
          cursor: pointer;
        }
        .zen-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: rgba(255,235,200,0.6);
          border: none;
          cursor: pointer;
        }
        .zen-slider::-moz-range-thumb {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: rgba(255,235,200,0.6);
          border: none;
          cursor: pointer;
        }
        .zen-btn {
          background: rgba(255,235,200,0.06);
          border: 1px solid rgba(255,235,200,0.08);
          color: rgba(255,235,200,0.5);
          font-size: 10px;
          font-family: inherit;
          padding: 4px 10px;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.3s, color 0.3s;
          line-height: 14px;
          letter-spacing: 0.4px;
          white-space: nowrap;
          user-select: none;
        }
        .zen-btn:hover {
          background: rgba(255,235,200,0.12);
          color: rgba(255,235,200,0.8);
        }
        .zen-btn-active {
          background: rgba(255,235,200,0.15) !important;
          color: rgba(255,235,200,0.9) !important;
          border-color: rgba(255,235,200,0.2) !important;
        }
        .zen-toolbar {
          position: absolute;
          bottom: 8px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          background: rgba(18,14,8,0.88);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border-radius: 10px;
          border: 1px solid rgba(255,235,200,0.06);
          box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        }
        .zen-sep {
          width: 1px;
          height: 16px;
          background: rgba(255,235,200,0.08);
          flex-shrink: 0;
        }
      `}</style>

      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          touchAction: 'none',
        }}
      />

      {/* Bottom toolbar */}
      <div className="zen-toolbar">
        {/* Tool buttons */}
        <button
          className={`zen-btn ${tool === 'rake' ? 'zen-btn-active' : ''}`}
          onClick={() => handleToolChange('rake')}
          title="Rake - drag to draw parallel lines"
        >
          Rake
        </button>
        <button
          className={`zen-btn ${tool === 'circle' ? 'zen-btn-active' : ''}`}
          onClick={() => handleToolChange('circle')}
          title="Circle - click for ripple pattern"
        >
          Circle
        </button>
        <button
          className={`zen-btn ${tool === 'stone' ? 'zen-btn-active' : ''}`}
          onClick={() => handleToolChange('stone')}
          title={stones.length >= MAX_STONES ? `Max ${MAX_STONES} stones` : 'Place a stone'}
          style={stones.length >= MAX_STONES && tool === 'stone' ? { opacity: 0.4 } : {}}
        >
          Stone
        </button>

        <div className="zen-sep" />

        {/* Rake width slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{
            fontSize: 9,
            color: 'rgba(255,235,200,0.35)',
            letterSpacing: '0.3px',
            userSelect: 'none',
          }}>
            Lines
          </span>
          <input
            type="range"
            className="zen-slider"
            min="1"
            max="7"
            step="1"
            value={rakeWidth}
            onChange={handleRakeWidthChange}
            title={`Rake lines: ${rakeWidth}`}
          />
          <span style={{
            fontSize: 9,
            color: 'rgba(255,235,200,0.35)',
            minWidth: 8,
            textAlign: 'center',
            userSelect: 'none',
          }}>
            {rakeWidth}
          </span>
        </div>

        <div className="zen-sep" />

        <button
          className="zen-btn"
          onClick={handleClear}
          title="Clear all rake patterns"
        >
          Clear
        </button>
      </div>
    </div>
  )
}
