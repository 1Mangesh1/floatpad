import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useWidgetStore } from '../../store/widgetStore'

/* ── helpers ─────────────────────────────────────────────────── */

function uid() {
  return crypto.randomUUID().slice(0, 8)
}

function dateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Monday of the week containing `ref`, shifted by `offset` weeks. */
function weekMonday(ref, offset = 0) {
  const d = new Date(ref)
  const day = d.getDay() // 0=Sun … 6=Sat
  const diff = day === 0 ? -6 : 1 - day // roll back to Monday
  d.setDate(d.getDate() + diff + offset * 7)
  d.setHours(0, 0, 0, 0)
  return d
}

function weekDates(ref, offset) {
  const mon = weekMonday(ref, offset)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon)
    d.setDate(mon.getDate() + i)
    return d
  })
}

function fmtRange(dates) {
  const a = dates[0]
  const b = dates[6]
  const mo = (d) =>
    d.toLocaleString('en-US', { month: 'short' })
  const sameMonth = a.getMonth() === b.getMonth()
  if (sameMonth) {
    return `${mo(a)} ${a.getDate()} \u2013 ${b.getDate()}`
  }
  return `${mo(a)} ${a.getDate()} \u2013 ${mo(b)} ${b.getDate()}`
}

function calcStreak(habitId, completions, today) {
  const map = completions[habitId]
  if (!map) return 0

  let d = new Date(today)
  // If today isn't done, start counting from yesterday
  if (!map[dateStr(d)]) {
    d.setDate(d.getDate() - 1)
  }
  let streak = 0
  while (map[dateStr(d)]) {
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/* ── styles ──────────────────────────────────────────────────── */

const css = `
@keyframes ht-check-pop {
  0%   { transform: scale(0.8); }
  50%  { transform: scale(1.15); }
  100% { transform: scale(1); }
}
@keyframes ht-check-fill {
  0%   { background: rgba(255,255,255,0.06); }
  100% { background: #10b981; }
}
@keyframes ht-slide-in {
  from { opacity: 0; transform: translateX(-18px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes ht-slide-out {
  from { opacity: 1; transform: translateX(0); }
  to   { opacity: 0; transform: translateX(24px); }
}
@keyframes ht-checkmark-draw {
  from { stroke-dashoffset: 16; }
  to   { stroke-dashoffset: 0; }
}

.ht-row-enter {
  animation: ht-slide-in 0.2s ease-out both;
}
.ht-row-exit {
  animation: ht-slide-out 0.2s ease-in both;
  pointer-events: none;
}

.ht-circle {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  flex-shrink: 0;
  position: relative;
}
.ht-circle:hover {
  border-color: rgba(255,255,255,0.3) !important;
  box-shadow: 0 0 6px rgba(16,185,129,0.2);
}
.ht-circle.checked {
  animation: ht-check-pop 0.25s cubic-bezier(0.34,1.56,0.64,1) both;
  background: #10b981 !important;
  border-color: #10b981 !important;
  box-shadow: 0 0 10px rgba(16,185,129,0.45);
}
.ht-circle.checked svg {
  animation: ht-checkmark-draw 0.2s ease-out 0.05s both;
}
.ht-circle.today-col {
  border-color: rgba(255,255,255,0.25) !important;
}
.ht-circle.today-col:not(.checked) {
  box-shadow: 0 0 4px rgba(16,185,129,0.12);
}

.ht-delete-btn {
  opacity: 0;
  background: none;
  border: none;
  color: rgba(255,255,255,0.3);
  font-size: 14px;
  cursor: pointer;
  padding: 0 2px;
  line-height: 1;
  transition: opacity 0.15s ease, color 0.15s ease;
  font-family: inherit;
}
.ht-habit-row:hover .ht-delete-btn {
  opacity: 1;
}
.ht-delete-btn:hover {
  color: #ef4444 !important;
}

.ht-add-input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  border-bottom: 1.5px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.9);
  font-size: 13px;
  font-family: inherit;
  padding: 6px 2px;
  outline: none;
  transition: border-color 0.2s ease;
}
.ht-add-input:focus {
  border-color: rgba(16,185,129,0.6);
}
.ht-add-input::placeholder {
  color: rgba(255,255,255,0.25);
}

.ht-add-btn {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(16,185,129,0.15);
  color: #10b981;
  font-size: 18px;
  font-family: inherit;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  flex-shrink: 0;
  padding: 0;
  line-height: 1;
}
.ht-add-btn:hover {
  background: rgba(16,185,129,0.3);
  border-color: rgba(16,185,129,0.5);
  box-shadow: 0 0 10px rgba(16,185,129,0.2);
}
.ht-add-btn:active {
  transform: scale(0.92);
}

.ht-nav-btn {
  background: none;
  border: 1px solid rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.5);
  border-radius: 6px;
  width: 24px;
  height: 24px;
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  font-family: inherit;
  padding: 0;
}
.ht-nav-btn:hover {
  background: rgba(255,255,255,0.06);
  border-color: rgba(255,255,255,0.2);
  color: rgba(255,255,255,0.8);
}
.ht-nav-btn:active {
  transform: scale(0.92);
}

.ht-streak-badge {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 10px;
  white-space: nowrap;
  flex-shrink: 0;
  line-height: 1.2;
}
`

/* ── component ───────────────────────────────────────────────── */

export function HabitTracker({ widgetId }) {
  const widget = useWidgetStore((s) => s.widgets.find((w) => w.id === widgetId))
  const updateData = useWidgetStore((s) => s.updateData)

  const data = widget?.data ?? {}
  const habits = useMemo(() => data.habits ?? [], [data.habits])
  const completions = useMemo(() => data.completions ?? {}, [data.completions])
  const weekOffset = data.weekOffset ?? 0

  const [newHabit, setNewHabit] = useState('')
  const [removingId, setRemovingId] = useState(null)
  const [recentlyAdded, setRecentlyAdded] = useState(null)
  const inputRef = useRef(null)

  const today = useMemo(() => new Date(), [])
  const todayStr = useMemo(() => dateStr(today), [today])

  const days = useMemo(() => weekDates(today, weekOffset), [today, weekOffset])
  const rangeLabel = useMemo(() => fmtRange(days), [days])
  const isCurrentWeek = weekOffset === 0

  const persist = useCallback(
    (patch) => {
      if (widgetId) updateData(widgetId, patch)
    },
    [widgetId, updateData],
  )

  /* ── actions ───────────────────────────────────────────────── */

  const addHabit = useCallback(() => {
    const name = newHabit.trim()
    if (!name) return
    const id = uid()
    const habit = { id, name, createdAt: new Date().toISOString() }
    persist({ habits: [...habits, habit] })
    setNewHabit('')
    setRecentlyAdded(id)
    inputRef.current?.focus()
  }, [newHabit, habits, persist])

  // Clear the recently-added animation flag after it plays
  useEffect(() => {
    if (!recentlyAdded) return
    const t = setTimeout(() => setRecentlyAdded(null), 250)
    return () => clearTimeout(t)
  }, [recentlyAdded])

  const removeHabit = useCallback(
    (id) => {
      setRemovingId(id)
      setTimeout(() => {
        const next = habits.filter((h) => h.id !== id)
        const nextCompletions = { ...completions }
        delete nextCompletions[id]
        persist({ habits: next, completions: nextCompletions })
        setRemovingId(null)
      }, 200)
    },
    [habits, completions, persist],
  )

  const toggleDay = useCallback(
    (habitId, date) => {
      const ds = dateStr(date)
      const prev = completions[habitId] ?? {}
      const next = { ...prev }
      if (next[ds]) {
        delete next[ds]
      } else {
        next[ds] = true
      }
      persist({ completions: { ...completions, [habitId]: next } })
    },
    [completions, persist],
  )

  const setWeek = useCallback(
    (dir) => persist({ weekOffset: weekOffset + dir }),
    [weekOffset, persist],
  )

  /* ── keyboard ──────────────────────────────────────────────── */

  const onInputKey = useCallback(
    (e) => {
      if (e.key === 'Enter') addHabit()
    },
    [addHabit],
  )

  /* ── render ────────────────────────────────────────────────── */

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        gap: 10,
        minHeight: 0,
        fontFamily: 'inherit',
        color: 'rgba(255,255,255,0.85)',
      }}
    >
      <style>{css}</style>

      {/* ── add habit bar ──────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 10,
          padding: '4px 10px',
          backdropFilter: 'blur(6px)',
          flexShrink: 0,
        }}
      >
        <input
          ref={inputRef}
          className="ht-add-input"
          type="text"
          placeholder="New habit..."
          value={newHabit}
          onChange={(e) => setNewHabit(e.target.value)}
          onKeyDown={onInputKey}
          maxLength={60}
        />
        <button className="ht-add-btn" onClick={addHabit} title="Add habit">
          +
        </button>
      </div>

      {/* ── week navigation ────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <button className="ht-nav-btn" onClick={() => setWeek(-1)} title="Previous week">
          &#8249;
        </button>
        <span
          style={{
            fontSize: 11,
            color: isCurrentWeek ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.4)',
            letterSpacing: '0.02em',
            userSelect: 'none',
          }}
        >
          {isCurrentWeek ? 'This Week' : rangeLabel}
        </span>
        <button className="ht-nav-btn" onClick={() => setWeek(1)} title="Next week">
          &#8250;
        </button>
      </div>

      {/* ── habit list ─────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {habits.length === 0 ? (
          /* empty state */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: 10,
              opacity: 0.35,
              userSelect: 'none',
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                border: '2px dashed rgba(255,255,255,0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                color: 'rgba(255,255,255,0.35)',
              }}
            >
              +
            </div>
            <span style={{ fontSize: 12 }}>Add your first habit</span>
          </div>
        ) : (
          <>
            {/* day header row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                paddingBottom: 4,
                marginBottom: 2,
              }}
            >
              {/* spacer for name column */}
              <div style={{ flex: 1, minWidth: 0 }} />
              {/* day labels */}
              <div
                style={{
                  display: 'flex',
                  gap: 4,
                  justifyContent: 'center',
                }}
              >
                {days.map((d, i) => (
                  <div
                    key={i}
                    style={{
                      width: 22,
                      textAlign: 'center',
                      fontSize: 10,
                      color:
                        dateStr(d) === todayStr
                          ? 'rgba(16,185,129,0.7)'
                          : 'rgba(255,255,255,0.4)',
                      fontWeight: dateStr(d) === todayStr ? 600 : 400,
                      userSelect: 'none',
                    }}
                  >
                    {DAY_LABELS[i]}
                  </div>
                ))}
              </div>
              {/* spacer for streak + delete */}
              <div style={{ width: 60, flexShrink: 0 }} />
            </div>

            {/* habits */}
            {habits.map((habit) => {
              const streak = calcStreak(habit.id, completions, today)
              const isRemoving = removingId === habit.id
              const isNew = recentlyAdded === habit.id
              return (
                <div
                  key={habit.id}
                  className={`ht-habit-row ${isRemoving ? 'ht-row-exit' : ''} ${isNew ? 'ht-row-enter' : ''}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '7px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  {/* habit name */}
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 13,
                      color: 'rgba(255,255,255,0.8)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      paddingRight: 8,
                    }}
                    title={habit.name}
                  >
                    {habit.name}
                  </div>

                  {/* day checkboxes */}
                  <div style={{ display: 'flex', gap: 4 }}>
                    {days.map((d, i) => {
                      const ds = dateStr(d)
                      const done = !!(completions[habit.id] ?? {})[ds]
                      const isToday = ds === todayStr
                      return (
                        <div
                          key={i}
                          className={`ht-circle${done ? ' checked' : ''}${isToday ? ' today-col' : ''}`}
                          style={{
                            background: done
                              ? '#10b981'
                              : 'rgba(255,255,255,0.06)',
                            border: `1.5px solid ${
                              done
                                ? '#10b981'
                                : isToday
                                  ? 'rgba(255,255,255,0.25)'
                                  : 'rgba(255,255,255,0.1)'
                            }`,
                          }}
                          onClick={() => toggleDay(habit.id, d)}
                          role="checkbox"
                          aria-checked={done}
                          aria-label={`${habit.name} ${DAY_LABELS[i]}`}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              toggleDay(habit.id, d)
                            }
                          }}
                        >
                          {done && (
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 12 12"
                              fill="none"
                              style={{ display: 'block' }}
                            >
                              <path
                                d="M2.5 6.5L5 9L9.5 3.5"
                                stroke="#fff"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeDasharray="16"
                                strokeDashoffset="0"
                              />
                            </svg>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* streak + delete */}
                  <div
                    style={{
                      width: 60,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: 4,
                      paddingLeft: 6,
                    }}
                  >
                    {streak > 0 && (
                      <span
                        className="ht-streak-badge"
                        style={{
                          background: 'rgba(255,165,0,0.15)',
                          color: 'rgba(255,165,0,0.9)',
                        }}
                      >
                        <span role="img" aria-label="streak">
                          {'\uD83D\uDD25'}
                        </span>
                        {streak}
                      </span>
                    )}
                    <button
                      className="ht-delete-btn"
                      onClick={() => removeHabit(habit.id)}
                      title="Delete habit"
                      aria-label={`Delete ${habit.name}`}
                    >
                      &times;
                    </button>
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
