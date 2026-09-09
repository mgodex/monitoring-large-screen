import { useState, useEffect, useRef, useCallback } from 'react'
import MonitoringGrid from './components/MonitoringGrid'
import SettingsPanel from './components/SettingsPanel'
import DetailModal from './components/DetailModal'
import PlaybackModal from './components/PlaybackModal'
import { useMqtt } from './hooks/useMqtt'
import './App.css'

function App() {
  const {
    status,
    devices,
    group,
    faces,
    allDevices,
    screenError,
    records,
    recordsError,
    recordBusy,
    sendSwitch,
    sendDetail,
    sendGetAllDevice,
    sendJumpToDevice,
    sendQueryRecord,
    clearRecordQuery,
  } = useMqtt()
  const [autoSwitchInterval, setAutoSwitchInterval] = useState(0)
  const [detailDevice, setDetailDevice] = useState(null)
  const [playbackDevice, setPlaybackDevice] = useState(null)
  const timerRef = useRef(null)
  const bootRef = useRef(false)

  const openDetail = useCallback(
    (device) => {
      if (!device?.name) return
      setDetailDevice(device)
      sendDetail(device.name, true)
    },
    [sendDetail],
  )

  const closeDetail = useCallback(() => {
    if (detailDevice) {
      sendDetail(detailDevice.name, false)
    }
    setDetailDevice(null)
  }, [detailDevice, sendDetail])

  const switchToNext = useCallback(() => {
    sendSwitch('next', '9')
  }, [sendSwitch])

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    if (autoSwitchInterval > 0) {
      timerRef.current = setInterval(() => {
        switchToNext()
      }, autoSwitchInterval * 1000)
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [autoSwitchInterval, switchToNext])

  useEffect(() => {
    if (status === 'connected' && !bootRef.current) {
      bootRef.current = true
      const timer = setTimeout(() => {
        switchToNext()
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [status, switchToNext])

  useEffect(() => {
    if (status === 'connected') {
      sendGetAllDevice()
    }
  }, [status, sendGetAllDevice])

  const jumpToDevice = useCallback(
    (name) => {
      if (name) sendJumpToDevice(name)
    },
    [sendJumpToDevice],
  )

  const openPlayback = useCallback((device) => {
    if (!device?.name) return
    setPlaybackDevice(device)
  }, [])

  const closePlayback = useCallback(() => {
    if (playbackDevice) {
      clearRecordQuery(playbackDevice.name)
    }
    setPlaybackDevice(null)
  }, [playbackDevice, clearRecordQuery])

  const queryRecords = useCallback(
    (start, end) => {
      if (playbackDevice) {
        sendQueryRecord(playbackDevice.name, start, end)
      }
    },
    [playbackDevice, sendQueryRecord],
  )

  return (
    <div className="app">
      <header className="app-header">
        <h1>监控大屏</h1>
        <div className="header-info">
          <span className="header-status">
            当前为第 <em>{group}</em> 组
            <i className="hs-sep" />
            启用 <em>{devices.length}</em> 路
          </span>
        </div>
      </header>

      <main className="app-main">
        <MonitoringGrid devices={devices} faces={faces} onDetail={openDetail} />
      </main>

      {detailDevice && (
        <DetailModal device={detailDevice} faces={faces?.[detailDevice.name]} onClose={closeDetail} />
      )}

      {playbackDevice && (
        <PlaybackModal
          device={playbackDevice}
          records={records[playbackDevice.name]}
          error={recordsError[playbackDevice.name]}
          busy={recordBusy}
          onQuery={queryRecords}
          onClose={closePlayback}
        />
      )}

      <SettingsPanel
        mqttStatus={status}
        group={group}
        autoSwitchInterval={autoSwitchInterval}
        onAutoSwitchIntervalChange={setAutoSwitchInterval}
        onSwitchNext={switchToNext}
        allDevices={allDevices}
        screenError={screenError}
        onJumpToDevice={jumpToDevice}
        onPlayback={openPlayback}
      />
    </div>
  )
}

export default App
