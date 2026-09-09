import { useState, useEffect, useRef, useCallback } from 'react'
import { Client } from '@stomp/stompjs'

const STOMP_URL = 'ws://127.0.0.1:15674/ws'
const SWITCH_TOPIC = '/topic/.switchScreen'
const RETURN_TOPIC = '/topic/.switchScreenReturn'
const FACE_TOPIC = '/topic/.faceInfo'
const QUERY_RECORD_TOPIC = '/topic/.queryRecord'
const QUERY_RECORD_RETURN_TOPIC = '/topic/.queryRecordReturn'
const RECORD_QUERY_TIMEOUT = 10000

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
      connectHeaders: {
        login: 'meng',
        passcode: '123456',
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
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

  return {
    status,
    devices,
    group,
    lastMessage,
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
    onMessage,
  }
}
