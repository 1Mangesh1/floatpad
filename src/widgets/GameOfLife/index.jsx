import { useRef, useEffect, useCallback, useState } from 'react'
import { useWidgetStore } from '../../store/widgetStore'

/* ── colour themes ────────────────────────────────────── */
const THEMES = {
  bio:    { color: '#2ed573', label: 'Bio' },
  plasma: { color: '#c084fc', label: 'Plasma' },
  fire:   { color: '#ff4757', label: 'Fire' },
}

/* ── speed map ────────────────────────────────────────── */
const SPEEDS = { slow: 200, med: 100, fast: 50 }

/* ── preset patterns (relative coords) ────────────────── */
const PRESETS = {
  glider: {
    label: 'Glider',
    cells: [[0,1],[1,2],[2,0],[2,1],[2,2]],
  },
  rpentomino: {
    label: 'R-pento',
    cells: [[0,1],[0,2],[1,0],[1,1],[2,1]],
  },
  pulsar: {
    label: 'Pulsar',
    cells: (() => {
      // Classic period-3 oscillator (quarter then mirror)
      const q = [
        [2,1],[3,1],[4,1],[2,6],[3,6],[4,6],
        [1,2],[1,3],[1,4],[6,2],[6,3],[6,4],
      ]
      const full = []
      for (const [r, c] of q) {
        full.push([r, c], [-r, c], [r, -c], [-r, -c])
      }
      // dedupe
      const set = new Set(full.map(([r, c]) => `${r},${c}`))
      return [...set].map(s => s.split(',').map(Number))
    })(),
  },
  gospergun: {
    label: 'Gun',
    cells: [
      [0,24],
      [1,22],[1,24],
      [2,12],[2,13],[2,20],[2,21],[2,34],[2,35],
      [3,11],[3,15],[3,20],[3,21],[3,34],[3,35],
      [4,0],[4,1],[4,10],[4,16],[4,20],[4,21],
      [5,0],[5,1],[5,10],[5,14],[5,16],[5,17],[5,22],[5,24],
      [6,10],[6,16],[6,24],
      [7,11],[7,15],
      [8,12],[8,13],
    ],
  },
}

const CELL_SIZE = 8

/* ════════════════════════════════════════════════════════ */
export function GameOfLife({ widgetId }) {
  const widget     = useWidgetStore(s => s.widgets.find(w => w.id === widgetId))
  const updateData = useWidgetStore(s => s.updateData)

  const theme = widget?.data?.theme || 'bio'
  const speed = widget?.data?.speed || 'med'

  /* ── local (non-persisted) state ─────────────────────── */
  const [running, setRunning]   = useState(false)
  const [gen, setGen]           = useState(0)

  /* ── refs ─────────────────────────────────────────────── */
  const canvasRef     = useRef(null)
  const containerRef  = useRef(null)
  const rafRef        = useRef(null)
  const lastTickRef   = useRef(0)
  const sizeRef       = useRef({ w: 0, h: 0 })
  const colsRef       = useRef(0)
  const rowsRef       = useRef(0)

  // Grid: flat Float32Array storing intensity 0-1 (0 = dead, >0 alive/fading)
  const gridRef       = useRef(null)  // current intensities
  const aliveRef      = useRef(null)  // Uint8: 1 = alive, 0 = dead
  const nextAliveRef  = useRef(null)  // double-buffer

  const runningRef    = useRef(running)
  const speedRef      = useRef(speed)
  const themeRef      = useRef(theme)
  const genRef        = useRef(0)

  useEffect(() => { runningRef.current = running }, [running])
  useEffect(() => { speedRef.current   = speed },   [speed])
  useEffect(() => { themeRef.current   = theme },   [theme])

  /* ── helpers to save persisted state ─────────────────── */
  const setTheme = useCallback(t => updateData(widgetId, { theme: t }), [widgetId, updateData])
  const setSpeed = useCallback(s => updateData(widgetId, { speed: s }), [widgetId, updateData])

  /* ── initialise / resize grid arrays ─────────────────── */
  const ensureGrid = useCallback((cols, rows) => {
    const len = cols * rows
    if (!gridRef.current || gridRef.current.length !== len) {
      gridRef.current     = new Float32Array(len)
      aliveRef.current    = new Uint8Array(len)
      nextAliveRef.current = new Uint8Array(len)
    }
    colsRef.current = cols
    rowsRef.current = rows
  }, [])

  /* ── clear grid ──────────────────────────────────────── */
  const clearGrid = useCallback(() => {
    if (gridRef.current)  gridRef.current.fill(0)
    if (aliveRef.current) aliveRef.current.fill(0)
    genRef.current = 0
    setGen(0)
    setRunning(false)
  }, [])

  /* ── randomise ~30 % ─────────────────────────────────── */
  const randomise = useCallback(() => {
    const a = aliveRef.current
    const g = gridRef.current
    if (!a || !g) return
    for (let i = 0; i < a.length; i++) {
      const alive = Math.random() < 0.3 ? 1 : 0
      a[i] = alive
      g[i] = alive
    }
    genRef.current = 0
    setGen(0)
  }, [])

  /* ── place a preset centered ─────────────────────────── */
  const placePreset = useCallback((key) => {
    const preset = PRESETS[key]
    if (!preset || !aliveRef.current) return
    const cols = colsRef.current
    const rows = rowsRef.current
    // find bounding box
    let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity
    for (const [r, c] of preset.cells) {
      if (r < minR) minR = r; if (r > maxR) maxR = r
      if (c < minC) minC = c; if (c > maxC) maxC = c
    }
    const offR = Math.floor(rows / 2) - Math.floor((maxR + minR) / 2)
    const offC = Math.floor(cols / 2) - Math.floor((maxC + minC) / 2)
    clearGrid()
    const a = aliveRef.current
    const g = gridRef.current
    for (const [r, c] of preset.cells) {
      const rr = ((r + offR) % rows + rows) % rows
      const cc = ((c + offC) % cols + cols) % cols
      a[rr * cols + cc] = 1
      g[rr * cols + cc] = 1
    }
  }, [clearGrid])

  /* ── advance one generation ──────────────────────────── */
  const stepOnce = useCallback(() => {
    const cols = colsRef.current
    const rows = rowsRef.current
    const alive = aliveRef.current
    const next  = nextAliveRef.current
    if (!alive || !next) return

    for (let r = 0; r < rows; r++) {
      const rUp   = ((r - 1) + rows) % rows
      const rDown = (r + 1) % rows
      for (let c = 0; c < cols; c++) {
        const cLeft  = ((c - 1) + cols) % cols
        const cRight = (c + 1) % cols
        const neighbors =
          alive[rUp   * cols + cLeft]  + alive[rUp   * cols + c] + alive[rUp   * cols + cRight] +
          alive[r     * cols + cLeft]  +                           alive[r     * cols + cRight] +
          alive[rDown * cols + cLeft]  + alive[rDown * cols + c] + alive[rDown * cols + cRight]

        const idx = r * cols + c
        if (alive[idx]) {
          next[idx] = (neighbors === 2 || neighbors === 3) ? 1 : 0
        } else {
          next[idx] = neighbors === 3 ? 1 : 0
        }
      }
    }
    // swap buffers
    const tmp = aliveRef.current
    aliveRef.current    = nextAliveRef.current
    nextAliveRef.current = tmp

    genRef.current += 1
    setGen(genRef.current)
  }, [])

  /* ── drawing / paint (click & drag) ──────────────────── */
  const paintingRef = useRef(false)
  const paintValRef = useRef(1) // 1 = set alive, 0 = set dead

  const cellFromEvent = useCallback((e) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return null
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const c = Math.floor(x / CELL_SIZE)
    const r = Math.floor(y / CELL_SIZE)
    if (c < 0 || c >= colsRef.current || r < 0 || r >= rowsRef.current) return null
    return { r, c }
  }, [])

  const paintCell = useCallback((r, c) => {
    const idx = r * colsRef.current + c
    if (!aliveRef.current || !gridRef.current) return
    aliveRef.current[idx] = paintValRef.current
    gridRef.current[idx]  = paintValRef.current
  }, [])

  const handlePointerDown = useCallback((e) => {
    const cell = cellFromEvent(e)
    if (!cell) return
    paintingRef.current = true
    const idx = cell.r * colsRef.current + cell.c
    // toggle: if cell alive, erase; if dead, draw
    paintValRef.current = aliveRef.current[idx] ? 0 : 1
    paintCell(cell.r, cell.c)
    canvasRef.current?.setPointerCapture?.(e.pointerId)
  }, [cellFromEvent, paintCell])

  const handlePointerMove = useCallback((e) => {
    if (!paintingRef.current) return
    const cell = cellFromEvent(e)
    if (cell) paintCell(cell.r, cell.c)
  }, [cellFromEvent, paintCell])

  const handlePointerUp = useCallback(() => {
    paintingRef.current = false
  }, [])

  /* ── main canvas loop ────────────────────────────────── */
  useEffect(() => {
    const canvas    = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')

    const resize = () => {
      const rect = container.getBoundingClientRect()
      const w = Math.floor(rect.width)
      const h = Math.floor(rect.height)
      const dpr = window.devicePixelRatio || 1
      canvas.width  = w * dpr
      canvas.height = h * dpr
      canvas.style.width  = w + 'px'
      canvas.style.height = h + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      sizeRef.current = { w, h }

      const newCols = Math.floor(w / CELL_SIZE)
      const newRows = Math.floor(h / CELL_SIZE)

      // preserve old grid data on resize
      const oldCols = colsRef.current
      const oldRows = rowsRef.current
      const oldAlive = aliveRef.current ? Uint8Array.from(aliveRef.current) : null
      const oldGrid  = gridRef.current  ? Float32Array.from(gridRef.current) : null

      ensureGrid(newCols, newRows)

      if (oldAlive && oldGrid) {
        const minR = Math.min(oldRows, newRows)
        const minC = Math.min(oldCols, newCols)
        for (let r = 0; r < minR; r++) {
          for (let c = 0; c < minC; c++) {
            aliveRef.current[r * newCols + c] = oldAlive[r * oldCols + c]
            gridRef.current[r * newCols + c]  = oldGrid[r * oldCols + c]
          }
        }
      }
    }

    const ro = new ResizeObserver(resize)
    ro.observe(container)
    resize()

    /* ── render loop ───────────────────────────────────── */
    const tick = (timestamp) => {
      const { w, h } = sizeRef.current
      const cols = colsRef.current
      const rows = rowsRef.current
      const alive = aliveRef.current
      const grid  = gridRef.current
      if (!alive || !grid || w === 0) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }

      const interval = SPEEDS[speedRef.current] || 100

      // Game logic step (time-gated)
      if (runningRef.current && timestamp - lastTickRef.current >= interval) {
        lastTickRef.current = timestamp
        stepOnce()
      }

      // Update intensity ramps (every frame for smooth animation)
      const currentAlive = aliveRef.current
      for (let i = 0; i < grid.length; i++) {
        if (currentAlive[i]) {
          // ramp up
          if (grid[i] < 1) grid[i] = Math.min(1, grid[i] + 0.15)
        } else {
          // ramp down
          if (grid[i] > 0) grid[i] = Math.max(0, grid[i] - 0.06)
        }
      }

      // ── draw ──────────────────────────────────────────
      const themeColor = THEMES[themeRef.current]?.color || '#2ed573'

      // Dark background
      ctx.fillStyle = '#0a0a14'
      ctx.fillRect(0, 0, w, h)

      // Subtle grid lines
      ctx.strokeStyle = 'rgba(255,255,255,0.03)'
      ctx.lineWidth = 0.5
      for (let c = 0; c <= cols; c++) {
        const x = c * CELL_SIZE
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, rows * CELL_SIZE); ctx.stroke()
      }
      for (let r = 0; r <= rows; r++) {
        const y = r * CELL_SIZE
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cols * CELL_SIZE, y); ctx.stroke()
      }

      // Parse theme colour to RGB once per frame for alpha blending
      const tr = parseInt(themeColor.slice(1, 3), 16)
      const tg = parseInt(themeColor.slice(3, 5), 16)
      const tb = parseInt(themeColor.slice(5, 7), 16)

      // Draw cells
      ctx.save()
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const intensity = grid[r * cols + c]
          if (intensity <= 0.01) continue

          const x = c * CELL_SIZE + 1
          const y = r * CELL_SIZE + 1
          const s = CELL_SIZE - 2
          const radius = 2

          const alpha = intensity
          ctx.fillStyle = `rgba(${tr},${tg},${tb},${alpha.toFixed(2)})`

          // Glow only for brighter cells
          if (intensity > 0.3) {
            ctx.shadowBlur  = 6 * intensity
            ctx.shadowColor = themeColor
          } else {
            ctx.shadowBlur = 0
          }

          // Rounded rect
          ctx.beginPath()
          ctx.moveTo(x + radius, y)
          ctx.lineTo(x + s - radius, y)
          ctx.quadraticCurveTo(x + s, y, x + s, y + radius)
          ctx.lineTo(x + s, y + s - radius)
          ctx.quadraticCurveTo(x + s, y + s, x + s - radius, y + s)
          ctx.lineTo(x + radius, y + s)
          ctx.quadraticCurveTo(x, y + s, x, y + s - radius)
          ctx.lineTo(x, y + radius)
          ctx.quadraticCurveTo(x, y, x + radius, y)
          ctx.closePath()
          ctx.fill()
        }
      }
      ctx.restore()

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      ro.disconnect()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [ensureGrid, stepOnce])

  /* ── step button (advance one gen when paused) ───────── */
  const handleStep = useCallback(() => {
    if (!runningRef.current) stepOnce()
  }, [stepOnce])

  /* ── render ──────────────────────────────────────────── */
  const themeColor = THEMES[theme]?.color || '#2ed573'

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
        userSelect: 'none',
      }}
    >
      <style>{`
        .gol-toolbar {
          position: absolute;
          top: 0; left: 0; right: 0;
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 5px 8px;
          background: linear-gradient(180deg, rgba(10,10,20,0.92) 60%, rgba(10,10,20,0));
          z-index: 2;
          flex-wrap: wrap;
        }
        .gol-btn {
          padding: 2px 7px;
          font-size: 10px;
          font-weight: 500;
          font-family: inherit;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          color: rgba(255,255,255,0.7);
          background: rgba(255,255,255,0.08);
          transition: background 0.15s, color 0.15s;
          line-height: 16px;
          letter-spacing: 0.3px;
          white-space: nowrap;
        }
        .gol-btn:hover {
          background: rgba(255,255,255,0.16);
          color: #fff;
        }
        .gol-btn.gol-active {
          background: rgba(255,255,255,0.2);
          color: #fff;
        }
        .gol-sep {
          width: 1px;
          height: 14px;
          background: rgba(255,255,255,0.1);
          margin: 0 2px;
        }
        .gol-gen {
          font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
          font-size: 10px;
          color: rgba(255,255,255,0.45);
          margin-left: auto;
          white-space: nowrap;
          letter-spacing: 0.5px;
        }
        .gol-theme-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          border: 1.5px solid rgba(255,255,255,0.15);
          cursor: pointer;
          padding: 0;
          transition: border 0.2s, box-shadow 0.2s;
        }
      `}</style>

      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none' }}
      />

      {/* ── Toolbar ──────────────────────────────────────── */}
      <div className="gol-toolbar">
        {/* Play / Pause */}
        <button
          className={`gol-btn ${running ? 'gol-active' : ''}`}
          onClick={() => setRunning(r => !r)}
          title={running ? 'Pause' : 'Play'}
          style={running ? { color: themeColor } : {}}
        >
          {running ? '⏸' : '▶'}
        </button>

        {/* Step */}
        <button className="gol-btn" onClick={handleStep} title="Step">
          ⏭
        </button>

        <div className="gol-sep" />

        {/* Speed */}
        {Object.keys(SPEEDS).map(s => (
          <button
            key={s}
            className={`gol-btn ${speed === s ? 'gol-active' : ''}`}
            onClick={() => setSpeed(s)}
            style={speed === s ? { color: themeColor } : {}}
          >
            {s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}

        <div className="gol-sep" />

        {/* Clear / Random */}
        <button className="gol-btn" onClick={clearGrid}>Clear</button>
        <button className="gol-btn" onClick={randomise}>Rand</button>

        <div className="gol-sep" />

        {/* Presets */}
        {Object.entries(PRESETS).map(([key, { label }]) => (
          <button key={key} className="gol-btn" onClick={() => placePreset(key)}>
            {label}
          </button>
        ))}

        <div className="gol-sep" />

        {/* Theme dots */}
        {Object.entries(THEMES).map(([key, { color }]) => (
          <button
            key={key}
            className="gol-theme-dot"
            onClick={() => setTheme(key)}
            title={key}
            style={{
              background: color,
              border: theme === key
                ? '2px solid rgba(255,255,255,0.7)'
                : '1.5px solid rgba(255,255,255,0.15)',
              boxShadow: theme === key ? `0 0 6px ${color}` : 'none',
            }}
          />
        ))}

        {/* Generation counter */}
        <span className="gol-gen">Gen: {gen}</span>
      </div>
    </div>
  )
}
