import { useState, useEffect, useRef, useCallback } from 'react'
import { CLIENT_CONFIG } from '../config/clientConfig'
import { AudioPlayer } from '../audio/AudioPlayer'
import { ClientVad } from '../audio/ClientVad'
import type {
  SessionStateName,
  SessionMode,
  TranscriptItem,
  Claim,
  TraceEvent,
  MetricsState,
  Notice,
  RoutingEvent,
  MicState,
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
  const [currentEpoch, setCurrentEpoch] = useState<number>(0)

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
  const [micState, setMicState] = useState<MicState>('off')
  const [micAudioLevel, setMicAudioLevel] = useState<number>(0)
  const [speakerAudioLevel, setSpeakerAudioLevel] = useState<number>(0)

  const wsRef = useRef<WebSocket | null>(null)
  const threadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const epochRef = useRef<number>(0)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioPlayerRef = useRef<AudioPlayer | null>(null)
  const clientVadRef = useRef<ClientVad | null>(null)
  const sessionStateRef = useRef<SessionStateName>('ready')

  // Keep sessionStateRef in sync
  useEffect(() => {
    sessionStateRef.current = sessionState
  }, [sessionState])

  // Client-clock metric timestamps
  const tVadStartRef = useRef<number | null>(null)
  const tVadEndRef = useRef<number | null>(null)
  const tTurnStartReceiptRef = useRef<number | null>(null)

  // Send message helper
  const send = useCallback((payload: Record<string, unknown>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload))
    } else {
      console.warn('[useGatewayWs] Socket not open, failed to send:', payload)
    }
  }, [])

  // Initialize AudioPlayer with callback events adhering to contracts/ws_events.md
  useEffect(() => {
    const player = new AudioPlayer({
      onPlaybackStarted: (turnId, epoch, sentenceIdx, tClientMs) => {
        send({
          type: 'playback_started',
          turn_id: turnId,
          epoch,
          sentence_idx: sentenceIdx,
          t_client_ms: tClientMs,
        })
      },
      onPlaybackProgress: (turnId, epoch, sentenceIdx, playedMs) => {
        send({
          type: 'playback_progress',
          turn_id: turnId,
          epoch,
          sentence_idx: sentenceIdx,
          played_ms: playedMs,
        })
      },
      onPlaybackStopped: (turnId, epoch, reason, tClientMs) => {
        send({
          type: 'playback_stopped',
          turn_id: turnId,
          epoch,
          reason,
          t_client_ms: tClientMs,
        })
      },
    })
    audioPlayerRef.current = player

    return () => {
      player.close()
    }
  }, [send])

  // Sample real-time speaker audio energy from AnalyserNode
  useEffect(() => {
    let animId: number
    const sampleSpeakerEnergy = () => {
      animId = requestAnimationFrame(sampleSpeakerEnergy)
      const analyser = audioPlayerRef.current?.getAnalyser()
      if (analyser && activeSpeakerId) {
        const data = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) {
          sum += data[i]
        }
        const avg = sum / (data.length * 255)
        setSpeakerAudioLevel(avg)
      } else {
        setSpeakerAudioLevel(0)
      }
    }
    sampleSpeakerEnergy()
    return () => cancelAnimationFrame(animId)
  }, [activeSpeakerId])

  // Connect to WebSocket
  const connect = useCallback(() => {
    try {
      const url = CLIENT_CONFIG.gatewayWsUrl
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[useGatewayWs] Connected to', url)
        setConnected(true)
        setNotices((prev) => prev.filter((n) => n.code !== 'disconnected'))
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          // Epoch verification (contracts/ws_events.md Section 2)
          if (data.epoch !== undefined && typeof data.epoch === 'number') {
            if (data.epoch < epochRef.current) {
              console.log(`[useGatewayWs] Dropping stale event from epoch ${data.epoch} < current ${epochRef.current}`)
              return
            }
            if (data.epoch > epochRef.current) {
              epochRef.current = data.epoch
              setCurrentEpoch(data.epoch)
              audioPlayerRef.current?.setEpoch(data.epoch)
              setActiveSpeakerId(null)
            }
          }

          switch (data.type) {
            case 'session_state': {
              setSessionState(data.state)
              if (data.mode) setSessionMode(data.mode)
              if (data.session_id) setSessionId(data.session_id)
              if (data.epoch !== undefined) {
                epochRef.current = data.epoch
                setCurrentEpoch(data.epoch)
                audioPlayerRef.current?.setEpoch(data.epoch)
              }

              if (data.state === 'ended') {
                audioPlayerRef.current?.stop('end')
                setActiveSpeakerId(null)
                setSpeechSlip(null)
              }
              break
            }

            case 'speaker_active': {
              // Authoritative speaker highlight (contracts/ws_events.md Section 4 & RULE-32)
              setActiveSpeakerId(data.agent_id)
              if (data.turn_id !== undefined) {
                setActiveTurnId(data.turn_id)
              }

              // Compute grant_to_first_audio_ms (receipt of turn_start to speaker_active)
              if (tTurnStartReceiptRef.current !== null) {
                const grantMs = Math.round(performance.now() - tTurnStartReceiptRef.current)
                tTurnStartReceiptRef.current = null
                setMetrics((prev) => ({ ...prev, grant_to_first_audio_ms: grantMs }))
                send({
                  type: 'metrics',
                  name: 'grant_to_first_audio_ms',
                  value: grantMs,
                  available: true,
                })
              }

              // Compute user_question_to_first_audio_ms if responding to user
              if (tVadEndRef.current !== null) {
                const questionToAudioMs = Math.round(performance.now() - tVadEndRef.current)
                tVadEndRef.current = null
                setMetrics((prev) => ({ ...prev, user_question_to_first_audio_ms: questionToAudioMs }))
                send({
                  type: 'metrics',
                  name: 'user_question_to_first_audio_ms',
                  value: questionToAudioMs,
                  available: true,
                })
              }
              break
            }

            case 'audio_chunk': {
              // Play incoming MP3/WAV chunks in sentence order
              if (data.data_b64) {
                audioPlayerRef.current?.enqueueChunk({
                  turnId: data.turn_id,
                  epoch: data.epoch,
                  sentenceIdx: data.sentence_idx ?? 0,
                  seq: data.seq ?? 0,
                  mime: data.mime || 'audio/mpeg',
                  dataB64: data.data_b64,
                })
              }
              break
            }

            case 'transcript': {
              setSpeechSlip({ text: data.text, final: data.final })

              setTranscripts((prev) => {
                // Key by turn_id, speaker, and sentence_idx to preserve each sentence in order
                const existingIdx = prev.findIndex(
                  (t) =>
                    t.turn_id === data.turn_id &&
                    t.speaker === data.speaker &&
                    (data.sentence_idx === undefined || t.sentence_idx === data.sentence_idx)
                )
                const newItem: TranscriptItem = {
                  id: `t_${data.turn_id}_${data.epoch}_${data.speaker}_${data.sentence_idx ?? 0}`,
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
              // Authoritative highlight rule: DO NOT set activeSpeakerId on turn_start!
              // Gated strictly on speaker_active / playback_started event per RULE-32.
              tTurnStartReceiptRef.current = performance.now()
              break
            }

            case 'turn_end': {
              if (data.status === 'completed') {
                audioPlayerRef.current?.endTurn(data.turn_id)
              } else if (data.status === 'interrupted' || data.status === 'discarded') {
                audioPlayerRef.current?.stop('barge_in')
                setActiveSpeakerId(null)
              }
              break
            }

            case 'playback_stopped': {
              if (data.reason === 'finished' || data.reason === 'barge_in' || data.reason === 'end') {
                setActiveSpeakerId(null)
                setSpeakerAudioLevel(0)
              }
              break
            }

            case 'trace_event': {
              setTraces((prev) => [...prev, data as TraceEvent])
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
              // Server-reported metric update
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
                    code: 'unknown_target',
                    level: 'warn',
                    text: r.question || 'Which expert did you mean? (Alex, Sam, or Maya)',
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

            case 'topic_config': {
              console.log('[useGatewayWs] Topic configuration updated:', data.topic_id)
              break
            }

            default:
              console.log('[useGatewayWs] Event:', data)
              break
          }
        } catch (err) {
          console.error('[useGatewayWs] Error parsing event:', err)
        }
      }

      ws.onclose = () => {
        console.log('[useGatewayWs] Disconnected')
        setConnected(false)
        audioPlayerRef.current?.stop('error')
        // Local-only state S7 on socket closed (reconciliation R3)
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
  }, [send])

  useEffect(() => {
    connect()
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
      if (threadTimeoutRef.current) {
        clearTimeout(threadTimeoutRef.current)
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      }
      if (clientVadRef.current) {
        clientVadRef.current.stop()
      }
      if (audioPlayerRef.current) {
        audioPlayerRef.current.close()
      }
    }
  }, [connect])

  // Start Session (Local S1 Connecting per R3)
  const startSession = useCallback(
    (topicId: string) => {
      epochRef.current = 0
      setCurrentEpoch(0)
      audioPlayerRef.current?.reset(0)
      setSessionState('connecting')
      setTranscripts([])
      setClaims([])
      setTraces([])
      setNotices([])
      setActiveSpeakerId(null)
      setSpeechSlip(null)
      send({
        type: 'start_session',
        topic_id: topicId,
        session_id: null,
      })
    },
    [send]
  )

  // Barge-In (Local S4 User Speaking per R3, audio player stop, and metrics)
  const bargeIn = useCallback(() => {
    const tStart = performance.now()
    tVadStartRef.current = tStart
    setSessionState('user_speaking')
    setActiveSpeakerId(null)
    setSpeechSlip({ text: 'Listening to you…', final: false })

    // Immediately stop in-flight audio playback
    audioPlayerRef.current?.stop('barge_in')

    // Send VAD start notification
    send({
      type: 'vad',
      state: 'start',
      t_client_ms: tStart,
    })

    // Send barge_in notification
    send({
      type: 'barge_in',
      turn_id: activeTurnId || 1,
      epoch: epochRef.current,
      sentence_idx: 0,
      played_ms: 500,
      t_client_ms: tStart,
    })

    // Immediate playback stop on client; measure interrupt_to_silence_ms
    const tStop = performance.now()
    const silenceMs = Math.max(1, Math.round(tStop - tStart))

    setMetrics((prev) => ({ ...prev, interrupt_to_silence_ms: silenceMs }))
    send({
      type: 'playback_stopped',
      turn_id: activeTurnId || 1,
      epoch: epochRef.current,
      reason: 'barge_in',
      t_client_ms: tStop,
    })
    send({
      type: 'metrics',
      name: 'interrupt_to_silence_ms',
      value: silenceMs,
      available: true,
    })

    // Fallback simulation timer if VAD mic is not active
    if (!clientVadRef.current) {
      setTimeout(() => {
        const tEnd = performance.now()
        tVadEndRef.current = tEnd
        send({
          type: 'vad',
          state: 'end',
          t_client_ms: tEnd,
        })
      }, 1200)
    }
  }, [send, activeTurnId])

  // Direct Addressing (RULE-10, RULE-12)
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

  // End Session (Local S8 per R3)
  const endSession = useCallback(() => {
    epochRef.current += 1
    setCurrentEpoch(epochRef.current)
    audioPlayerRef.current?.stop('end')
    setSessionState('ended')
    setActiveSpeakerId(null)
    setSpeechSlip(null)
    send({
      type: 'end_session',
    })
  }, [send])

  // Microphone toggle with real browser getUserMedia + Client VAD
  const toggleMic = useCallback(async () => {
    if (micState === 'on') {
      if (clientVadRef.current) {
        clientVadRef.current.stop()
        clientVadRef.current = null
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop())
        mediaStreamRef.current = null
      }
      setMicState('off')
      setMicAudioLevel(0)
      send({ type: 'mic_state', state: 'off' })
      return
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMicState('unavailable')
      send({ type: 'mic_state', state: 'unavailable' })
      setNotices((prev) => [
        ...prev,
        {
          code: 'mic_denied',
          level: 'warn',
          text: 'Microphone hardware is unavailable in this environment.',
          recoverable: false,
        },
      ])
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      mediaStreamRef.current = stream
      setMicState('on')
      send({ type: 'mic_state', state: 'on' })
      setNotices((prev) => prev.filter((n) => n.code !== 'mic_denied'))

      // Start Client VAD for automated voice barge-in
      const vad = new ClientVad({
        onSpeechStart: (_tStart) => {
          if (sessionStateRef.current !== 'user_speaking') {
            bargeIn()
          }
        },
        onSpeechEnd: (tEnd) => {
          tVadEndRef.current = tEnd
          send({
            type: 'vad',
            state: 'end',
            t_client_ms: tEnd,
          })
          setSessionState('processing_user')
        },
        onAudioLevel: (lvl) => {
          setMicAudioLevel(lvl)
        },
        onUtterance: (text, isFinal, targetHint) => {
          setSpeechSlip({ text, final: isFinal })
          if (targetHint) {
            setAddressedAgentId(targetHint)
            send({ type: 'address_agent', agent_id: targetHint })
          }
          send({
            type: 'user_utterance',
            utterance_id: `u_${Date.now()}`,
            text,
            final: isFinal,
            input_mode: 'voice',
            confidence: 0.95,
            target_hint: targetHint,
          })
        },
      })
      vad.start(stream)
      clientVadRef.current = vad
    } catch (err: unknown) {
      const error = err as { name?: string }
      console.warn('[useGatewayWs] Mic permission error:', error)
      const isDenied = error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError'
      const stateVal: MicState = isDenied ? 'denied' : 'unavailable'
      setMicState(stateVal)
      setMicAudioLevel(0)
      send({ type: 'mic_state', state: stateVal })
      setNotices((prev) => [
        ...prev,
        {
          code: 'mic_denied',
          level: 'error',
          text: 'Microphone access is blocked. Enable it in your browser settings to interrupt by voice.',
          recoverable: true,
        },
      ])
    }
  }, [micState, send, bargeIn])

  const triggerMockEvent = useCallback(
    (action: 'unknown_target' | 'no_speech' | 'disconnect') => {
      send({ type: `trigger_${action}` })
    },
    [send]
  )

  const dismissNotice = useCallback((index: number) => {
    setNotices((prev) => prev.filter((_, i) => i !== index))
  }, [])

  // Manual development simulation helper
  const simulateSpeaker = useCallback((agentId: string | null, text?: string) => {
    setActiveSpeakerId(agentId)
    if (agentId) {
      setSessionState('agent_speaking')
      if (text) {
        setSpeechSlip({ text, final: false })
      }
    } else {
      setSessionState('waiting_first_speaker')
      setSpeechSlip(null)
    }
  }, [])

  // Send typed user utterance (A1/A5 interactive query)
  const sendUtterance = useCallback(
    (text: string, targetHint?: string) => {
      const cleanText = text.trim()
      if (!cleanText) return
      setSpeechSlip({ text: cleanText, final: true })
      const target = targetHint || addressedAgentId || 'ai_engineer'
      send({
        type: 'user_utterance',
        utterance_id: `u_${Date.now()}`,
        text: cleanText,
        final: true,
        input_mode: 'text',
        confidence: 1.0,
        target_hint: target,
      })
      setSessionState('processing_user')
    },
    [send, addressedAgentId]
  )

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
    micState,
    micAudioLevel,
    speakerAudioLevel,
    startSession,
    bargeIn,
    addressAgent,
    sendUtterance,
    endSession,
    toggleMic,
    triggerMockEvent,
    dismissNotice,
    simulateSpeaker,
  }
}
