import { useState, useRef, useEffect, useCallback } from 'react'
import { useMediaMTXWebRTC } from 'mediamtx-webrtc-react'
import FaceOverlay from './FaceOverlay'

const VIDEO_BASE = 'http://localhost:8889'

function fitBox(ar) {
  const availW = Math.max(320, window.innerWidth - 64)
  const availH = Math.max(240, window.innerHeight - 64)
  let w = availW
  let h = w / ar
  if (h > availH) {
    h = availH
    w = h * ar
  }
  return { width: Math.round(w), height: Math.round(h) }
}

export default function DetailModal({ device, faces, onClose }) {
  const { videoRef, isConnected } = useMediaMTXWebRTC({
    url: `${VIDEO_BASE}/${device.name}/whep`,
  })
  const arRef = useRef(16 / 9)
  const [box, setBox] = useState(() => fitBox(16 / 9))

  const applyVideoSize = useCallback(() => {
    const v = videoRef.current
    if (v && v.videoWidth && v.videoHeight) {
      arRef.current = v.videoWidth / v.videoHeight
      setBox(fitBox(arRef.current))
    }
  }, [videoRef])

  useEffect(() => {
    const onResize = () => setBox(fitBox(arRef.current))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <div className="detail-overlay">
      <div
        className="detail-modal"
        style={{ width: box.width, height: box.height }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="detail-video">
          {!isConnected && (
            <div className="cell-loading">
              <div className="spinner" />
              <span>连接中...</span>
            </div>
          )}
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            onLoadedMetadata={applyVideoSize}
            onLoadedData={applyVideoSize}
            style={{ display: isConnected ? 'block' : 'none' }}
          />
          {isConnected && <FaceOverlay faces={faces} videoRef={videoRef} fit="contain" />}

          <button className="detail-close" onClick={onClose} title="关闭">
            &times;
          </button>

          <div className="detail-preview-pill">
            <span className="dpp-label">
              <i />
              正在预览
            </span>
            <span className="dpp-name" title={device.name}>
              {device.name}
            </span>
            {device.ip && (
              <>
                <i className="dpp-sep">·</i>
                <span className="dpp-ip">{device.ip}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
