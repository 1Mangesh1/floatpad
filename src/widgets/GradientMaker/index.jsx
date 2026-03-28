import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useWidgetStore } from '../../store/widgetStore'

/* ── defaults ────────────────────────────────────────── */
const DEFAULT_STOPS = [
  { color: '#c084fc', position: 0 },
  { color: '#0ea5e9', position: 100 },
]

const PRESETS = [
  { name: 'Sunset', stops: [{ color: '#ff6b6b', position: 0 }, { color: '#feca57', position: 100 }] },
  { name: 'Ocean',  stops: [{ color: '#667eea', position: 0 }, { color: '#764ba2', position: 100 }] },
  { name: 'Aurora', stops: [{ color: '#00d2ff', position: 0 }, { color: '#3a7bd5', position: 100 }] },
  { name: 'Peach',  stops: [{ color: '#ed6ea0', position: 0 }, { color: '#ec8c69', position: 100 }] },
  { name: 'Mint',   stops: [{ color: '#11998e', position: 0 }, { color: '#38ef7d', position: 100 }] },
  { name: 'Night',  stops: [{ color: '#0f0c29', position: 0 }, { color: '#302b63', position: 50 }, { color: '#24243e', position: 100 }] },
]

const SWATCH_COLORS = [
  '#ff4757', '#ff6b6b', '#feca57', '#2ed573',
  '#1e90ff', '#c084fc', '#ff6348', '#ffffff',
  '#0ea5e9', '#10b981', '#f59e0b', '#ec4899',
  '#8b5cf6', '#06b6d4', '#f97316', '#0f0c29',
]

const SNAP_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315, 360]
const SNAP_THRESHOLD = 8

/* ── helpers ─────────────────────────────────────────── */
function sortedStops(stops) {
  return [...stops].sort((a, b) => a.position - b.position)
}

function buildStopString(stops) {
  return sortedStops(stops).map(s => `${s.color} ${s.position}%`).join(', ')
}

function buildGradientCSS(type, angle, stops) {
  const s = buildStopString(stops)
  if (type === 'radial') return `radial-gradient(circle, ${s})`
  if (type === 'conic') return `conic-gradient(from ${angle}deg, ${s})`
  return `linear-gradient(${angle}deg, ${s})`
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val))
}

/* ── component ───────────────────────────────────────── */
export function GradientMaker({ widgetId }) {
  const widget = useWidgetStore(s => s.widgets.find(w => w.id === widgetId))
  const updateData = useWidgetStore(s => s.updateData)

  const type = widget?.data?.type ?? 'linear'
  const angle = widget?.data?.angle ?? 135
  const stops = widget?.data?.stops ?? DEFAULT_STOPS

  const [selectedStop, setSelectedStop] = useState(0)
  const [copied, setCopied] = useState(false)
  const [hexInputOverride, setHexInputOverride] = useState(null)
  const [draggingStop, setDraggingStop] = useState(null)
  const [draggingDial, setDraggingDial] = useState(false)

  const stopBarRef = useRef(null)
  const dialRef = useRef(null)
  const copiedTimer = useRef(null)

  // Derive hex input: show override while typing, otherwise the store value
  const hexInput = hexInputOverride ?? stops[selectedStop]?.color ?? '#ffffff'

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
    }
  }, [])

  const save = useCallback((patch) => {
    updateData(widgetId, patch)
  }, [widgetId, updateData])

  /* ── gradient CSS ────────────────────────────────── */
  const gradientCSS = useMemo(() => buildGradientCSS(type, angle, stops), [type, angle, stops])
  const fullCSS = `background: ${gradientCSS};`

  /* ── type toggle ─────────────────────────────────── */
  const setType = useCallback((t) => save({ type: t }), [save])

  /* ── angle ───────────────────────────────────────── */
  const setAngle = useCallback((a) => {
    let snapped = a
    for (const snap of SNAP_ANGLES) {
      if (Math.abs(a - snap) < SNAP_THRESHOLD) { snapped = snap % 360; break }
    }
    save({ angle: snapped })
  }, [save])

  /* ── stops manipulation ──────────────────────────── */
  const updateStop = useCallback((idx, patch) => {
    const next = stops.map((s, i) => i === idx ? { ...s, ...patch } : s)
    save({ stops: next })
  }, [stops, save])

  const addStop = useCallback((position) => {
    // Interpolate color roughly
    const sorted = sortedStops(stops)
    let color = '#ffffff'
    for (let i = 0; i < sorted.length - 1; i++) {
      if (position >= sorted[i].position && position <= sorted[i + 1].position) {
        color = sorted[i].color
        break
      }
    }
    const next = [...stops, { color, position: Math.round(position) }]
    save({ stops: next })
    setSelectedStop(next.length - 1)
  }, [stops, save])

  const removeStop = useCallback((idx) => {
    if (stops.length <= 2) return
    const next = stops.filter((_, i) => i !== idx)
    save({ stops: next })
    setSelectedStop(Math.min(selectedStop, next.length - 1))
  }, [stops, save, selectedStop])

  /* ── stop bar drag ───────────────────────────────── */
  const handleStopBarMouseDown = useCallback((e, idx) => {
    e.stopPropagation()
    e.preventDefault()
    setSelectedStop(idx)
    setDraggingStop(idx)
  }, [])

  useEffect(() => {
    if (draggingStop === null) return
    const handleMove = (e) => {
      if (!stopBarRef.current) return
      const rect = stopBarRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const pos = clamp(Math.round((x / rect.width) * 100), 0, 100)
      updateStop(draggingStop, { position: pos })
    }
    const handleUp = () => setDraggingStop(null)
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [draggingStop, updateStop])

  /* ── stop bar click to add ───────────────────────── */
  const handleStopBarClick = useCallback((e) => {
    if (!stopBarRef.current) return
    // Ignore if click was on a marker
    if (e.target.dataset.marker) return
    const rect = stopBarRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const pos = clamp(Math.round((x / rect.width) * 100), 0, 100)
    addStop(pos)
  }, [addStop])

  /* ── dial drag ───────────────────────────────────── */
  const handleDialMouseDown = useCallback((e) => {
    e.preventDefault()
    setDraggingDial(true)
  }, [])

  useEffect(() => {
    if (!draggingDial) return
    const handleMove = (e) => {
      if (!dialRef.current) return
      const rect = dialRef.current.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const dx = e.clientX - cx
      const dy = e.clientY - cy
      let deg = Math.round(Math.atan2(dy, dx) * (180 / Math.PI) + 90)
      if (deg < 0) deg += 360
      setAngle(deg)
    }
    const handleUp = () => setDraggingDial(false)
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [draggingDial, setAngle])

  /* ── copy ────────────────────────────────────────── */
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(fullCSS).then(() => {
      setCopied(true)
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
      copiedTimer.current = setTimeout(() => setCopied(false), 1500)
    })
  }, [fullCSS])

  /* ── preset apply ────────────────────────────────── */
  const applyPreset = useCallback((preset) => {
    save({ stops: preset.stops })
    setSelectedStop(0)
  }, [save])

  /* ── hex input ───────────────────────────────────── */
  const handleHexChange = useCallback((e) => {
    const val = e.target.value
    setHexInputOverride(val)
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      updateStop(selectedStop, { color: val })
    }
  }, [selectedStop, updateStop])

  const handleHexBlur = useCallback(() => {
    // Clear override — will fall back to the store value
    setHexInputOverride(null)
  }, [])

  if (!widget) return null

  const showAngle = type === 'linear' || type === 'conic'
  const scoped = widgetId.replace(/[^a-zA-Z0-9]/g, '')

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      gap: 10,
      fontFamily: "'Inter', 'SF Pro Display', -apple-system, sans-serif",
      color: '#e0e0f0',
      userSelect: 'none',
      overflow: 'hidden',
    }}>
      <style>{`
        .grad-scroll-${scoped}::-webkit-scrollbar { width: 4px; }
        .grad-scroll-${scoped}::-webkit-scrollbar-track { background: transparent; }
        .grad-scroll-${scoped}::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
        .grad-scroll-${scoped}::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.14); }
      `}</style>

      <div className={`grad-scroll-${scoped}`} style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        minHeight: 0,
      }}>

        {/* ── Preview ────────────────────────────────── */}
        <div style={{
          height: 160,
          minHeight: 160,
          borderRadius: 10,
          background: gradientCSS,
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
          flexShrink: 0,
        }} />

        {/* ── Type toggle + Angle ────────────────────── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
        }}>
          {/* Type pills */}
          <div style={{
            display: 'flex',
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 8,
            padding: 2,
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            {['linear', 'radial', 'conic'].map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                style={{
                  padding: '5px 10px',
                  borderRadius: 6,
                  border: 'none',
                  background: type === t ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color: type === t ? '#fff' : 'rgba(255,255,255,0.4)',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  textTransform: 'capitalize',
                  letterSpacing: '0.02em',
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Angle dial */}
          {showAngle && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
              <div
                ref={dialRef}
                onMouseDown={handleDialMouseDown}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  position: 'relative',
                  cursor: 'grab',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {/* Tick marks */}
                {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => {
                  const rad = (deg - 90) * Math.PI / 180
                  return (
                    <div key={deg} style={{
                      position: 'absolute',
                      width: 1,
                      height: deg % 90 === 0 ? 4 : 3,
                      background: deg % 90 === 0 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
                      left: 24 + Math.cos(rad) * 20,
                      top: 24 + Math.sin(rad) * 20,
                      transform: `rotate(${deg}deg)`,
                      transformOrigin: 'center',
                      borderRadius: 1,
                    }} />
                  )
                })}
                {/* Indicator line */}
                <div style={{
                  position: 'absolute',
                  width: 2,
                  height: 14,
                  background: '#c084fc',
                  borderRadius: 1,
                  left: '50%',
                  top: 4,
                  marginLeft: -1,
                  transformOrigin: 'center 20px',
                  transform: `rotate(${angle}deg)`,
                  transition: draggingDial ? 'none' : 'transform 0.15s ease',
                  boxShadow: '0 0 6px rgba(192,132,252,0.4)',
                }} />
                {/* Center dot */}
                <div style={{
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  background: '#c084fc',
                  position: 'absolute',
                }} />
                {/* Degree text */}
                <span style={{
                  position: 'absolute',
                  bottom: -16,
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.5)',
                  fontWeight: 500,
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                }}>
                  {angle}°
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── Gradient stop bar ──────────────────────── */}
        <div style={{ flexShrink: 0 }}>
          <div style={{
            fontSize: 10,
            color: 'rgba(255,255,255,0.35)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 6,
          }}>
            Color Stops
          </div>

          {/* Gradient bar with markers */}
          <div
            ref={stopBarRef}
            onClick={handleStopBarClick}
            style={{
              position: 'relative',
              height: 28,
              borderRadius: 6,
              background: gradientCSS,
              border: '1px solid rgba(255,255,255,0.08)',
              cursor: 'crosshair',
              marginBottom: 20,
            }}
          >
            {stops.map((stop, idx) => {
              const isSelected = idx === selectedStop
              return (
                <div
                  key={idx}
                  data-marker="true"
                  onMouseDown={(e) => handleStopBarMouseDown(e, idx)}
                  style={{
                    position: 'absolute',
                    left: `${stop.position}%`,
                    bottom: -12,
                    transform: 'translateX(-50%)',
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    background: stop.color,
                    border: isSelected
                      ? '2px solid #fff'
                      : '2px solid rgba(255,255,255,0.3)',
                    boxShadow: isSelected
                      ? '0 0 8px rgba(255,255,255,0.3), 0 2px 4px rgba(0,0,0,0.4)'
                      : '0 1px 3px rgba(0,0,0,0.4)',
                    cursor: 'grab',
                    zIndex: isSelected ? 2 : 1,
                    transition: draggingStop !== null ? 'none' : 'left 0.1s ease',
                  }}
                />
              )
            })}
          </div>

          {/* Stop controls: swatch grid + hex + position + delete */}
          <div style={{
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
          }}>
            {/* Swatch grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(8, 1fr)',
              gap: 3,
              flexShrink: 0,
            }}>
              {SWATCH_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => {
                    updateStop(selectedStop, { color: c })
                    setHexInputOverride(null)
                  }}
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 3,
                    background: c,
                    border: stops[selectedStop]?.color === c
                      ? '1.5px solid #fff'
                      : '1px solid rgba(255,255,255,0.1)',
                    cursor: 'pointer',
                    padding: 0,
                    transition: 'transform 0.1s ease',
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                />
              ))}
            </div>

            {/* Hex + position + delete */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {/* Native color picker as a tiny swatch */}
                <label style={{
                  width: 24,
                  height: 24,
                  borderRadius: 4,
                  background: stops[selectedStop]?.color ?? '#fff',
                  border: '1px solid rgba(255,255,255,0.15)',
                  cursor: 'pointer',
                  flexShrink: 0,
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  <input
                    type="color"
                    value={stops[selectedStop]?.color ?? '#ffffff'}
                    onChange={(e) => {
                      updateStop(selectedStop, { color: e.target.value })
                      setHexInputOverride(null)
                    }}
                    style={{
                      position: 'absolute',
                      top: 0, left: 0,
                      width: '100%', height: '100%',
                      opacity: 0,
                      cursor: 'pointer',
                    }}
                  />
                </label>
                <input
                  type="text"
                  value={hexInput}
                  onChange={handleHexChange}
                  onBlur={handleHexBlur}
                  spellCheck={false}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 4,
                    color: '#e0e0f0',
                    fontSize: 11,
                    fontFamily: "'JetBrains Mono', monospace",
                    padding: '3px 6px',
                    outline: 'none',
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>Pos</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={stops[selectedStop]?.position ?? 0}
                  onChange={e => updateStop(selectedStop, { position: Number(e.target.value) })}
                  style={{
                    flex: 1,
                    height: 3,
                    accentColor: '#c084fc',
                  }}
                />
                <span style={{
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.5)',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontVariantNumeric: 'tabular-nums',
                  minWidth: 28,
                  textAlign: 'right',
                }}>
                  {stops[selectedStop]?.position ?? 0}%
                </span>
                <button
                  onClick={() => removeStop(selectedStop)}
                  disabled={stops.length <= 2}
                  title="Remove stop"
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    border: 'none',
                    background: stops.length <= 2 ? 'rgba(255,255,255,0.02)' : 'rgba(255,80,80,0.1)',
                    color: stops.length <= 2 ? 'rgba(255,255,255,0.15)' : 'rgba(255,80,80,0.7)',
                    fontSize: 13,
                    cursor: stops.length <= 2 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    flexShrink: 0,
                    transition: 'all 0.15s ease',
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Presets ────────────────────────────────── */}
        <div style={{ flexShrink: 0 }}>
          <div style={{
            fontSize: 10,
            color: 'rgba(255,255,255,0.35)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 6,
          }}>
            Presets
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: 6,
          }}>
            {PRESETS.map(preset => (
              <button
                key={preset.name}
                onClick={() => applyPreset(preset)}
                title={preset.name}
                style={{
                  height: 28,
                  borderRadius: 6,
                  background: `linear-gradient(135deg, ${buildStopString(preset.stops)})`,
                  border: '1px solid rgba(255,255,255,0.06)',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'transform 0.12s ease, box-shadow 0.12s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'scale(1.05)'
                  e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.3)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'scale(1)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
            ))}
          </div>
        </div>

        {/* ── CSS Output ─────────────────────────────── */}
        <div style={{ flexShrink: 0 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 6,
          }}>
            <span style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.35)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>
              CSS
            </span>
            <button
              onClick={handleCopy}
              style={{
                background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)',
                border: copied ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.08)',
                color: copied ? '#10b981' : 'rgba(255,255,255,0.5)',
                fontSize: 10,
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: 4,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                letterSpacing: '0.02em',
              }}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div style={{
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 6,
            padding: '8px 10px',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            lineHeight: 1.5,
            color: 'rgba(255,255,255,0.7)',
            wordBreak: 'break-all',
            whiteSpace: 'pre-wrap',
          }}>
            {fullCSS}
          </div>
        </div>

      </div>
    </div>
  )
}
