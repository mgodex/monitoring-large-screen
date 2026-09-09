export const MQTT_CONFIG = {
  brokerURL: 'ws://127.0.0.1:15674/ws',
  credentials: {
    login: 'meng',
    passcode: '123456',
  },
  reconnectDelay: 5000,
  heartbeatIncoming: 4000,
  heartbeatOutgoing: 4000,
}

export const MQTT_TOPICS = {
  SWITCH: '/topic/.switchScreen',
  SWITCH_RETURN: '/topic/.switchScreenReturn',
  FACE: '/topic/.faceInfo',
  QUERY_RECORD: '/topic/.queryRecord',
  QUERY_RECORD_RETURN: '/topic/.queryRecordReturn',
}

export const VIDEO_CONFIG = {
  baseURL: 'http://localhost:8889',
  getWHEPUrl: (deviceName) => `${VIDEO_CONFIG.baseURL}/${deviceName}/whep`,
}

export const TIMEOUT_CONFIG = {
  RECORD_QUERY: 10000,
}

export const DETAIL_CONFIG = {
  keepAliveInterval: 5000,
}
