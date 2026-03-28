import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import { useWidgetStore } from '../../store/widgetStore'

/* ── constants ───────────────────────────────────────── */
const NODE_W = 70
const NODE_H = 32
const NODE_RADIUS = 8
const GRID_SPACING = 20
const REPEL_DIST = 90
const REPEL_FORCE = 0.4
const SPRING_DIST = 160
const SPRING_FORCE = 0.005
const DAMPING = 0.88
const HIT_PADDING = 6

function uid() {
  return Math.random().toString(36).slice(2, 9)
}

function defaultNodes() {
  return [{ id: uid(), text: 'Start here', x: 0, y: 0 }]
}

/* ── hit testing ─────────────────────────────────────── */
function hitNode(nodes, mx, my, pan) {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i]
    const sx = n.x + pan.x
    const sy = n.y + pan.y
    const hw = NODE_W / 2 + HIT_PADDING
    const hh = NODE_H / 2 + HIT_PADDING
    if (mx >= sx - hw && mx <= sx + hw && my >= sy - hh && my <= sy + hh) {
      return n
    }
  }
  return null
}

/* ── measure text for auto-width ─────────────────────── */
function nodeWidth(ctx, text) {
  ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  const w = ctx.measureText(text).width
  return Math.max(NODE_W, w + 24)
}

/* ════════════════════════════════════════════════════════ */
export function DigitalGarden({ widgetId }) {
  const widget = useWidgetStore(s => s.widgets.find(w => w.id === widgetId))
  const updateData = useWidgetStore(s => s.updateData)

  /* persisted data */
  const nodes = widget?.data?.nodes || null
  const edges = useMemo(() => widget?.data?.edges || [], [widget?.data?.edges])
  const pan = useMemo(() => widget?.data?.pan || { x: 0, y: 0 }, [widget?.data?.pan])

  /* local state */
  const [connectMode, setConnectMode] = useState(false)
  const [connectFrom, setConnectFrom] = useState(null)
  const [selectedNode, setSelectedNode] = useState(null)
  const [editingNode, setEditingNode] = useState(null)
  const [editText, setEditText] = useState('')
  const [hoverNode, setHoverNode] = useState(null)
  const [editPos, setEditPos] = useState(null)
  const [nodeCount, setNodeCount] = useState(nodes?.length ?? 1)

  /* refs */
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const rafRef = useRef(null)
  const sizeRef = useRef({ w: 0, h: 0 })
  const nodesRef = useRef(null)
  const edgesRef = useRef(edges)
  const panRef = useRef(pan)
  const velocitiesRef = useRef({})
  const mouseRef = useRef({ x: 0, y: 0 })
  const draggingRef = useRef(null)       // { nodeId, offsetX, offsetY }
  const panningRef = useRef(false)
  const panStartRef = useRef({ x: 0, y: 0, px: 0, py: 0 })
  const spaceRef = useRef(false)
  const connectFromRef = useRef(null)
  const connectModeRef = useRef(false)
  const selectedRef = useRef(null)
  const hoverRef = useRef(null)
  const saveTimerRef = useRef(null)

  /* ── initialize nodes from store or defaults ────────── */
  useEffect(() => {
    if (!nodesRef.current) {
      nodesRef.current = nodes ? nodes.map(n => ({ ...n })) : defaultNodes()
      // centre the seed node
      if (!nodes) {
        const { w, h } = sizeRef.current
        if (w > 0) {
          nodesRef.current[0].x = w / 2 - panRef.current.x
          nodesRef.current[0].y = h / 2 - panRef.current.y
        }
      }
    }
  }, [nodes])

  /* ── sync edges from store ──────────────────────────── */
  useEffect(() => {
    edgesRef.current = edges
  }, [edges])

  /* ── sync pan from store ────────────────────────────── */
  useEffect(() => {
    panRef.current = pan
  }, [pan])

  /* keep refs in sync with state */
  useEffect(() => { connectFromRef.current = connectFrom }, [connectFrom])
  useEffect(() => { connectModeRef.current = connectMode }, [connectMode])
  useEffect(() => { selectedRef.current = selectedNode }, [selectedNode])
  useEffect(() => { hoverRef.current = hoverNode }, [hoverNode])

  /* ── debounced save ─────────────────────────────────── */
  const save = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const ns = nodesRef.current
      const es = edgesRef.current
      const p = panRef.current
      if (ns) {
        updateData(widgetId, {
          nodes: ns.map(n => ({ id: n.id, text: n.text, x: n.x, y: n.y })),
          edges: es.map(e => ({ from: e.from, to: e.to })),
          pan: { x: p.x, y: p.y },
        })
      }
    }, 400)
  }, [widgetId, updateData])

  /* ── canvas setup & render loop ─────────────────────── */
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

      // centre seed node if first mount
      if (nodesRef.current && nodesRef.current.length === 1 && nodesRef.current[0].x === 0 && nodesRef.current[0].y === 0) {
        nodesRef.current[0].x = w / 2 - panRef.current.x
        nodesRef.current[0].y = h / 2 - panRef.current.y
      }
    }

    const ro = new ResizeObserver(resize)
    ro.observe(container)
    resize()

    /* ── physics + draw ─────────────────────────────── */
    const tick = () => {
      const { w, h } = sizeRef.current
      const ns = nodesRef.current
      const es = edgesRef.current
      const p = panRef.current
      if (!ns || w === 0) { rafRef.current = requestAnimationFrame(tick); return }

      const vels = velocitiesRef.current

      /* physics — only when not dragging that specific node */
      for (let i = 0; i < ns.length; i++) {
        const a = ns[i]
        if (!vels[a.id]) vels[a.id] = { vx: 0, vy: 0 }
        if (draggingRef.current?.nodeId === a.id) { vels[a.id].vx = 0; vels[a.id].vy = 0; continue }

        let fx = 0, fy = 0

        // repulsion from all other nodes
        for (let j = 0; j < ns.length; j++) {
          if (i === j) continue
          const b = ns[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          if (dist < REPEL_DIST) {
            const f = REPEL_FORCE * (1 - dist / REPEL_DIST)
            fx += (dx / dist) * f
            fy += (dy / dist) * f
          }
        }

        // spring attraction for connected nodes
        for (const e of es) {
          let other = null
          if (e.from === a.id) other = ns.find(n => n.id === e.to)
          else if (e.to === a.id) other = ns.find(n => n.id === e.from)
          if (!other) continue
          const dx = other.x - a.x
          const dy = other.y - a.y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          if (dist > SPRING_DIST) {
            const f = SPRING_FORCE * (dist - SPRING_DIST)
            fx += (dx / dist) * f
            fy += (dy / dist) * f
          }
        }

        vels[a.id].vx = (vels[a.id].vx + fx) * DAMPING
        vels[a.id].vy = (vels[a.id].vy + fy) * DAMPING
        a.x += vels[a.id].vx
        a.y += vels[a.id].vy
      }

      /* ── draw ──────────────────────────────────────── */
      ctx.clearRect(0, 0, w, h)

      // background
      ctx.fillStyle = '#0a0a14'
      ctx.fillRect(0, 0, w, h)

      // dot grid
      ctx.fillStyle = 'rgba(255,255,255,0.025)'
      const startX = (p.x % GRID_SPACING + GRID_SPACING) % GRID_SPACING
      const startY = (p.y % GRID_SPACING + GRID_SPACING) % GRID_SPACING
      for (let gx = startX; gx < w; gx += GRID_SPACING) {
        for (let gy = startY; gy < h; gy += GRID_SPACING) {
          ctx.fillRect(gx - 0.5, gy - 0.5, 1, 1)
        }
      }

      /* draw edges */
      for (const e of es) {
        const from = ns.find(n => n.id === e.from)
        const to = ns.find(n => n.id === e.to)
        if (!from || !to) continue

        const x1 = from.x + p.x
        const y1 = from.y + p.y
        const x2 = to.x + p.x
        const y2 = to.y + p.y

        // quadratic bezier with midpoint offset
        const mx = (x1 + x2) / 2
        const my = (y1 + y2) / 2
        const dx = x2 - x1
        const dy = y2 - y1
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const off = Math.min(dist * 0.15, 30)
        const cx = mx + (-dy / dist) * off
        const cy = my + (dx / dist) * off

        ctx.save()
        ctx.strokeStyle = 'rgba(255,255,255,0.15)'
        ctx.lineWidth = 1.2
        ctx.shadowColor = 'rgba(16,185,129,0.15)'
        ctx.shadowBlur = 4
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.quadraticCurveTo(cx, cy, x2, y2)
        ctx.stroke()
        ctx.restore()
      }

      /* connecting line from source to cursor */
      if (connectFromRef.current) {
        const src = ns.find(n => n.id === connectFromRef.current)
        if (src) {
          const sx = src.x + p.x
          const sy = src.y + p.y
          const { x: mx2, y: my2 } = mouseRef.current
          ctx.save()
          ctx.strokeStyle = 'rgba(16,185,129,0.5)'
          ctx.lineWidth = 1.5
          ctx.setLineDash([5, 5])
          ctx.beginPath()
          ctx.moveTo(sx, sy)
          ctx.lineTo(mx2, my2)
          ctx.stroke()
          ctx.setLineDash([])
          ctx.restore()
        }
      }

      /* draw nodes */
      const now = Date.now()
      for (const n of ns) {
        const sx = n.x + p.x
        const sy = n.y + p.y

        // skip if off-screen
        if (sx < -100 || sx > w + 100 || sy < -100 || sy > h + 100) continue

        const nw = nodeWidth(ctx, n.text)
        const nh = NODE_H
        const isSelected = selectedRef.current === n.id
        const isHover = hoverRef.current === n.id
        const isConnectSource = connectFromRef.current === n.id

        ctx.save()

        // glow
        if (isSelected || isConnectSource) {
          ctx.shadowColor = 'rgba(16,185,129,0.6)'
          ctx.shadowBlur = 16
        } else if (isHover) {
          ctx.shadowColor = 'rgba(16,185,129,0.3)'
          ctx.shadowBlur = 10
        } else {
          ctx.shadowColor = 'rgba(16,185,129,0.15)'
          ctx.shadowBlur = 6
        }

        // body
        const bx = sx - nw / 2
        const by = sy - nh / 2
        ctx.beginPath()
        ctx.roundRect(bx, by, nw, nh, NODE_RADIUS)
        ctx.fillStyle = isSelected ? 'rgba(16,185,129,0.3)' : 'rgba(16,185,129,0.15)'
        ctx.fill()

        // border
        ctx.strokeStyle = isSelected
          ? 'rgba(16,185,129,0.8)'
          : isConnectSource
            ? `rgba(16,185,129,${0.4 + Math.sin(now / 200) * 0.3})`
            : isHover
              ? 'rgba(16,185,129,0.6)'
              : 'rgba(16,185,129,0.4)'
        ctx.lineWidth = isSelected ? 1.8 : 1.2
        ctx.stroke()
        ctx.restore()

        // text
        ctx.save()
        ctx.fillStyle = '#fff'
        ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(n.text, sx, sy + 0.5)
        ctx.restore()

        // close button on hover
        if (isHover && !connectModeRef.current) {
          const cbx = sx + nw / 2 - 4
          const cby = sy - nh / 2 - 4
          ctx.save()
          ctx.fillStyle = 'rgba(255,70,70,0.8)'
          ctx.beginPath()
          ctx.arc(cbx, cby, 7, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = '#fff'
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(cbx - 2.5, cby - 2.5)
          ctx.lineTo(cbx + 2.5, cby + 2.5)
          ctx.moveTo(cbx + 2.5, cby - 2.5)
          ctx.lineTo(cbx - 2.5, cby + 2.5)
          ctx.stroke()
          ctx.restore()
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      ro.disconnect()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, []) // stable — all mutable state via refs

  /* ── helpers ────────────────────────────────────────── */
  const deleteNode = useCallback((id) => {
    const ns = nodesRef.current
    if (!ns) return
    nodesRef.current = ns.filter(n => n.id !== id)
    edgesRef.current = edgesRef.current.filter(e => e.from !== id && e.to !== id)
    delete velocitiesRef.current[id]
    if (selectedRef.current === id) setSelectedNode(null)
    if (hoverRef.current === id) setHoverNode(null)
    setNodeCount(nodesRef.current.length)
    save()
  }, [save])

  const addNode = useCallback((x, y, text) => {
    const ns = nodesRef.current
    if (!ns) return
    const id = uid()
    const worldX = x - panRef.current.x
    const worldY = y - panRef.current.y
    ns.push({ id, text: text || 'New idea', x: worldX, y: worldY })
    velocitiesRef.current[id] = { vx: 0, vy: 0 }
    setSelectedNode(id)
    setNodeCount(ns.length)
    save()
    return id
  }, [save])

  const addNodeAtCenter = useCallback(() => {
    const { w, h } = sizeRef.current
    const id = addNode(w / 2, h / 2, 'New idea')
    if (id) {
      setEditingNode(id)
      setEditText('New idea')
    }
  }, [addNode])

  const clearAll = useCallback(() => {
    nodesRef.current = defaultNodes()
    const { w, h } = sizeRef.current
    nodesRef.current[0].x = w / 2
    nodesRef.current[0].y = h / 2
    edgesRef.current = []
    panRef.current = { x: 0, y: 0 }
    velocitiesRef.current = {}
    setSelectedNode(null)
    setConnectFrom(null)
    setConnectMode(false)
    setEditingNode(null)
    setNodeCount(1)
    save()
  }, [save])

  /* ── keyboard: space for pan ────────────────────────── */
  useEffect(() => {
    const onDown = (e) => {
      if (e.code === 'Space' && !e.repeat) {
        spaceRef.current = true
      }
      if (e.code === 'Escape') {
        setConnectMode(false)
        setConnectFrom(null)
        setEditingNode(null)
        setSelectedNode(null)
      }
      if ((e.code === 'Delete' || e.code === 'Backspace') && selectedRef.current && !editingNode) {
        deleteNode(selectedRef.current)
      }
    }
    const onUp = (e) => {
      if (e.code === 'Space') spaceRef.current = false
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [editingNode, deleteNode])

  /* ── close button hit test ──────────────────────────── */
  const hitClose = useCallback((node, mx, my) => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return false
    const nw = nodeWidth(ctx, node.text)
    const sx = node.x + panRef.current.x
    const sy = node.y + panRef.current.y
    const cbx = sx + nw / 2 - 4
    const cby = sy - NODE_H / 2 - 4
    const dx = mx - cbx
    const dy = my - cby
    return dx * dx + dy * dy <= 9 * 9 // 9px radius for easy clicking
  }, [])

  /* ── mouse handlers ─────────────────────────────────── */
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    mouseRef.current = { x: mx, y: my }

    const ns = nodesRef.current
    if (!ns) return

    // space+drag = pan
    if (spaceRef.current) {
      panningRef.current = true
      panStartRef.current = { x: mx, y: my, px: panRef.current.x, py: panRef.current.y }
      return
    }

    const hit = hitNode(ns, mx, my, panRef.current)

    if (hit) {
      // check close button first
      if (!connectModeRef.current && hoverRef.current === hit.id && hitClose(hit, mx, my)) {
        deleteNode(hit.id)
        return
      }

      if (connectModeRef.current) {
        if (!connectFromRef.current) {
          setConnectFrom(hit.id)
        } else if (connectFromRef.current !== hit.id) {
          // create edge if not duplicate
          const already = edgesRef.current.some(
            e => (e.from === connectFromRef.current && e.to === hit.id) ||
                 (e.to === connectFromRef.current && e.from === hit.id)
          )
          if (!already) {
            edgesRef.current = [...edgesRef.current, { from: connectFromRef.current, to: hit.id }]
          }
          setConnectFrom(null)
          save()
        }
        setSelectedNode(hit.id)
        return
      }

      // start dragging
      draggingRef.current = {
        nodeId: hit.id,
        offsetX: mx - (hit.x + panRef.current.x),
        offsetY: my - (hit.y + panRef.current.y),
      }
      setSelectedNode(hit.id)
    } else {
      // clicked empty space — start panning
      panningRef.current = true
      panStartRef.current = { x: mx, y: my, px: panRef.current.x, py: panRef.current.y }
      setSelectedNode(null)
      if (connectModeRef.current) setConnectFrom(null)
    }
  }, [deleteNode, hitClose, save])

  const handleMouseMove = useCallback((e) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    mouseRef.current = { x: mx, y: my }

    if (draggingRef.current) {
      const ns = nodesRef.current
      const node = ns?.find(n => n.id === draggingRef.current.nodeId)
      if (node) {
        node.x = mx - draggingRef.current.offsetX - panRef.current.x
        node.y = my - draggingRef.current.offsetY - panRef.current.y
      }
      return
    }

    if (panningRef.current) {
      const dx = mx - panStartRef.current.x
      const dy = my - panStartRef.current.y
      panRef.current = {
        x: panStartRef.current.px + dx,
        y: panStartRef.current.py + dy,
      }
      return
    }

    // hover detection
    const ns = nodesRef.current
    if (!ns) return
    const hit = hitNode(ns, mx, my, panRef.current)
    setHoverNode(hit ? hit.id : null)
  }, [])

  const handleMouseUp = useCallback(() => {
    if (draggingRef.current) {
      draggingRef.current = null
      save()
    }
    if (panningRef.current) {
      panningRef.current = false
      save()
    }
  }, [save])

  const handleDoubleClick = useCallback((e) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    const ns = nodesRef.current
    if (!ns) return

    const hit = hitNode(ns, mx, my, panRef.current)
    if (hit) {
      // edit existing node
      setEditingNode(hit.id)
      setEditText(hit.text)
      setSelectedNode(hit.id)
    } else {
      // create new node
      const id = addNode(mx, my, 'New idea')
      if (id) {
        setEditingNode(id)
        setEditText('New idea')
      }
    }
  }, [addNode])

  const handleContextMenu = useCallback((e) => {
    e.preventDefault()
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const ns = nodesRef.current
    if (!ns) return
    const hit = hitNode(ns, mx, my, panRef.current)
    if (hit) deleteNode(hit.id)
  }, [deleteNode])

  /* ── inline edit handlers ───────────────────────────── */
  const commitEdit = useCallback(() => {
    if (!editingNode) return
    const ns = nodesRef.current
    if (!ns) return
    const node = ns.find(n => n.id === editingNode)
    if (node) {
      node.text = editText.trim() || 'Untitled'
    }
    setEditingNode(null)
    setEditText('')
    save()
  }, [editingNode, editText, save])

  const handleEditKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitEdit()
    }
    if (e.key === 'Escape') {
      setEditingNode(null)
      setEditText('')
    }
    e.stopPropagation()
  }, [commitEdit])

  /* focus the input when editing starts */
  useEffect(() => {
    if (editingNode && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingNode])

  /* ── compute editing node screen position (via effect) ── */
  useEffect(() => {
    if (editingNode) {
      const ns = nodesRef.current
      if (ns) {
        const node = ns.find(n => n.id === editingNode)
        if (node) {
          setEditPos({
            x: node.x + panRef.current.x,
            y: node.y + panRef.current.y,
          })
          return
        }
      }
    }
    setEditPos(null)
  }, [editingNode])

  /* ── cursor style ───────────────────────────────────── */
  const cursor = connectMode ? 'crosshair' : 'default'

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
        cursor,
      }}
    >
      <style>{`
        .garden-toolbar {
          position: absolute;
          top: 8px;
          left: 8px;
          right: 8px;
          display: flex;
          align-items: center;
          gap: 5px;
          z-index: 2;
          pointer-events: none;
        }
        .garden-toolbar > * {
          pointer-events: auto;
        }
        .garden-btn {
          padding: 3px 10px;
          font-size: 10px;
          font-weight: 500;
          font-family: inherit;
          border-radius: 9px;
          border: none;
          cursor: pointer;
          color: rgba(255,255,255,0.6);
          background: rgba(255,255,255,0.08);
          transition: background 0.2s, color 0.2s;
          line-height: 16px;
          letter-spacing: 0.3px;
          white-space: nowrap;
        }
        .garden-btn:hover {
          background: rgba(255,255,255,0.15);
          color: #fff;
        }
        .garden-btn-active {
          color: #fff;
          background: rgba(16,185,129,0.35);
          box-shadow: 0 0 6px rgba(16,185,129,0.3);
        }
        .garden-btn-active:hover {
          background: rgba(16,185,129,0.45);
        }
        .garden-btn-danger {
          color: rgba(255,120,120,0.7);
        }
        .garden-btn-danger:hover {
          background: rgba(255,70,70,0.2);
          color: rgba(255,120,120,1);
        }
        .garden-count {
          margin-left: auto;
          font-size: 10px;
          color: rgba(255,255,255,0.3);
          font-family: inherit;
          letter-spacing: 0.3px;
        }
        .garden-edit-input {
          position: absolute;
          transform: translate(-50%, -50%);
          z-index: 3;
          background: rgba(16,185,129,0.25);
          border: 1.5px solid rgba(16,185,129,0.7);
          border-radius: 8px;
          color: #fff;
          font-size: 12px;
          font-family: inherit;
          text-align: center;
          padding: 4px 10px;
          outline: none;
          width: 120px;
          box-shadow: 0 0 16px rgba(16,185,129,0.3);
        }
      `}</style>

      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />

      {/* Toolbar */}
      <div className="garden-toolbar">
        <button className="garden-btn" onClick={addNodeAtCenter}>
          + Add
        </button>
        <button
          className={`garden-btn ${connectMode ? 'garden-btn-active' : ''}`}
          onClick={() => {
            setConnectMode(m => !m)
            setConnectFrom(null)
          }}
        >
          {connectMode ? 'Connecting...' : 'Connect'}
        </button>
        <button className="garden-btn garden-btn-danger" onClick={clearAll}>
          Clear
        </button>
        <span className="garden-count">
          {nodeCount} node{nodeCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Inline edit input */}
      {editingNode && editPos && (
        <input
          ref={inputRef}
          className="garden-edit-input"
          value={editText}
          onChange={e => setEditText(e.target.value)}
          onKeyDown={handleEditKeyDown}
          onBlur={commitEdit}
          style={{
            left: editPos.x,
            top: editPos.y,
          }}
        />
      )}
    </div>
  )
}
