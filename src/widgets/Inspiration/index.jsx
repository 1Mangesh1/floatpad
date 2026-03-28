import { useState, useEffect, useCallback, useRef } from 'react'
import { useWidgetStore } from '../../store/widgetStore'

const QUOTES = [
  { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
  { text: 'In the middle of difficulty lies opportunity.', author: 'Albert Einstein' },
  { text: 'Simplicity is the ultimate sophistication.', author: 'Leonardo da Vinci' },
  { text: 'Imagination is more important than knowledge.', author: 'Albert Einstein' },
  { text: 'The unexamined life is not worth living.', author: 'Socrates' },
  { text: 'To be yourself in a world that is constantly trying to make you something else is the greatest accomplishment.', author: 'Ralph Waldo Emerson' },
  { text: 'Have no fear of perfection — you\'ll never reach it.', author: 'Salvador Dali' },
  { text: 'Everything you can imagine is real.', author: 'Pablo Picasso' },
  { text: 'The best time to plant a tree was twenty years ago. The second best time is now.', author: 'Chinese Proverb' },
  { text: 'Stay hungry, stay foolish.', author: 'Stewart Brand' },
  { text: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.', author: 'Aristotle' },
  { text: 'I have not failed. I\'ve just found 10,000 ways that won\'t work.', author: 'Thomas Edison' },
  { text: 'The purpose of life is not to be happy. It is to be useful, to be honorable, to be compassionate.', author: 'Ralph Waldo Emerson' },
  { text: 'It does not matter how slowly you go as long as you do not stop.', author: 'Confucius' },
  { text: 'Creativity is intelligence having fun.', author: 'Albert Einstein' },
  { text: 'The only true wisdom is in knowing you know nothing.', author: 'Socrates' },
  { text: 'Do what you can, with what you have, where you are.', author: 'Theodore Roosevelt' },
  { text: 'One must still have chaos in oneself to be able to give birth to a dancing star.', author: 'Friedrich Nietzsche' },
  { text: 'The details are not the details. They make the design.', author: 'Charles Eames' },
  { text: 'First, solve the problem. Then, write the code.', author: 'John Johnson' },
]

function getQuoteFontSize(text) {
  if (text.length < 50) return 22
  if (text.length < 80) return 20
  if (text.length < 110) return 18
  return 17
}

const EMPTY_FAVORITES = []

export function Inspiration({ widgetId }) {
  const widget = useWidgetStore(s => s.widgets.find(w => w.id === widgetId))
  const updateData = useWidgetStore(s => s.updateData)

  const currentIndex = widget?.data?.currentIndex ?? 0
  const favoritesRaw = widget?.data?.favorites
  const favorites = favoritesRaw ?? EMPTY_FAVORITES

  const [visible, setVisible] = useState(true)
  const [displayIndex, setDisplayIndex] = useState(currentIndex)
  const [copied, setCopied] = useState(false)
  const copiedTimer = useRef(null)

  const quote = QUOTES[displayIndex] || QUOTES[0]
  const isFavorite = favorites.includes(displayIndex)

  const transitionTo = useCallback((nextIndex) => {
    setVisible(false)
    setTimeout(() => {
      setDisplayIndex(nextIndex)
      setVisible(true)
    }, 200)
  }, [])

  // Sync displayIndex if currentIndex changes externally
  useEffect(() => {
    if (currentIndex !== displayIndex) {
      transitionTo(currentIndex)
    }
    // Only react to store changes, not internal display changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex])

  const handleShuffle = useCallback(() => {
    let next
    do {
      next = Math.floor(Math.random() * QUOTES.length)
    } while (next === displayIndex && QUOTES.length > 1)
    updateData(widgetId, { currentIndex: next })
    transitionTo(next)
  }, [displayIndex, widgetId, updateData, transitionTo])

  const handleCopy = useCallback(() => {
    const text = `"${quote.text}" — ${quote.author}`
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
      copiedTimer.current = setTimeout(() => setCopied(false), 1500)
    })
  }, [quote])

  const handleFavorite = useCallback(() => {
    const next = isFavorite
      ? favorites.filter(i => i !== displayIndex)
      : [...favorites, displayIndex]
    updateData(widgetId, { favorites: next })
  }, [isFavorite, favorites, displayIndex, widgetId, updateData])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
    }
  }, [])

  const fontSize = getQuoteFontSize(quote.text)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap');

        .insp-quote-area {
          opacity: 1;
          transform: translateY(0);
          transition: opacity 0.4s ease, transform 0.4s ease;
        }
        .insp-quote-area.insp-hidden {
          opacity: 0;
          transform: translateY(8px);
        }

        .insp-ctrl-btn {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: none;
          background: rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.5);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          transition: background 0.2s, transform 0.15s, color 0.2s;
          position: relative;
          padding: 0;
          line-height: 1;
        }
        .insp-ctrl-btn:hover {
          background: rgba(255,255,255,0.12);
          color: rgba(255,255,255,0.75);
          transform: scale(1.1);
        }
        .insp-ctrl-btn:active {
          transform: scale(0.95);
        }

        .insp-fav-btn.insp-fav-active {
          color: #f43f5e;
          animation: insp-pulse 0.4s ease;
        }

        @keyframes insp-pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.3); }
          100% { transform: scale(1); }
        }

        .insp-toast {
          position: absolute;
          bottom: calc(100% + 6px);
          left: 50%;
          transform: translateX(-50%);
          background: rgba(192,132,252,0.9);
          color: #fff;
          font-family: 'Inter', sans-serif;
          font-size: 10px;
          font-weight: 500;
          padding: 3px 10px;
          border-radius: 10px;
          white-space: nowrap;
          pointer-events: none;
          animation: insp-toast-in 0.2s ease, insp-toast-out 0.3s ease 1.2s forwards;
        }

        @keyframes insp-toast-in {
          from { opacity: 0; transform: translateX(-50%) translateY(4px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes insp-toast-out {
          from { opacity: 1; }
          to   { opacity: 0; }
        }

        .insp-divider {
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(192,132,252,0.3) 50%,
            transparent 100%
          );
          margin: 0;
          border: none;
        }
      `}</style>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        fontFamily: "'Inter', sans-serif",
      }}>
        {/* Quote area */}
        <div
          className={`insp-quote-area${visible ? '' : ' insp-hidden'}`}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            position: 'relative',
            padding: '8px 4px 12px',
            minHeight: 0,
          }}
        >
          {/* Decorative opening quote */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: -4,
              left: -4,
              fontSize: 72,
              fontFamily: "'Playfair Display', Georgia, serif",
              color: 'rgba(192,132,252,0.2)',
              lineHeight: 1,
              userSelect: 'none',
              pointerEvents: 'none',
            }}
          >
            {'\u201C'}
          </div>

          {/* Quote text */}
          <p style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize,
            fontWeight: 400,
            color: '#e0e0f0',
            lineHeight: 1.6,
            margin: '18px 0 10px',
            padding: '0 6px 0 18px',
            letterSpacing: '0.01em',
            wordBreak: 'break-word',
          }}>
            {quote.text}
          </p>

          {/* Author */}
          <p style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 12,
            fontStyle: 'italic',
            color: 'rgba(255,255,255,0.4)',
            textAlign: 'right',
            margin: '4px 6px 0 0',
            letterSpacing: '0.02em',
          }}>
            {'\u2014'} {quote.author}
          </p>
        </div>

        {/* Decorative divider */}
        <div className="insp-divider" style={{ margin: '0 8px 10px' }} />

        {/* Controls */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 12,
          paddingBottom: 2,
          flexShrink: 0,
        }}>
          <button
            className="insp-ctrl-btn"
            onClick={handleShuffle}
            title="Random quote"
            aria-label="Shuffle quote"
          >
            {'\uD83D\uDD00'}
          </button>

          <button
            className="insp-ctrl-btn"
            onClick={handleCopy}
            title="Copy quote"
            aria-label="Copy quote"
            style={{ position: 'relative' }}
          >
            {'\uD83D\uDCCB'}
            {copied && <span className="insp-toast">Copied!</span>}
          </button>

          <button
            className={`insp-ctrl-btn insp-fav-btn${isFavorite ? ' insp-fav-active' : ''}`}
            onClick={handleFavorite}
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            style={isFavorite ? { color: '#f43f5e' } : {}}
          >
            {isFavorite ? '\u2665' : '\u2661'}
          </button>
        </div>
      </div>
    </>
  )
}
