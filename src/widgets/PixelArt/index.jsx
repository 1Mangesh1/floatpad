import { useRef, useState, useEffect, useCallback } from 'react'
import { useWidgetStore } from '../../store/widgetStore'

/* ── constants ──────────────────────────────────────────── */
const GRID = 16
const TOTAL = GRID * GRID

const PALETTE = [
  '#000000', '#ffffff', '#ff0000', '#ff8c00',
  '#ffdd00', '#22c55e', '#06b6d4', '#3b82f6',
  '#8b5cf6', '#ec4899', '#92400e', '#6b7280',
  '#166534', '#1e3a5f', '#7f1d1d', '#fcd9b6',
]

const TOOL_DEFS = [
  { id: 'pencil',  icon: '\u270F\uFE0F', tip: 'Pencil' },
  { id: 'eraser',  icon: '\uD83E\uDDF9',  tip: 'Eraser' },
  { id: 'fill',    icon: '\uD83E\uDEA3',   tip: 'Fill' },
  { id: 'picker',  icon: '\uD83D\uDCA7',  tip: 'Pick color' },
]

/* ── styles ─────────────────────────────────────────────── */
const STYLES = `
.pixel-wrap {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 6px;
  user-select: none;
  -webkit-user-select: none;
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 11px;
}

/* toolbar */
.pixel-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.pixel-tool-btn {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.15s;
}
.pixel-tool-btn:hover {
  background: rgba(255,255,255,0.08);
  border-color: rgba(255,255,255,0.18);
}
.pixel-tool-btn.pixel-active {
  background: rgba(255,255,255,0.1);
  border-color: rgba(160,180,255,0.6);
  box-shadow: 0 0 8px rgba(160,180,255,0.2);
}

/* color indicator in toolbar */
.pixel-cur-color {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 5px;
}
.pixel-cur-swatch {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 1px solid rgba(255,255,255,0.2);
}
.pixel-cur-hex {
  color: rgba(255,255,255,0.45);
  font-size: 10px;
  letter-spacing: 0.5px;
}

/* palette */
.pixel-palette {
  display: flex;
  gap: 3px;
  flex-wrap: wrap;
  flex-shrink: 0;
}
.pixel-pal-btn {
  width: 18px;
  height: 18px;
  border-radius: 3px;
  border: 1.5px solid transparent;
  cursor: pointer;
  transition: all 0.12s;
}
.pixel-pal-btn:hover {
  transform: scale(1.2);
  z-index: 1;
}
.pixel-pal-btn.pixel-pal-sel {
  border-color: rgba(255,255,255,0.8);
  box-shadow: 0 0 6px rgba(255,255,255,0.25);
}

/* canvas area */
.pixel-canvas-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  position: relative;
}
.pixel-canvas {
  image-rendering: pixelated;
  border-radius: 4px;
  cursor: crosshair;
}

/* bottom controls */
.pixel-bottom {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}
.pixel-btn {
  flex: 1;
  padding: 5px 0;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px;
  color: rgba(255,255,255,0.6);
  font-size: 10px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;
  text-align: center;
}
.pixel-btn:hover {
  background: rgba(255,255,255,0.08);
  border-color: rgba(255,255,255,0.18);
  color: rgba(255,255,255,0.85);
}
`

/* ── helpers ─────────────────────────────────────────────── */
function idx(r, c) { return r * GRID + c }

function floodFill(grid, startIdx, fillColor) {
  const target = grid[startIdx]
  if (target === fillColor) return grid
  const next = [...grid]
  const queue = [startIdx]
  const visited = new Set()
  visited.add(startIdx)

  while (queue.length > 0) {
    const i = queue.shift()
    const r = Math.floor(i / GRID)
    const c = i % GRID
    next[i] = fillColor

    const neighbors = [
      r > 0 ? idx(r - 1, c) : -1,
      r < GRID - 1 ? idx(r + 1, c) : -1,
      c > 0 ? idx(r, c - 1) : -1,
      c < GRID - 1 ? idx(r, c + 1) : -1,
    ]
    for (const ni of neighbors) {
      if (ni >= 0 && !visited.has(ni) && grid[ni] === target) {
        visited.add(ni)
        queue.push(ni)
      }
    }
  }
  return next
}

/* ════════════════════════════════════════════════════════════ */
export function PixelArt({ widgetId }) {
  const widget     = useWidgetStore(s => s.widgets.find(w => w.id === widgetId))
  const updateData = useWidgetStore(s => s.updateData)

  /* ── persisted data with defaults ─────────────────────── */
  const gridData = widget?.data?.grid   ?? new Array(TOTAL).fill(null)
  const color    = widget?.data?.color  ?? '#ffffff'
  const tool     = widget?.data?.tool   ?? 'pencil'
  const showGrid = widget?.data?.showGrid ?? true

  /* ── local state ──────────────────────────────────────── */
  const [hoverIdx, setHoverIdx] = useState(-1)

  /* ── refs ──────────────────────────────────────────────── */
  const canvasRef    = useRef(null)
  const wrapRef      = useRef(null)
  const paintingRef  = useRef(false)
  const gridRef      = useRef(gridData)
  const colorRef     = useRef(color)
  const toolRef      = useRef(tool)
  const showGridRef  = useRef(showGrid)
  const hoverRef     = useRef(-1)
  const cellSizeRef  = useRef(20)
  const saveTimer    = useRef(null)
  const styleRef     = useRef(null)

  /* keep refs in sync */
  gridRef.current     = gridData
  colorRef.current    = color
  toolRef.current     = tool
  showGridRef.current = showGrid

  /* ── drawing on canvas ────────────────────────────────── */
  const drawCanvas = useCallback(() => {
    const cvs = canvasRef.current
    if (!cvs) return
    const ctx = cvs.getContext('2d')
    const cs = cellSizeRef.current
    const size = cs * GRID

    cvs.width  = size
    cvs.height = size

    ctx.clearRect(0, 0, size, size)

    const g = gridRef.current
    const sg = showGridRef.current
    const hi = hoverRef.current

    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const i  = idx(r, c)
        const x  = c * cs
        const y  = r * cs
        const cv = g[i]

        /* base cell */
        if (cv) {
          ctx.fillStyle = cv
          ctx.fillRect(x, y, cs, cs)
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.02)'
          ctx.fillRect(x, y, cs, cs)
        }

        /* hover preview */
        if (i === hi && !paintingRef.current) {
          const tc = toolRef.current
          if (tc === 'pencil' || tc === 'fill') {
            ctx.fillStyle = colorRef.current
            ctx.globalAlpha = 0.3
            ctx.fillRect(x, y, cs, cs)
            ctx.globalAlpha = 1
          } else if (tc === 'eraser') {
            ctx.fillStyle = 'rgba(255,255,255,0.15)'
            ctx.fillRect(x, y, cs, cs)
          }
        }

        /* grid lines */
        if (sg) {
          ctx.strokeStyle = 'rgba(255,255,255,0.06)'
          ctx.lineWidth = 0.5
          ctx.strokeRect(x + 0.25, y + 0.25, cs - 0.5, cs - 0.5)
        }
      }
    }
  }, [])

  /* ── save helper ───────────────────────────────────────── */
  const save = useCallback((patch) => {
    /* grid updates apply to the ref immediately so drag-paint
       never loses intermediate cells, and drawCanvas picks
       them up on the next call. */
    if (patch.grid) {
      gridRef.current = patch.grid
      drawCanvas()
    }
    /* Debounce the store write to avoid flooding zustand on
       every mousemove. The final write re-reads gridRef to
       capture all accumulated cell changes. */
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      updateData(widgetId, patch.grid ? { ...patch, grid: gridRef.current } : patch)
    }, 80)
  }, [widgetId, updateData, drawCanvas])

  /* ── sizing ───────────────────────────────────────────── */
  const recalcSize = useCallback(() => {
    if (!wrapRef.current) return
    const rect = wrapRef.current.getBoundingClientRect()
    const available = Math.min(rect.width, rect.height)
    const cs = Math.max(8, Math.floor(available / GRID))
    cellSizeRef.current = cs

    const cvs = canvasRef.current
    if (cvs) {
      const px = cs * GRID
      cvs.style.width  = px + 'px'
      cvs.style.height = px + 'px'
    }
    drawCanvas()
  }, [drawCanvas])

  /* ── effect: mount + observe resize ───────────────────── */
  useEffect(() => {
    recalcSize()
    const ro = new ResizeObserver(() => recalcSize())
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [recalcSize])

  /* ── redraw on any data change ────────────────────────── */
  useEffect(() => { drawCanvas() }, [gridData, color, tool, showGrid, hoverIdx, drawCanvas])

  /* ── inject styles once ───────────────────────────────── */
  useEffect(() => {
    if (!styleRef.current) {
      const el = document.createElement('style')
      el.textContent = STYLES
      document.head.appendChild(el)
      styleRef.current = el
    }
    return () => {
      if (styleRef.current) {
        styleRef.current.remove()
        styleRef.current = null
      }
    }
  }, [])

  /* ── cell index from mouse event ──────────────────────── */
  const cellFromEvent = useCallback((e) => {
    const cvs = canvasRef.current
    if (!cvs) return -1
    const rect = cvs.getBoundingClientRect()
    const scaleX = cvs.width / rect.width
    const scaleY = cvs.height / rect.height
    const px = (e.clientX - rect.left) * scaleX
    const py = (e.clientY - rect.top) * scaleY
    const cs = cellSizeRef.current
    const c = Math.floor(px / cs)
    const r = Math.floor(py / cs)
    if (r < 0 || r >= GRID || c < 0 || c >= GRID) return -1
    return idx(r, c)
  }, [])

  /* ── paint a single cell ──────────────────────────────── */
  const paintCell = useCallback((i, isErase) => {
    if (i < 0) return
    const g = [...gridRef.current]
    if (isErase) {
      if (g[i] === null) return
      g[i] = null
    } else {
      if (g[i] === colorRef.current) return
      g[i] = colorRef.current
    }
    save({ grid: g })
  }, [save])

  /* ── mouse handlers ───────────────────────────────────── */
  const handleDown = useCallback((e) => {
    e.preventDefault()
    const i = cellFromEvent(e)
    if (i < 0) return
    paintingRef.current = true
    const t = toolRef.current
    const rightClick = e.button === 2

    if (rightClick || t === 'eraser') {
      paintCell(i, true)
    } else if (t === 'pencil') {
      paintCell(i, false)
    } else if (t === 'fill') {
      const filled = floodFill(gridRef.current, i, colorRef.current)
      save({ grid: filled })
    } else if (t === 'picker') {
      const picked = gridRef.current[i]
      if (picked) {
        save({ color: picked })
      }
    }
  }, [cellFromEvent, paintCell, save])

  const handleMove = useCallback((e) => {
    const i = cellFromEvent(e)
    hoverRef.current = i
    setHoverIdx(i)

    if (!paintingRef.current) return
    const t = toolRef.current
    const rightClick = e.buttons === 2
    if (rightClick || t === 'eraser') {
      paintCell(i, true)
    } else if (t === 'pencil') {
      paintCell(i, false)
    }
  }, [cellFromEvent, paintCell])

  const handleUp = useCallback(() => {
    paintingRef.current = false
  }, [])

  const handleLeave = useCallback(() => {
    paintingRef.current = false
    hoverRef.current = -1
    setHoverIdx(-1)
  }, [])

  const handleContext = useCallback((e) => {
    e.preventDefault()
  }, [])

  /* ── tool actions ─────────────────────────────────────── */
  const setTool  = (t)  => save({ tool: t })
  const setColor = (c)  => save({ color: c })
  const toggleGrid = () => save({ showGrid: !showGridRef.current })
  const clearGrid  = () => save({ grid: new Array(TOTAL).fill(null) })

  /* ── download PNG ─────────────────────────────────────── */
  const downloadPng = useCallback(() => {
    const scale = 512
    const cs = scale / GRID
    const offscreen = document.createElement('canvas')
    offscreen.width = scale
    offscreen.height = scale
    const ctx = offscreen.getContext('2d')

    /* transparent background */
    ctx.clearRect(0, 0, scale, scale)

    const g = gridRef.current
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const cv = g[idx(r, c)]
        if (cv) {
          ctx.fillStyle = cv
          ctx.fillRect(c * cs, r * cs, cs, cs)
        }
      }
    }

    const link = document.createElement('a')
    link.download = 'pixel-art.png'
    link.href = offscreen.toDataURL('image/png')
    link.click()
  }, [])

  /* ── render ───────────────────────────────────────────── */
  if (!widget) return null

  return (
    <div className="pixel-wrap">
      {/* ── toolbar ── */}
      <div className="pixel-toolbar">
        {TOOL_DEFS.map(t => (
          <button
            key={t.id}
            className={'pixel-tool-btn' + (tool === t.id ? ' pixel-active' : '')}
            title={t.tip}
            onClick={() => setTool(t.id)}
          >
            {t.icon}
          </button>
        ))}
        <div className="pixel-cur-color">
          <div className="pixel-cur-swatch" style={{ background: color }} />
          <span className="pixel-cur-hex">{color}</span>
        </div>
      </div>

      {/* ── palette ── */}
      <div className="pixel-palette">
        {PALETTE.map(c => (
          <button
            key={c}
            className={'pixel-pal-btn' + (color === c ? ' pixel-pal-sel' : '')}
            style={{ background: c }}
            title={c}
            onClick={() => setColor(c)}
          />
        ))}
      </div>

      {/* ── canvas ── */}
      <div className="pixel-canvas-wrap" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          className="pixel-canvas"
          onMouseDown={handleDown}
          onMouseMove={handleMove}
          onMouseUp={handleUp}
          onMouseLeave={handleLeave}
          onContextMenu={handleContext}
        />
      </div>

      {/* ── bottom controls ── */}
      <div className="pixel-bottom">
        <button className="pixel-btn" onClick={clearGrid}>Clear</button>
        <button className="pixel-btn" onClick={downloadPng}>Download PNG</button>
        <button className="pixel-btn" onClick={toggleGrid}>
          Grid {showGrid ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
  )
}
