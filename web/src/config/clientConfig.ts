// Client configuration for AI Roundtable

export const CLIENT_CONFIG = {
  gatewayWsUrl: import.meta.env.VITE_GATEWAY_WS_URL || 'ws://localhost:8000/ws',
  appTitle: 'AI Roundtable',
  tagline: 'Three perspectives. One live conversation.',
  reconnectTimeoutMs: 15000,
  maxReconnectAttempts: 5,
} as const
