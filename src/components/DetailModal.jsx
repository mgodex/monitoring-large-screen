import { useState, useRef, useEffect, useCallback } from 'react'
import { useMediaMTXWebRTC } from 'mediamtx-webrtc-react'
import FaceOverlay from './FaceOverlay'
import { VIDEO_CONFIG } from '../config'

const { getWHEPUrl } = VIDEO_CONFIG

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

export default function DetailModal({ device, faces, faceRecords, aiActive, onClose }) {
  const { videoRef, isConnected } = useMediaMTXWebRTC({
    url: getWHEPUrl(device.name),
  })
  const arRef = useRef(16 / 9)
  const [box, setBox] = useState(() => fitBox(16 / 9))
  const [previewPhoto, setPreviewPhoto] = useState(null)

  const handleExport = useCallback(() => {
    if (!faceRecords.length) return
    const name = (r) => r.name || (r.id != null ? `人员${r.id}` : '未命名')
    const rowsHtml = faceRecords
      .map((r, i) => {
        const img = r.photo
          ? `<img src="${r.photo}" alt="${name(r)}" />`
          : '<div class="noimg">无照片</div>'
        return `<tr><td>${i + 1}</td><td><div class="photo">${img}</div></td><td>${name(r)}</td><td>${r.id != null ? r.id : ''}</td><td>${r.time}</td></tr>`
      })
      .join('')
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<title>人脸识别记录 - ${device.name}</title>
<style>
  body { font-family: "Microsoft YaHei", "PingFang SC", sans-serif; margin: 28px; color: #1f2937; }
  h1 { font-size: 18px; margin: 0 0 6px; }
  .meta { color: #6b7280; font-size: 13px; margin-bottom: 16px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #d1d5db; padding: 8px; text-align: center; font-size: 13px; }
  th { background: #f3f4f6; }
  .photo img { width: 80px; height: 80px; object-fit: cover; border-radius: 6px; }
  .noimg { color: #9ca3af; }
</style>
</head>
<body>
<h1>人脸识别比对记录</h1>
<div class="meta">设备：${device.name} · 导出时间：${new Date().toLocaleString('zh-CN')} · 共 ${faceRecords.length} 条</div>
<table>
<thead>
<tr><th>序号</th><th>照片</th><th>姓名</th><th>ID</th><th>时间</th></tr>
</thead>
<tbody>
${rowsHtml}
</tbody>
</table>
</body>
</html>`
    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const stamp = new Date().toLocaleString('zh-CN').replace(/[/:]/g, '-')
    a.download = `人脸识别记录_${device.name}_${stamp}.html`
    a.click()
    URL.revokeObjectURL(url)
  }, [faceRecords, device.name])

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

          <div className={`ai-badge ${aiActive ? 'on' : 'off'}`}>
            <i />
            {aiActive ? 'AI识别已启动' : 'AI识别已停止'}
          </div>

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

      <aside className="face-records-panel">
        <div className="face-records-header">
          <span>比对通过记录</span>
          <div className="face-records-actions">
            <em>{faceRecords.length}</em>
            <button
              className="fr-export"
              onClick={handleExport}
              disabled={!faceRecords.length}
              title="导出本次记录"
            >
              导出
            </button>
          </div>
        </div>
        <ul className="face-records-list">
          {faceRecords.length === 0 && (
            <li className="face-record-empty">暂无记录</li>
          )}
          {faceRecords.map((r, i) => (
            <li className="face-record-item" key={`${r.name}-${i}`}>
              {r.photo ? (
                <img
                  src={r.photo}
                  alt={r.name}
                  onClick={() => setPreviewPhoto(r.photo)}
                  onError={(e) => {
                    e.target.style.display = 'none'
                  }}
                />
              ) : (
                <span className="fr-avatar">{String(r.name || '?').slice(0, 1)}</span>
              )}
              <div className="fr-meta">
                <span className="fr-name">
                  {r.name || (r.id != null ? `人员${r.id}` : '未命名')}
                </span>
                <span className="fr-id">{r.id != null ? `ID: ${r.id}` : ''}</span>
              </div>
              <time className="fr-time">{r.time}</time>
            </li>
          ))}
        </ul>
      </aside>

      {previewPhoto && (
        <div className="photo-preview" onClick={() => setPreviewPhoto(null)}>
          <img src={previewPhoto} alt="人脸" />
        </div>
      )}
    </div>
  )
}
