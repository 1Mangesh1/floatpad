import { useState, useEffect, useRef, useCallback } from 'react'
import { useWidgetStore } from '../../store/widgetStore'

const DECAY_INTERVAL = 30_000 // 30 seconds
const DECAY_AMOUNT = 3
const MAX_CATCHUP_LOSS = 50
const COOLDOWN_MS = 2000
const ACTION_BOOST = 25

function clamp(v, min = 0, max = 100) {
  return Math.max(min, Math.min(max, v))
}

function getMood(food, energy, fun) {
  const lowest = Math.min(food, energy, fun)
  if (food > 50 && energy > 50 && fun > 50) return { emoji: '😊', label: 'Happy!' }
  if (lowest === food && food < 30) return { emoji: '😿', label: 'Hungry...' }
  if (lowest === energy && energy < 30) return { emoji: '😴', label: 'Sleepy...' }
  if (lowest === fun && fun < 30) return { emoji: '😐', label: 'Bored...' }
  // Stats between 30-50 — mildly content
  if (food <= 50) return { emoji: '😿', label: 'Hungry...' }
  if (energy <= 50) return { emoji: '😴', label: 'Sleepy...' }
  return { emoji: '😐', label: 'Bored...' }
}

export function VirtualPet({ widgetId }) {
  const widget = useWidgetStore(s => s.widgets.find(w => w.id === widgetId))
  const updateData = useWidgetStore(s => s.updateData)

  const name = widget?.data?.name ?? 'Mochi'
  const food = widget?.data?.food ?? 80
  const energy = widget?.data?.energy ?? 80
  const fun = widget?.data?.fun ?? 80
  const lastTick = widget?.data?.lastTick ?? Date.now()

  const [isEditingName, setIsEditingName] = useState(!widget?.data?.name)
  const [localName, setLocalName] = useState(name)
  const [cooldowns, setCooldowns] = useState({ feed: false, sleep: false, play: false })
  const [jumping, setJumping] = useState(false)
  const [floatingTexts, setFloatingTexts] = useState([])
  const floatIdRef = useRef(0)
  const mountedRef = useRef(false)

  // Catch-up decay on mount
  useEffect(() => {
    if (mountedRef.current) return
    mountedRef.current = true
    const elapsed = Date.now() - lastTick
    if (elapsed > DECAY_INTERVAL) {
      const ticks = Math.floor(elapsed / DECAY_INTERVAL)
      const totalDecay = Math.min(ticks * DECAY_AMOUNT, MAX_CATCHUP_LOSS)
      updateData(widgetId, {
        food: clamp(food - totalDecay),
        energy: clamp(energy - totalDecay),
        fun: clamp(fun - totalDecay),
        lastTick: Date.now(),
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Periodic decay
  useEffect(() => {
    const id = setInterval(() => {
      const w = useWidgetStore.getState().widgets.find(w => w.id === widgetId)
      if (!w) return
      const d = w.data || {}
      updateData(widgetId, {
        food: clamp((d.food ?? 80) - DECAY_AMOUNT),
        energy: clamp((d.energy ?? 80) - DECAY_AMOUNT),
        fun: clamp((d.fun ?? 80) - DECAY_AMOUNT),
        lastTick: Date.now(),
      })
    }, DECAY_INTERVAL)
    return () => clearInterval(id)
  }, [widgetId, updateData])

  const addFloatingText = useCallback((text) => {
    const id = ++floatIdRef.current
    setFloatingTexts(prev => [...prev, { id, text }])
    setTimeout(() => {
      setFloatingTexts(prev => prev.filter(ft => ft.id !== id))
    }, 1000)
  }, [])

  const triggerJump = useCallback(() => {
    setJumping(true)
    setTimeout(() => setJumping(false), 300)
  }, [])

  const handleAction = useCallback((type) => {
    if (cooldowns[type]) return
    const w = useWidgetStore.getState().widgets.find(w => w.id === widgetId)
    const d = w?.data || {}

    let patch = { lastTick: Date.now() }
    if (type === 'feed') {
      patch.food = clamp((d.food ?? 80) + ACTION_BOOST)
      addFloatingText('+25 🍕')
    } else if (type === 'sleep') {
      patch.energy = clamp((d.energy ?? 80) + ACTION_BOOST)
      addFloatingText('💤 zzz')
    } else if (type === 'play') {
      patch.fun = clamp((d.fun ?? 80) + ACTION_BOOST)
      patch.energy = clamp((d.energy ?? 80) - 10)
      addFloatingText('⭐')
    }

    updateData(widgetId, patch)
    triggerJump()
    setCooldowns(prev => ({ ...prev, [type]: true }))
    setTimeout(() => {
      setCooldowns(prev => ({ ...prev, [type]: false }))
    }, COOLDOWN_MS)
  }, [cooldowns, widgetId, updateData, addFloatingText, triggerJump])

  const handleNameSubmit = () => {
    const trimmed = localName.trim() || 'Mochi'
    updateData(widgetId, { name: trimmed })
    setLocalName(trimmed)
    setIsEditingName(false)
  }

  if (!widget) return null

  const mood = getMood(food, energy, fun)
  const stats = [
    { key: 'food', label: '🍕 Food', value: food, color: '#10b981' },
    { key: 'energy', label: '⚡ Energy', value: energy, color: '#f59e0b' },
    { key: 'fun', label: '🎮 Fun', value: fun, color: '#8b5cf6' },
  ]

  return (
    <>
      <style>{`
        @keyframes pet-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes pet-jump {
          0% { transform: scale(1); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
        @keyframes pet-float-up {
          0% { opacity: 1; transform: translateY(0) translateX(-50%); }
          100% { opacity: 0; transform: translateY(-40px) translateX(-50%); }
        }
        .pet-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          height: 100%;
          gap: 8px;
          user-select: none;
          overflow: hidden;
        }
        .pet-name {
          font-size: 13px;
          font-weight: 600;
          color: rgba(255,255,255,0.8);
          letter-spacing: 0.5px;
          text-align: center;
          cursor: pointer;
        }
        .pet-name-input {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 6px;
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          text-align: center;
          padding: 3px 8px;
          outline: none;
          width: 120px;
        }
        .pet-name-input:focus {
          border-color: rgba(255,255,255,0.3);
        }
        .pet-emoji-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .pet-emoji {
          font-size: 64px;
          line-height: 1;
          animation: pet-bounce 2s ease-in-out infinite;
        }
        .pet-emoji.pet-jumping {
          animation: pet-jump 0.3s ease-in-out;
        }
        .pet-floating-text {
          position: absolute;
          top: 0;
          left: 50%;
          font-size: 16px;
          font-weight: 700;
          pointer-events: none;
          animation: pet-float-up 1s ease-out forwards;
          white-space: nowrap;
        }
        .pet-mood {
          font-size: 12px;
          color: rgba(255,255,255,0.55);
          text-align: center;
        }
        .pet-stats {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 6px;
          flex: 1;
          justify-content: center;
        }
        .pet-stat-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          color: rgba(255,255,255,0.65);
        }
        .pet-stat-label {
          width: 72px;
          flex-shrink: 0;
          white-space: nowrap;
        }
        .pet-stat-bar {
          flex: 1;
          height: 6px;
          border-radius: 3px;
          background: rgba(255,255,255,0.08);
          overflow: hidden;
        }
        .pet-stat-fill {
          height: 100%;
          border-radius: 3px;
          transition: width 0.4s ease;
        }
        .pet-stat-pct {
          width: 30px;
          text-align: right;
          flex-shrink: 0;
          font-variant-numeric: tabular-nums;
        }
        .pet-actions {
          display: flex;
          gap: 8px;
          width: 100%;
          padding-top: 4px;
        }
        .pet-btn {
          flex: 1;
          padding: 6px 0;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          background: rgba(255,255,255,0.05);
          color: rgba(255,255,255,0.8);
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
          backdrop-filter: blur(8px);
          text-align: center;
        }
        .pet-btn:hover:not(:disabled) {
          background: rgba(255,255,255,0.1);
          border-color: rgba(255,255,255,0.2);
        }
        .pet-btn:active:not(:disabled) {
          transform: scale(0.96);
        }
        .pet-btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }
      `}</style>

      <div className="pet-container">
        {/* Name */}
        {isEditingName ? (
          <input
            className="pet-name-input"
            value={localName}
            onChange={e => setLocalName(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={e => e.key === 'Enter' && handleNameSubmit()}
            maxLength={16}
            autoFocus
            placeholder="Name your pet..."
          />
        ) : (
          <div className="pet-name">{name}</div>
        )}

        {/* Pet */}
        <div className="pet-emoji-wrapper">
          <div className={`pet-emoji${jumping ? ' pet-jumping' : ''}`}>🐱</div>
          {floatingTexts.map(ft => (
            <span key={ft.id} className="pet-floating-text">{ft.text}</span>
          ))}
        </div>

        {/* Mood */}
        <div className="pet-mood">{mood.emoji} {mood.label}</div>

        {/* Stats */}
        <div className="pet-stats">
          {stats.map(s => (
            <div key={s.key} className="pet-stat-row">
              <span className="pet-stat-label">{s.label}</span>
              <div className="pet-stat-bar">
                <div
                  className="pet-stat-fill"
                  style={{ width: `${s.value}%`, background: s.color }}
                />
              </div>
              <span className="pet-stat-pct">{Math.round(s.value)}%</span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="pet-actions">
          <button
            className="pet-btn"
            onClick={() => handleAction('feed')}
            disabled={cooldowns.feed}
          >🍕 Feed</button>
          <button
            className="pet-btn"
            onClick={() => handleAction('sleep')}
            disabled={cooldowns.sleep}
          >💤 Sleep</button>
          <button
            className="pet-btn"
            onClick={() => handleAction('play')}
            disabled={cooldowns.play}
          >🎮 Play</button>
        </div>
      </div>
    </>
  )
}
