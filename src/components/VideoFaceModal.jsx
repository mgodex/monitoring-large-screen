import { useCallback, useMemo, useRef, useState } from 'react'
import { VIDEO_FACE_CONFIG } from '../config'

export default function VideoFaceModal({ onClose, sendVideoFaceDetect }) {
  const [file, setFile] = useState(null)
  const [phase, setPhase] = useState('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [resultUrl, setResultUrl] = useState('')
  const [progress, setProgress] = useState(null)
  const [result, setResult] = useState(null)
  const [tab, setTab] = useState('knowns')
  const [previewPhoto, setPreviewPhoto] = useState(null)
  const [taskId, setTaskId] = useState('')
  const inputRef = useRef(null)

  const knowns = useMemo(() => (result ? result.knowns : []), [result])
  const strangers = useMemo(() => (result ? result.strangers : []), [result])

  const pickFile = (e) => {
    const f = e.target.files && e.target.files[0]
    if (!f) return
    setFile(f)
    setPhase('idle')
    setErrorMsg('')
    setResultUrl('')
    setProgress(null)
    setResult(null)
    setTaskId('')
  }

  const reset = () => {
    setFile(null)
    setPhase('idle')
    setErrorMsg('')
    setResultUrl('')
    setProgress(null)
    setResult(null)
    setTaskId('')
    if (inputRef.current) inputRef.current.value = ''
  }

  const start = async () => {
    if (!file || phase === 'uploading' || phase === 'processing') return
    setErrorMsg('')
    setResultUrl('')
    setProgress(null)
    setResult(null)
    setTaskId('')
    setPhase('uploading')
    try {
      const resp = await fetch(VIDEO_FACE_CONFIG.uploadURL, {
        method: 'PUT',
        headers: { 'content-type': file.type || VIDEO_FACE_CONFIG.uploadContentType },
        body: file,
      })
      if (!resp.ok) throw new Error(`视频上传失败（HTTP ${resp.status}）`)
      const data = await resp.json()
      const url = data.url
      if (!url) throw new Error('视频上传失败：未返回视频地址')
      setPhase('processing')
      const result = await sendVideoFaceDetect(url, (p) => setProgress(p))
      if (result.ok && result.url) {
        setResultUrl(result.url)
        setResult({
          knowns: result.knowns || [],
          strangers: result.strangers || [],
        })
        setTaskId(result.id || '')
        setPhase('done')
      } else {
        setErrorMsg(result.detail || '视频人脸处理失败')
        setPhase('error')
      }
    } catch (e) {
      setErrorMsg(String(e.message || e))
      setPhase('error')
    }
  }

  const busy = phase === 'uploading' || phase === 'processing'
  const pct =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.current / progress.total) * 100))
      : 0

  const handleExport = useCallback(() => {
    if (!knowns.length && !strangers.length) return
    const name = (k) =>
      k.name || (k.id != null ? `人员${k.id}` : '未命名')

    const knownsRows = knowns
      .map(
        (k, i) =>
          `<tr><td>${i + 1}</td><td><div class="photo"><img src="${k.base64}" alt="${name(k)}" /></div></td><td>${name(k)}</td><td>${k.id != null ? k.id : ''}</td></tr>`,
      )
      .join('')

    const strangersRows = strangers
      .map((s, i) => {
        const matches = (s.matches && s.matches.length)
          ? s.matches
              .map(
                (m, j) =>
                  `${j + 1}. ${m.name || '未知'}（${
                    m.sim != null ? `${Math.round(m.sim * 100)}%` : '—'
                  }）`,
              )
              .join('；')
          : '—'
        return `<tr><td>${i + 1}</td><td><div class="photo"><img src="${s.base64}" alt="陌生人${i + 1}" /></div></td><td>${matches}</td></tr>`
      })
      .join('')

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<title>视频人脸处理结果</title>
<style>
  body { font-family: "Microsoft YaHei", "PingFang SC", sans-serif; margin: 28px; color: #1f2937; }
  h1 { font-size: 18px; margin: 0 0 6px; }
  .meta { color: #6b7280; font-size: 13px; margin-bottom: 16px; }
  h2 { font-size: 15px; margin: 18px 0 8px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #d1d5db; padding: 8px; text-align: center; font-size: 13px; }
  th { background: #f3f4f6; }
  .photo img { width: 80px; height: 80px; object-fit: cover; border-radius: 6px; }
</style>
</head>
<body>
<h1>视频人脸处理结果</h1>
<div class="meta">导出时间：${new Date().toLocaleString('zh-CN')} · 白名单 ${knowns.length} 人 · 陌生人 ${strangers.length} 人</div>
<h2>白名单</h2>
<table>
<thead><tr><th>序号</th><th>照片</th><th>姓名</th><th>ID</th></tr></thead>
<tbody>${knownsRows}</tbody>
</table>
<h2>陌生人</h2>
<table>
<thead><tr><th>序号</th><th>照片</th><th>相似人员</th></tr></thead>
<tbody>${strangersRows}</tbody>
</table>
</body>
</html>`
    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const stamp = new Date().toLocaleString('zh-CN').replace(/[/:]/g, '-')
    a.download = `视频人脸处理结果_${stamp}.html`
    a.click()
    URL.revokeObjectURL(url)
  }, [knowns, strangers])

  return (
    <div className="detail-overlay">
      <div className="vfm-shell" onClick={(e) => e.stopPropagation()}>
        <div className="vfm-modal">
          <div className="face-capture-header">
            <div className="fc-title">
              <i className="fc-title-dot" />
              视频人脸分析
            </div>
            <div className="fc-actions">
              <button className="fc-close" onClick={onClose} title="关闭">
                &times;
              </button>
            </div>
          </div>

          <div className="vfm-body">
          <div className="vfm-upload">
            <label
              className={`vfm-dropzone ${file ? 'has-file' : ''} ${busy ? 'disabled' : ''}`}
            >
              <input
                ref={inputRef}
                type="file"
                accept="video/*"
                disabled={busy}
                onChange={pickFile}
              />
              {file ? (
                <div className="vfm-file">
                  <span className="vfm-file-ic">▶</span>
                  <div className="vfm-file-name" title={file.name}>
                    {file.name}
                  </div>
                  <span className="vfm-file-size">
                    {(file.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                  {!busy && (
                    <button
                      className="vfm-remove"
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        reset()
                      }}
                      title="移除文件"
                    >
                      &times;
                    </button>
                  )}
                </div>
              ) : (
                <span className="vfm-drop-hint">
                  点击选择视频文件
                  <small>支持 mp4 / avi / mov 等常见格式</small>
                </span>
              )}
            </label>
          </div>

          {phase === 'uploading' && (
            <div className="vfm-status">
              <span className="vfm-spinner" />
              视频上传中...
            </div>
          )}
          {phase === 'processing' && (
            <div className={`vfm-status ${progress ? 'vfm-progressing' : ''}`}>
              {progress ? (
                <div className="vfm-progress">
                  <div className="vfm-progress-head">
                    <span className="vfm-spinner" />
                    正在做人脸检测处理...
                  </div>
                  <div className="vfm-progress-bar">
                    <div
                      className="vfm-progress-fill"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="vfm-progress-text">
                    已处理 {progress.current} / {progress.total} 帧 ·{' '}
                    <strong>{pct}%</strong>
                  </div>
                </div>
              ) : (
                <>
                  <span className="vfm-spinner" />
                  正在做人脸检测处理，请稍候...
                </>
              )}
            </div>
          )}
          {phase === 'error' && (
            <div className="vfm-status vfm-error">
              <span className="pe-icon">!</span>
              {errorMsg}
            </div>
          )}
          {phase === 'done' && (
            <div className="vfm-result">
              <video src={resultUrl} controls autoPlay playsInline />
            </div>
          )}

<div className="vfm-actions">
            <span className="vfm-note">
              此功能对算力需求大，请耐心等待。<em>请勿并发请求，否则可能导致服务器卡顿。</em>
              {taskId && (
                <span className="vfm-task-id">
                  本次任务ID为: <em>{taskId}</em>
                </span>
              )}
            </span>
            {phase !== 'done' && (
              <button
                className="vfm-btn-primary"
                onClick={start}
                disabled={!file || busy}
              >
                {busy ? '处理中...' : '开始处理'}
              </button>
            )}
          </div>
        </div>
        </div>

        <aside className="vfm-sidebar">
          <div className="vfm-sidebar-head">
            <span className="vfm-sidebar-title">分析结果</span>
            <div className="vfm-sidebar-actions">
              {(knowns.length > 0 || strangers.length > 0) && (
                <span className="vfm-sidebar-count">
                  {knowns.length + strangers.length}
                </span>
              )}
              <button
                className="vfm-export"
                onClick={handleExport}
                disabled={!knowns.length && !strangers.length}
                title="导出白名单与陌生人结果"
              >
                导出
              </button>
            </div>
          </div>
          <div className="vfm-sidebar-tabs">
            <button
              type="button"
              className={`vfm-tab ${tab === 'knowns' ? 'active' : ''}`}
              onClick={() => setTab('knowns')}
            >
              白名单<em>{knowns.length}</em>
            </button>
            <button
              type="button"
              className={`vfm-tab ${tab === 'strangers' ? 'active' : ''}`}
              onClick={() => setTab('strangers')}
            >
              陌生人<em>{strangers.length}</em>
            </button>
          </div>
          <div className="vfm-sidebar-body">
            {tab === 'knowns' ? (
              <>
                {knowns.length === 0 && (
                  <div className="vfm-sec-empty">暂无白名单人脸</div>
                )}
                {knowns.map((k) => (
                  <div className="vfm-known" key={k.id}>
                    <img
                      className="vfm-face"
                      src={k.base64}
                      alt={k.name || '白名单'}
                      onClick={() => setPreviewPhoto(k.base64)}
                      onError={(e) => {
                        e.target.style.display = 'none'
                      }}
                    />
                    <div className="vfm-known-meta">
                      <span className="vfm-known-name">
                        {k.name || '未命名'}
                      </span>
                      <span className="vfm-known-id">ID {k.id}</span>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <>
                {strangers.length === 0 && (
                  <div className="vfm-sec-empty">暂无陌生人</div>
                )}
                {strangers.map((s, i) => (
                  <div className="vfm-stranger" key={`${i}`}>
                    <div className="vfm-stranger-head">
                      <img
                        className="vfm-face vfm-face-sm"
                        src={s.base64}
                        alt={`陌生人${i + 1}`}
                        onClick={() => setPreviewPhoto(s.base64)}
                        onError={(e) => {
                          e.target.style.display = 'none'
                        }}
                      />
                      <span className="vfm-stranger-tag">陌生人 {i + 1}</span>
                    </div>
                    {s.matches && s.matches.length > 0 && (
                      <div className="vfm-matches">
                        <span className="vfm-matches-label">相似人员</span>
                        {s.matches.map((m, j) => (
                          <div className="vfm-match" key={`${i}-${j}`}>
                            <span className="vfm-match-name">
                              {m.name || '未知'}
                            </span>
                            <span className="vfm-match-sim">
                              {m.sim != null
                                ? `${Math.round(m.sim * 100)}%`
                                : '—'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </aside>
      </div>

      {previewPhoto && (
        <div className="photo-preview" onClick={() => setPreviewPhoto(null)}>
          <img src={previewPhoto} alt="人脸" />
        </div>
      )}
    </div>
  )
}