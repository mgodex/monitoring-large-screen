import { useState } from 'react'

export default function FaceCaptureModal({ captures, onClose, onClear }) {
  const [previewPhoto, setPreviewPhoto] = useState(null)

  return (
    <div className="detail-overlay">
      <div className="face-capture-modal" onClick={(e) => e.stopPropagation()}>
        <div className="face-capture-header">
          <div className="fc-title">
            <i className="fc-title-dot" />
            抓脸记录
            <em className="fc-count">{captures.length}</em>
          </div>
          <div className="fc-actions">
            <button
              className="fc-clear"
              onClick={onClear}
              disabled={!captures.length}
              title="清空抓脸记录"
            >
              清空
            </button>
            <button className="fc-close" onClick={onClose} title="关闭">
              &times;
            </button>
          </div>
        </div>

        <div className="face-capture-body">
          {captures.length === 0 && (
            <div className="face-capture-empty">等待设备抓脸...</div>
          )}
          {captures.map((c, i) => (
            <div className="face-capture-item" key={`${c.time}-${i}`}>
              {c.photo ? (
                <img
                  className="fc-photo"
                  src={c.photo}
                  alt="抓脸"
                  onClick={() => setPreviewPhoto(c.photo)}
                  onError={(e) => {
                    e.target.style.display = 'none'
                  }}
                />
              ) : (
                <span className="fc-photo fc-photo-empty">无照片</span>
              )}
              <div className="fc-info">
                <div className="fc-row">
                  检测分
                  <strong className="fc-score">
                    {c.score != null ? `${Math.round(c.score * 100)}%` : '—'}
                  </strong>
                </div>
                <div className="fc-row fc-detail">
                  <span title="正脸程度">
                    正脸{c.frontal != null ? `${Math.round(c.frontal * 100)}%` : '—'}
                  </span>
                  <span title="清晰度">
                    清晰{c.sharpness != null ? `${Math.round(c.sharpness * 100)}%` : '—'}
                  </span>
                  <span title="人脸占比">
                    占比{c.size != null ? `${Math.round(c.size * 100)}%` : '—'}
                  </span>
                  <span title="检测置信度">
                    置信{c.det != null ? `${Math.round(c.det * 100)}%` : '—'}
                  </span>
                </div>
                <div className="fc-row fc-device">
                  设备 <span title={c.device}>{c.device || '—'}</span>
                </div>
              </div>
              <time className="fc-time">{c.time}</time>
            </div>
          ))}
        </div>
      </div>

      {previewPhoto && (
        <div className="photo-preview" onClick={() => setPreviewPhoto(null)}>
          <img src={previewPhoto} alt="人脸" />
        </div>
      )}
    </div>
  )
}