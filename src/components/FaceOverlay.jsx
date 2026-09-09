import { useLayoutEffect, useState } from 'react'

function useContentRect(videoRef, fit = 'cover') {
  const [rect, setRect] = useState(null)

  useLayoutEffect(() => {
    const video = videoRef.current
    const container = video?.parentElement
    if (!video || !container) return

    let raf = 0

    const measure = () => {
      const vw = video.videoWidth
      const vh = video.videoHeight
      if (!vw || !vh) return
      const cw = container.clientWidth
      const ch = container.clientHeight
      if (!cw || !ch) return
      const scale =
        fit === 'contain' ? Math.min(cw / vw, ch / vh) : Math.max(cw / vw, ch / vh)
      const w = vw * scale
      const h = vh * scale
      setRect({ left: (cw - w) / 2, top: (ch - h) / 2, width: w, height: h })
    }

    const schedule = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(measure)
    }

    video.addEventListener('loadedmetadata', measure)
    video.addEventListener('loadeddata', measure)
    video.addEventListener('resize', measure)
    const ro = new ResizeObserver(schedule)
    ro.observe(container)
    schedule()

    return () => {
      cancelAnimationFrame(raf)
      video.removeEventListener('loadedmetadata', measure)
      video.removeEventListener('loadeddata', measure)
      video.removeEventListener('resize', measure)
      ro.disconnect()
    }
  }, [videoRef, fit])

  return rect
}

export default function FaceOverlay({ faces, videoRef, fit = 'cover' }) {
  const rect = useContentRect(videoRef, fit)

  if (!rect || !faces || faces.length === 0) return null

  return faces.map((face, i) => {
    const known = !!face.known
    const pct = face.score != null ? ` ${Math.round(face.score * 100)}%` : ''
    const label = known
      ? `${face.name ? `${face.id} ${face.name}` : `ID:${face.id}`}`
      : '未知'

    return (
      <div
        key={i}
        className="face-box"
        style={{
          left: rect.left + face.x * rect.width,
          top: rect.top + face.y * rect.height,
          width: face.w * rect.width,
          height: face.h * rect.height,
          borderColor: known ? '#4ade80' : '#fb7185',
        }}
        title={`${known ? `${face.id} ${face.name || ''}` : '陌生人'}${pct}`.trim()}
      >
        <span className={`face-tag ${known ? 'face-tag-known' : 'face-tag-unknown'}`}>
          <i />
          {label}
          {pct}
        </span>
      </div>
    )
  })
}
