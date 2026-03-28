import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useWidgetStore } from '../../store/widgetStore'
import { useCFCrawl } from '../../hooks/useCFCrawl'

const ACCENT = '#0ea5e9'
const ACCENT_RGB = '14, 165, 233'
const BG_SUBTLE = 'rgba(255,255,255,0.06)'
const FONT_BODY = "'IBM Plex Sans', sans-serif"
const FONT_MONO = "'IBM Plex Mono', monospace"

const scopeId = (wid) => wid.replace(/[^a-zA-Z0-9]/g, '')

export function WebClipper({ widgetId }) {
  const widget = useWidgetStore((s) => s.widgets.find((w) => w.id === widgetId))
  const updateData = useWidgetStore((s) => s.updateData)
  const { crawl, loading, error } = useCFCrawl()

  const [url, setUrl] = useState('')
  const [btnHover, setBtnHover] = useState(false)
  const [chipHover, setChipHover] = useState(null)
  const [retryHover, setRetryHover] = useState(false)
  const contentRef = useRef(null)

  const rawClips = widget?.data?.clips
  const clips = useMemo(() => rawClips ?? [], [rawClips])
  const activeClipIndex = widget?.data?.activeClipIndex ?? null

  const activeClip =
    activeClipIndex !== null && clips[activeClipIndex]
      ? clips[activeClipIndex]
      : null

  const save = useCallback(
    (patch) => updateData(widgetId, patch),
    [widgetId, updateData],
  )

  const handleClip = useCallback(async () => {
    const trimmed = url.trim()
    if (!trimmed) return

    const result = await crawl(trimmed)
    if (result === null) return // error is surfaced via hook's error state

    // Extract a rough title: first non-empty line, capped at 120 chars
    const lines = result.split('\n').filter((l) => l.trim())
    const title = lines.length > 0 ? lines[0].slice(0, 120) : trimmed

    const newClip = {
      url: trimmed,
      title,
      content: result,
      clippedAt: new Date().toISOString(),
    }

    const updated = [newClip, ...clips].slice(0, 20) // keep max 20 clips
    save({ clips: updated, activeClipIndex: 0 })
    setUrl('')
  }, [url, crawl, clips, save])

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && !loading) handleClip()
    },
    [handleClip, loading],
  )

  const viewClip = useCallback(
    (index) => save({ activeClipIndex: index }),
    [save],
  )

  const removeClip = useCallback(
    (index, e) => {
      e.stopPropagation()
      const updated = clips.filter((_, i) => i !== index)
      let newActive = activeClipIndex
      if (activeClipIndex === index) newActive = null
      else if (activeClipIndex !== null && activeClipIndex > index)
        newActive = activeClipIndex - 1
      save({ clips: updated, activeClipIndex: newActive })
    },
    [clips, activeClipIndex, save],
  )

  // Scroll content to top when active clip changes
  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0
  }, [activeClipIndex])

  if (!widget) return null

  const sid = scopeId(widgetId)
  const visibleChips = clips.slice(0, 5)
  const isWorkerError =
    error &&
    (error.toLowerCase().includes('worker') ||
      error.toLowerCase().includes('network') ||
      error.toLowerCase().includes('fetch') ||
      error.toLowerCase().includes('url') ||
      error.toLowerCase().includes('failed'))

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        gap: 0,
        fontFamily: FONT_BODY,
        overflow: 'hidden',
      }}
    >
      <style>{`
        @keyframes wc-scan-${sid} {
          0%   { top: 0; opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .wc-content-${sid}::-webkit-scrollbar { width: 4px; }
        .wc-content-${sid}::-webkit-scrollbar-track { background: transparent; }
        .wc-content-${sid}::-webkit-scrollbar-thumb {
          background: rgba(${ACCENT_RGB}, 0.2);
          border-radius: 2px;
        }
        .wc-content-${sid}::-webkit-scrollbar-thumb:hover {
          background: rgba(${ACCENT_RGB}, 0.35);
        }
      `}</style>

      {/* URL Input Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: BG_SUBTLE,
          borderRadius: 8,
          padding: '0 0 0 10px',
          flexShrink: 0,
        }}
      >
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter URL to clip..."
          spellCheck={false}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#e0e0f0',
            fontFamily: FONT_MONO,
            fontSize: 13,
            padding: '9px 0',
            minWidth: 0,
          }}
        />
        <button
          onClick={handleClip}
          disabled={loading || !url.trim()}
          onMouseEnter={() => setBtnHover(true)}
          onMouseLeave={() => setBtnHover(false)}
          style={{
            flexShrink: 0,
            background:
              loading || !url.trim()
                ? 'rgba(255,255,255,0.04)'
                : btnHover
                  ? '#38bdf8'
                  : ACCENT,
            color:
              loading || !url.trim() ? 'rgba(255,255,255,0.25)' : '#fff',
            border: 'none',
            borderRadius: '0 8px 8px 0',
            padding: '9px 14px',
            fontFamily: FONT_BODY,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.03em',
            cursor: loading || !url.trim() ? 'default' : 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: btnHover && url.trim() && !loading
              ? `0 0 12px rgba(${ACCENT_RGB}, 0.35)`
              : 'none',
          }}
        >
          {loading ? 'Clipping...' : 'Clip'}
        </button>
      </div>

      {/* History Chips */}
      {visibleChips.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            marginTop: 8,
            flexShrink: 0,
          }}
        >
          {visibleChips.map((clip, i) => {
            const isActive = activeClipIndex === i
            const isHovered = chipHover === i
            return (
              <div
                key={clip.clippedAt + i}
                onClick={() => viewClip(i)}
                onMouseEnter={() => setChipHover(i)}
                onMouseLeave={() => setChipHover(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  background: isActive
                    ? `rgba(${ACCENT_RGB}, 0.15)`
                    : isHovered
                      ? 'rgba(255,255,255,0.1)'
                      : BG_SUBTLE,
                  borderRadius: 10,
                  padding: '3px 8px',
                  fontSize: 11,
                  fontFamily: FONT_MONO,
                  color: isActive ? ACCENT : 'rgba(255,255,255,0.5)',
                  cursor: 'pointer',
                  maxWidth: 160,
                  transition: 'all 0.15s ease',
                  border: isActive
                    ? `1px solid rgba(${ACCENT_RGB}, 0.25)`
                    : '1px solid transparent',
                }}
              >
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {clip.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                </span>
                <span
                  onClick={(e) => removeClip(i, e)}
                  style={{
                    flexShrink: 0,
                    fontSize: 10,
                    opacity: 0.5,
                    lineHeight: 1,
                    padding: '0 1px',
                    cursor: 'pointer',
                  }}
                >
                  ×
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Content Area */}
      <div
        style={{
          flex: 1,
          marginTop: 10,
          position: 'relative',
          minHeight: 0,
          borderRadius: 6,
          overflow: 'hidden',
          background: activeClip || loading || error
            ? 'rgba(255,255,255,0.02)'
            : 'transparent',
        }}
      >
        {/* Loading: scanning line animation */}
        {loading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              overflow: 'hidden',
              pointerEvents: 'none',
              zIndex: 2,
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                height: 2,
                background: `linear-gradient(90deg, transparent, ${ACCENT}, transparent)`,
                animation: `wc-scan-${sid} 1.8s ease-in-out infinite`,
                boxShadow: `0 0 8px rgba(${ACCENT_RGB}, 0.5)`,
              }}
            />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'rgba(255,255,255,0.3)',
                fontSize: 12,
                fontFamily: FONT_MONO,
              }}
            >
              Extracting content...
            </div>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: 10,
              padding: 16,
            }}
          >
            <div
              style={{
                fontSize: 13,
                color: '#fca5a5',
                textAlign: 'center',
                lineHeight: 1.5,
                background: 'rgba(239,68,68,0.08)',
                borderRadius: 8,
                padding: '10px 14px',
                border: '1px solid rgba(239,68,68,0.15)',
              }}
            >
              {isWorkerError
                ? 'Configure your CloudFlare Worker to enable web clipping'
                : error}
            </div>
            <button
              onClick={handleClip}
              onMouseEnter={() => setRetryHover(true)}
              onMouseLeave={() => setRetryHover(false)}
              disabled={!url.trim()}
              style={{
                background: retryHover ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.08)',
                color: '#fca5a5',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 6,
                padding: '5px 14px',
                fontSize: 12,
                cursor: url.trim() ? 'pointer' : 'default',
                fontFamily: FONT_BODY,
                transition: 'all 0.15s ease',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Content Display */}
        {!loading && !error && activeClip && (
          <div
            ref={contentRef}
            className={`wc-content-${sid}`}
            style={{
              position: 'absolute',
              inset: 0,
              overflowY: 'auto',
              padding: '12px 14px',
            }}
          >
            {/* Title */}
            <div
              style={{
                fontWeight: 700,
                fontSize: 14,
                color: '#e0e0f0',
                lineHeight: 1.4,
                marginBottom: 6,
                fontFamily: FONT_BODY,
              }}
            >
              {activeClip.title}
            </div>
            {/* Source URL */}
            <div
              style={{
                fontSize: 11,
                fontFamily: FONT_MONO,
                color: 'rgba(255,255,255,0.3)',
                marginBottom: 12,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {activeClip.url}
            </div>
            {/* Body */}
            <div
              style={{
                fontSize: 13,
                fontFamily: FONT_BODY,
                color: 'rgba(255,255,255,0.78)',
                lineHeight: 1.65,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {activeClip.content}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && !activeClip && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: 8,
              userSelect: 'none',
            }}
          >
            <div style={{ fontSize: 32, opacity: 0.18 }}>
              {'\uD83C\uDF10'}
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'rgba(255,255,255,0.2)',
                fontFamily: FONT_BODY,
              }}
            >
              Clip any webpage
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
