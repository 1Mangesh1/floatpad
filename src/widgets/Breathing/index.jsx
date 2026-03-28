import { useState, useEffect, useRef, useCallback } from 'react'
import { useWidgetStore } from '../../store/widgetStore'

/* ─── Breathing patterns ─── */
const PATTERNS = {
  '4-4-4-4': {
    label: 'Box',
    phases: [
      { name: 'Breathe In', duration: 4 },
      { name: 'Hold', duration: 4 },
      { name: 'Breathe Out', duration: 4 },
      { name: 'Hold', duration: 4 },
    ],
  },
  '4-7-8': {
    label: 'Relaxing',
    phases: [
      { name: 'Breathe In', duration: 4 },
      { name: 'Hold', duration: 7 },
      { name: 'Breathe Out', duration: 8 },
    ],
  },
  '5-5': {
    label: 'Simple',
    phases: [
      { name: 'Breathe In', duration: 5 },
      { name: 'Breathe Out', duration: 5 },
    ],
  },
}

/* ─── Color themes ─── */
const THEMES = {
  calm:     { label: 'Calm',     color: '#10b981', rgb: '16,185,129' },
  ocean:    { label: 'Ocean',    color: '#0ea5e9', rgb: '14,165,233' },
  lavender: { label: 'Lavender', color: '#8b5cf6', rgb: '139,92,246' },
}

/* ─── Phase type helpers ─── */
function phaseType(name) {
  if (name === 'Breathe In') return 'inhale'
  if (name === 'Breathe Out') return 'exhale'
  return 'hold'
}

function formatSessionTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/* ─── Soft chime for phase transitions ─── */
function playChime(frequency = 528, duration = 0.4) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(frequency, ctx.currentTime)
    gain.gain.setValueAtTime(0.08, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + duration)
    setTimeout(() => ctx.close(), 600)
  } catch {
    /* Audio not available */
  }
}

/* ─── Styles ─── */
const styleTag = `
  @keyframes breath-fade-in {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .breath-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 0;
    gap: 12px;
    user-select: none;
  }

  /* ── Circle area ── */
  .breath-circle-area {
    position: relative;
    width: 200px;
    height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .breath-ring {
    position: absolute;
    border-radius: 50%;
    border: 1.5px solid var(--breath-color-15);
    transition: width 0.3s ease, height 0.3s ease, opacity 0.3s ease;
  }

  .breath-core {
    position: absolute;
    border-radius: 50%;
    background: radial-gradient(
      circle at 40% 40%,
      var(--breath-color-20),
      var(--breath-color-08) 60%,
      var(--breath-color-03) 100%
    );
    transition: width 0.3s ease, height 0.3s ease;
  }

  .breath-glow {
    position: absolute;
    border-radius: 50%;
    transition: width 0.3s ease, height 0.3s ease, box-shadow 0.3s ease;
  }

  /* ── Text inside circle ── */
  .breath-text-wrap {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    pointer-events: none;
  }

  .breath-phase-text {
    font-family: 'Inter', sans-serif;
    font-size: 16px;
    font-weight: 500;
    color: rgba(255,255,255,0.9);
    letter-spacing: 0.02em;
    animation: breath-fade-in 0.4s ease;
    text-align: center;
    line-height: 1.2;
  }

  .breath-timer-text {
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 13px;
    color: rgba(255,255,255,0.4);
    letter-spacing: 0.06em;
  }

  /* ── Pattern selector pills ── */
  .breath-patterns {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
  }

  .breath-pill {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    color: rgba(255,255,255,0.45);
    border-radius: 20px;
    padding: 4px 12px;
    font-size: 11px;
    font-family: 'Inter', sans-serif;
    cursor: pointer;
    transition: all 0.25s ease;
    outline: none;
  }
  .breath-pill:hover {
    background: rgba(255,255,255,0.08);
    color: rgba(255,255,255,0.65);
  }
  .breath-pill--active {
    background: var(--breath-color-15);
    border-color: var(--breath-color-40);
    color: var(--breath-accent);
    box-shadow: 0 0 10px var(--breath-color-15);
  }
  .breath-pill--active:hover {
    background: var(--breath-color-20);
  }

  /* ── Start/Stop button ── */
  .breath-toggle {
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.12);
    color: rgba(255,255,255,0.8);
    border-radius: 24px;
    padding: 7px 24px;
    font-size: 13px;
    font-family: 'Inter', sans-serif;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.25s ease;
    outline: none;
    letter-spacing: 0.02em;
  }
  .breath-toggle:hover {
    background: rgba(255,255,255,0.1);
    border-color: rgba(255,255,255,0.2);
  }
  .breath-toggle:active {
    transform: scale(0.96);
  }
  .breath-toggle--active {
    background: var(--breath-color-15);
    border-color: var(--breath-color-40);
    color: var(--breath-accent);
    box-shadow: 0 0 16px var(--breath-color-15);
  }
  .breath-toggle--active:hover {
    background: var(--breath-color-20);
    box-shadow: 0 0 20px var(--breath-color-20);
  }

  /* ── Theme dots ── */
  .breath-themes {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-shrink: 0;
  }

  .breath-theme-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    padding: 0;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .breath-theme-dot:hover {
    transform: scale(1.3);
  }
  .breath-theme-dot--active {
    transform: scale(1.2);
    box-shadow: 0 0 0 2px rgba(255,255,255,0.5), 0 0 8px var(--dot-glow);
  }

  /* ── Footer info ── */
  .breath-footer {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-shrink: 0;
  }

  .breath-meta {
    font-size: 10px;
    color: rgba(255,255,255,0.25);
    font-family: 'Inter', sans-serif;
    letter-spacing: 0.04em;
  }
`

/* ─── Component ─── */
export function Breathing({ widgetId }) {
  const widget = useWidgetStore(s => s.widgets.find(w => w.id === widgetId))
  const updateData = useWidgetStore(s => s.updateData)

  const data = widget?.data ?? {}
  const pattern = data.pattern || '4-4-4-4'
  const theme = data.theme || 'calm'

  const themeObj = THEMES[theme] || THEMES.calm
  const patternObj = PATTERNS[pattern] || PATTERNS['4-4-4-4']
  const phases = patternObj.phases

  /* ── Local running state ── */
  const [isActive, setIsActive] = useState(false)
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [phaseElapsed, setPhaseElapsed] = useState(0)
  const [cycles, setCycles] = useState(0)
  const [sessionSeconds, setSessionSeconds] = useState(0)

  /* ── Refs for animation loop ── */
  const rafRef = useRef(null)
  const lastTickRef = useRef(0)
  const stateRef = useRef({ isActive, phaseIndex, phaseElapsed, phases })

  // Keep stateRef in sync
  useEffect(() => {
    stateRef.current = { isActive, phaseIndex, phaseElapsed, phases }
  })

  /* ── Derived values ── */
  const currentPhase = phases[phaseIndex]
  const phaseDuration = currentPhase.duration
  const remaining = Math.max(0, Math.ceil(phaseDuration - phaseElapsed))
  const pType = phaseType(currentPhase.name)

  // Scale factor: 0 = smallest (120px), 1 = largest (180px)
  let scale = 0
  if (pType === 'inhale') {
    scale = Math.min(1, phaseElapsed / phaseDuration)
  } else if (pType === 'exhale') {
    scale = Math.max(0, 1 - phaseElapsed / phaseDuration)
  } else {
    // Hold: keep at whatever size the previous phase left it
    const prevPhaseIdx = (phaseIndex - 1 + phases.length) % phases.length
    const prevType = phaseType(phases[prevPhaseIdx].name)
    scale = prevType === 'inhale' || prevType === 'hold' ? 1 : 0
  }

  // Apply easing
  let easedScale
  if (pType === 'inhale') {
    // ease-out: fast start, slow end  => 1 - (1 - t)^2
    easedScale = 1 - (1 - scale) * (1 - scale)
  } else if (pType === 'exhale') {
    // ease-in: slow start, fast end  => t^2
    easedScale = scale * scale
  } else {
    easedScale = scale
  }

  const baseDiameter = 120
  const maxDiameter = 180
  const diameter = baseDiameter + (maxDiameter - baseDiameter) * easedScale

  /* ── Animation loop via requestAnimationFrame ── */
  useEffect(() => {
    if (!isActive) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      return
    }

    lastTickRef.current = performance.now()

    const tick = (now) => {
      const dt = Math.min((now - lastTickRef.current) / 1000, 0.1)
      lastTickRef.current = now

      setPhaseElapsed(prev => {
        const st = stateRef.current
        const currentDuration = st.phases[st.phaseIndex].duration
        const next = prev + dt

        if (next >= currentDuration) {
          // Advance phase
          const nextPhaseIdx = (st.phaseIndex + 1) % st.phases.length

          // If wrapping back to 0, increment cycle
          if (nextPhaseIdx === 0) {
            setCycles(c => c + 1)
          }

          setPhaseIndex(nextPhaseIdx)
          playChime(nextPhaseIdx === 0 ? 396 : 528, 0.35)
          return 0
        }
        return next
      })

      setSessionSeconds(s => s + dt)

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [isActive])

  /* ── Handlers ── */
  const handleToggle = useCallback(() => {
    setIsActive(prev => !prev)
  }, [])

  const handlePatternChange = useCallback((p) => {
    setIsActive(false)
    setPhaseIndex(0)
    setPhaseElapsed(0)
    setCycles(0)
    setSessionSeconds(0)
    updateData(widgetId, { pattern: p })
  }, [widgetId, updateData])

  const handleThemeChange = useCallback((t) => {
    updateData(widgetId, { theme: t })
  }, [widgetId, updateData])

  /* ── CSS custom properties for theming ── */
  const cssVars = {
    '--breath-accent': themeObj.color,
    '--breath-color-03': `rgba(${themeObj.rgb},0.03)`,
    '--breath-color-08': `rgba(${themeObj.rgb},0.08)`,
    '--breath-color-15': `rgba(${themeObj.rgb},0.15)`,
    '--breath-color-20': `rgba(${themeObj.rgb},0.2)`,
    '--breath-color-40': `rgba(${themeObj.rgb},0.4)`,
  }

  /* ── Ring configuration for ripple effect ── */
  const rings = [
    { offset: 0, opacity: 0.25, delay: 0 },
    { offset: 16, opacity: 0.15, delay: 0.06 },
    { offset: 30, opacity: 0.08, delay: 0.12 },
    { offset: 42, opacity: 0.04, delay: 0.18 },
  ]

  return (
    <div className="breath-container" style={cssVars}>
      <style>{styleTag}</style>

      {/* ── Circle area ── */}
      <div className="breath-circle-area">
        {/* Outer glow */}
        <div
          className="breath-glow"
          style={{
            width: diameter + 30,
            height: diameter + 30,
            boxShadow: `0 0 ${30 + easedScale * 30}px rgba(${themeObj.rgb},${0.08 + easedScale * 0.15})`,
          }}
        />

        {/* Concentric rings with staggered sizing */}
        {rings.map((ring, i) => {
          const ringDelay = ring.delay
          // Stagger: each ring lags behind the core slightly
          let ringScale = easedScale
          if (isActive) {
            const laggedElapsed = Math.max(0, phaseElapsed - ringDelay * phaseDuration)
            const laggedRatio = Math.min(1, laggedElapsed / phaseDuration)
            if (pType === 'inhale') {
              ringScale = 1 - (1 - laggedRatio) * (1 - laggedRatio)
            } else if (pType === 'exhale') {
              const invRatio = Math.max(0, 1 - laggedElapsed / phaseDuration)
              ringScale = invRatio * invRatio
            }
          }
          const ringDiam = baseDiameter + (maxDiameter - baseDiameter) * ringScale + ring.offset
          return (
            <div
              key={i}
              className="breath-ring"
              style={{
                width: ringDiam,
                height: ringDiam,
                borderColor: `rgba(${themeObj.rgb},${ring.opacity})`,
              }}
            />
          )
        })}

        {/* Core circle */}
        <div
          className="breath-core"
          style={{
            width: diameter,
            height: diameter,
            background: `radial-gradient(circle at 40% 40%, rgba(${themeObj.rgb},0.2), rgba(${themeObj.rgb},0.08) 60%, rgba(${themeObj.rgb},0.03) 100%)`,
            boxShadow: `inset 0 0 30px rgba(${themeObj.rgb},0.1), 0 0 ${20 + easedScale * 20}px rgba(${themeObj.rgb},${0.1 + easedScale * 0.12})`,
          }}
        />

        {/* Phase text and timer */}
        <div className="breath-text-wrap">
          {isActive ? (
            <>
              <div className="breath-phase-text" key={`${phaseIndex}-${cycles}`}>
                {currentPhase.name}
              </div>
              <div className="breath-timer-text">{remaining}</div>
            </>
          ) : (
            <div
              className="breath-phase-text"
              style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}
            >
              Ready
            </div>
          )}
        </div>
      </div>

      {/* ── Pattern selector ── */}
      <div className="breath-patterns">
        {Object.keys(PATTERNS).map(key => (
          <button
            key={key}
            className={`breath-pill${pattern === key ? ' breath-pill--active' : ''}`}
            onClick={() => handlePatternChange(key)}
          >
            {key}
          </button>
        ))}
      </div>

      {/* ── Start / Stop ── */}
      <button
        className={`breath-toggle${isActive ? ' breath-toggle--active' : ''}`}
        onClick={handleToggle}
      >
        {isActive ? 'Stop' : 'Start'}
      </button>

      {/* ── Theme dots ── */}
      <div className="breath-themes">
        {Object.keys(THEMES).map(key => (
          <button
            key={key}
            className={`breath-theme-dot${theme === key ? ' breath-theme-dot--active' : ''}`}
            title={THEMES[key].label}
            style={{
              background: THEMES[key].color,
              '--dot-glow': THEMES[key].color,
            }}
            onClick={() => handleThemeChange(key)}
          />
        ))}
      </div>

      {/* ── Footer: cycle count + session time ── */}
      <div className="breath-footer">
        {isActive || cycles > 0 ? (
          <>
            <span className="breath-meta">Cycle {cycles + (isActive ? 1 : 0)}</span>
            <span className="breath-meta">
              {formatSessionTime(Math.floor(sessionSeconds))}
            </span>
          </>
        ) : (
          <span className="breath-meta">{patternObj.label} breathing</span>
        )}
      </div>
    </div>
  )
}
