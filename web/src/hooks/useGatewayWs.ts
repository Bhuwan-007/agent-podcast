import { useState, useEffect, useRef, useCallback } from 'react'
import { CLIENT_CONFIG } from '../config/clientConfig'
import type {
  SessionStateName,
  SessionMode,
  TranscriptItem,
  Claim,
  TraceEvent,
  MetricsState,
  Notice,
  RoutingEvent,
} from '../types/protocol'

export interface ActiveThread {
  from: string
  to: string
  summary: string
  ts: number
}

export function useGatewayWs() {
  const [connected, setConnected] = useState<boolean>(false)
  const [sessionState, setSessionState] = useState<SessionStateName>('ready')
  const [sessionMode, setSessionMode] = useState<SessionMode>('mock')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [currentEpoch, setCurrentEpoch] = useState<number>(1)

  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null)
  const [activeTurnId, setActiveTurnId] = useState<number | null>(null)
  const [speechSlip, setSpeechSlip] = useState<{ text: string; final: boolean } | null>(null)

  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([])
  const [claims, setClaims] = useState<Claim[]>([])
  const [traces, setTraces] = useState<TraceEvent[]>([])
  const [metrics, setMetrics] = useState<MetricsState>({
    interrupt_to_silence_ms: null,
    user_question_to_first_audio_ms: null,
    grant_to_first_audio_ms: null,
  })
  const [notices, setNotices] = useState<Notice[]>([])
  const [addressedAgentId, setAddressedAgentId] = useState<string | null>(null)
  const [activeThread, setActiveThread] = useState<ActiveThread | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const threadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Connect to WebSocket
  const connect = useCallback(() => {
    try {
      const url = CLIENT_CONFIG.gatewayWsUrl
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[useGatewayWs] Connected to', url)
        setConnected(true)
        // Clear disconnected notice if present
        setNotices((prev) => prev.filter((n) => n.code !== 'disconnected'))
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          // Dispatch protocol events
          switch (data.type) {
            case 'session_state': {
              setSessionState(data.state)
              if (data.mode) setSessionMode(data.mode)
              if (data.session_id) setSessionId(data.session_id)
              if (data.epoch !== undefined) setCurrentEpoch(data.epoch)

              if (data.state === 'ended') {
                setActiveSpeakerId(null)
                setSpeechSlip(null)
              }
              break
            }

            case 'speaker_active': {
              setActiveSpeakerId(data.agent_id)
              setActiveTurnId(data.turn_id)
              break
            }

            case 'transcript': {
              setSpeechSlip({ text: data.text, final: data.final })

              setTranscripts((prev) => {
                // If turn exists and final update, update it; otherwise append
                const existingIdx = prev.findIndex(
                  (t) => t.turn_id === data.turn_id && t.speaker === data.speaker
                )
                const newItem: TranscriptItem = {
                  id: `t_${data.turn_id}_${data.epoch}_${data.speaker}`,
                  turn_id: data.turn_id,
                  epoch: data.epoch,
                  speaker: data.speaker,
                  text: data.text,
                  final: data.final,
                  sentence_idx: data.sentence_idx,
                }
                if (existingIdx >= 0) {
                  const updated = [...prev]
                  updated[existingIdx] = newItem
                  return updated
                }
                return [...prev, newItem]
              })
              break
            }

            case 'turn_start': {
              setActiveTurnId(data.turn_id)
              if (data.agent_id) {
                setActiveSpeakerId(data.agent_id)
              }
              break
            }

            case 'turn_end': {
              if (data.status === 'completed' || data.status === 'interrupted' || data.status === 'discarded') {
                if (activeTurnId === data.turn_id) {
                  setActiveSpeakerId(null)
                }
              }
              break
            }

            case 'trace_event': {
              setTraces((prev) => [...prev, data as TraceEvent])
              // Set visual thread between seats
              if (data.from && data.to) {
                setActiveThread({
                  from: data.from,
                  to: data.to,
                  summary: data.summary,
                  ts: Date.now(),
                })
                if (threadTimeoutRef.current) clearTimeout(threadTimeoutRef.current)
                threadTimeoutRef.current = setTimeout(() => {
                  setActiveThread(null)
                }, 1600)
              }
              break
            }

            case 'claims_update': {
              setClaims(data.claims as Claim[])
              break
            }

            case 'metrics': {
              setMetrics((prev) => ({
                ...prev,
                [data.name]: data.available ? data.value : null,
              }))
              break
            }

            case 'routing': {
              const r = data as RoutingEvent
              if (r.target) {
                setAddressedAgentId(r.target)
              }
              if (r.kind === 'unknown_target') {
                setNotices((prev) => [
                  ...prev,
                  {
                    code: 'no_speech',
                    level: 'warn',
                    text: r.question || 'Which expert did you mean?',
                    recoverable: true,
                  },
                ])
              }
              break
            }

            case 'notice': {
              setNotices((prev) => [...prev, data as Notice])
              break
            }

            case 'audio_chunk': {
              // Real audio playback will be integrated in B4
              // For B2/B3 we acknowledge audio chunk receipt
              break
            }

            default:
              console.log('[useGatewayWs] Event:', data)
              break
          }
        } catch (err) {
          console.error('[useGatewayWs] Failed to parse event frame:', err)
        }
      }

      ws.onclose = () => {
        console.log('[useGatewayWs] Disconnected')
        setConnected(false)
        setSessionState('recovery')
        setNotices((prev) => [
          ...prev,
          {
            code: 'disconnected',
            level: 'warn',
            text: 'Connection to gateway was lost. Reconnecting…',
            recoverable: true,
          },
        ])
      }

      ws.onerror = (err) => {
        console.error('[useGatewayWs] WebSocket error:', err)
      }
    } catch (e) {
      console.error('[useGatewayWs] Connection error:', e)
    }
  }, [activeTurnId])

  useEffect(() => {
    connect()
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
      if (threadTimeoutRef.current) {
        clearTimeout(threadTimeoutRef.current)
      }
    }
  }, [connect])

  // Client Outbound Events
  const send = useCallback((payload: Record<string, unknown>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload))
    } else {
      console.warn('[useGatewayWs] Cannot send message, socket not open', payload)
    }
  }, [])

  const startSession = useCallback(
    (topicId: string) => {
      setSessionState('connecting')
      setTranscripts([])
      setClaims([])
      setTraces([])
      setNotices([])
      send({
        type: 'start_session',
        topic_id: topicId,
        session_id: null,
      })
    },
    [send]
  )

  const bargeIn = useCallback(() => {
    setSessionState('user_speaking')
    setActiveSpeakerId(null)
    setSpeechSlip({ text: 'Listening to you…', final: false })
    send({
      type: 'barge_in',
      turn_id: activeTurnId || 1,
      epoch: currentEpoch,
      sentence_idx: 0,
      played_ms: 500,
      t_client_ms: performance.now(),
    })
  }, [send, activeTurnId, currentEpoch])

  const addressAgent = useCallback(
    (agentId: string | null) => {
      setAddressedAgentId(agentId)
      send({
        type: 'address_agent',
        agent_id: agentId,
      })
    },
    [send]
  )

  const endSession = useCallback(() => {
    setSessionState('ended')
    setActiveSpeakerId(null)
    setSpeechSlip(null)
    send({
      type: 'end_session',
    })
  }, [send])

  const triggerMockEvent = useCallback(
    (action: 'unknown_target' | 'no_speech' | 'disconnect') => {
      send({ type: `trigger_${action}` })
    },
    [send]
  )

  const dismissNotice = useCallback((index: number) => {
    setNotices((prev) => prev.filter((_, i) => i !== index))
  }, [])

  return {
    connected,
    sessionState,
    sessionMode,
    sessionId,
    currentEpoch,
    activeSpeakerId,
    activeTurnId,
    speechSlip,
    transcripts,
    claims,
    traces,
    metrics,
    notices,
    addressedAgentId,
    activeThread,
    startSession,
    bargeIn,
    addressAgent,
    endSession,
    triggerMockEvent,
    dismissNotice,
  }
}
