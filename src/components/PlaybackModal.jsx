import { useState, useRef, useMemo, useCallback } from 'react'

function toLocalInput(d) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

function defaultRange() {
  const now = new Date()
  now.setSeconds(0, 0)
  const start = new Date(now.getTime() - 10 * 60 * 1000)
  return { start: toLocalInput(start), end: toLocalInput(now) }
}

function toSec(str) {
  const t = Date.parse(String(str || '').replace(' ', 'T'))
  return Number.isFinite(t) ? t / 1000 : 0
}

function fmtDur(totalSec) {
  if (!Number.isFinite(totalSec) || totalSec < 0) totalSec = 0
  const s = Math.floor(totalSec % 60)
  const m = Math.floor((totalSec / 60) % 60)
  const h = Math.floor(totalSec / 3600)
  const p = (n) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`
}

export default function PlaybackModal({ device, records, error, busy, onQuery, onClose }) {
  const [initialRange] = useState(defaultRange)
  const [start, setStart] = useState(initialRange.start)
  const [end, setEnd] = useState(initialRange.end)
  const [queried, setQueried] = useState(false)

  const segments = useMemo(
    () =>
      (records || []).map((r, idx) => ({
        ...r,
        idx,
        dur: Math.max(0, toSec(r.end) - toSec(r.start)),
      })),
    [records],
  )

  const videoRef = useRef(null)
  const pendingRef = useRef(null)
  const [cur, setCur] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [pos, setPos] = useState(0)
  const [measured, setMeasured] = useState({})
  const [rate, setRate] = useState(1)

  const effDur = useCallback(
    (i) => measured[i] ?? segments[i]?.dur ?? 0,
    [measured, segments],
  )

  const total = useMemo(() => {
    let acc = 0
    for (let i = 0; i < segments.length; i++) acc += effDur(i)
    return acc
  }, [segments, effDur])

  const cum = useCallback(
    (n) => {
      let acc = 0
      for (let i = 0; i < n; i++) acc += effDur(i)
      return acc
    },
    [effDur],
  )

  const resetPlayer = useCallback(() => {
    setCur(null)
    setPlaying(false)
    setPos(0)
    setMeasured({})
    pendingRef.current = null
  }, [])

  const jumpTo = useCallback(
    (index, t = 0, autoplay = true) => {
      if (index < 0 || index >= segments.length) return
      const v = videoRef.current
      pendingRef.current = { index, t, autoplay }
      if (index === cur) {
        if (v && v.readyState >= 1) {
          const d = Number.isFinite(v.duration) ? v.duration : 0
          if (d > 0) v.currentTime = Math.min(Math.max(0, t), d - 0.1)
          if (autoplay) {
            v.play().catch(() => {})
            setPlaying(true)
          } else {
            v.pause()
            setPlaying(false)
          }
          setPos(cum(index) + (d > 0 ? Math.min(Math.max(0, t), d - 0.1) : t))
          pendingRef.current = null
        }
      } else {
        setCur(index)
        setPlaying(autoplay)
        setPos(cum(index) + Math.max(0, t))
      }
    },
    [cur, segments, cum],
  )

  const findAt = useCallback(
    (overall) => {
      let acc = 0
      for (let i = 0; i < segments.length; i++) {
        const d = effDur(i)
        if (i === segments.length - 1 || overall <= acc + d) {
          return { i, t: Math.min(Math.max(0, overall - acc), Math.max(0, d)) }
        }
        acc += d
      }
      return { i: 0, t: 0 }
    },
    [segments, effDur],
  )

  const togglePlay = useCallback(() => {
    if (cur == null) {
      if (segments.length) jumpTo(0, 0, true)
      return
    }
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      v.play().catch(() => {})
      setPlaying(true)
    } else {
      v.pause()
      setPlaying(false)
    }
  }, [cur, segments, jumpTo])

  const goNext = useCallback(() => {
    if (cur == null) return
    if (cur + 1 < segments.length) {
      jumpTo(cur + 1, 0, true)
    } else {
      setPlaying(false)
    }
  }, [cur, segments, jumpTo])

  const onLoadedMetadata = useCallback(() => {
    const v = videoRef.current
    const d = v && Number.isFinite(v.duration) ? v.duration : 0
    if (cur != null && d > 0) {
      setMeasured((prev) => (prev[cur] === d ? prev : { ...prev, [cur]: d }))
    }
    if (v) v.playbackRate = rate
    const p = pendingRef.current
    if (p && p.index === cur) {
      if (d > 0) v.currentTime = Math.min(Math.max(0, p.t), d - 0.1)
      if (p.autoplay) {
        v.play().catch(() => {})
        setPlaying(true)
      } else {
        setPlaying(false)
      }
      setPos(cum(cur) + (d > 0 ? Math.min(Math.max(0, p.t), d - 0.1) : 0))
      pendingRef.current = null
    }
  }, [cur, cum, rate])

  const onTimeUpdate = useCallback(() => {
    const v = videoRef.current
    if (!v || cur == null) return
    setPos(Math.min(cum(cur) + v.currentTime, total))
  }, [cur, cum, total])

  const onTrackClick = useCallback(
    (e) => {
      if (!segments.length || total <= 0) return
      const rect = e.currentTarget.getBoundingClientRect()
      const frac = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1)
      const { i, t } = findAt(frac * total)
      jumpTo(i, t, true)
    },
    [segments, total, findAt, jumpTo],
  )

  const changeRate = useCallback((r) => {
    setRate(r)
    const v = videoRef.current
    if (v) v.playbackRate = r
  }, [])

  const doQuery = () => {
    setQueried(true)
    resetPlayer()
    onQuery(start.replace('T', ' '), end.replace('T', ' '))
  }

  const seg = cur != null ? segments[cur] : null
  const pct = total > 0 ? Math.min((pos / total) * 100, 100) : 0

  return (
    <div className="detail-overlay">
      <div className="playback-modal" onClick={(e) => e.stopPropagation()}>
        <div className="playback-frame">
          <div className="playback-topbar">
            <div className="pb-brand">
              <span className="pb-brand-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="2" y="5" width="15" height="14" rx="2" />
                  <path d="m17 10 5-3v10l-5-3V10z" />
                </svg>
              </span>
              <div className="pb-brand-text">
                <span className="pb-title">录像回放</span>
                <span className="pb-sub">
                  {device.name}
                  {device.ip ? ` · ${device.ip}` : ''}
                </span>
              </div>
            </div>
            <button className="pb-close" onClick={onClose} title="关闭">
              &times;
            </button>
          </div>

          <div className="playback-controls">
            <div className="pb-field">
              <label htmlFor="pb-start">开始时间</label>
              <input
                id="pb-start"
                type="datetime-local"
                step="1"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <span className="pb-to">→</span>
            <div className="pb-field">
              <label htmlFor="pb-end">结束时间</label>
              <input
                id="pb-end"
                type="datetime-local"
                step="1"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
            <button className="pb-query-btn" onClick={doQuery} disabled={busy}>
              {busy ? '查询中...' : '查询录像'}
            </button>
          </div>

          {error && (
            <div className="playback-error">
              <span className="pe-icon">!</span>
              {error}
            </div>
          )}

          <div className="playback-body">
            <div className="playback-player">
              <video
                ref={videoRef}
                src={seg ? seg.url : undefined}
                autoPlay={false}
                playsInline
                onClick={togglePlay}
                onEnded={goNext}
                onLoadedMetadata={onLoadedMetadata}
                onTimeUpdate={onTimeUpdate}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
              />
              {!seg && (
                <div className="playback-hint">
                  {busy ? (
                    <>
                      <span className="pb-spinner" />
                      查询中...
                    </>
                  ) : (
                    '点击下方录像段开始播放'
                  )}
                </div>
              )}
              {seg && (
                <div className="pb-controls" onClick={(e) => e.stopPropagation()}>
                  <button className="pb-btn" onClick={togglePlay} title={playing ? '暂停' : '播放'}>
                    {playing ? '⏸' : '▶'}
                  </button>
                  <span className="pb-time">
                    {fmtDur(pos)} / {fmtDur(total)}
                  </span>
                  <div className="pb-speeds">
                    {[0.5, 1, 1.5, 2].map((sp) => (
                      <button
                        key={sp}
                        className={`pb-speed ${rate === sp ? 'active' : ''}`}
                        onClick={() => changeRate(sp)}
                      >
                        {sp}x
                      </button>
                    ))}
                  </div>
                  <div className="pb-track" onClick={onTrackClick}>
                    <div className="pb-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )}
            </div>

            <div className="playback-list">
              <div className="playback-list-head">
                <span className="pl-title">录像段</span>
                <span className="pl-count">
                  {queried && !busy ? `${segments.length} 段` : '—'}
                </span>
              </div>
              <div className="playback-list-scroll">
                {queried && busy && (
                  <div className="playback-empty">查询中...</div>
                )}
                {queried && !busy && segments.length === 0 && (
                  <div className="playback-empty">该时间段暂无录像，请调整时间后重新查询</div>
                )}
                {!queried && !busy && (
                  <div className="playback-empty">设置起止时间后点击「查询录像」</div>
                )}
                {queried &&
                  !busy &&
                  segments.map((item) => (
                    <div
                      key={item.url}
                      className={`playback-item ${cur === item.idx ? 'active' : ''} ${busy ? 'disabled' : ''}`}
                      onClick={() => !busy && jumpTo(item.idx, 0, true)}
                    >
                      <span className="playback-item-ic">▶</span>
                      <div className="playback-item-time">
                        <span>{item.start}</span>
                        <span className="playback-arrow">→</span>
                        <span>{item.end}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
