import { useState, useCallback, useRef, useEffect } from 'react'
import { useWidgetStore } from '../../store/widgetStore'

/* ─── Answer pool ─── */
const POSITIVE = [
  'It is certain', 'It is decidedly so', 'Without a doubt',
  'Yes definitely', 'You may rely on it', 'As I see it, yes',
  'Most likely', 'Outlook good', 'Yes', 'Signs point to yes',
]
const NEUTRAL = [
  'Reply hazy, try again', 'Ask again later',
  'Better not tell you now', 'Cannot predict now',
  'Concentrate and ask again',
]
const NEGATIVE = [
  "Don't count on it", 'My reply is no', 'My sources say no',
  'Outlook not so good', 'Very doubtful',
]

const ALL_ANSWERS = [
  ...POSITIVE.map(a => ({ text: a, type: 'positive' })),
  ...NEUTRAL.map(a => ({ text: a, type: 'neutral' })),
  ...NEGATIVE.map(a => ({ text: a, type: 'negative' })),
]

function pickAnswer() {
  return ALL_ANSWERS[Math.floor(Math.random() * ALL_ANSWERS.length)]
}

function answerColor(type) {
  if (type === 'neutral') return '#feca57'
  if (type === 'negative') return '#ff6b6b'
  return '#ffffff'
}

/* ─── Styles injected once ─── */
const STYLE_ID = 'm8-style-injected'
function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return
  const el = document.createElement('style')
  el.id = STYLE_ID
  el.textContent = `
    @keyframes m8-shake {
      0%, 100% { transform: translateX(0) rotate(0deg); }
      10% { transform: translateX(-8px) rotate(-2deg); }
      20% { transform: translateX(7px) rotate(2deg); }
      30% { transform: translateX(-9px) rotate(-1deg); }
      40% { transform: translateX(6px) rotate(1deg); }
      50% { transform: translateX(-7px) rotate(-2deg); }
      60% { transform: translateX(8px) rotate(1deg); }
      70% { transform: translateX(-5px) rotate(-1deg); }
      80% { transform: translateX(6px) rotate(2deg); }
      90% { transform: translateX(-3px) rotate(0deg); }
    }

    @keyframes m8-fade-in {
      from { opacity: 0; transform: scale(0.8); }
      to   { opacity: 1; transform: scale(1); }
    }

    @keyframes m8-glow-pulse {
      0%, 100% { box-shadow: 0 0 8px rgba(30,60,180,0.4), inset 0 0 6px rgba(60,90,200,0.2); }
      50%      { box-shadow: 0 0 18px rgba(60,100,255,0.7), inset 0 0 12px rgba(80,120,255,0.35); }
    }

    .m8-ball.m8-shaking {
      animation: m8-shake 0.6s cubic-bezier(0.36,0.07,0.19,0.97) both;
    }

    .m8-answer-show {
      animation: m8-fade-in 0.3s ease-out both;
    }

    .m8-triangle-glow {
      animation: m8-glow-pulse 1s ease-in-out 2;
    }

    .m8-input:focus {
      outline: none;
      border-color: rgba(100,130,255,0.5) !important;
      box-shadow: 0 0 8px rgba(100,130,255,0.25);
    }

    .m8-btn:hover {
      background: rgba(100,130,255,0.25) !important;
      border-color: rgba(100,130,255,0.5) !important;
    }

    .m8-btn:active {
      transform: scale(0.96);
    }

    .m8-history-item {
      padding: 3px 0;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .m8-history-item:last-child { border-bottom: none; }
  `
  document.head.appendChild(el)
}

/* ─── Component ─── */
export function Magic8Ball({ widgetId }) {
  const widget = useWidgetStore(s => s.widgets.find(w => w.id === widgetId))
  const updateData = useWidgetStore(s => s.updateData)

  const [question, setQuestion] = useState('')
  const [shaking, setShaking] = useState(false)
  const [showAnswer, setShowAnswer] = useState(true)
  const [glowing, setGlowing] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => { ensureStyles() }, [])

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  const data = widget?.data || {}
  const lastAnswer = data.lastAnswer || null
  const lastType = data.lastType || null
  const history = data.history || []

  const shake = useCallback(() => {
    const q = question.trim()
    if (!q || shaking) return

    setShaking(true)
    setShowAnswer(false)
    setGlowing(false)

    timerRef.current = setTimeout(() => {
      const answer = pickAnswer()
      const newHistory = [
        { q, a: answer.text, type: answer.type },
        ...history,
      ].slice(0, 5)

      updateData(widgetId, {
        lastAnswer: answer.text,
        lastType: answer.type,
        history: newHistory,
      })

      setShaking(false)
      setShowAnswer(true)
      setGlowing(true)
      setQuestion('')

      // Stop glow after the animation plays
      timerRef.current = setTimeout(() => setGlowing(false), 2100)
    }, 650)
  }, [question, shaking, history, widgetId, updateData])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') shake()
  }, [shake])

  if (!widget) return null

  /* ─── Render ─── */
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      height: '100%',
      gap: 10,
      userSelect: 'none',
      overflow: 'hidden',
    }}>
      {/* 8-Ball */}
      <div
        className={`m8-ball${shaking ? ' m8-shaking' : ''}`}
        style={{
          width: 180,
          height: 180,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 30%, #555 0%, #222 30%, #111 60%, #000 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          flexShrink: 0,
          boxShadow: '0 8px 32px rgba(0,0,0,0.6), inset 0 -4px 12px rgba(0,0,0,0.8)',
        }}
      >
        {/* Glossy highlight overlay */}
        <div style={{
          position: 'absolute',
          top: 10,
          left: 18,
          width: 60,
          height: 40,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(255,255,255,0.18) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Blue triangle window */}
        <div
          className={glowing ? 'm8-triangle-glow' : ''}
          style={{
            width: 70,
            height: 70,
            background: '#0a0a3e',
            border: '2px solid rgba(60,90,200,0.5)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 6,
            clipPath: 'polygon(50% 8%, 95% 92%, 5% 92%)',
            WebkitClipPath: 'polygon(50% 8%, 95% 92%, 5% 92%)',
            position: 'relative',
          }}
        >
          {/* Triangle border effect via layered element */}
        </div>

        {/* Actual triangle answer overlay (rendered on top for proper text centering) */}
        <div
          className={glowing ? 'm8-triangle-glow' : ''}
          style={{
            position: 'absolute',
            width: 68,
            height: 68,
            background: '#0a0a3e',
            border: '2px solid rgba(60,90,200,0.5)',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '18px 6px 4px',
            clipPath: 'polygon(50% 5%, 97% 95%, 3% 95%)',
            WebkitClipPath: 'polygon(50% 5%, 97% 95%, 3% 95%)',
          }}
        >
          <span
            className={showAnswer && lastAnswer ? 'm8-answer-show' : ''}
            style={{
              fontSize: lastAnswer && lastAnswer !== '8' ? 9 : 22,
              fontWeight: 700,
              lineHeight: 1.15,
              color: lastAnswer ? answerColor(lastType) : 'rgba(255,255,255,0.6)',
              opacity: showAnswer ? 1 : 0,
              transition: 'opacity 0.15s',
              letterSpacing: lastAnswer ? 0 : 1,
            }}
          >
            {lastAnswer || '8'}
          </span>
        </div>
      </div>

      {/* Question input */}
      <input
        className="m8-input"
        type="text"
        placeholder="Ask a question..."
        value={question}
        onChange={e => setQuestion(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          width: '100%',
          padding: '8px 12px',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8,
          color: '#e0e0f0',
          fontSize: 13,
          fontFamily: 'inherit',
          boxSizing: 'border-box',
          transition: 'border-color 0.2s, box-shadow 0.2s',
        }}
      />

      {/* Shake button */}
      <button
        className="m8-btn"
        onClick={shake}
        disabled={shaking || !question.trim()}
        style={{
          width: '100%',
          padding: '8px 0',
          background: shaking
            ? 'rgba(100,130,255,0.18)'
            : 'rgba(100,130,255,0.12)',
          border: '1px solid rgba(100,130,255,0.3)',
          borderRadius: 8,
          color: question.trim() && !shaking ? '#c0c8ff' : 'rgba(192,200,255,0.4)',
          fontSize: 13,
          fontWeight: 600,
          cursor: question.trim() && !shaking ? 'pointer' : 'default',
          transition: 'all 0.2s',
          fontFamily: 'inherit',
        }}
      >
        {shaking ? 'Shaking...' : 'Ask the 8-Ball'}
      </button>

      {/* History */}
      {history.length > 0 && (
        <div style={{
          width: '100%',
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          marginTop: 2,
        }}>
          <div style={{
            fontSize: 10,
            color: 'rgba(255,255,255,0.3)',
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginBottom: 4,
          }}>
            Recent
          </div>
          {history.map((entry, i) => (
            <div key={i} className="m8-history-item" style={{
              fontSize: 11,
              lineHeight: 1.4,
            }}>
              <div style={{ color: 'rgba(255,255,255,0.35)' }}>
                Q: {entry.q}
              </div>
              <div style={{ color: answerColor(entry.type), fontWeight: 600 }}>
                {entry.a}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
