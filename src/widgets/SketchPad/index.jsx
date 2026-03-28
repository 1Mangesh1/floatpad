import { useRef, useState, useCallback, useEffect } from 'react'
import { useWidgetStore } from '../../store/widgetStore'

const COLORS = ['#ffffff', '#ff4757', '#ffa502', '#2ed573', '#1e90ff', '#c084fc', '#ff6b81', '#eccc68']
const BRUSH_SIZES = [2, 5, 10]
const CANVAS_BG = '#0d0d1a'
const MAX_UNDO = 20
const SAVE_DEBOUNCE = 800

export function SketchPad({ widgetId }) {
  const widget = useWidgetStore(s => s.widgets.find(w => w.id === widgetId))
  const updateData = useWidgetStore(s => s.updateData)

  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const ctxRef = useRef(null)
  const isDrawingRef = useRef(false)
  const lastXRef = useRef(0)
  const lastYRef = useRef(0)
  const prevXRef = useRef(0)
  const prevYRef = useRef(0)
  const lastTimeRef = useRef(0)
  const undoStackRef = useRef([])
  const saveTimerRef = useRef(null)
  const sizeRef = useRef({ w: 0, h: 0 })
  const restoredRef = useRef(false)

  const [brushColor, setBrushColor] = useState(widget?.data?.brushColor ?? '#ffffff')
  const [brushSize, setBrushSize] = useState(widget?.data?.brushSize ?? 5)
  const [opacity, setOpacity] = useState(widget?.data?.opacity ?? 1.0)
  const [erasing, setErasing] = useState(false)
  const [undoCount, setUndoCount] = useState(0)

  // Keep refs for values used in event handlers
  const brushColorRef = useRef(brushColor)
  const brushSizeRef = useRef(brushSize)
  const opacityRef = useRef(opacity)
  const erasingRef = useRef(erasing)

  brushColorRef.current = brushColor
  brushSizeRef.current = brushSize
  opacityRef.current = opacity
  erasingRef.current = erasing

  // Persist tool settings
  const persistSettings = useCallback((patch) => {
    updateData(widgetId, patch)
  }, [widgetId, updateData])

  const handleColorChange = useCallback((c) => {
    setBrushColor(c)
    setErasing(false)
    persistSettings({ brushColor: c })
  }, [persistSettings])

  const handleSizeChange = useCallback((s) => {
    setBrushSize(s)
    persistSettings({ brushSize: s })
  }, [persistSettings])

  const handleOpacityChange = useCallback((e) => {
    const val = parseFloat(e.target.value)
    setOpacity(val)
    persistSettings({ opacity: val })
  }, [persistSettings])

  const handleEraserToggle = useCallback(() => {
    setErasing(prev => !prev)
  }, [])

  // Debounced save of canvas data
  const saveCanvas = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const dataURL = canvas.toDataURL('image/png')
      updateData(widgetId, { canvasData: dataURL })
    }, SAVE_DEBOUNCE)
  }, [widgetId, updateData])

  // Push current canvas state to undo stack
  const pushUndo = useCallback(() => {
    const ctx = ctxRef.current
    const { w, h } = sizeRef.current
    if (!ctx || w === 0) return
    const dpr = window.devicePixelRatio || 1
    const imgData = ctx.getImageData(0, 0, w * dpr, h * dpr)
    undoStackRef.current.push(imgData)
    if (undoStackRef.current.length > MAX_UNDO) {
      undoStackRef.current.shift()
    }
    setUndoCount(undoStackRef.current.length)
  }, [])

  const handleUndo = useCallback(() => {
    const stack = undoStackRef.current
    if (stack.length === 0) return
    const imgData = stack.pop()
    const ctx = ctxRef.current
    if (!ctx) return
    ctx.putImageData(imgData, 0, 0)
    setUndoCount(stack.length)
    saveCanvas()
  }, [saveCanvas])

  const handleClear = useCallback(() => {
    const ctx = ctxRef.current
    const { w, h } = sizeRef.current
    if (!ctx || w === 0) return
    pushUndo()
    const dpr = window.devicePixelRatio || 1
    ctx.fillStyle = CANVAS_BG
    ctx.fillRect(0, 0, w * dpr, h * dpr)
    saveCanvas()
  }, [pushUndo, saveCanvas])

  const handleDownload = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `sketch-${Date.now()}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }, [])

  // Canvas setup + resize observer
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

      // Save current drawing before resizing
      let prevImage = null
      if (sizeRef.current.w > 0 && sizeRef.current.h > 0) {
        prevImage = ctx.getImageData(0, 0, canvas.width, canvas.height)
      }

      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      sizeRef.current = { w, h }

      // Fill background
      ctx.fillStyle = CANVAS_BG
      ctx.fillRect(0, 0, w, h)

      // Restore previous drawing if resizing
      if (prevImage) {
        ctx.putImageData(prevImage, 0, 0)
      }

      // Restore from persisted data on first mount
      if (!restoredRef.current && widget?.data?.canvasData) {
        restoredRef.current = true
        const img = new Image()
        img.onload = () => {
          ctx.setTransform(1, 0, 0, 1, 0, 0)
          ctx.drawImage(img, 0, 0)
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        }
        img.src = widget.data.canvasData
      } else if (!restoredRef.current) {
        restoredRef.current = true
      }
    }

    const ro = new ResizeObserver(resize)
    ro.observe(container)
    resize()

    return () => {
      ro.disconnect()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Drawing handlers
  const getCanvasPos = useCallback((e) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }, [])

  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return
    const ctx = ctxRef.current
    if (!ctx) return

    pushUndo()
    isDrawingRef.current = true
    const pos = getCanvasPos(e)
    lastXRef.current = pos.x
    lastYRef.current = pos.y
    prevXRef.current = pos.x
    prevYRef.current = pos.y
    lastTimeRef.current = performance.now()

    // Draw a dot for single clicks
    const color = erasingRef.current ? CANVAS_BG : brushColorRef.current
    ctx.globalAlpha = opacityRef.current
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = color
    ctx.lineWidth = brushSizeRef.current
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, brushSizeRef.current / 2, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
    ctx.globalAlpha = 1.0
  }, [getCanvasPos, pushUndo])

  const handleMouseMove = useCallback((e) => {
    if (!isDrawingRef.current) return
    const ctx = ctxRef.current
    if (!ctx) return

    const pos = getCanvasPos(e)
    const now = performance.now()
    const dt = now - lastTimeRef.current
    lastTimeRef.current = now

    // Pressure simulation: faster = thinner
    const dx = pos.x - lastXRef.current
    const dy = pos.y - lastYRef.current
    const dist = Math.sqrt(dx * dx + dy * dy)
    const speed = dt > 0 ? dist / dt : 0 // pixels per ms
    const pressureFactor = Math.max(0.3, Math.min(1.0, 1.0 - speed * 0.15))
    const dynamicSize = brushSizeRef.current * pressureFactor

    const color = erasingRef.current ? CANVAS_BG : brushColorRef.current

    ctx.globalAlpha = opacityRef.current
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = color
    ctx.lineWidth = dynamicSize

    // Quadratic bezier for smoothness: use midpoint between prev and current
    const midX = (lastXRef.current + pos.x) / 2
    const midY = (lastYRef.current + pos.y) / 2

    ctx.beginPath()
    ctx.moveTo(prevXRef.current, prevYRef.current)
    ctx.quadraticCurveTo(lastXRef.current, lastYRef.current, midX, midY)
    ctx.stroke()

    prevXRef.current = midX
    prevYRef.current = midY
    lastXRef.current = pos.x
    lastYRef.current = pos.y
    ctx.globalAlpha = 1.0
  }, [getCanvasPos])

  const handleMouseUp = useCallback(() => {
    if (!isDrawingRef.current) return
    isDrawingRef.current = false
    saveCanvas()
  }, [saveCanvas])

  const handleMouseLeave = useCallback(() => {
    if (!isDrawingRef.current) return
    isDrawingRef.current = false
    saveCanvas()
  }, [saveCanvas])

  // Cleanup save timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  if (!widget) return null

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
        background: CANVAS_BG,
        cursor: erasing ? 'crosshair' : 'default',
      }}
    >
      <style>{`
        .sketch-opacity-slider {
          -webkit-appearance: none;
          appearance: none;
          width: 60px;
          height: 3px;
          border-radius: 2px;
          background: rgba(255,255,255,0.15);
          outline: none;
          cursor: pointer;
        }
        .sketch-opacity-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: rgba(255,255,255,0.8);
          border: none;
          cursor: pointer;
        }
        .sketch-opacity-slider::-moz-range-thumb {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: rgba(255,255,255,0.8);
          border: none;
          cursor: pointer;
        }
        .sketch-btn {
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.65);
          font-size: 10px;
          font-family: inherit;
          padding: 3px 8px;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.2s, color 0.2s;
          line-height: 14px;
          letter-spacing: 0.3px;
          white-space: nowrap;
        }
        .sketch-btn:hover {
          background: rgba(255,255,255,0.15);
          color: rgba(255,255,255,0.9);
        }
        .sketch-btn-active {
          background: rgba(255,255,255,0.2) !important;
          color: #fff !important;
          border-color: rgba(255,255,255,0.25) !important;
        }
        .sketch-btn-danger:hover {
          background: rgba(255,71,87,0.25);
          color: #ff4757;
          border-color: rgba(255,71,87,0.3);
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

      {/* Top toolbar — floating */}
      <div style={{
        position: 'absolute',
        top: 8,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 10px',
        background: 'rgba(15,15,30,0.85)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      }}>
        {/* Brush sizes */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {BRUSH_SIZES.map(size => {
            const dotSize = Math.max(4, size + 2)
            const isActive = brushSize === size && !erasing
            return (
              <button
                key={size}
                onClick={() => handleSizeChange(size)}
                title={`${size}px`}
                style={{
                  width: 20,
                  height: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  border: 'none',
                  background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'background 0.2s',
                }}
              >
                <span style={{
                  display: 'block',
                  width: dotSize,
                  height: dotSize,
                  borderRadius: '50%',
                  background: isActive ? '#fff' : 'rgba(255,255,255,0.5)',
                  transition: 'background 0.2s',
                }} />
              </button>
            )
          })}
        </div>

        {/* Separator */}
        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)' }} />

        {/* Color swatches */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {COLORS.map(c => {
            const isActive = brushColor === c && !erasing
            return (
              <button
                key={c}
                onClick={() => handleColorChange(c)}
                title={c}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  border: isActive
                    ? `2px solid ${c}`
                    : '2px solid transparent',
                  background: c,
                  cursor: 'pointer',
                  padding: 0,
                  flexShrink: 0,
                  boxShadow: isActive ? `0 0 6px ${c}55` : 'none',
                  transition: 'border 0.2s, box-shadow 0.2s',
                  boxSizing: 'border-box',
                }}
              />
            )
          })}
        </div>

        {/* Separator */}
        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)' }} />

        {/* Eraser */}
        <button
          className={`sketch-btn ${erasing ? 'sketch-btn-active' : ''}`}
          onClick={handleEraserToggle}
          title="Eraser"
        >
          Eraser
        </button>

        {/* Separator */}
        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)' }} />

        {/* Opacity slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{
            fontSize: 9,
            color: 'rgba(255,255,255,0.4)',
            letterSpacing: '0.3px',
            userSelect: 'none',
          }}>
            Op
          </span>
          <input
            type="range"
            className="sketch-opacity-slider"
            min="0.2"
            max="1.0"
            step="0.05"
            value={opacity}
            onChange={handleOpacityChange}
            title={`Opacity: ${Math.round(opacity * 100)}%`}
          />
        </div>
      </div>

      {/* Bottom toolbar — floating */}
      <div style={{
        position: 'absolute',
        bottom: 8,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        background: 'rgba(15,15,30,0.85)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      }}>
        <button
          className="sketch-btn"
          onClick={handleUndo}
          disabled={undoCount === 0}
          title="Undo"
          style={undoCount === 0 ? { opacity: 0.35, cursor: 'default' } : {}}
        >
          Undo
        </button>
        <button
          className="sketch-btn sketch-btn-danger"
          onClick={handleClear}
          title="Clear canvas"
        >
          Clear
        </button>
        <button
          className="sketch-btn"
          onClick={handleDownload}
          title="Download as PNG"
        >
          Save PNG
        </button>
      </div>
    </div>
  )
}
