export const MQTT_CONFIG = {
  brokerURL: 'ws://127.0.0.1:15674/ws',
  // brokerURL: 'ws://172.66.66.8:15674/ws',
  // brokerURL: 'ws://172.16.0.17:15674/ws',
  credentials: {
    login: 'meng',
    passcode: '123456',
    // login: 'admin',
    // passcode: 'gfkd_123456',
    // login: 'gfkd',
    // passcode: 'gfkd@123456',
  },
  reconnectDelay: 5000,
  heartbeatIncoming: 4000,
  heartbeatOutgoing: 4000,
}

export const MQTT_TOPICS = {
  SWITCH: '/topic/.switchScreen',
  SWITCH_RETURN: '/topic/.switchScreenReturn',
  FACE: '/topic/.faceInfo',
  FACE_CAPTURE: '/topic/.mengTool',
  QUERY_RECORD: '/topic/.queryRecord',
  QUERY_RECORD_RETURN: '/topic/.queryRecordReturn',
}

export const VIDEO_CONFIG = {
  baseURL: 'http://localhost:8889',
  // baseURL: 'http://172.66.66.8:8889',
  // baseURL: 'http://172.16.0.4:8889',
  getWHEPUrl: (deviceName) => `${VIDEO_CONFIG.baseURL}/${deviceName}/whep`,
}

export const VIDEO_FACE_CONFIG = {
  uploadURL: '/api/upload/file',
  uploadContentType: 'video/mp4',
}

export const TIMEOUT_CONFIG = {
  RECORD_QUERY: 10000,
  VIDEO_FACE_DETECT: 300000,
}

export const DETAIL_CONFIG = {
  keepAliveInterval: 5000,
}
