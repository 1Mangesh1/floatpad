import { useState, useCallback, useRef, useEffect } from 'react'
import { useWidgetStore } from '../../store/widgetStore'

const MAJOR_ARCANA = [
  { numeral: '0', name: 'The Fool', emoji: '\uD83C\uDCCF', upright: 'New beginnings, spontaneity. A leap of faith into the unknown — trust your instincts and embrace the adventure ahead.', reversed: 'Recklessness, fear. You may be rushing in without thinking, or holding back when the universe calls you forward.' },
  { numeral: 'I', name: 'The Magician', emoji: '\u2728', upright: 'Manifestation, resourcefulness. You have all the tools you need — channel your willpower and make it real.', reversed: 'Manipulation, illusion. Beware of trickery, whether from others or self-deception clouding your vision.' },
  { numeral: 'II', name: 'The High Priestess', emoji: '\uD83C\uDF19', upright: 'Intuition, mystery. The answers lie within — quiet your mind and listen to the whispers of your subconscious.', reversed: 'Secrets, withdrawal. Something hidden demands your attention. Trust is being tested in the shadows.' },
  { numeral: 'III', name: 'The Empress', emoji: '\uD83D\uDC51', upright: 'Abundance, nurturing. A season of growth and creative fertility surrounds you. Let beauty and care flow freely.', reversed: 'Dependence, smothering. Overprotection or codependency may be stifling growth. Give space to breathe.' },
  { numeral: 'IV', name: 'The Emperor', emoji: '\uD83C\uDFDB\uFE0F', upright: 'Authority, structure. Discipline and order will serve you now. Build your empire on solid foundations.', reversed: 'Rigidity, control. An iron grip is breaking what it holds. Flexibility is not weakness — it is wisdom.' },
  { numeral: 'V', name: 'The Hierophant', emoji: '\uD83D\uDCDC', upright: 'Tradition, guidance. Seek wisdom from established paths and trusted mentors. There is comfort in shared knowledge.', reversed: 'Rebellion, nonconformity. Question the rules. Your own truth may diverge from what you have been taught.' },
  { numeral: 'VI', name: 'The Lovers', emoji: '\uD83D\uDC95', upright: 'Love, harmony. A profound connection beckons — romantic or otherwise. Choose with your heart aligned to your values.', reversed: 'Disharmony, imbalance. A relationship or choice is out of alignment. Reflect before you commit further.' },
  { numeral: 'VII', name: 'The Chariot', emoji: '\u26A1', upright: 'Willpower, triumph. Harness opposing forces and charge forward. Victory belongs to the determined.', reversed: 'Lack of direction. Scattered energy leads nowhere. Find your north star before you ride.' },
  { numeral: 'VIII', name: 'Strength', emoji: '\uD83E\uDD81', upright: 'Courage, patience. True power is gentle. Tame the wild within through compassion, not force.', reversed: 'Self-doubt, weakness. Your inner lion is caged by fear. Remember the strength you have already survived with.' },
  { numeral: 'IX', name: 'The Hermit', emoji: '\uD83C\uDFD4\uFE0F', upright: 'Introspection, solitude. Withdraw from the noise and seek your inner lantern. Wisdom awaits in stillness.', reversed: 'Isolation, loneliness. Solitude has become a prison. Reach out — the world has not forgotten you.' },
  { numeral: 'X', name: 'Wheel of Fortune', emoji: '\uD83C\uDFA1', upright: 'Change, destiny. The wheel turns — fortune rises. Embrace the cycle and ride the momentum of fate.', reversed: 'Bad luck, resistance. Fighting the current exhausts you. Accept what cannot be changed and adapt.' },
  { numeral: 'XI', name: 'Justice', emoji: '\u2696\uFE0F', upright: 'Fairness, truth. The scales demand honesty. Act with integrity and the universe will balance the account.', reversed: 'Dishonesty, unfairness. Something is unjust. Seek truth relentlessly, even when it is uncomfortable.' },
  { numeral: 'XII', name: 'The Hanged Man', emoji: '\uD83D\uDD04', upright: 'Surrender, new perspective. Let go and see the world upside down. In suspension, revelation awaits.', reversed: 'Stalling, resistance. You cling to what must be released. The sacrifice you avoid is the one that frees you.' },
  { numeral: 'XIII', name: 'Death', emoji: '\uD83E\uDD8B', upright: 'Transformation, endings. Something must die so something greater can be born. Embrace the metamorphosis.', reversed: 'Fear of change, stagnation. You resist the inevitable. What you refuse to release will decay in your hands.' },
  { numeral: 'XIV', name: 'Temperance', emoji: '\uD83C\uDFFA', upright: 'Balance, moderation. Blend opposing elements with patience. The alchemist within knows the perfect measure.', reversed: 'Excess, imbalance. You have tipped the scales too far. Restore equilibrium before the vessel overflows.' },
  { numeral: 'XV', name: 'The Devil', emoji: '\uD83D\uDD17', upright: 'Bondage, materialism. Chains of your own making bind you. Recognize the illusion and reclaim your freedom.', reversed: 'Release, breaking free. The chains are loosening. You are finding the courage to walk away from what enslaves you.' },
  { numeral: 'XVI', name: 'The Tower', emoji: '\u26A1', upright: 'Upheaval, revelation. Lightning strikes the false structure. From the rubble, truth emerges raw and undeniable.', reversed: 'Avoidance, fear of change. You sense the cracks but look away. The longer you delay, the harder the fall.' },
  { numeral: 'XVII', name: 'The Star', emoji: '\u2B50', upright: 'Hope, inspiration. After the storm, starlight guides you home. Healing and renewal pour down from above.', reversed: 'Despair, disconnection. The light feels distant. But even unseen stars still shine — look inward to find them.' },
  { numeral: 'XVIII', name: 'The Moon', emoji: '\uD83C\uDF11', upright: 'Illusion, subconscious. Nothing is as it seems beneath the moon. Trust your dreams, but question your fears.', reversed: 'Clarity, release of fear. The fog lifts and truth becomes visible. What once terrified you loses its power.' },
  { numeral: 'XIX', name: 'The Sun', emoji: '\u2600\uFE0F', upright: 'Joy, success, vitality. Radiant energy floods your path. Bask in the warmth — you have earned this light.', reversed: 'Sadness, unrealistic expectations. The sun hides behind clouds of your own making. Adjust your lens and find the warmth again.' },
  { numeral: 'XX', name: 'Judgement', emoji: '\uD83C\uDFBA', upright: 'Reflection, reckoning. The trumpet calls you to account. Rise to meet your highest self with honesty and grace.', reversed: 'Self-doubt, refusal. You hear the call but turn away. Avoiding judgement does not erase the truth it carries.' },
  { numeral: 'XXI', name: 'The World', emoji: '\uD83C\uDF0D', upright: 'Completion, accomplishment. The cycle is complete. Celebrate what you have built — a new chapter dawns on the horizon.', reversed: 'Incompleteness, shortcuts. The journey is unfinished. Do not rush the final steps — wholeness requires patience.' },
]

const EMPTY_HISTORY = []

export function TarotDraw({ widgetId }) {
  const widget = useWidgetStore(s => s.widgets.find(w => w.id === widgetId))
  const updateData = useWidgetStore(s => s.updateData)

  const currentCard = widget?.data?.currentCard ?? null
  const reversed = widget?.data?.reversed ?? false
  const historyRaw = widget?.data?.history
  const history = historyRaw ?? EMPTY_HISTORY

  const [flipping, setFlipping] = useState(false)
  const [showFront, setShowFront] = useState(currentCard !== null)
  const [animKey, setAnimKey] = useState(0)
  const flipTimer = useRef(null)

  // If card already exists on mount, show it face-up immediately
  useEffect(() => {
    if (currentCard !== null) {
      setShowFront(true)
      setFlipping(false)
    }
  }, [currentCard])

  useEffect(() => {
    return () => {
      if (flipTimer.current) clearTimeout(flipTimer.current)
    }
  }, [])

  const drawCard = useCallback(() => {
    if (flipping) return

    const cardIndex = Math.floor(Math.random() * MAJOR_ARCANA.length)
    const isReversed = Math.random() < 0.5

    // Start flip: show back first, then animate to front
    setShowFront(false)
    setFlipping(true)
    setAnimKey(k => k + 1)

    // At the halfway point of the flip, switch to front
    flipTimer.current = setTimeout(() => {
      setShowFront(true)
    }, 300)

    // When flip is complete, save state
    setTimeout(() => {
      setFlipping(false)
      const newHistory = [{ card: cardIndex, reversed: isReversed }, ...history].slice(0, 5)
      updateData(widgetId, {
        currentCard: cardIndex,
        reversed: isReversed,
        history: newHistory,
      })
    }, 600)
  }, [flipping, history, widgetId, updateData])

  const card = currentCard !== null ? MAJOR_ARCANA[currentCard] : null
  const meaning = card
    ? (reversed ? card.reversed : card.upright)
    : null

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&display=swap');

        .tarot-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          height: 100%;
          overflow-y: auto;
          overflow-x: hidden;
          font-family: 'Inter', sans-serif;
          gap: 14px;
          padding: 4px 0 8px;
        }

        .tarot-scene {
          perspective: 800px;
          width: 120px;
          height: 180px;
          flex-shrink: 0;
        }

        .tarot-card {
          width: 100%;
          height: 100%;
          position: relative;
          transform-style: preserve-3d;
          transition: transform 0.6s ease;
        }

        .tarot-card.tarot-flipping {
          animation: tarot-flip 0.6s ease forwards;
        }

        @keyframes tarot-flip {
          0%   { transform: rotateY(0deg); }
          100% { transform: rotateY(180deg); }
        }

        .tarot-card-face {
          position: absolute;
          inset: 0;
          backface-visibility: hidden;
          border-radius: 8px;
          overflow: hidden;
        }

        .tarot-card-back {
          background: #1a0a2e;
          border: 2px solid #d4a574;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2;
        }

        .tarot-card-back-inner {
          width: calc(100% - 16px);
          height: calc(100% - 16px);
          border: 1px solid rgba(212, 165, 116, 0.5);
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .tarot-card-back-inner::before {
          content: '';
          position: absolute;
          inset: 6px;
          border: 1px solid rgba(212, 165, 116, 0.25);
          border-radius: 3px;
        }

        .tarot-card-back-inner::after {
          content: '';
          position: absolute;
          inset: 12px;
          border: 1px solid rgba(212, 165, 116, 0.15);
          border-radius: 2px;
        }

        .tarot-star-symbol {
          font-size: 28px;
          color: #d4a574;
          text-shadow: 0 0 12px rgba(212, 165, 116, 0.5), 0 0 24px rgba(212, 165, 116, 0.2);
          z-index: 1;
        }

        .tarot-card-front {
          background: linear-gradient(180deg, #2d1b4e 0%, #1a0a2e 100%);
          border: 2px solid #d4a574;
          transform: rotateY(180deg);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          padding: 10px 8px;
        }

        .tarot-card-front-reversed {
          transform: rotateY(180deg) rotate(180deg);
        }

        .tarot-card-numeral {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 10px;
          color: #d4a574;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .tarot-card-name {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 11px;
          font-weight: 600;
          color: #e0daf0;
          text-align: center;
          line-height: 1.2;
        }

        .tarot-card-emoji {
          font-size: 36px;
          line-height: 1;
          filter: drop-shadow(0 0 8px rgba(212, 165, 116, 0.4));
        }

        .tarot-card-bottom-line {
          width: 30px;
          height: 1px;
          background: linear-gradient(90deg, transparent, #d4a574, transparent);
        }

        .tarot-reversed-tag {
          display: inline-block;
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 10px;
          font-style: italic;
          color: #e07070;
          background: rgba(224, 112, 112, 0.1);
          border: 1px solid rgba(224, 112, 112, 0.25);
          padding: 2px 8px;
          border-radius: 10px;
          margin-top: 2px;
        }

        .tarot-meaning {
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          font-style: italic;
          color: rgba(255, 255, 255, 0.6);
          text-align: center;
          line-height: 1.55;
          padding: 0 8px;
          max-width: 280px;
        }

        .tarot-card-title-display {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 16px;
          font-weight: 600;
          color: #d4a574;
          text-align: center;
          letter-spacing: 0.02em;
          text-shadow: 0 0 20px rgba(212, 165, 116, 0.3);
        }

        .tarot-draw-btn {
          position: relative;
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 14px;
          font-weight: 500;
          letter-spacing: 0.05em;
          color: #d4a574;
          background: rgba(26, 10, 46, 0.8);
          border: 1.5px solid #d4a574;
          border-radius: 20px;
          padding: 8px 24px;
          cursor: pointer;
          overflow: hidden;
          transition: background 0.3s, box-shadow 0.3s, transform 0.15s;
          flex-shrink: 0;
        }

        .tarot-draw-btn:hover {
          background: rgba(45, 27, 78, 0.9);
          box-shadow: 0 0 20px rgba(212, 165, 116, 0.25), inset 0 0 20px rgba(212, 165, 116, 0.05);
          transform: scale(1.03);
        }

        .tarot-draw-btn:active {
          transform: scale(0.97);
        }

        .tarot-draw-btn::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 200%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent 0%,
            transparent 40%,
            rgba(212, 165, 116, 0.15) 50%,
            transparent 60%,
            transparent 100%
          );
          animation: tarot-shimmer 3s ease-in-out infinite;
        }

        @keyframes tarot-shimmer {
          0%   { transform: translateX(-30%); }
          100% { transform: translateX(30%); }
        }

        .tarot-divider {
          width: 60%;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(212, 165, 116, 0.3), transparent);
          flex-shrink: 0;
        }

        .tarot-history {
          display: flex;
          gap: 6px;
          justify-content: center;
          flex-shrink: 0;
          padding-bottom: 2px;
        }

        .tarot-history-card {
          width: 22px;
          height: 33px;
          background: #1a0a2e;
          border: 1px solid rgba(212, 165, 116, 0.4);
          border-radius: 3px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 6px;
          color: rgba(212, 165, 116, 0.6);
          cursor: default;
          transition: border-color 0.2s, box-shadow 0.2s;
          position: relative;
        }

        .tarot-history-card:hover {
          border-color: #d4a574;
          box-shadow: 0 0 8px rgba(212, 165, 116, 0.3);
        }

        .tarot-history-card-reversed {
          transform: rotate(180deg);
        }

        .tarot-history-label {
          font-family: 'Inter', sans-serif;
          font-size: 10px;
          color: rgba(255, 255, 255, 0.25);
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .tarot-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 20px;
          flex: 1;
        }

        .tarot-empty-stars {
          font-size: 24px;
          color: rgba(212, 165, 116, 0.3);
          letter-spacing: 8px;
          animation: tarot-pulse-stars 3s ease-in-out infinite;
        }

        @keyframes tarot-pulse-stars {
          0%, 100% { opacity: 0.4; }
          50%      { opacity: 0.8; }
        }

        .tarot-empty-text {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 13px;
          font-style: italic;
          color: rgba(255, 255, 255, 0.35);
          text-align: center;
        }

        .tarot-reading-area {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          flex: 1;
          min-height: 0;
        }

        .tarot-fade-in {
          animation: tarot-fade-in 0.4s ease 0.5s both;
        }

        @keyframes tarot-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="tarot-container">
        {currentCard === null && !flipping ? (
          <div className="tarot-empty-state">
            <div className="tarot-empty-stars">{'\u2729 \u2729 \u2729'}</div>
            <div className="tarot-empty-text">
              The cards await your question...<br />
              Focus your intention and draw.
            </div>
            <button className="tarot-draw-btn" onClick={drawCard}>
              Draw a Card
            </button>
          </div>
        ) : (
          <>
            <div className="tarot-reading-area">
              {/* Card scene */}
              <div className="tarot-scene">
                <div
                  className={`tarot-card${flipping ? ' tarot-flipping' : ''}`}
                  key={animKey}
                  style={!flipping && showFront ? { transform: 'rotateY(180deg)' } : undefined}
                >
                  {/* Back face */}
                  <div className="tarot-card-face tarot-card-back">
                    <div className="tarot-card-back-inner">
                      <span className="tarot-star-symbol">{'\u2605'}</span>
                    </div>
                  </div>

                  {/* Front face */}
                  <div className={`tarot-card-face tarot-card-front${reversed ? ' tarot-card-front-reversed' : ''}`}>
                    {card && (
                      <>
                        <span className="tarot-card-numeral">{card.numeral}</span>
                        <span className="tarot-card-name">{card.name}</span>
                        <span className="tarot-card-emoji">{card.emoji}</span>
                        <div className="tarot-card-bottom-line" />
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Card title and meaning below the card */}
              {card && !flipping && (
                <div className="tarot-fade-in" key={`info-${animKey}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div className="tarot-card-title-display">
                    {card.numeral} &mdash; {card.name}
                  </div>
                  {reversed && <span className="tarot-reversed-tag">(Reversed)</span>}
                  <div className="tarot-meaning">{meaning}</div>
                </div>
              )}
            </div>

            {/* Draw another */}
            <button
              className="tarot-draw-btn"
              onClick={drawCard}
              disabled={flipping}
              style={flipping ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
            >
              Draw Again
            </button>

            {/* History row */}
            {history.length > 0 && (
              <>
                <div className="tarot-divider" />
                <div className="tarot-history-label">Recent Draws</div>
                <div className="tarot-history">
                  {history.map((h, i) => {
                    const hCard = MAJOR_ARCANA[h.card]
                    return (
                      <div
                        key={`${h.card}-${i}`}
                        className={`tarot-history-card${h.reversed ? ' tarot-history-card-reversed' : ''}`}
                        title={`${hCard.numeral} ${hCard.name}${h.reversed ? ' (Reversed)' : ''}`}
                      >
                        <span style={{ fontSize: 10 }}>{hCard.emoji}</span>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  )
}
