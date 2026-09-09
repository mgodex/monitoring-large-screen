import { memo } from 'react'
import { useMediaMTXWebRTC } from 'mediamtx-webrtc-react'
import FaceOverlay from './FaceOverlay'

const VIDEO_BASE = 'http://localhost:8889'

const WebRTCCell = memo(function WebRTCCell({ device, index, faces, onDetail }) {
  const { videoRef, isConnected } = useMediaMTXWebRTC({
    url: `${VIDEO_BASE}/${device.name}/whep`,
  })

  return (
    <div
      className="monitor-cell clickable"
      onClick={() => onDetail(device)}
      title={`点击查看 ${device.name} (${device.ip || '无IP'}) 详细画面`}
    >
      <div className="cell-video">
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
          style={{ display: isConnected ? 'block' : 'none' }}
        />
        {isConnected && <FaceOverlay faces={faces} videoRef={videoRef} />}
        <div className="cell-overlay">
          <span className="cell-index">{String(index + 1).padStart(2, '0')}</span>
          <span className="cell-device-line">
            {device.name}
            {device.ip && (
              <>
                <span className="cell-sep">·</span>
                <span className="cell-ip">{device.ip}</span>
              </>
            )}
          </span>
          <span className={`cell-live ${isConnected ? 'on' : 'off'}`}>
            <i />
            {isConnected ? '在线' : '离线'}
          </span>
        </div>
      </div>
    </div>
  )
})

export default function MonitoringGrid({ devices, faces, onDetail }) {
  return (
    <div className="monitoring-grid">
      {devices.map((device, index) => (
        <WebRTCCell
          key={device.name || index}
          device={device}
          index={index}
          faces={faces?.[device.name]}
          onDetail={onDetail}
        />
      ))}
      {Array.from({ length: 9 - devices.length }).map((_, i) => (
        <div key={`empty-${i}`} className="monitor-cell empty">
          <div className="cell-placeholder">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.5">
              <rect x="2" y="2" width="20" height="20" rx="2" />
              <path d="M15 10l-4 3-3-2-4 3" />
            </svg>
            <small>空闲</small>
          </div>
        </div>
      ))}
    </div>
  )
}
