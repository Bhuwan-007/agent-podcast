// Generates real, valid PCM WAV audio data and golden event fixture files
// for contracts/examples/*.jsonl and web/dev/fixtures/*.jsonl

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '../..')
const contractsExamplesDir = path.resolve(rootDir, 'contracts/examples')
const devFixturesDir = path.resolve(__dirname, 'fixtures')

// Ensure target directories exist
fs.mkdirSync(contractsExamplesDir, { recursive: true })
fs.mkdirSync(devFixturesDir, { recursive: true })

/**
 * Creates a valid mono 16-bit PCM WAV buffer with a sine tone.
 * @param {number} durationMs - Duration in milliseconds
 * @param {number} freq - Frequency in Hz
 * @param {number} sampleRate - Sample rate in Hz
 * @returns {Buffer}
 */
function createWavBuffer(durationMs = 800, freq = 440, sampleRate = 22050) {
  const numSamples = Math.floor((durationMs / 1000) * sampleRate)
  const byteRate = sampleRate * 2
  const blockAlign = 2
  const dataSize = numSamples * 2
  const buffer = Buffer.alloc(44 + dataSize)

  // RIFF header
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16) // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20)  // AudioFormat (1 for PCM)
  buffer.writeUInt16LE(1, 22)  // NumChannels (1 mono)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(byteRate, 28)
  buffer.writeUInt16LE(blockAlign, 32)
  buffer.writeUInt16LE(16, 34) // BitsPerSample

  // Data subchunk
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)

  // Generate sine wave samples with attack/decay envelope
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate
    const envelope = Math.min(1, i / 200, (numSamples - i) / 200)
    const sample = Math.sin(2 * Math.PI * freq * t) * 0.4 * envelope
    const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)))
    buffer.writeInt16LE(intSample, 44 + i * 2)
  }

  return buffer
}

// Generate base64 audio chunks for experts
const alexAudioB64 = createWavBuffer(600, 392).toString('base64') // G4
const samAudioB64 = createWavBuffer(800, 330).toString('base64')  // E4
const mayaAudioB64 = createWavBuffer(700, 440).toString('base64') // A4

// ============================================================================
// FIXTURE: start.jsonl
// ============================================================================
const startEvents = [
  {
    type: 'session_state',
    state: 'connecting',
    mode: 'mock',
    session_id: 'mock_sess_001',
    epoch: 1,
  },
  {
    type: 'topic_config',
    topic_id: 'topic_1',
    title: 'Will AI Replace Software Developers?',
    background: 'Coding tools can write/debug/explain code and automate tasks, but engineering includes architecture, security, testing, maintenance and user needs.',
    opening_prompt: "AI coding agents are becoming increasingly capable of building software. Will they eventually replace software developers, or will they transform the role of developers? Discuss your perspectives, challenge one another's assumptions, and work towards a nuanced conclusion.",
    agents: [
      {
        agent_id: 'ai_engineer',
        role: 'AI Engineer',
        display_name: 'Alex',
        voice_label: 'Energetic Technologist',
        aliases: ['ai engineer', 'engineer', 'alex'],
        available: true,
      },
      {
        agent_id: 'software_developer',
        role: 'Software Developer',
        display_name: 'Sam',
        voice_label: 'Pragmatic Builder',
        aliases: ['software developer', 'developer', 'dev', 'sam'],
        available: true,
      },
      {
        agent_id: 'oss_maintainer',
        role: 'Open-Source Maintainer',
        display_name: 'Maya',
        voice_label: 'Rigorous Maintainer',
        aliases: ['open-source maintainer', 'open source maintainer', 'maintainer', 'maya'],
        available: true,
      },
    ],
  },
  {
    type: 'session_state',
    state: 'waiting_first_speaker',
    mode: 'mock',
    session_id: 'mock_sess_001',
    epoch: 1,
  },
]

// ============================================================================
// FIXTURE: normal_turn.jsonl
// ============================================================================
const normalTurnEvents = [
  // Turn 1: Alex speaks
  {
    type: 'turn_start',
    turn_id: 1,
    epoch: 1,
    agent_id: 'ai_engineer',
    kind: 'agent',
  },
  {
    type: 'audio_chunk',
    turn_id: 1,
    epoch: 1,
    sentence_idx: 0,
    seq: 1,
    mime: 'audio/wav',
    data_b64: alexAudioB64,
  },
  {
    type: 'transcript',
    turn_id: 1,
    epoch: 1,
    speaker: 'ai_engineer',
    text: 'AI coding tools are advancing far beyond simple autocomplete.',
    final: false,
    sentence_idx: 0,
  },
  {
    type: 'speaker_active',
    agent_id: 'ai_engineer',
    turn_id: 1,
  },
  {
    type: 'session_state',
    state: 'agent_speaking',
    mode: 'mock',
    session_id: 'mock_sess_001',
    epoch: 1,
  },
  {
    type: 'transcript',
    turn_id: 1,
    epoch: 1,
    speaker: 'ai_engineer',
    text: 'AI coding tools are advancing far beyond simple autocomplete. We are now seeing autonomous systems construct whole modules and resolve regressions overnight.',
    final: true,
    sentence_idx: 0,
  },
  {
    type: 'claims_update',
    claims: [
      {
        id: 'c1',
        agent_id: 'ai_engineer',
        text: 'AI automation will absorb majority of routine CRUD and boilerplate coding.',
        status: 'open',
        verified: false,
      },
    ],
  },
  {
    type: 'turn_end',
    turn_id: 1,
    epoch: 1,
    status: 'completed',
  },
  // Trace event: Sam bidding to challenge
  {
    type: 'trace_event',
    ts: '12:00:03.450',
    from: 'software_developer',
    to: 'ai_engineer',
    msg_type: 'floor.bid',
    summary: 'challenge c1: dispute maintenance claim (urgency 0.85)',
  },
  // Turn 2: Sam speaks
  {
    type: 'turn_start',
    turn_id: 2,
    epoch: 1,
    agent_id: 'software_developer',
    kind: 'agent',
  },
  {
    type: 'audio_chunk',
    turn_id: 2,
    epoch: 1,
    sentence_idx: 0,
    seq: 1,
    mime: 'audio/wav',
    data_b64: samAudioB64,
  },
  {
    type: 'transcript',
    turn_id: 2,
    epoch: 1,
    speaker: 'software_developer',
    text: 'Generating syntax is the easy part of software engineering.',
    final: false,
    sentence_idx: 0,
  },
  {
    type: 'speaker_active',
    agent_id: 'software_developer',
    turn_id: 2,
  },
  {
    type: 'transcript',
    turn_id: 2,
    epoch: 1,
    speaker: 'software_developer',
    text: 'Generating syntax is the easy part. Software engineering is primarily about requirements clarity, domain modeling, and living with the code you ship for five years.',
    final: true,
    sentence_idx: 0,
  },
  {
    type: 'claims_update',
    claims: [
      {
        id: 'c1',
        agent_id: 'ai_engineer',
        text: 'AI automation will absorb majority of routine CRUD and boilerplate coding.',
        status: 'open',
        verified: false,
      },
      {
        id: 'c2',
        agent_id: 'software_developer',
        text: 'Architecture and long-term maintenance judgment cannot be replaced by statistical generation.',
        status: 'challenged',
        verified: false,
      },
    ],
  },
  {
    type: 'turn_end',
    turn_id: 2,
    epoch: 1,
    status: 'completed',
  },
  {
    type: 'metrics',
    name: 'grant_to_first_audio_ms',
    value: 680,
    available: true,
  },
]

// ============================================================================
// FIXTURE: barge_in.jsonl
// ============================================================================
const bargeInEvents = [
  // Interruption occurs during Sam speaking -> Epoch increments from 1 to 2
  {
    type: 'session_state',
    state: 'user_speaking',
    mode: 'mock',
    session_id: 'mock_sess_001',
    epoch: 2,
  },
  {
    type: 'turn_end',
    turn_id: 2,
    epoch: 1,
    status: 'interrupted',
  },
  {
    type: 'session_state',
    state: 'processing_user',
    mode: 'mock',
    session_id: 'mock_sess_001',
    epoch: 2,
  },
  {
    type: 'transcript',
    turn_id: 3,
    epoch: 2,
    speaker: 'human',
    text: 'Wait, Maya, what specific security vulnerabilities are maintainers seeing from generated PRs?',
    final: true,
    sentence_idx: 0,
  },
  {
    type: 'routing',
    utterance_id: 'u1',
    kind: 'targeted',
    target: 'oss_maintainer',
    question: 'what specific security vulnerabilities are maintainers seeing from generated PRs?',
  },
  {
    type: 'session_state',
    state: 'agent_generating',
    mode: 'mock',
    session_id: 'mock_sess_001',
    epoch: 2,
  },
  // Maya replies as human_reply turn in epoch 2
  {
    type: 'turn_start',
    turn_id: 4,
    epoch: 2,
    agent_id: 'oss_maintainer',
    kind: 'human_reply',
  },
  {
    type: 'audio_chunk',
    turn_id: 4,
    epoch: 2,
    sentence_idx: 0,
    seq: 1,
    mime: 'audio/wav',
    data_b64: mayaAudioB64,
  },
  {
    type: 'speaker_active',
    agent_id: 'oss_maintainer',
    turn_id: 4,
  },
  {
    type: 'session_state',
    state: 'agent_speaking',
    mode: 'mock',
    session_id: 'mock_sess_001',
    epoch: 2,
  },
  {
    type: 'transcript',
    turn_id: 4,
    epoch: 2,
    speaker: 'oss_maintainer',
    text: 'We are seeing subtle hallucinations of non-existent packages that attackers can register, plus edge-case bypasses that look superficially clean.',
    final: true,
    sentence_idx: 0,
  },
  {
    type: 'metrics',
    name: 'interrupt_to_silence_ms',
    value: 118,
    available: true,
  },
  {
    type: 'metrics',
    name: 'user_question_to_first_audio_ms',
    value: 1350,
    available: true,
  },
  {
    type: 'turn_end',
    turn_id: 4,
    epoch: 2,
    status: 'completed',
  },
]

// ============================================================================
// FIXTURE: unknown_target.jsonl
// ============================================================================
const unknownTargetEvents = [
  {
    type: 'session_state',
    state: 'processing_user',
    mode: 'mock',
    session_id: 'mock_sess_001',
    epoch: 2,
  },
  {
    type: 'routing',
    utterance_id: 'u2',
    kind: 'unknown_target',
    target: null,
    question: 'Which expert did you mean? (Alex, Sam, or Maya)',
  },
  {
    type: 'notice',
    code: 'unknown_target',
    level: 'warn',
    text: 'Which expert did you mean? (Alex, Sam, or Maya)',
    recoverable: true,
  },
]

// ============================================================================
// FIXTURE: no_speech.jsonl
// ============================================================================
const noSpeechEvents = [
  {
    type: 'notice',
    code: 'no_speech',
    level: 'warn',
    text: "Didn't catch any speech. Speak clearly or click a panel card to address an expert.",
    recoverable: true,
  },
]

// ============================================================================
// FIXTURE: disconnect.jsonl
// ============================================================================
const disconnectEvents = [
  {
    type: 'session_state',
    state: 'recovery',
    mode: 'mock',
    session_id: 'mock_sess_001',
    epoch: 2,
  },
  {
    type: 'notice',
    code: 'disconnected',
    level: 'warn',
    text: 'Gateway connection dropped. Attempting automatic reconnection…',
    recoverable: true,
  },
]

// ============================================================================
// FIXTURE: end.jsonl
// ============================================================================
const endEvents = [
  {
    type: 'turn_end',
    turn_id: 4,
    epoch: 2,
    status: 'discarded',
  },
  {
    type: 'session_state',
    state: 'ended',
    mode: 'mock',
    session_id: 'mock_sess_001',
    epoch: 3, // Epoch increments on end per contracts section 2
  },
]

// Utility to write jsonl
function writeJsonl(filename, events) {
  const content = events.map((e) => JSON.stringify(e)).join('\n') + '\n'
  fs.writeFileSync(path.join(contractsExamplesDir, filename), content, 'utf8')
  fs.writeFileSync(path.join(devFixturesDir, filename), content, 'utf8')
  console.log(`Wrote ${filename} (${events.length} events)`)
}

writeJsonl('start.jsonl', startEvents)
writeJsonl('normal_turn.jsonl', normalTurnEvents)
writeJsonl('barge_in.jsonl', bargeInEvents)
writeJsonl('unknown_target.jsonl', unknownTargetEvents)
writeJsonl('no_speech.jsonl', noSpeechEvents)
writeJsonl('disconnect.jsonl', disconnectEvents)
writeJsonl('end.jsonl', endEvents)

console.log('All golden fixtures created successfully!')
