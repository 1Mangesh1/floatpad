import { useState, useEffect, useRef, useCallback, memo } from 'react'
import { useWidgetStore } from '../../store/widgetStore'

// ── Note Definitions (C4 to B5 — 2 octaves, 24 notes) ─────────

const NOTE_NAMES = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
]

const NOTES = []
for (let octave = 4; octave <= 5; octave++) {
  for (let i = 0; i < 12; i++) {
    const name = NOTE_NAMES[i]
    const midi = (octave + 1) * 12 + i // MIDI note number
    const freq = 440 * Math.pow(2, (midi - 69) / 12) // A4 = 440
    const isBlack = name.includes('#')
    NOTES.push({
      id: `${name}${octave}`,
      name,
      octave,
      freq: Math.round(freq * 100) / 100,
      isBlack,
      midi,
    })
  }
}

// White keys only (for layout indexing)
const WHITE_NOTES = NOTES.filter((n) => !n.isBlack)
const BLACK_NOTES = NOTES.filter((n) => n.isBlack)

// Keyboard mapping: bottom row A-L for white keys, top row W-O for black keys
// A=C4, S=D4, D=E4, F=F4, G=G4, H=A4, J=B4, K=C5, L=D5
// Then we extend: ;=E5, '=F5 won't work well, so map what fits
const WHITE_KEY_MAP = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'", 'z', 'x', 'c']
const BLACK_KEY_MAP = ['w', 'e', '', 't', 'y', 'u', '', 'o', 'p', '', '[', ']', '']
// Map: black keys correspond to sharps between white keys
// C#=W, D#=E, F#=T, G#=Y, A#=U, C#5=O, D#5=P, F#5=[, G#5=], A#5= (none)

// Build a lookup: keyboard key -> note id
const KEY_TO_NOTE = {}
WHITE_NOTES.forEach((note, i) => {
  if (WHITE_KEY_MAP[i]) KEY_TO_NOTE[WHITE_KEY_MAP[i]] = note.id
})

// Black key mapping: index within each octave
// In octave 4: C#=0, D#=1, F#=2, G#=3, A#=4 -> map to w, e, t, y, u
// In octave 5: C#=5, D#=6, F#=7, G#=8, A#=9 -> map to o, p, [, ], (none)
const BLACK_KEYBOARD = ['w', 'e', 't', 'y', 'u', 'o', 'p', '[', ']', '\\']
BLACK_NOTES.forEach((note, i) => {
  if (BLACK_KEYBOARD[i]) KEY_TO_NOTE[BLACK_KEYBOARD[i]] = note.id
})

// Reverse lookup: note id -> keyboard key (for labels)
const NOTE_TO_KEY = {}
Object.entries(KEY_TO_NOTE).forEach(([k, v]) => {
  NOTE_TO_KEY[v] = k.toUpperCase()
})

// Note lookup by id
const NOTE_BY_ID = {}
NOTES.forEach((n) => {
  NOTE_BY_ID[n.id] = n
})

// ── Waveform Config ─────────────────────────────────────────────

const WAVEFORMS = [
  { type: 'sine', label: 'SIN', color: '#00d2ff' },
  { type: 'square', label: 'SQR', color: '#ff4757' },
  { type: 'sawtooth', label: 'SAW', color: '#ffa502' },
  { type: 'triangle', label: 'TRI', color: '#2ed573' },
]

const WAVEFORM_COLORS = {}
WAVEFORMS.forEach((w) => {
  WAVEFORM_COLORS[w.type] = w.color
})

// ── Audio Engine ────────────────────────────────────────────────

function getOrCreateCtx(ref) {
  if (!ref.current) {
    ref.current = new (window.AudioContext || window.webkitAudioContext)()
  }
  if (ref.current.state === 'suspended') {
    ref.current.resume()
  }
  return ref.current
}

function startNote(ctx, noteId, waveform, attack, volume, masterGain) {
  const note = NOTE_BY_ID[noteId]
  if (!note) return null
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = waveform
  osc.frequency.setValueAtTime(note.freq, now)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(Math.max(volume, 0.001), now + attack)
  osc.connect(gain).connect(masterGain)
  osc.start(now)
  return { osc, gain }
}

function stopNote(ctx, voice, release) {
  if (!voice) return
  const now = ctx.currentTime
  const { osc, gain } = voice
  gain.gain.cancelScheduledValues(now)
  gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.001), now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + release)
  osc.stop(now + release + 0.05)
}

// ── Knob Component ──────────────────────────────────────────────

const Knob = memo(function Knob({ value, min, max, label, color, format, onChange }) {
  const knobRef = useRef(null)

  const ratio = (value - min) / (max - min)
  const angle = 135 + ratio * 270 // 135deg to 405deg

  const displayVal = format ? format(value) : value.toFixed(2)

  const handleMouseDown = useCallback(
    (e) => {
      e.preventDefault()
      e.stopPropagation()
      const startY = e.clientY
      const startVal = value

      const handleMouseMove = (ev) => {
        const dy = startY - ev.clientY // up = positive
        const range = max - min
        const sensitivity = range / 100
        let newVal = startVal + dy * sensitivity
        newVal = Math.max(min, Math.min(max, newVal))
        onChange(newVal)
      }

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [value, min, max, onChange]
  )

  return (
    <div style={knobStyles.wrapper}>
      <div
        ref={knobRef}
        style={{
          ...knobStyles.knob,
          borderColor: `${color}44`,
          boxShadow: `0 0 8px ${color}22, inset 0 0 6px rgba(0,0,0,0.4)`,
        }}
        onMouseDown={handleMouseDown}
      >
        <div
          style={{
            ...knobStyles.indicator,
            transform: `rotate(${angle}deg)`,
          }}
        >
          <div
            style={{
              ...knobStyles.dot,
              background: color,
              boxShadow: `0 0 4px ${color}`,
            }}
          />
        </div>
        {/* Arc track */}
        <svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
        >
          <circle
            cx="16"
            cy="16"
            r="14"
            fill="none"
            stroke={`${color}18`}
            strokeWidth="2"
            strokeDasharray="88"
            strokeDashoffset="22"
            transform="rotate(135 16 16)"
          />
          <circle
            cx="16"
            cy="16"
            r="14"
            fill="none"
            stroke={`${color}66`}
            strokeWidth="2"
            strokeDasharray={`${ratio * 66} 88`}
            strokeDashoffset="0"
            transform="rotate(135 16 16)"
          />
        </svg>
      </div>
      <div style={knobStyles.label}>{label}</div>
      <div style={{ ...knobStyles.value, color }}>{displayVal}</div>
    </div>
  )
})

const knobStyles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
  },
  knob: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: '2px solid',
    background: 'radial-gradient(circle at 40% 35%, rgba(60,60,80,0.9), rgba(20,20,35,0.95))',
    position: 'relative',
    cursor: 'ns-resize',
    userSelect: 'none',
  },
  indicator: {
    position: 'absolute',
    top: 0,
    left: '50%',
    width: 0,
    height: '50%',
    transformOrigin: 'bottom center',
    marginLeft: -1,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: '50%',
    position: 'absolute',
    top: 2,
    left: -1,
  },
  label: {
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: '0.08em',
    color: 'rgba(200,200,220,0.6)',
    textTransform: 'uppercase',
    marginTop: 1,
  },
  value: {
    fontSize: 9,
    fontWeight: 600,
    fontFamily: 'ui-monospace, Consolas, monospace',
  },
}

// ── Piano Key Components ────────────────────────────────────────

const WhiteKey = memo(function WhiteKey({ noteId, active, accentColor, keyLabel, onDown, onUp, onEnter }) {
  return (
    <div
      data-note={noteId}
      onMouseDown={(e) => { e.preventDefault(); onDown(noteId) }}
      onMouseUp={() => onUp(noteId)}
      onMouseEnter={(e) => { if (e.buttons === 1) onEnter(noteId) }}
      onMouseLeave={(e) => { if (e.buttons === 1) onUp(noteId) }}
      style={{
        width: 30,
        height: 120,
        background: active
          ? `linear-gradient(180deg, ${accentColor}55 0%, ${accentColor}33 40%, rgba(220,220,240,0.85) 100%)`
          : 'linear-gradient(180deg, rgba(240,240,250,0.95) 0%, rgba(200,200,220,0.85) 100%)',
        borderRadius: '0 0 6px 6px',
        border: '1px solid rgba(100,100,120,0.3)',
        borderTop: 'none',
        position: 'relative',
        cursor: 'pointer',
        transform: active ? 'translateY(2px)' : 'translateY(0)',
        transition: 'transform 0.06s, background 0.08s, box-shadow 0.1s',
        boxShadow: active
          ? `0 2px 12px ${accentColor}44, inset 0 -2px 4px rgba(0,0,0,0.05)`
          : '0 4px 8px rgba(0,0,0,0.3), inset 0 -2px 4px rgba(0,0,0,0.05)',
        flexShrink: 0,
        zIndex: 1,
        userSelect: 'none',
      }}
    >
      {keyLabel && (
        <span
          style={{
            position: 'absolute',
            bottom: 6,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 8,
            fontWeight: 700,
            color: active ? accentColor : 'rgba(80,80,100,0.5)',
            fontFamily: 'ui-monospace, Consolas, monospace',
            pointerEvents: 'none',
            transition: 'color 0.1s',
          }}
        >
          {keyLabel}
        </span>
      )}
      <span
        style={{
          position: 'absolute',
          bottom: 18,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 7,
          fontWeight: 600,
          color: active ? accentColor : 'rgba(80,80,100,0.35)',
          fontFamily: 'ui-monospace, Consolas, monospace',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        {noteId}
      </span>
    </div>
  )
})

const BlackKey = memo(function BlackKey({ noteId, active, accentColor, keyLabel, onDown, onUp, onEnter, leftOffset }) {
  return (
    <div
      data-note={noteId}
      onMouseDown={(e) => { e.preventDefault(); onDown(noteId) }}
      onMouseUp={() => onUp(noteId)}
      onMouseEnter={(e) => { if (e.buttons === 1) onEnter(noteId) }}
      onMouseLeave={(e) => { if (e.buttons === 1) onUp(noteId) }}
      style={{
        width: 20,
        height: 75,
        background: active
          ? `linear-gradient(180deg, ${accentColor}88 0%, #1a1a2e 60%)`
          : 'linear-gradient(180deg, #2a2a3e 0%, #1a1a2e 50%, #111122 100%)',
        borderRadius: '0 0 4px 4px',
        border: '1px solid rgba(50,50,70,0.5)',
        borderTop: 'none',
        position: 'absolute',
        top: 0,
        left: leftOffset,
        cursor: 'pointer',
        transform: active ? 'translateY(2px)' : 'translateY(0)',
        transition: 'transform 0.06s, background 0.08s, box-shadow 0.1s',
        boxShadow: active
          ? `0 0 14px ${accentColor}66, 0 2px 6px rgba(0,0,0,0.5)`
          : '0 3px 6px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.05)',
        zIndex: 2,
        userSelect: 'none',
      }}
    >
      {keyLabel && (
        <span
          style={{
            position: 'absolute',
            bottom: 5,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 7,
            fontWeight: 700,
            color: active ? accentColor : 'rgba(150,150,180,0.4)',
            fontFamily: 'ui-monospace, Consolas, monospace',
            pointerEvents: 'none',
            transition: 'color 0.1s',
          }}
        >
          {keyLabel}
        </span>
      )}
    </div>
  )
})

// ── Black key left offsets ──────────────────────────────────────
// Black keys sit between specific white keys. For a standard piano layout:
// C#: between C and D, D#: between D and E, F#: between F and G, etc.

function getBlackKeyOffsets() {
  // Map each black note to its position relative to white keys
  const offsets = {}
  const whiteKeyWidth = 30
  const blackKeyWidth = 20

  const gap = 2 // matches flex gap between white keys

  // For each black note, figure out which white key index it sits after
  let whiteIdx = 0
  for (let octave = 4; octave <= 5; octave++) {
    for (let i = 0; i < 12; i++) {
      const name = NOTE_NAMES[i]
      const noteId = `${name}${octave}`
      if (!name.includes('#')) {
        whiteIdx++
      } else {
        // Black key sits between the previous white key and the next
        // Account for the gap between white keys
        const leftWhitePos = (whiteIdx - 1) * (whiteKeyWidth + gap)
        offsets[noteId] = leftWhitePos + whiteKeyWidth - blackKeyWidth / 2 + gap / 2
      }
    }
  }
  return offsets
}

const BLACK_KEY_OFFSETS = getBlackKeyOffsets()

// ── Main Component ──────────────────────────────────────────────

export function MiniSynth({ widgetId }) {
  const widget = useWidgetStore((s) => s.widgets.find((w) => w.id === widgetId))
  const updateData = useWidgetStore((s) => s.updateData)

  const waveform = widget?.data?.waveform ?? 'sine'
  const attack = widget?.data?.attack ?? 0.05
  const release = widget?.data?.release ?? 0.3
  const volume = widget?.data?.volume ?? 0.7

  const [activeNotes, setActiveNotes] = useState(new Set())

  const audioCtxRef = useRef(null)
  const masterGainRef = useRef(null)
  const voicesRef = useRef(new Map()) // noteId -> { osc, gain }
  const activeNotesRef = useRef(new Set())
  const paramsRef = useRef({ waveform, attack, release, volume })

  // Keep params ref in sync
  useEffect(() => {
    paramsRef.current = { waveform, attack, release, volume }
  }, [waveform, attack, release, volume])

  // Update master gain when volume changes
  useEffect(() => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.setValueAtTime(volume, audioCtxRef.current?.currentTime ?? 0)
    }
  }, [volume])

  const accentColor = WAVEFORM_COLORS[waveform] || '#00d2ff'

  // ── Note on / off ───────────────────────────────────────────
  const noteOn = useCallback(
    (noteId) => {
      if (activeNotesRef.current.has(noteId)) return
      const ctx = getOrCreateCtx(audioCtxRef)
      if (!masterGainRef.current) {
        masterGainRef.current = ctx.createGain()
        masterGainRef.current.gain.setValueAtTime(paramsRef.current.volume, ctx.currentTime)
        masterGainRef.current.connect(ctx.destination)
      }
      const { waveform: wf, attack: atk, volume: vol } = paramsRef.current
      const voice = startNote(ctx, noteId, wf, atk, vol, masterGainRef.current)
      if (voice) {
        // Stop any existing voice for this note
        if (voicesRef.current.has(noteId)) {
          stopNote(ctx, voicesRef.current.get(noteId), 0.01)
        }
        voicesRef.current.set(noteId, voice)
        activeNotesRef.current.add(noteId)
        setActiveNotes(new Set(activeNotesRef.current))
      }
    },
    []
  )

  const noteOff = useCallback(
    (noteId) => {
      if (!activeNotesRef.current.has(noteId)) return
      const ctx = audioCtxRef.current
      if (ctx && voicesRef.current.has(noteId)) {
        stopNote(ctx, voicesRef.current.get(noteId), paramsRef.current.release)
        voicesRef.current.delete(noteId)
      }
      activeNotesRef.current.delete(noteId)
      setActiveNotes(new Set(activeNotesRef.current))
    },
    []
  )

  // Glide: mouse enters a key while dragging
  const noteEnter = useCallback(
    (noteId) => {
      // Stop all currently active notes except this one, start this one
      const toStop = [...activeNotesRef.current].filter((id) => id !== noteId)
      toStop.forEach((id) => noteOff(id))
      noteOn(noteId)
    },
    [noteOn, noteOff]
  )

  // Global mouse up: release all notes (in case mouse leaves the keyboard)
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      const toStop = [...activeNotesRef.current]
      toStop.forEach((id) => noteOff(id))
    }
    document.addEventListener('mouseup', handleGlobalMouseUp)
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp)
  }, [noteOff])

  // ── Keyboard shortcuts ──────────────────────────────────────
  useEffect(() => {
    const pressed = new Set()

    const handleKeyDown = (e) => {
      if (e.repeat) return
      const key = e.key.toLowerCase()
      const noteId = KEY_TO_NOTE[key]
      if (noteId && !pressed.has(key)) {
        pressed.add(key)
        noteOn(noteId)
      }
    }

    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase()
      const noteId = KEY_TO_NOTE[key]
      if (noteId) {
        pressed.delete(key)
        noteOff(noteId)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [noteOn, noteOff])

  // Cleanup on unmount
  useEffect(() => {
    const voices = voicesRef.current
    return () => {
      voices.forEach((voice) => {
        try { voice.osc.stop() } catch { /* already stopped */ }
      })
      voices.clear()
    }
  }, [])

  // ── Handlers ────────────────────────────────────────────────
  const setWaveform = useCallback(
    (wf) => updateData(widgetId, { waveform: wf }),
    [widgetId, updateData]
  )
  const setAttack = useCallback(
    (v) => updateData(widgetId, { attack: Math.round(v * 100) / 100 }),
    [widgetId, updateData]
  )
  const setRelease = useCallback(
    (v) => updateData(widgetId, { release: Math.round(v * 100) / 100 }),
    [widgetId, updateData]
  )
  const setVolume = useCallback(
    (v) => updateData(widgetId, { volume: Math.round(v * 100) / 100 }),
    [widgetId, updateData]
  )

  if (!widget) return null

  return (
    <div style={styles.root}>
      <style>{`
        @keyframes synth-glow-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        .synth-waveform-btn {
          border: none;
          cursor: pointer;
          font-family: ui-monospace, Consolas, monospace;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
          padding: 4px 10px;
          border-radius: 10px;
          transition: all 0.15s ease;
          user-select: none;
          outline: none;
        }
        .synth-waveform-btn:hover {
          transform: translateY(-1px);
        }
      `}</style>

      {/* Waveform Selector */}
      <div style={styles.waveformRow}>
        {WAVEFORMS.map((wf) => {
          const isActive = waveform === wf.type
          return (
            <button
              key={wf.type}
              className="synth-waveform-btn"
              onClick={() => setWaveform(wf.type)}
              style={{
                background: isActive
                  ? `${wf.color}33`
                  : 'rgba(255,255,255,0.04)',
                color: isActive ? wf.color : 'rgba(200,200,220,0.5)',
                border: isActive
                  ? `1px solid ${wf.color}66`
                  : '1px solid rgba(255,255,255,0.08)',
                boxShadow: isActive ? `0 0 10px ${wf.color}22` : 'none',
              }}
            >
              {wf.label}
            </button>
          )
        })}
      </div>

      {/* Controls Row */}
      <div style={styles.controlsRow}>
        <Knob
          value={attack}
          min={0.01}
          max={0.5}
          label="ATK"
          color={accentColor}
          format={(v) => `${(v * 1000).toFixed(0)}ms`}
          onChange={setAttack}
        />
        <Knob
          value={release}
          min={0.1}
          max={2.0}
          label="REL"
          color={accentColor}
          format={(v) => `${v.toFixed(1)}s`}
          onChange={setRelease}
        />
        <Knob
          value={volume}
          min={0}
          max={1}
          label="VOL"
          color={accentColor}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={setVolume}
        />
      </div>

      {/* Piano Keyboard */}
      <div style={styles.keyboardContainer}>
        <div style={styles.keyboard}>
          {/* White keys */}
          <div style={styles.whiteKeys}>
            {WHITE_NOTES.map((note) => (
              <WhiteKey
                key={note.id}
                noteId={note.id}
                active={activeNotes.has(note.id)}
                accentColor={accentColor}
                keyLabel={NOTE_TO_KEY[note.id]}
                onDown={noteOn}
                onUp={noteOff}
                onEnter={noteEnter}
              />
            ))}
          </div>
          {/* Black keys (absolutely positioned) */}
          {BLACK_NOTES.map((note) => (
            <BlackKey
              key={note.id}
              noteId={note.id}
              active={activeNotes.has(note.id)}
              accentColor={accentColor}
              keyLabel={NOTE_TO_KEY[note.id]}
              onDown={noteOn}
              onUp={noteOff}
              onEnter={noteEnter}
              leftOffset={BLACK_KEY_OFFSETS[note.id]}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

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
  waveformRow: {
    display: 'flex',
    gap: 6,
    justifyContent: 'center',
    flexShrink: 0,
  },
  controlsRow: {
    display: 'flex',
    gap: 20,
    justifyContent: 'center',
    alignItems: 'flex-start',
    flexShrink: 0,
    padding: '2px 0',
  },
  keyboardContainer: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  keyboard: {
    position: 'relative',
    display: 'inline-flex',
    height: 120,
  },
  whiteKeys: {
    display: 'flex',
    gap: 2,
    height: '100%',
  },
}
