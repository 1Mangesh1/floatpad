import { useState, useEffect, useRef, useCallback } from 'react'
import { useWidgetStore } from '../../store/widgetStore'

// ── Constants ───────────────────────────────────────────────────

const EMERALD = '#10b981'
const EMERALD_RGB = '16,185,129'

const NOISE_TYPES = [
  { id: 'white',    label: 'White',    icon: '\u2601\uFE0F', color: '#e0e0f0', desc: 'Flat spectrum' },
  { id: 'pink',     label: 'Pink',     icon: '\uD83C\uDF38', color: '#f472b6', desc: '1/f natural' },
  { id: 'brown',    label: 'Brown',    icon: '\uD83C\uDF0A', color: '#d97706', desc: 'Deep rumble' },
  { id: 'binaural', label: 'Binaural', icon: '\uD83E\uDDE0', color: '#8b5cf6', desc: 'Alpha 10Hz' },
]

const TIMER_OPTIONS = [
  { value: 0,  label: 'Off' },
  { value: 15, label: '15m' },
  { value: 30, label: '30m' },
  { value: 60, label: '1h' },
]

const NOISE_COLOR_MAP = {
  white: '#e0e0f0',
  pink: '#f472b6',
  brown: '#d97706',
  binaural: '#8b5cf6',
}

const BAR_COUNT = 32
const BAR_WIDTH = 3
const BAR_GAP = 2

// ── Noise Generation Helpers ────────────────────────────────────

function createWhiteNoiseBuffer(ctx, duration = 2) {
  const sampleRate = ctx.sampleRate
  const length = sampleRate * duration
  const buffer = ctx.createBuffer(1, length, sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1
  }
  return buffer
}

function createPinkNoiseBuffer(ctx, duration = 2) {
  // Voss-McCartney algorithm with 8 octave bands
  const sampleRate = ctx.sampleRate
  const length = sampleRate * duration
  const buffer = ctx.createBuffer(1, length, sampleRate)
  const data = buffer.getChannelData(0)

  const numSources = 8
  const values = new Float32Array(numSources)
  let runningSum = 0

  // Initialize
  for (let j = 0; j < numSources; j++) {
    values[j] = Math.random() * 2 - 1
    runningSum += values[j]
  }

  for (let i = 0; i < length; i++) {
    // Determine which sources to update based on trailing zeros of i
    let k = i
    let j = 0
    while (j < numSources && (k & 1) === 0) {
      runningSum -= values[j]
      values[j] = Math.random() * 2 - 1
      runningSum += values[j]
      k >>= 1
      j++
    }
    // Normalize: numSources random values, variance ~ numSources, so divide by numSources
    data[i] = (runningSum + (Math.random() * 2 - 1)) / (numSources + 1)
  }

  // Normalize peak to ~0.9
  let max = 0
  for (let i = 0; i < length; i++) {
    const abs = Math.abs(data[i])
    if (abs > max) max = abs
  }
  if (max > 0) {
    const scale = 0.9 / max
    for (let i = 0; i < length; i++) {
      data[i] *= scale
    }
  }

  return buffer
}

function createBrownNoiseBuffer(ctx, duration = 2) {
  const sampleRate = ctx.sampleRate
  const length = sampleRate * duration
  const buffer = ctx.createBuffer(1, length, sampleRate)
  const data = buffer.getChannelData(0)

  let last = 0
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1
    last = (last + 0.02 * white) / 1.02
    data[i] = last
  }

  // Normalize
  let max = 0
  for (let i = 0; i < length; i++) {
    const abs = Math.abs(data[i])
    if (abs > max) max = abs
  }
  if (max > 0) {
    const scale = 0.9 / max
    for (let i = 0; i < length; i++) {
      data[i] *= scale
    }
  }

  return buffer
}

// ── Style Tag ───────────────────────────────────────────────────

const styleContent = `
  @keyframes noise-pulse {
    0%, 100% { box-shadow: 0 0 12px rgba(${EMERALD_RGB},0.3), 0 0 24px rgba(${EMERALD_RGB},0.15); }
    50% { box-shadow: 0 0 20px rgba(${EMERALD_RGB},0.5), 0 0 40px rgba(${EMERALD_RGB},0.25); }
  }
  .noise-play-btn {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.15);
    background: rgba(255,255,255,0.05);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    outline: none;
    user-select: none;
    flex-shrink: 0;
  }
  .noise-play-btn:hover {
    background: rgba(255,255,255,0.1);
    border-color: rgba(255,255,255,0.25);
  }
  .noise-play-btn.active {
    background: rgba(${EMERALD_RGB},0.15);
    border-color: ${EMERALD};
    animation: noise-pulse 2s ease-in-out infinite;
  }
  .noise-play-btn.active:hover {
    background: rgba(${EMERALD_RGB},0.25);
  }

  .noise-card {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px;
    padding: 10px 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    user-select: none;
  }
  .noise-card:hover {
    background: rgba(255,255,255,0.08);
    border-color: rgba(255,255,255,0.15);
  }
  .noise-card.selected {
    background: rgba(255,255,255,0.08);
    border-width: 1.5px;
  }

  .noise-volume-track {
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: rgba(255,255,255,0.08);
    position: relative;
    cursor: pointer;
  }
  .noise-volume-fill {
    height: 100%;
    border-radius: 3px;
    background: ${EMERALD};
    pointer-events: none;
    transition: width 0.05s linear;
  }
  .noise-volume-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #fff;
    border: 2px solid ${EMERALD};
    box-shadow: 0 0 8px rgba(${EMERALD_RGB},0.4);
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    cursor: grab;
    transition: box-shadow 0.2s ease;
  }
  .noise-volume-thumb:hover {
    box-shadow: 0 0 14px rgba(${EMERALD_RGB},0.6);
  }
  .noise-volume-thumb:active {
    cursor: grabbing;
  }

  input.noise-range {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: rgba(255,255,255,0.08);
    outline: none;
    cursor: pointer;
  }
  input.noise-range::-webkit-slider-runnable-track {
    height: 6px;
    border-radius: 3px;
  }
  input.noise-range::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #fff;
    border: 2px solid ${EMERALD};
    box-shadow: 0 0 8px rgba(${EMERALD_RGB},0.4);
    margin-top: -5px;
    cursor: grab;
    transition: box-shadow 0.2s ease;
  }
  input.noise-range::-webkit-slider-thumb:hover {
    box-shadow: 0 0 14px rgba(${EMERALD_RGB},0.6);
  }
  input.noise-range::-moz-range-track {
    height: 6px;
    border-radius: 3px;
    background: rgba(255,255,255,0.08);
  }
  input.noise-range::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #fff;
    border: 2px solid ${EMERALD};
    box-shadow: 0 0 8px rgba(${EMERALD_RGB},0.4);
    cursor: grab;
  }
  input.noise-range::-moz-range-progress {
    background: ${EMERALD};
    border-radius: 3px;
    height: 6px;
  }

  .noise-timer-pill {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    color: rgba(255,255,255,0.5);
    border-radius: 20px;
    padding: 4px 12px;
    font-size: 11px;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.2s ease;
    outline: none;
    user-select: none;
    white-space: nowrap;
  }
  .noise-timer-pill:hover {
    background: rgba(255,255,255,0.08);
    color: rgba(255,255,255,0.7);
  }
  .noise-timer-pill.active {
    background: rgba(${EMERALD_RGB},0.2);
    border-color: rgba(${EMERALD_RGB},0.5);
    color: ${EMERALD};
    box-shadow: 0 0 10px rgba(${EMERALD_RGB},0.2);
  }

  @keyframes noise-bar-bounce {
    0%, 100% { transform: scaleY(0.3); }
    50% { transform: scaleY(1); }
  }
`

// ── Visualizer Component ────────────────────────────────────────

function Visualizer({ playing, noiseType }) {
  const color = NOISE_COLOR_MAP[noiseType] || '#e0e0f0'
  const [phases] = useState(() => Array.from({ length: BAR_COUNT }, () => Math.random() * Math.PI * 2))

  const [bars, setBars] = useState(() => Array(BAR_COUNT).fill(4))
  const rafRef = useRef(null)
  const startTimeRef = useRef(null)

  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      return
    }

    startTimeRef.current = performance.now()

    const animate = (now) => {
      const t = (now - startTimeRef.current) / 1000
      const newBars = phases.map((phase) => {
        const v1 = Math.sin(t * 1.8 + phase) * 0.4
        const v2 = Math.sin(t * 2.7 + phase * 1.3) * 0.3
        const v3 = Math.sin(t * 0.9 + phase * 0.7) * 0.3
        const combined = (v1 + v2 + v3 + 1) / 2
        return 4 + combined * 16
      })
      setBars(newBars)
      rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [playing, phases])

  const displayBars = playing ? bars : bars.map(() => 4)

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      height: 24,
      gap: `${BAR_GAP}px`,
      opacity: playing ? 1 : 0.2,
      transition: 'opacity 0.4s ease',
    }}>
      {displayBars.map((h, i) => (
        <div
          key={i}
          style={{
            width: `${BAR_WIDTH}px`,
            height: `${h}px`,
            borderRadius: '1.5px',
            background: color,
            opacity: 0.7 + (h / 20) * 0.3,
            transition: playing ? 'none' : 'height 0.3s ease',
          }}
        />
      ))}
    </div>
  )
}

// ── Waveform Mini Icon for Cards ────────────────────────────────

function WaveIcon({ type, color, size = 32 }) {
  const mid = size / 2
  let d = ''

  if (type === 'white') {
    // Jagged random-looking line
    const points = []
    for (let i = 0; i <= 8; i++) {
      const x = (i / 8) * size
      const y = mid + (i % 2 === 0 ? -1 : 1) * (2 + (i % 3) * 2)
      points.push(`${i === 0 ? 'M' : 'L'}${x},${y}`)
    }
    d = points.join(' ')
  } else if (type === 'pink') {
    // Gentle wave
    d = `M0,${mid} Q${size * 0.25},${mid - 6} ${size * 0.5},${mid} Q${size * 0.75},${mid + 6} ${size},${mid}`
  } else if (type === 'brown') {
    // Deep slow wave
    d = `M0,${mid + 2} Q${size * 0.3},${mid - 8} ${size * 0.5},${mid} Q${size * 0.7},${mid + 8} ${size},${mid - 2}`
  } else if (type === 'binaural') {
    // Two overlapping waves
    d = `M0,${mid - 2} Q${size * 0.25},${mid - 7} ${size * 0.5},${mid - 2} Q${size * 0.75},${mid + 3} ${size},${mid - 2}`
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      {type === 'binaural' && (
        <path
          d={`M0,${mid + 2} Q${size * 0.25},${mid + 7} ${size * 0.5},${mid + 2} Q${size * 0.75},${mid - 3} ${size},${mid + 2}`}
          fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.4"
        />
      )}
    </svg>
  )
}

// ── Format time helper ──────────────────────────────────────────

function formatCountdown(totalSeconds) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ── Main Component ──────────────────────────────────────────────

export function NoiseGen({ widgetId }) {
  const widget = useWidgetStore((s) => s.widgets.find((w) => w.id === widgetId))
  const updateData = useWidgetStore((s) => s.updateData)

  const data = widget?.data ?? {}
  const noiseType = data.noiseType ?? 'white'
  const volume = data.volume ?? 0.5
  const timer = data.timer ?? 0

  // Local-only state
  const [playing, setPlaying] = useState(false)
  const [countdown, setCountdown] = useState(null) // seconds remaining, or null

  // Audio refs
  const ctxRef = useRef(null)
  const sourceRef = useRef(null)
  const gainRef = useRef(null)
  const binauralRef = useRef({ left: null, right: null, merger: null })
  const fadeTimerRef = useRef(null)
  const countdownIntervalRef = useRef(null)

  // Persist state changes
  const persist = useCallback(
    (patch) => {
      if (widgetId) updateData(widgetId, patch)
    },
    [widgetId, updateData]
  )

  // ── Audio Context Management ──────────────────────────────────

  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume()
    }
    return ctxRef.current
  }, [])

  // ── Stop Audio ────────────────────────────────────────────────

  const stopAudio = useCallback((fade = false) => {
    if (fadeTimerRef.current) {
      clearTimeout(fadeTimerRef.current)
      fadeTimerRef.current = null
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }

    const finish = () => {
      // Stop buffer source
      if (sourceRef.current) {
        try { sourceRef.current.stop() } catch { /* already stopped */ }
        sourceRef.current.disconnect()
        sourceRef.current = null
      }
      // Stop binaural oscillators
      const bin = binauralRef.current
      if (bin.left) {
        try { bin.left.stop() } catch { /* already stopped */ }
        bin.left.disconnect()
        bin.left = null
      }
      if (bin.right) {
        try { bin.right.stop() } catch { /* already stopped */ }
        bin.right.disconnect()
        bin.right = null
      }
      if (bin.merger) {
        bin.merger.disconnect()
        bin.merger = null
      }
      setPlaying(false)
      setCountdown(null)
    }

    if (fade && gainRef.current && ctxRef.current) {
      const now = ctxRef.current.currentTime
      gainRef.current.gain.cancelScheduledValues(now)
      gainRef.current.gain.setValueAtTime(gainRef.current.gain.value, now)
      gainRef.current.gain.linearRampToValueAtTime(0, now + 3)
      fadeTimerRef.current = setTimeout(finish, 3100)
    } else {
      finish()
    }
  }, [])

  // ── Start Audio ───────────────────────────────────────────────

  const startAudio = useCallback((type, vol) => {
    const ctx = getCtx()

    // Create gain node
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.05)
    gain.connect(ctx.destination)
    gainRef.current = gain

    if (type === 'binaural') {
      // Two sine oscillators, one per channel
      const merger = ctx.createChannelMerger(2)

      const leftOsc = ctx.createOscillator()
      leftOsc.type = 'sine'
      leftOsc.frequency.setValueAtTime(200, ctx.currentTime)

      const rightOsc = ctx.createOscillator()
      rightOsc.type = 'sine'
      rightOsc.frequency.setValueAtTime(210, ctx.currentTime)

      const leftGain = ctx.createGain()
      leftGain.gain.setValueAtTime(1, ctx.currentTime)
      const rightGain = ctx.createGain()
      rightGain.gain.setValueAtTime(1, ctx.currentTime)

      leftOsc.connect(leftGain).connect(merger, 0, 0)
      rightOsc.connect(rightGain).connect(merger, 0, 1)
      merger.connect(gain)

      leftOsc.start(ctx.currentTime)
      rightOsc.start(ctx.currentTime)

      binauralRef.current = { left: leftOsc, right: rightOsc, merger }
    } else {
      // Buffer-based noise
      let buffer
      if (type === 'white') {
        buffer = createWhiteNoiseBuffer(ctx, 2)
      } else if (type === 'pink') {
        buffer = createPinkNoiseBuffer(ctx, 2)
      } else {
        buffer = createBrownNoiseBuffer(ctx, 2)
      }

      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.loop = true
      source.connect(gain)
      source.start(ctx.currentTime)
      sourceRef.current = source
    }

    setPlaying(true)
  }, [getCtx])

  // ── Toggle Play/Stop ──────────────────────────────────────────

  const togglePlay = useCallback(() => {
    if (playing) {
      stopAudio(false)
    } else {
      startAudio(noiseType, volume)
      // Start countdown if timer is set
      if (timer > 0) {
        const totalSeconds = timer * 60
        setCountdown(totalSeconds)
      }
    }
  }, [playing, noiseType, volume, timer, startAudio, stopAudio])

  // ── Countdown Timer ───────────────────────────────────────────

  useEffect(() => {
    if (countdown === null || countdown <= 0 || !playing) {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
        countdownIntervalRef.current = null
      }
      // Timer reached zero: fade out
      if (countdown !== null && countdown <= 0 && playing) {
        stopAudio(true)
      }
      return
    }

    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null) return null
        if (prev <= 1) return 0
        return prev - 1
      })
    }, 1000)

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
        countdownIntervalRef.current = null
      }
    }
  }, [countdown !== null && countdown > 0 && playing]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Volume Changes ────────────────────────────────────────────

  useEffect(() => {
    if (gainRef.current && ctxRef.current && playing) {
      const now = ctxRef.current.currentTime
      gainRef.current.gain.cancelScheduledValues(now)
      gainRef.current.gain.setValueAtTime(gainRef.current.gain.value, now)
      gainRef.current.gain.linearRampToValueAtTime(volume, now + 0.05)
    }
  }, [volume, playing])

  // ── Handle Noise Type Change While Playing ────────────────────

  const handleNoiseTypeChange = useCallback((type) => {
    persist({ noiseType: type })
    if (playing) {
      stopAudio(false)
      // Slight delay to let cleanup finish
      requestAnimationFrame(() => {
        startAudio(type, volume)
        if (timer > 0 && countdown !== null && countdown > 0) {
          // Keep existing countdown
        } else if (timer > 0) {
          setCountdown(timer * 60)
        }
      })
    }
  }, [persist, playing, stopAudio, startAudio, volume, timer, countdown])

  // ── Handle Volume Change ──────────────────────────────────────

  const handleVolumeChange = useCallback((e) => {
    const val = parseFloat(e.target.value)
    persist({ volume: val })
  }, [persist])

  // ── Handle Timer Change ───────────────────────────────────────

  const handleTimerChange = useCallback((val) => {
    persist({ timer: val })
    if (playing) {
      if (val > 0) {
        setCountdown(val * 60)
      } else {
        setCountdown(null)
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current)
          countdownIntervalRef.current = null
        }
      }
    }
  }, [persist, playing])

  // ── Cleanup on Unmount ────────────────────────────────────────

  useEffect(() => {
    return () => {
      // Stop everything on widget close/unmount
      if (sourceRef.current) {
        try { sourceRef.current.stop() } catch { /* already stopped */ }
      }
      const bin = binauralRef.current
      if (bin.left) { try { bin.left.stop() } catch { /* already stopped */ } }
      if (bin.right) { try { bin.right.stop() } catch { /* already stopped */ } }
      if (ctxRef.current) {
        try { ctxRef.current.close() } catch { /* already stopped */ }
      }
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    }
  }, [])

  // ── Compute volume slider background ──────────────────────────

  const volumePercent = volume * 100
  const sliderBackground = `linear-gradient(to right, ${EMERALD} 0%, ${EMERALD} ${volumePercent}%, rgba(255,255,255,0.08) ${volumePercent}%, rgba(255,255,255,0.08) 100%)`

  if (!widget) return null

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      gap: '14px',
      color: 'rgba(255,255,255,0.85)',
      fontFamily: 'inherit',
      fontSize: '13px',
      overflow: 'hidden',
    }}>
      <style>{styleContent}</style>

      {/* ── Play/Stop Button ──────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button
          className={`noise-play-btn ${playing ? 'active' : ''}`}
          onClick={togglePlay}
          aria-label={playing ? 'Stop' : 'Play'}
        >
          {playing ? (
            // Stop icon (square)
            <svg width="22" height="22" viewBox="0 0 22 22">
              <rect x="4" y="4" width="14" height="14" rx="2" fill={EMERALD} />
            </svg>
          ) : (
            // Play icon (triangle)
            <svg width="22" height="22" viewBox="0 0 22 22">
              <polygon points="6,3 6,19 19,11" fill="rgba(255,255,255,0.7)" />
            </svg>
          )}
        </button>
      </div>

      {/* ── Noise Type Grid ───────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '8px',
      }}>
        {NOISE_TYPES.map((nt) => {
          const selected = noiseType === nt.id
          return (
            <div
              key={nt.id}
              className={`noise-card ${selected ? 'selected' : ''}`}
              style={selected ? { borderColor: nt.color, boxShadow: `0 0 12px ${nt.color}22` } : {}}
              onClick={() => handleNoiseTypeChange(nt.id)}
            >
              <WaveIcon type={nt.id} color={nt.color} size={28} />
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px',
                fontWeight: 600,
                color: selected ? nt.color : 'rgba(255,255,255,0.7)',
                transition: 'color 0.2s',
              }}>
                <span>{nt.icon}</span>
                <span>{nt.label}</span>
              </div>
              <div style={{
                fontSize: '9px',
                color: 'rgba(255,255,255,0.35)',
                letterSpacing: '0.3px',
              }}>
                {nt.desc}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Visualizer ────────────────────────────────────────── */}
      <Visualizer playing={playing} noiseType={noiseType} />

      {/* ── Volume Slider ─────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Volume
          </span>
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(volume * 100)}%
          </span>
        </div>
        <input
          className="noise-range"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={handleVolumeChange}
          style={{ background: sliderBackground }}
        />
      </div>

      {/* ── Timer Pills ───────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
        <span style={{
          fontSize: '10px',
          color: 'rgba(255,255,255,0.4)',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          alignSelf: 'flex-start',
        }}>
          Timer
        </span>
        <div style={{ display: 'flex', gap: '6px' }}>
          {TIMER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`noise-timer-pill ${timer === opt.value ? 'active' : ''}`}
              onClick={() => handleTimerChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {/* Countdown display */}
        {countdown !== null && countdown > 0 && playing && (
          <div style={{
            fontSize: '13px',
            color: EMERALD,
            fontVariantNumeric: 'tabular-nums',
            fontWeight: 500,
            letterSpacing: '0.5px',
            opacity: 0.9,
          }}>
            {formatCountdown(countdown)}
          </div>
        )}
      </div>
    </div>
  )
}
