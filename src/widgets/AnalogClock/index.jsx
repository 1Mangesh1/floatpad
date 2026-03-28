import { useRef, useEffect, useState, useCallback } from 'react'
import { useWidgetStore } from '../../store/widgetStore'

const STYLES = {
  minimal: {
    label: 'Minimal',
    accent: '#ffffff',
    faceColor: 'rgba(255,255,255,0.04)',
    rimColor: 'rgba(255,255,255,0.12)',
    hourHandColor: '#e0e0e0',
    minuteHandColor: '#c8c8c8',
    secondHandColor: '#ffffff',
    markerColor: 'rgba(255,255,255,0.7)',
    minorMarkerColor: 'rgba(255,255,255,0.15)',
    textColor: 'rgba(255,255,255,0.5)',
    digitalColor: 'rgba(255,255,255,0.6)',
    showAllHours: false,
    showMinuteMarkers: false,
    numeralType: 'none',
    glow: false,
  },
  classic: {
    label: 'Classic',
    accent: '#d4a574',
    faceColor: 'rgba(212,165,116,0.04)',
    rimColor: 'rgba(212,165,116,0.2)',
    hourHandColor: '#d4a574',
    minuteHandColor: '#c49a6c',
    secondHandColor: '#d4a574',
    markerColor: 'rgba(212,165,116,0.8)',
    minorMarkerColor: 'rgba(212,165,116,0.25)',
    textColor: 'rgba(212,165,116,0.7)',
    digitalColor: 'rgba(212,165,116,0.6)',
    showAllHours: true,
    showMinuteMarkers: true,
    numeralType: 'roman',
    glow: false,
  },
  neon: {
    label: 'Neon',
    accent: '#00d2ff',
    faceColor: 'rgba(0,210,255,0.03)',
    rimColor: 'rgba(0,210,255,0.3)',
    hourHandColor: '#00d2ff',
    minuteHandColor: '#00b8e6',
    secondHandColor: '#00d2ff',
    markerColor: 'rgba(0,210,255,0.9)',
    minorMarkerColor: 'rgba(0,210,255,0.25)',
    textColor: 'rgba(0,210,255,0.7)',
    digitalColor: 'rgba(0,210,255,0.7)',
    showAllHours: true,
    showMinuteMarkers: true,
    numeralType: 'arabic',
    glow: true,
  },
}

const ROMAN = ['XII','I','II','III','IV','V','VI','VII','VIII','IX','X','XI']

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function formatTime(date) {
  let h = date.getHours()
  const m = date.getMinutes()
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`
}

function formatDate(date) {
  return `${DAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`
}

export function AnalogClock({ widgetId }) {
  const widget = useWidgetStore(s => s.widgets.find(w => w.id === widgetId))
  const updateData = useWidgetStore(s => s.updateData)

  const style = widget?.data?.style ?? 'minimal'
  const theme = STYLES[style]

  const rafRef = useRef(null)
  const [now, setNow] = useState(() => new Date())

  // Smooth animation loop
  useEffect(() => {
    let running = true
    const tick = () => {
      if (!running) return
      setNow(new Date())
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      running = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const setStyle = useCallback((s) => {
    updateData(widgetId, { style: s })
  }, [widgetId, updateData])

  // Clock math
  const hours = now.getHours() % 12
  const minutes = now.getMinutes()
  const seconds = now.getSeconds()
  const millis = now.getMilliseconds()

  const hourDeg = (360 / 12) * hours + (360 / 12 / 60) * minutes
  const minuteDeg = (360 / 60) * minutes + (360 / 60 / 60) * seconds
  const secondDeg = (360 / 60) * seconds + (360 / 60) * (millis / 1000)

  const CX = 100
  const CY = 100
  const R = 90

  // Generate filter IDs unique to this widget to avoid SVG filter collisions
  const filterId = `clock-glow-${widgetId}`
  const shadowId = `clock-shadow-${widgetId}`
  const tipGlowId = `clock-tip-${widgetId}`

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      gap: 4,
      userSelect: 'none',
    }}>
      <style>{`
        .clock-style-btn {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.5);
          font-size: 10px;
          padding: 3px 10px;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          letter-spacing: 0.5px;
        }
        .clock-style-btn:hover {
          background: rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.8);
        }
        .clock-style-btn.clock-active {
          border-color: var(--clock-accent);
          color: var(--clock-accent);
          background: rgba(255,255,255,0.08);
        }
      `}</style>

      <svg
        viewBox="0 0 200 200"
        width="200"
        height="200"
        style={{ flexShrink: 0 }}
      >
        <defs>
          {/* Glow filter for neon style */}
          <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Subtle hand shadow */}
          <filter id={shadowId} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0.5" dy="1" stdDeviation="1" floodColor="rgba(0,0,0,0.5)" />
          </filter>
          {/* Tip glow for second hand */}
          <filter id={tipGlowId} x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Face background */}
        <circle
          cx={CX} cy={CY} r={R}
          fill={theme.faceColor}
          stroke={theme.rimColor}
          strokeWidth={theme.glow ? 1.5 : 1}
          filter={theme.glow ? `url(#${filterId})` : undefined}
        />

        {/* Inner decorative ring */}
        <circle
          cx={CX} cy={CY} r={R - 4}
          fill="none"
          stroke={theme.rimColor}
          strokeWidth={0.3}
          opacity={0.5}
        />

        {/* Minute markers (60 ticks) */}
        {theme.showMinuteMarkers && Array.from({ length: 60 }, (_, i) => {
          if (i % 5 === 0) return null  // skip hour positions
          const angle = (i * 6 - 90) * (Math.PI / 180)
          const outerR = R - 6
          const innerR = R - 10
          return (
            <line
              key={`m${i}`}
              x1={CX + Math.cos(angle) * innerR}
              y1={CY + Math.sin(angle) * innerR}
              x2={CX + Math.cos(angle) * outerR}
              y2={CY + Math.sin(angle) * outerR}
              stroke={theme.minorMarkerColor}
              strokeWidth={0.5}
              strokeLinecap="round"
              filter={theme.glow ? `url(#${filterId})` : undefined}
            />
          )
        })}

        {/* Hour markers (12 ticks) */}
        {Array.from({ length: 12 }, (_, i) => {
          const isMajor = i % 3 === 0
          // In minimal mode, only show major markers
          if (style === 'minimal' && !isMajor) return null
          const angle = (i * 30 - 90) * (Math.PI / 180)
          const outerR = R - 6
          const innerR = isMajor ? R - 20 : R - 14
          const width = isMajor ? 2 : 1
          return (
            <line
              key={`h${i}`}
              x1={CX + Math.cos(angle) * innerR}
              y1={CY + Math.sin(angle) * innerR}
              x2={CX + Math.cos(angle) * outerR}
              y2={CY + Math.sin(angle) * outerR}
              stroke={theme.markerColor}
              strokeWidth={width}
              strokeLinecap="round"
              filter={theme.glow ? `url(#${filterId})` : undefined}
            />
          )
        })}

        {/* Hour numerals */}
        {theme.showAllHours && Array.from({ length: 12 }, (_, i) => {
          const angle = (i * 30 - 90) * (Math.PI / 180)
          const textR = R - 28
          const label = theme.numeralType === 'roman' ? ROMAN[i] : (i === 0 ? '12' : String(i))
          return (
            <text
              key={`n${i}`}
              x={CX + Math.cos(angle) * textR}
              y={CY + Math.sin(angle) * textR}
              fill={theme.textColor}
              fontSize={theme.numeralType === 'roman' ? 9 : 10}
              fontFamily="'Georgia', 'Times New Roman', serif"
              fontWeight={i % 3 === 0 ? '700' : '400'}
              textAnchor="middle"
              dominantBaseline="central"
              filter={theme.glow ? `url(#${filterId})` : undefined}
            >
              {label}
            </text>
          )
        })}

        {/* Hour hand */}
        <line
          x1={CX}
          y1={CY}
          x2={CX}
          y2={CY - 48}
          stroke={theme.hourHandColor}
          strokeWidth={4.5}
          strokeLinecap="round"
          filter={`url(#${shadowId})`}
          transform={`rotate(${hourDeg}, ${CX}, ${CY})`}
        />

        {/* Minute hand */}
        <line
          x1={CX}
          y1={CY}
          x2={CX}
          y2={CY - 68}
          stroke={theme.minuteHandColor}
          strokeWidth={2.5}
          strokeLinecap="round"
          filter={`url(#${shadowId})`}
          transform={`rotate(${minuteDeg}, ${CX}, ${CY})`}
        />

        {/* Second hand — tail + main + tip */}
        <g
          transform={`rotate(${secondDeg}, ${CX}, ${CY})`}
          filter={theme.glow ? `url(#${filterId})` : undefined}
        >
          {/* Tail (counterweight) */}
          <line
            x1={CX}
            y1={CY + 18}
            x2={CX}
            y2={CY}
            stroke={theme.secondHandColor}
            strokeWidth={1.2}
            strokeLinecap="round"
            opacity={0.6}
          />
          {/* Main shaft */}
          <line
            x1={CX}
            y1={CY}
            x2={CX}
            y2={CY - 76}
            stroke={theme.secondHandColor}
            strokeWidth={0.8}
            strokeLinecap="round"
          />
          {/* Tip glow dot */}
          <circle
            cx={CX}
            cy={CY - 76}
            r={1.8}
            fill={theme.secondHandColor}
            filter={`url(#${tipGlowId})`}
          />
        </g>

        {/* Center pivot */}
        <circle
          cx={CX} cy={CY} r={4}
          fill={style === 'minimal' ? '#1a1a2e' : style === 'classic' ? '#1a1a2e' : '#0a0a14'}
          stroke={theme.accent}
          strokeWidth={1.5}
        />
        <circle
          cx={CX} cy={CY} r={1.5}
          fill={theme.accent}
        />
      </svg>

      {/* Digital time */}
      <div style={{
        fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
        fontSize: 15,
        color: theme.digitalColor,
        letterSpacing: 1.5,
        marginTop: 2,
        textShadow: theme.glow ? `0 0 8px ${theme.accent}` : 'none',
      }}>
        {formatTime(now)}
      </div>

      {/* Date */}
      <div style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        fontSize: 10,
        color: theme.textColor,
        letterSpacing: 0.8,
        opacity: 0.7,
        marginTop: -1,
      }}>
        {formatDate(now)}
      </div>

      {/* Style switcher */}
      <div style={{
        display: 'flex',
        gap: 6,
        marginTop: 6,
        '--clock-accent': theme.accent,
      }}>
        {Object.entries(STYLES).map(([key, s]) => (
          <button
            key={key}
            className={`clock-style-btn${style === key ? ' clock-active' : ''}`}
            style={style === key ? { '--clock-accent': s.accent, borderColor: s.accent, color: s.accent } : undefined}
            onClick={() => setStyle(key)}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}
