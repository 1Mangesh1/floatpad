import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useWidgetStore } from '../../store/widgetStore'

/* ── helpers ─────────────────────────────────────────────────── */

function uid() {
  return crypto.randomUUID().slice(0, 8)
}

const TAG_COLORS = [null, 'red', 'yellow', 'green']
const TAG_HEX = { red: '#ef4444', yellow: '#eab308', green: '#22c55e' }

function randomColor() {
  return TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)]
}

const COLUMNS = [
  { key: 'todo',  label: 'TO DO',  accent: '#0ea5e9' },
  { key: 'doing', label: 'DOING',  accent: '#f59e0b' },
  { key: 'done',  label: 'DONE',   accent: '#10b981' },
]

const COL_KEYS = COLUMNS.map(c => c.key)

/* ── styles ──────────────────────────────────────────────────── */

const css = `
@keyframes kanban-fade-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes kanban-fade-out {
  from { opacity: 1; }
  to   { opacity: 0; transform: scale(0.95); }
}

.kanban-board {
  display: flex;
  gap: 8px;
  height: 100%;
  min-height: 0;
  font-family: inherit;
  color: rgba(255,255,255,0.85);
}

.kanban-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: rgba(255,255,255,0.02);
  border-radius: 8px;
  border-top: 2px solid var(--kanban-accent);
  overflow: hidden;
}

.kanban-col-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px 6px;
  flex-shrink: 0;
  user-select: none;
}

.kanban-col-title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.4);
}

.kanban-col-count {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 10px;
  color: rgba(255,255,255,0.7);
  background: rgba(255,255,255,0.08);
  line-height: 1.4;
}

.kanban-cards {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 6px 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.kanban-cards::-webkit-scrollbar {
  width: 3px;
}
.kanban-cards::-webkit-scrollbar-track {
  background: transparent;
}
.kanban-cards::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.1);
  border-radius: 2px;
}

.kanban-card {
  position: relative;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 8px;
  padding: 8px 10px;
  display: flex;
  align-items: flex-start;
  gap: 7px;
  transition: background 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
  animation: kanban-fade-in 0.2s ease-out both;
  cursor: default;
}
.kanban-card:hover {
  background: rgba(255,255,255,0.09);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}
.kanban-card-exit {
  animation: kanban-fade-out 0.18s ease-in both;
  pointer-events: none;
}

.kanban-card-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-top: 5px;
  flex-shrink: 0;
}

.kanban-card-text {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  line-height: 1.4;
  color: rgba(255,255,255,0.85);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

.kanban-card-actions {
  position: absolute;
  top: 4px;
  right: 4px;
  display: flex;
  align-items: center;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.12s ease;
}
.kanban-card:hover .kanban-card-actions {
  opacity: 1;
}

.kanban-card-btn {
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 4px;
  background: rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.5);
  font-size: 11px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  line-height: 1;
  transition: background 0.1s ease, color 0.1s ease;
  font-family: inherit;
}
.kanban-card-btn:hover {
  background: rgba(255,255,255,0.15);
  color: rgba(255,255,255,0.8);
}
.kanban-card-btn.delete:hover {
  background: rgba(239,68,68,0.25);
  color: #ef4444;
}

.kanban-add-btn {
  width: 100%;
  border: 1px dashed rgba(255,255,255,0.1);
  border-radius: 6px;
  background: transparent;
  color: rgba(255,255,255,0.25);
  font-size: 16px;
  cursor: pointer;
  padding: 4px 0;
  margin-top: 2px;
  transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
  font-family: inherit;
  flex-shrink: 0;
}
.kanban-add-btn:hover {
  background: rgba(255,255,255,0.04);
  border-color: rgba(255,255,255,0.2);
  color: rgba(255,255,255,0.5);
}

.kanban-add-input {
  width: 100%;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 6px;
  color: rgba(255,255,255,0.9);
  font-size: 13px;
  font-family: inherit;
  padding: 6px 8px;
  outline: none;
  margin-top: 2px;
  flex-shrink: 0;
  box-sizing: border-box;
  transition: border-color 0.15s ease;
}
.kanban-add-input:focus {
  border-color: rgba(255,255,255,0.25);
}
.kanban-add-input::placeholder {
  color: rgba(255,255,255,0.2);
}

.kanban-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: rgba(255,255,255,0.2);
  user-select: none;
  font-style: italic;
}

.kanban-col-footer {
  padding: 4px 6px 6px;
  flex-shrink: 0;
}
`

/* ── component ───────────────────────────────────────────────── */

export function KanbanBoard({ widgetId }) {
  const widget = useWidgetStore(s => s.widgets.find(w => w.id === widgetId))
  const updateData = useWidgetStore(s => s.updateData)

  const data = widget?.data ?? {}
  const columns = useMemo(() => ({
    todo:  data.columns?.todo  ?? [],
    doing: data.columns?.doing ?? [],
    done:  data.columns?.done  ?? [],
  }), [data.columns])

  const [addingTo, setAddingTo] = useState(null)
  const [inputText, setInputText] = useState('')
  const [exitingCard, setExitingCard] = useState(null) // { id, col }
  const inputRef = useRef(null)

  // Focus input when opening add mode
  useEffect(() => {
    if (addingTo) {
      // Small delay so DOM has rendered the input
      const t = setTimeout(() => inputRef.current?.focus(), 30)
      return () => clearTimeout(t)
    }
  }, [addingTo])

  const persist = useCallback((patch) => {
    if (widgetId) updateData(widgetId, patch)
  }, [widgetId, updateData])

  /* ── actions ───────────────────────────────────────────────── */

  const addCard = useCallback((colKey) => {
    const text = inputText.trim()
    if (!text) return
    const card = {
      id: uid(),
      text,
      color: randomColor(),
      createdAt: new Date().toISOString(),
    }
    const next = { ...columns, [colKey]: [...columns[colKey], card] }
    persist({ columns: next })
    setInputText('')
    setAddingTo(null)
  }, [inputText, columns, persist])

  const deleteCard = useCallback((colKey, cardId) => {
    setExitingCard({ id: cardId, col: colKey })
    setTimeout(() => {
      const next = {
        ...columns,
        [colKey]: columns[colKey].filter(c => c.id !== cardId),
      }
      persist({ columns: next })
      setExitingCard(null)
    }, 180)
  }, [columns, persist])

  const moveCard = useCallback((fromCol, cardId, direction) => {
    const fromIdx = COL_KEYS.indexOf(fromCol)
    const toIdx = fromIdx + direction
    if (toIdx < 0 || toIdx >= COL_KEYS.length) return
    const toCol = COL_KEYS[toIdx]
    const card = columns[fromCol].find(c => c.id === cardId)
    if (!card) return

    // Animate out
    setExitingCard({ id: cardId, col: fromCol })
    setTimeout(() => {
      const next = {
        ...columns,
        [fromCol]: columns[fromCol].filter(c => c.id !== cardId),
        [toCol]: [...columns[toCol], card],
      }
      persist({ columns: next })
      setExitingCard(null)
    }, 180)
  }, [columns, persist])

  const cancelAdd = useCallback(() => {
    setAddingTo(null)
    setInputText('')
  }, [])

  const onInputKey = useCallback((e, colKey) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addCard(colKey)
    } else if (e.key === 'Escape') {
      cancelAdd()
    }
  }, [addCard, cancelAdd])

  /* ── render ────────────────────────────────────────────────── */

  if (!widget) return null

  return (
    <div className="kanban-board">
      <style>{css}</style>

      {COLUMNS.map(({ key, label, accent }) => {
        const cards = columns[key]
        const colIdx = COL_KEYS.indexOf(key)
        const isAdding = addingTo === key

        return (
          <div
            key={key}
            className="kanban-col"
            style={{ '--kanban-accent': accent }}
          >
            {/* Header */}
            <div className="kanban-col-header">
              <span className="kanban-col-title">{label}</span>
              <span
                className="kanban-col-count"
                style={{ background: `${accent}22`, color: accent }}
              >
                {cards.length}
              </span>
            </div>

            {/* Cards */}
            <div className="kanban-cards">
              {cards.length === 0 && !isAdding && (
                <div className="kanban-empty">No tasks</div>
              )}

              {cards.map(card => {
                const isExiting =
                  exitingCard?.id === card.id && exitingCard?.col === key
                return (
                  <div
                    key={card.id}
                    className={`kanban-card${isExiting ? ' kanban-card-exit' : ''}`}
                  >
                    {/* Color dot */}
                    {card.color && (
                      <div
                        className="kanban-card-dot"
                        style={{ background: TAG_HEX[card.color] }}
                      />
                    )}

                    {/* Text */}
                    <div className="kanban-card-text" title={card.text}>
                      {card.text}
                    </div>

                    {/* Hover actions */}
                    <div className="kanban-card-actions">
                      {/* Left arrow */}
                      {colIdx > 0 && (
                        <button
                          className="kanban-card-btn"
                          onClick={() => moveCard(key, card.id, -1)}
                          title={`Move to ${COLUMNS[colIdx - 1].label}`}
                          aria-label="Move left"
                        >
                          &#8249;
                        </button>
                      )}
                      {/* Right arrow */}
                      {colIdx < COL_KEYS.length - 1 && (
                        <button
                          className="kanban-card-btn"
                          onClick={() => moveCard(key, card.id, 1)}
                          title={`Move to ${COLUMNS[colIdx + 1].label}`}
                          aria-label="Move right"
                        >
                          &#8250;
                        </button>
                      )}
                      {/* Delete */}
                      <button
                        className="kanban-card-btn delete"
                        onClick={() => deleteCard(key, card.id)}
                        title="Delete"
                        aria-label="Delete card"
                      >
                        &times;
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Footer: add button / input */}
            <div className="kanban-col-footer">
              {isAdding ? (
                <input
                  ref={inputRef}
                  className="kanban-add-input"
                  type="text"
                  placeholder="Task name..."
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => onInputKey(e, key)}
                  onBlur={() => {
                    // Small delay so click on another add button can register
                    setTimeout(cancelAdd, 120)
                  }}
                  maxLength={200}
                />
              ) : (
                <button
                  className="kanban-add-btn"
                  onClick={() => {
                    setAddingTo(key)
                    setInputText('')
                  }}
                  title="Add task"
                >
                  +
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
