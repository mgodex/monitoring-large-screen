import { useState, useEffect, useRef, useCallback } from 'react'
import { Client } from '@stomp/stompjs'
import { MQTT_CONFIG, MQTT_TOPICS, TIMEOUT_CONFIG } from '../config'

const { brokerURL: STOMP_URL, credentials, reconnectDelay, heartbeatIncoming, heartbeatOutgoing } = MQTT_CONFIG
const { SWITCH: SWITCH_TOPIC, SWITCH_RETURN: RETURN_TOPIC, FACE: FACE_TOPIC, QUERY_RECORD: QUERY_RECORD_TOPIC, QUERY_RECORD_RETURN: QUERY_RECORD_RETURN_TOPIC } = MQTT_TOPICS
const RECORD_QUERY_TIMEOUT = TIMEOUT_CONFIG.RECORD_QUERY

function toDataUri(photo) {
  if (!photo) return ''
  if (photo.startsWith('data:')) return photo
  if (photo.startsWith('http://') || photo.startsWith('https://')) return photo
  const clean = photo.replace(/\s+/g, '')
  let mime = 'image/jpeg'
  if (clean.startsWith('iVBOR')) mime = 'image/png'
  else if (clean.startsWith('R0lGOD')) mime = 'image/gif'
  else if (clean.startsWith('UklGR')) mime = 'image/webp'
  return `data:${mime};base64,${clean}`
}

function normalizeDevices(raw) {
  if (Array.isArray(raw)) {
    return raw
      .map((d) =>
        typeof d === 'string'
          ? { name: d, ip: '' }
          : { name: d?.name || '', ip: d?.ip || '' },
      )
      .filter((d) => d.name)
  }
  return (raw ? String(raw).split(',') : [])
    .filter(Boolean)
    .map((name) => ({ name: name.trim(), ip: '' }))
}

export function useMqtt() {
  const [status, setStatus] = useState('disconnected')
  const [devices, setDevices] = useState([])
  const [group, setGroup] = useState(0)
  const [lastMessage, setLastMessage] = useState(null)
  const [faces, setFaces] = useState({})
  const [faceRecords, setFaceRecords] = useState({})
  const [allDevices, setAllDevices] = useState([])
  const [screenError, setScreenError] = useState('')
  const [records, setRecords] = useState({})
  const [recordsError, setRecordsError] = useState({})
  const [recordBusy, setRecordBusy] = useState(false)
  const clientRef = useRef(null)
  const callbacksRef = useRef({})
  const firstSwitchRef = useRef(true)
  const recordTimerRef = useRef(null)

  useEffect(() => {
    const client = new Client({
      brokerURL: STOMP_URL,
      connectHeaders: credentials,
      reconnectDelay,
      heartbeatIncoming,
      heartbeatOutgoing,
      onConnect: () => {
        console.log('[MQTT] STOMP connected')
        setStatus('connected')
        client.subscribe(RETURN_TOPIC, (message) => {
          try {
            const data = JSON.parse(message.body)
            setLastMessage(data)
            if (data.cmd === 'getAllDevice' && data.result === 'ok') {
              const list = Array.isArray(data.devices)
                ? data.devices
                    .map((d) => ({
                      name: typeof d === 'string' ? d : d?.name || '',
                      ip: typeof d === 'string' ? '' : d?.ip || '',
                    }))
                    .filter((d) => d.name)
                : []
              setAllDevices(list)
            } else if (data.cmd === 'switchScreen') {
              if (data.result === 'ok') {
                setScreenError('')
                setDevices(normalizeDevices(data.devices))
                setGroup(data.group || 0)
              } else if (data.result === 'failed') {
                const msg =
                  (typeof data.devices === 'string' && data.devices) ||
                  data.message ||
                  '切换失败'
                setScreenError(String(msg))
              }
            }
            if (callbacksRef.current.onMessage) {
              callbacksRef.current.onMessage(data)
            }
          } catch (e) {
            console.error('STOMP message parse error:', e)
          }
        })
        client.subscribe(FACE_TOPIC, (message) => {
          try {
            const data = JSON.parse(message.body)
            if (data.cmd === 'faceEvent' && data.device) {
              setFaces((prev) => ({
                ...prev,
                [data.device]: Array.isArray(data.faces) ? data.faces : [],
              }))
              const device = data.device
              const seen = new Set()
              const batch = []
              for (const f of Array.isArray(data.faces) ? data.faces : []) {
                if (!f || f.known !== true) continue
                const key = f.id != null ? `id:${f.id}` : f.name ? `name:${f.name}` : ''
                if (!key || seen.has(key)) continue
                seen.add(key)
                batch.push({
                  key,
                  id: f.id,
                  name: f.name || '',
                  photo: toDataUri(f.photo),
                  time: new Date().toLocaleTimeString('zh-CN', {
                    hour12: false,
                  }),
                })
              }
              if (batch.length) {
                setFaceRecords((prev) => {
                  const cur = prev[device] || []
                  const result = [...cur]
                  for (const item of batch) {
                    const last = result.length ? result[result.length - 1] : null
                    if (last && item.key === last.key) continue
                    result.push(item)
                  }
                  return { ...prev, [device]: result }
                })
              }
            }
          } catch (e) {
            console.error('face message parse error:', e)
          }
        })
        client.subscribe(QUERY_RECORD_RETURN_TOPIC, (message) => {
          try {
            const data = JSON.parse(message.body)
            if (data.cmd === 'queryRecord') {
              if (recordTimerRef.current) {
                clearTimeout(recordTimerRef.current)
                recordTimerRef.current = null
              }
              setRecordBusy(false)
              if (data.result === 'ok') {
                const videos = (Array.isArray(data.videos) ? data.videos : [])
                  .map((v) => ({
                    start: v?.start || '',
                    end: v?.end || '',
                    url: v?.url || '',
                  }))
                  .filter((v) => v.url)
                setRecords((prev) => ({ ...prev, [data.device]: videos }))
                setRecordsError((prev) => {
                  if (!prev[data.device]) return prev
                  const next = { ...prev }
                  delete next[data.device]
                  return next
                })
              } else {
                const msg =
                  String(data.message || '') ||
                  (typeof data.devices === 'string' ? data.devices : '') ||
                  '查询失败'
                setRecordsError((prev) => ({ ...prev, [data.device]: msg }))
                setRecords((prev) => {
                  if (!prev[data.device]) return prev
                  const next = { ...prev }
                  delete next[data.device]
                  return next
                })
              }
            }
          } catch (e) {
            console.error('queryRecord message parse error:', e)
          }
        })
      },
      onDisconnect: () => setStatus('disconnected'),
      onStompError: (frame) => {
        console.error('[MQTT] STOMP error:', frame.headers?.message)
        setStatus('error')
      },
      onWebSocketClose: () => setStatus('disconnected'),
      onWebSocketError: () => setStatus('error'),
    })

    client.activate()
    clientRef.current = client

    return () => {
      if (recordTimerRef.current) {
        clearTimeout(recordTimerRef.current)
        recordTimerRef.current = null
      }
      client.deactivate()
    }
  }, [])

  const sendDetail = useCallback((device, run) => {
    const client = clientRef.current
    if (client && client.connected) {
      const payload = JSON.stringify({
        cmd: 'viewDetailedScreen',
        device,
        run,
      })
      console.log('[MQTT] sending:', payload, 'to', SWITCH_TOPIC)
      client.publish({
        destination: SWITCH_TOPIC,
        body: payload,
        headers: { 'content-type': 'application/json' },
      })
      return true
    }
    console.warn('[MQTT] sendDetail failed - client not ready')
    return false
  }, [])

  const sendSwitch = useCallback((groupCmd = 'next', quantity = '9') => {
    const client = clientRef.current
    if (client && client.connected) {
      if (firstSwitchRef.current) {
        firstSwitchRef.current = false
      } else {
        quantity = undefined
      }
      const payload = JSON.stringify({
        cmd: 'switchScreen',
        group: groupCmd,
        quantity,
      })
      console.log('[MQTT] sending:', payload, 'to', SWITCH_TOPIC)
      client.publish({
        destination: SWITCH_TOPIC,
        body: payload,
        headers: { 'content-type': 'application/json' },
      })
      return true
    }
    console.warn('[MQTT] sendSwitch failed - client not ready')
    return false
  }, [])

  const sendGetAllDevice = useCallback(() => {
    const client = clientRef.current
    if (client && client.connected) {
      const payload = JSON.stringify({ cmd: 'getAllDevice' })
      console.log('[MQTT] sending:', payload, 'to', SWITCH_TOPIC)
      client.publish({
        destination: SWITCH_TOPIC,
        body: payload,
        headers: { 'content-type': 'application/json' },
      })
      return true
    }
    console.warn('[MQTT] sendGetAllDevice failed - client not ready')
    return false
  }, [])

  const sendJumpToDevice = useCallback((device) => {
    const client = clientRef.current
    if (client && client.connected) {
      const payload = JSON.stringify({
        cmd: 'switchScreen',
        group: 'next',
        device,
      })
      console.log('[MQTT] sending:', payload, 'to', SWITCH_TOPIC)
      client.publish({
        destination: SWITCH_TOPIC,
        body: payload,
        headers: { 'content-type': 'application/json' },
      })
      return true
    }
    console.warn('[MQTT] sendJumpToDevice failed - client not ready')
    return false
  }, [])

  const sendQueryRecord = useCallback((device, startTime, endTime) => {
    const client = clientRef.current
    if (client && client.connected) {
      const payload = JSON.stringify({
        cmd: 'queryRecord',
        device,
        startTime,
        endTime,
      })
      console.log('[MQTT] sending:', payload, 'to', QUERY_RECORD_TOPIC)
      client.publish({
        destination: QUERY_RECORD_TOPIC,
        body: payload,
        headers: { 'content-type': 'application/json' },
      })
      setRecordsError((prev) => {
        if (!prev[device]) return prev
        const next = { ...prev }
        delete next[device]
        return next
      })
      setRecordBusy(true)
      if (recordTimerRef.current) {
        clearTimeout(recordTimerRef.current)
      }
      recordTimerRef.current = setTimeout(() => {
        recordTimerRef.current = null
        setRecordBusy(false)
        setRecordsError((prev) => ({ ...prev, [device]: '查询超时，请重试' }))
        setRecords((prev) => {
          if (!prev[device]) return prev
          const next = { ...prev }
          delete next[device]
          return next
        })
      }, RECORD_QUERY_TIMEOUT)
      return true
    }
    console.warn('[MQTT] sendQueryRecord failed - client not ready')
    return false
  }, [])

  const clearRecordQuery = useCallback((device) => {
    if (recordTimerRef.current) {
      clearTimeout(recordTimerRef.current)
      recordTimerRef.current = null
    }
    setRecordBusy(false)
    setRecords((prev) => {
      if (!prev || prev[device] == null) return prev
      const next = { ...prev }
      delete next[device]
      return next
    })
    setRecordsError((prev) => {
      if (!prev || prev[device] == null) return prev
      const next = { ...prev }
      delete next[device]
      return next
    })
  }, [])

  const onMessage = useCallback((cb) => {
    callbacksRef.current.onMessage = cb
  }, [])

  const clearFaceRecords = useCallback((device) => {
    setFaceRecords((prev) => {
      if (device == null) return {}
      if (!prev[device]) return prev
      const next = { ...prev }
      delete next[device]
      return next
    })
  }, [])

  return {
    status,
    devices,
    group,
    lastMessage,
    faces,
    faceRecords,
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
    clearFaceRecords,
    onMessage,
  }
}
