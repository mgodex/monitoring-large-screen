import { useState } from 'react'

const STATUS_META = {
  connected: { label: '已连接', color: '#4ade80' },
  disconnected: { label: '未连接', color: '#f87171' },
  reconnecting: { label: '重连中', color: '#fbbf24' },
  error: { label: '异常', color: '#f87171' },
}

export default function SettingsPanel({
  mqttStatus,
  group,
  autoSwitchInterval,
  onAutoSwitchIntervalChange,
  onSwitchNext,
  allDevices,
  screenError,
  onJumpToDevice,
  onPlayback,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const meta = STATUS_META[mqttStatus] || { label: mqttStatus, color: '#6b7280' }

  const kw = search.trim().toLowerCase()
  const filtered = kw
    ? allDevices.filter(
        (d) =>
          (d.name || '').toLowerCase().includes(kw) ||
          (d.ip || '').toLowerCase().includes(kw),
      )
    : allDevices

  return (
    <>
      <button
        className="settings-toggle"
        onClick={() => setIsOpen(!isOpen)}
        title={isOpen ? '关闭设置' : '打开设置'}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      </button>

      <div className={`settings-panel ${isOpen ? 'open' : ''}`}>
        <div className="settings-header">
          <div className="settings-brand">
            <span className="settings-title">系统设置</span>
            <span className="settings-subtitle">监控大屏 · 控制台</span>
          </div>
          <button className="settings-close" onClick={() => setIsOpen(false)} title="关闭">
            &times;
          </button>
        </div>

        <div className="settings-body">
          <section className="sp-card sp-overview">
            <div className="sp-conn-row">
              <span className="sp-field-label">连接状态</span>
              <span className="sp-pill" style={{ color: meta.color, borderColor: meta.color }}>
                <i className="sp-dot" style={{ background: meta.color }} />
                {meta.label}
              </span>
            </div>
            <div className="sp-divider" />
            <div className="sp-stats">
              <div className="sp-stat">
                <span className="sp-stat-num">{group || 0}</span>
                <span className="sp-stat-label">当前分组</span>
              </div>
              <div className="sp-stat">
                <span className="sp-stat-num">{allDevices.length}</span>
                <span className="sp-stat-label">接入设备</span>
              </div>
            </div>
          </section>

          <section className="sp-card">
            <span className="sp-field-label">自动轮播间隔</span>
            <div className="sp-input-group">
              <input
                type="number"
                min="0"
                max="3600"
                value={autoSwitchInterval}
                onChange={(e) => onAutoSwitchIntervalChange(Number(e.target.value))}
                placeholder="0"
              />
              <span className="sp-input-unit">秒</span>
            </div>
            <p className="sp-hint">设为 0 表示不自动轮播</p>
            <button className="sp-btn sp-btn-primary" onClick={onSwitchNext}>
              切换下一组
            </button>
          </section>

          {screenError && (
            <div className="sp-error">
              <span className="sp-error-icon">!</span>
              {screenError}
            </div>
          )}

          <section className="sp-device-section">
            <div className="sp-section-head">
              <span className="sp-field-label">设备列表</span>
              <span className="sp-count">
                {kw ? `${filtered.length}/${allDevices.length}` : allDevices.length}
              </span>
            </div>

            <div className="sp-search">
              <svg
                className="sp-search-icon"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索设备名 / IP..."
              />
              {search && (
                <button className="sp-search-clear" onClick={() => setSearch('')} title="清空">
                  &times;
                </button>
              )}
            </div>

            <div className="sp-devices">
              {allDevices.length === 0 ? (
                <div className="sp-devices-empty">
                  {mqttStatus === 'connected' ? '暂无设备，等待获取...' : '未连接服务器'}
                </div>
              ) : filtered.length === 0 ? (
                <div className="sp-devices-empty">未找到与「{search.trim()}」匹配的设备</div>
              ) : (
                filtered.map((d) => (
                  <div className="sp-device" key={d.name}>
                    <div className="sp-avatar">{d.name.charAt(0).toUpperCase()}</div>
                    <div className="sp-device-meta">
                      <div className="sp-device-name" title={d.name}>
                        {d.name}
                      </div>
                      {d.ip && <div className="sp-device-ip">{d.ip}</div>}
                    </div>
                    <div className="sp-device-tools">
                      <button
                        className="sp-action sp-action-jump"
                        onClick={() => onJumpToDevice(d.name)}
                        title="跳转到该设备所在分组"
                      >
                        跳转
                      </button>
                      <button
                        className="sp-action sp-action-play"
                        onClick={() => onPlayback(d)}
                        title="查看回放"
                      >
                        回放
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
