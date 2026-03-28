import { useState, useEffect, useRef, useCallback, memo } from 'react'
import { useWidgetStore } from '../../store/widgetStore'

const ROWS = [
  { key: 'kick', label: 'KICK', color: '#ff4757' },
  { key: 'snare', label: 'SNR', color: '#ffa502' },
  { key: 'hihat', label: 'HAT', color: '#2ed573' },
  { key: 'clap', label: 'CLAP', color: '#1e90ff' },
]
const STEPS = 8
const BPM_MIN = 60
const BPM_MAX = 180

function makeDefaultPattern() {
  return ROWS.map(() => Array(STEPS).fill(false))
}

// ── Sound Synthesis ──────────────────────────────────────────────

function getOrCreateCtx(ref) {
  if (!ref.current) {
    ref.current = new (window.AudioContext || window.webkitAudioContext)()
  }
  if (ref.current.state === 'suspended') {
    ref.current.resume()
  }
  return ref.current
}

function playKick(ctx) {
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(150, now)
  osc.frequency.exponentialRampToValueAtTime(60, now + 0.08)
  gain.gain.setValueAtTime(0.9, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3)
  osc.connect(gain).connect(ctx.destination)
  osc.start(now)
  osc.stop(now + 0.3)
}

function playSnare(ctx) {
  const now = ctx.currentTime
  const len = 4096
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource()
  src.buffer = buf
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 1000
  bp.Q.value = 0.8
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.7, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)
  src.connect(bp).connect(gain).connect(ctx.destination)
  src.start(now)
  src.stop(now + 0.12)
}

function playHiHat(ctx) {
  const now = ctx.currentTime
  const len = 2048
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource()
  src.buffer = buf
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 7000
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.4, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05)
  src.connect(hp).connect(gain).connect(ctx.destination)
  src.start(now)
  src.stop(now + 0.06)
}

function playClap(ctx) {
  const now = ctx.currentTime
  const len = 4096
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1

  // First hit
  const src1 = ctx.createBufferSource()
  src1.buffer = buf
  const bp1 = ctx.createBiquadFilter()
  bp1.type = 'bandpass'
  bp1.frequency.value = 2000
  bp1.Q.value = 0.6
  const g1 = ctx.createGain()
  g1.gain.setValueAtTime(0.6, now)
  g1.gain.exponentialRampToValueAtTime(0.001, now + 0.04)
  src1.connect(bp1).connect(g1).connect(ctx.destination)
  src1.start(now)
  src1.stop(now + 0.04)

  // Second hit (delayed)
  const src2 = ctx.createBufferSource()
  src2.buffer = buf
  const bp2 = ctx.createBiquadFilter()
  bp2.type = 'bandpass'
  bp2.frequency.value = 2000
  bp2.Q.value = 0.6
  const g2 = ctx.createGain()
  g2.gain.setValueAtTime(0.6, now + 0.025)
  g2.gain.exponentialRampToValueAtTime(0.001, now + 0.08)
  src2.connect(bp2).connect(g2).connect(ctx.destination)
  src2.start(now + 0.025)
  src2.stop(now + 0.08)
}

const PLAY_FN = [playKick, playSnare, playHiHat, playClap]

// ── Styles ───────────────────────────────────────────────────────

const styles = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    height: '100%',
    userSelect: 'none',
    fontFamily: 'ui-monospace, Consolas, monospace',
    color: '#e0e0e0',
    overflow: 'hidden',
  },
  grid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: 1,
    minHeight: 0,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.08em',
    width: 34,
    textAlign: 'right',
    flexShrink: 0,
    opacity: 0.7,
  },
  cells: {
    display: 'flex',
    gap: 4,
    flex: 1,
  },
  transport: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingTop: 6,
    borderTop: '1px solid rgba(255,255,255,0.06)',
    flexShrink: 0,
  },
  playBtn: {
    width: 36,
    height: 28,
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.06)',
    color: '#e0e0e0',
    fontSize: 14,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(6px)',
    transition: 'background 0.15s, border-color 0.15s',
  },
  bpmGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  bpmBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)',
    color: '#e0e0e0',
    fontSize: 14,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    lineHeight: 1,
  },
  bpmDisplay: {
    fontFamily: 'ui-monospace, Consolas, monospace',
    fontSize: 12,
    fontWeight: 600,
    minWidth: 56,
    textAlign: 'center',
    color: '#ccc',
  },
}

// ── Component ────────────────────────────────────────────────────

export function BeatPad({ widgetId }) {
  const widget = useWidgetStore((s) => s.widgets.find((w) => w.id === widgetId))
  const updateData = useWidgetStore((s) => s.updateData)

  const pattern = widget?.data?.pattern ?? makeDefaultPattern()
  const bpm = widget?.data?.bpm ?? 120

  const [playing, setPlaying] = useState(false)
  const [currentStep, setCurrentStep] = useState(-1)

  const audioCtxRef = useRef(null)
  const intervalRef = useRef(null)
  const patternRef = useRef(pattern)

  // Keep patternRef in sync so the interval callback reads the latest pattern
  useEffect(() => {
    patternRef.current = pattern
  }, [pattern])

  // Toggle a cell
  const toggleCell = useCallback(
    (row, col) => {
      const next = pattern.map((r, ri) =>
        ri === row ? r.map((c, ci) => (ci === col ? !c : c)) : r
      )
      updateData(widgetId, { pattern: next })
    },
    [pattern, widgetId, updateData]
  )

  // BPM controls
  const changeBpm = useCallback(
    (delta) => {
      const next = Math.max(BPM_MIN, Math.min(BPM_MAX, bpm + delta))
      updateData(widgetId, { bpm: next })
    },
    [bpm, widgetId, updateData]
  )

  // Sequencer tick
  const tick = useCallback(() => {
    setCurrentStep((prev) => {
      const next = (prev + 1) % STEPS
      const ctx = audioCtxRef.current
      if (ctx) {
        const pat = patternRef.current
        for (let r = 0; r < ROWS.length; r++) {
          if (pat[r][next]) {
            PLAY_FN[r](ctx)
          }
        }
      }
      return next
    })
  }, [])

  // Play / Stop
  const togglePlay = useCallback(() => {
    if (playing) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
      setPlaying(false)
      setCurrentStep(-1)
    } else {
      const ctx = getOrCreateCtx(audioCtxRef)
      // Trigger an immediate first tick so the user hears step 0 right away
      setPlaying(true)
      setCurrentStep(-1)
      // Small delay to let state settle, then start
      const ms = 60000 / bpm / 2
      // Immediate first tick
      setTimeout(() => {
        setCurrentStep(0)
        const pat = patternRef.current
        for (let r = 0; r < ROWS.length; r++) {
          if (pat[r][0]) PLAY_FN[r](ctx)
        }
      }, 0)
      intervalRef.current = setInterval(tick, ms)
    }
  }, [playing, bpm, tick])

  // Restart interval when BPM changes while playing
  useEffect(() => {
    if (playing && intervalRef.current) {
      clearInterval(intervalRef.current)
      const ms = 60000 / bpm / 2
      intervalRef.current = setInterval(tick, ms)
    }
  }, [bpm, playing, tick])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearInterval(intervalRef.current)
      // Don't close AudioContext — it can be reused if the widget respawns
    }
  }, [])

  if (!widget) return null

  return (
    <div style={styles.root}>
      {/* Sequencer Grid */}
      <div style={styles.grid}>
        {ROWS.map((row, ri) => (
          <div key={row.key} style={styles.row}>
            <span style={{ ...styles.label, color: row.color }}>{row.label}</span>
            <div style={styles.cells}>
              {Array.from({ length: STEPS }, (_, ci) => {
                const active = pattern[ri]?.[ci] ?? false
                const isCurrent = ci === currentStep && playing
                return (
                  <Cell
                    key={ci}
                    active={active}
                    isCurrent={isCurrent}
                    color={row.color}
                    onClick={() => toggleCell(ri, ci)}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Transport Bar */}
      <div style={styles.transport}>
        <button
          style={{
            ...styles.playBtn,
            background: playing
              ? 'rgba(255, 71, 87, 0.2)'
              : 'rgba(46, 213, 115, 0.15)',
            borderColor: playing
              ? 'rgba(255, 71, 87, 0.4)'
              : 'rgba(46, 213, 115, 0.3)',
          }}
          onClick={togglePlay}
          aria-label={playing ? 'Stop' : 'Play'}
        >
          {playing ? '■' : '▶'}
        </button>

        <div style={styles.bpmGroup}>
          <button
            style={styles.bpmBtn}
            onClick={() => changeBpm(-5)}
            aria-label="Decrease BPM"
          >
            −
          </button>
          <span style={styles.bpmDisplay}>{bpm} BPM</span>
          <button
            style={styles.bpmBtn}
            onClick={() => changeBpm(5)}
            aria-label="Increase BPM"
          >
            +
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Cell sub-component (memoized for perf) ───────────────────────

const Cell = memo(function Cell({ active, isCurrent, color, onClick }) {
  const bg = active
    ? hexToRgba(color, 0.6)
    : 'rgba(255,255,255,0.04)'

  const shadow = active
    ? `0 0 12px ${hexToRgba(color, 0.4)}`
    : 'none'

  const overlay = isCurrent
    ? 'rgba(255,255,255,0.12)'
    : 'transparent'

  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative',
        flex: 1,
        aspectRatio: '1',
        maxWidth: 42,
        minWidth: 0,
        borderRadius: 6,
        background: bg,
        boxShadow: shadow,
        cursor: 'pointer',
        transition: 'background 0.1s, box-shadow 0.15s',
        overflow: 'hidden',
      }}
    >
      {/* Current-step overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 6,
          background: overlay,
          transition: 'background 0.08s',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
})

// ── Helpers ──────────────────────────────────────────────────────

function hexToRgba(hex, alpha) {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r},${g},${b},${alpha})`
}
