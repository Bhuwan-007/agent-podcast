// Canonical protocol types adhering strictly to contracts/ws_events.md

export type SessionStateCode = 'S0' | 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6' | 'S7' | 'S8'

export type SessionStateName =
  | 'ready'
  | 'connecting'
  | 'waiting_first_speaker'
  | 'agent_speaking'
  | 'user_speaking'
  | 'processing_user'
  | 'agent_generating'
  | 'recovery'
  | 'ended'

export type SessionMode = 'live' | 'mock'

export interface AgentConfig {
  agent_id: string
  role: string
  display_name: string
  voice_label: string
  aliases: string[]
  available: boolean
  stance?: string
}

export interface TopicConfig {
  topic_id: string
  title: string
  background: string
  background_brief?: string
  opening_prompt: string
  available: boolean
  agents: AgentConfig[]
}

export interface TranscriptItem {
  id: string
  turn_id: number
  epoch: number
  speaker: string
  text: string
  final: boolean
  sentence_idx?: number
  timestamp?: string
}

export interface Claim {
  id: string
  agent_id: string
  text: string
  status: 'open' | 'challenged' | 'conceded' | 'supported'
  verified: boolean
}

export interface TraceEvent {
  ts: string
  from: string
  to: string
  msg_type: string
  summary: string
}

export interface MetricsState {
  interrupt_to_silence_ms: number | null
  user_question_to_first_audio_ms: number | null
  grant_to_first_audio_ms: number | null
}

export type MicState = 'on' | 'off' | 'denied' | 'unavailable'

export type NoticeCode =
  | 'mic_denied'
  | 'no_speech'
  | 'agent_timeout'
  | 'tts_failed'
  | 'disconnected'
  | 'session_lost'
  | 'collision'
  | 'topic_unavailable'
  | 'unknown_target'

export interface Notice {
  code: NoticeCode
  level: 'info' | 'warn' | 'error'
  text: string
  recoverable: boolean
}

export type RoutingKind =
  | 'targeted'
  | 'general'
  | 'continue'
  | 'topic_shift'
  | 'meta'
  | 'unknown_target'
  | 'unclear'

export interface RoutingEvent {
  utterance_id: string
  kind: RoutingKind
  target: string | null
  question: string | null
}
