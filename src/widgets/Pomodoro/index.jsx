import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useWidgetStore } from '../../store/widgetStore'

const MODES = {
  work: { label: 'Work', duration: 25 * 60 },
  shortBreak: { label: 'Short Break', duration: 5 * 60 },
  longBreak: { label: 'Long Break', duration: 15 * 60 },
}

const MODE_KEYS = ['work', 'shortBreak', 'longBreak']

const ACCENT = '#ff4757'
const ACCENT_RGB = '255,71,87'
const RING_SIZE = 160
const STROKE_WIDTH = 6
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.5)
    // play a second tone for a nicer chime
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.15)
    gain2.gain.setValueAtTime(0.2, ctx.currentTime + 0.15)
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.7)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(ctx.currentTime + 0.15)
    osc2.stop(ctx.currentTime + 0.7)
    setTimeout(() => ctx.close(), 1000)
  } catch {
    // Audio not available — silently ignore
  }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const styleTag = `
  @keyframes pomo-pulse {
    0%, 100% { filter: drop-shadow(0 0 8px rgba(${ACCENT_RGB},0.4)); }
    50% { filter: drop-shadow(0 0 16px rgba(${ACCENT_RGB},0.7)); }
  }
  .pomo-ring-group { transition: filter 0.3s ease; }
  .pomo-ring-group.running { animation: pomo-pulse 2s ease-in-out infinite; }
  .pomo-ring-group:not(.running) { filter: drop-shadow(0 0 8px rgba(${ACCENT_RGB},0.4)); }
  .pomo-btn {
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
    color: rgba(255,255,255,0.85);
    border-radius: 8px;
    padding: 8px 18px;
    font-size: 13px;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.2s ease;
    outline: none;
    user-select: none;
  }
  .pomo-btn:hover {
    background: rgba(255,255,255,0.12);
    border-color: rgba(255,255,255,0.2);
    box-shadow: 0 0 12px rgba(${ACCENT_RGB},0.15);
  }
  .pomo-btn:active { transform: scale(0.96); }
  .pomo-btn.primary {
    background: rgba(${ACCENT_RGB},0.2);
    border-color: rgba(${ACCENT_RGB},0.4);
    color: ${ACCENT};
  }
  .pomo-btn.primary:hover {
    background: rgba(${ACCENT_RGB},0.3);
    border-color: rgba(${ACCENT_RGB},0.5);
    box-shadow: 0 0 16px rgba(${ACCENT_RGB},0.3);
  }
  .pomo-mode-btn {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    color: rgba(255,255,255,0.5);
    border-radius: 20px;
    padding: 5px 14px;
    font-size: 11px;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.2s ease;
    outline: none;
    user-select: none;
    white-space: nowrap;
  }
  .pomo-mode-btn:hover {
    background: rgba(255,255,255,0.08);
    color: rgba(255,255,255,0.7);
  }
  .pomo-mode-btn.active {
    background: rgba(${ACCENT_RGB},0.2);
    border-color: rgba(${ACCENT_RGB},0.5);
    color: ${ACCENT};
    box-shadow: 0 0 10px rgba(${ACCENT_RGB},0.2);
  }
  .pomo-progress-track {
    stroke: rgba(255,255,255,0.06);
    transition: stroke 0.2s ease;
  }
  .pomo-progress-bar {
    stroke: ${ACCENT};
    stroke-linecap: round;
    transition: stroke-dashoffset 0.95s linear;
  }
  .pomo-dot {
    transition: all 0.3s ease;
  }
`

export function Pomodoro({ widgetId }) {
  const widget = useWidgetStore((s) => s.widgets.find((w) => w.id === widgetId))
  const updateData = useWidgetStore((s) => s.updateData)

  const data = widget?.data ?? {}

  // Restore persisted state or use defaults
  const [mode, setMode] = useState(data.mode ?? 'work')
  const [timeLeft, setTimeLeft] = useState(
    data.timeLeft ?? MODES.work.duration
  )
  const [isRunning, setIsRunning] = useState(false) // never auto-resume
  const [sessions, setSessions] = useState(data.sessions ?? 0)

  const intervalRef = useRef(null)

  // Persist state on meaningful changes
  const persist = useCallback(
    (patch) => {
      if (widgetId) updateData(widgetId, patch)
    },
    [widgetId, updateData]
  )

  // Persist when mode, timeLeft, or sessions change (debounced to avoid thrash)
  useEffect(() => {
    persist({ mode, timeLeft, sessions, isRunning: false })
  }, [mode, timeLeft, sessions]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep refs in sync for interval callback
  const modeRef = useRef(mode)
  const sessionsRef = useRef(sessions)
  useEffect(() => { modeRef.current = mode }, [mode])
  useEffect(() => { sessionsRef.current = sessions }, [sessions])

  // Timer tick + completion in one effect
  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }

    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current)
          setIsRunning(false)
          playBeep()

          const curMode = modeRef.current
          const curSessions = sessionsRef.current
          if (curMode === 'work') {
            const newSessions = curSessions + 1
            setSessions(newSessions)
            if (newSessions >= 4) {
              setMode('longBreak')
              setSessions(0)
              return MODES.longBreak.duration
            } else {
              setMode('shortBreak')
              return MODES.shortBreak.duration
            }
          } else {
            setMode('work')
            return MODES.work.duration
          }
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(intervalRef.current)
  }, [isRunning])

  const handleModeChange = useCallback(
    (newMode) => {
      setIsRunning(false)
      setMode(newMode)
      setTimeLeft(MODES[newMode].duration)
    },
    []
  )

  const handleStartPause = useCallback(() => {
    setIsRunning((prev) => !prev)
  }, [])

  const handleReset = useCallback(() => {
    setIsRunning(false)
    setTimeLeft(MODES[mode].duration)
  }, [mode])

  // Progress calculation
  const totalDuration = MODES[mode].duration
  const progress = timeLeft / totalDuration
  const dashOffset = CIRCUMFERENCE * (1 - progress)

  // Session dots
  const sessionDots = useMemo(() => {
    const dots = []
    for (let i = 0; i < 4; i++) {
      dots.push(i < sessions)
    }
    return dots
  }, [sessions])

  // Mode label for display
  const modeLabel = MODES[mode].label

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        height: '100%',
        justifyContent: 'center',
        minHeight: 0,
      }}
    >
      <style>{styleTag}</style>

      {/* Mode selector */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          flexShrink: 0,
        }}
      >
        {MODE_KEYS.map((key) => (
          <button
            key={key}
            className={`pomo-mode-btn ${mode === key ? 'active' : ''}`}
            onClick={() => handleModeChange(key)}
          >
            {MODES[key].label}
          </button>
        ))}
      </div>

      {/* Timer ring */}
      <div
        style={{
          position: 'relative',
          width: RING_SIZE,
          height: RING_SIZE,
          flexShrink: 0,
        }}
      >
        <svg
          width={RING_SIZE}
          height={RING_SIZE}
          className={`pomo-ring-group ${isRunning ? 'running' : ''}`}
          style={{ transform: 'rotate(-90deg)' }}
        >
          {/* Background track */}
          <circle
            className="pomo-progress-track"
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE_WIDTH}
          />
          {/* Progress arc */}
          <circle
            className="pomo-progress-bar"
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE_WIDTH}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
          />
        </svg>

        {/* Timer text centered in ring */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              fontSize: 36,
              fontWeight: 600,
              color: '#fff',
              letterSpacing: '0.05em',
              lineHeight: 1,
            }}
          >
            {formatTime(timeLeft)}
          </span>
          <span
            style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.35)',
              marginTop: 6,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
            }}
          >
            {modeLabel}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
        <button className="pomo-btn primary" onClick={handleStartPause}>
          {isRunning ? 'Pause' : timeLeft < totalDuration ? 'Resume' : 'Start'}
        </button>
        <button className="pomo-btn" onClick={handleReset}>
          Reset
        </button>
      </div>

      {/* Session dots */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        {sessionDots.map((filled, i) => (
          <div
            key={i}
            className="pomo-dot"
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: filled
                ? ACCENT
                : 'rgba(255,255,255,0.08)',
              border: `1.5px solid ${
                filled ? ACCENT : 'rgba(255,255,255,0.15)'
              }`,
              boxShadow: filled
                ? `0 0 8px rgba(${ACCENT_RGB},0.5)`
                : 'none',
            }}
          />
        ))}
        <span
          style={{
            fontSize: 10,
            color: 'rgba(255,255,255,0.3)',
            marginLeft: 4,
          }}
        >
          {sessions}/4
        </span>
      </div>
    </div>
  )
}
