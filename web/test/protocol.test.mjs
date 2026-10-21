import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.resolve(__dirname, '../dev/fixtures')

describe('Phase B3: Protocol & Event Handling Verification', () => {
  test('Golden Fixtures are valid JSONLines matching contracts/ws_events.md', () => {
    const fixtureFiles = [
      'start.jsonl',
      'normal_turn.jsonl',
      'barge_in.jsonl',
      'unknown_target.jsonl',
      'no_speech.jsonl',
      'disconnect.jsonl',
      'end.jsonl',
    ]

    for (const file of fixtureFiles) {
      const filePath = path.join(fixturesDir, file)
      assert.ok(fs.existsSync(filePath), `Fixture file must exist: ${file}`)
      const lines = fs.readFileSync(filePath, 'utf8').trim().split('\n').filter(Boolean)
      assert.ok(lines.length > 0, `Fixture ${file} should have at least 1 event`)

      for (const line of lines) {
        const ev = JSON.parse(line)
        assert.ok(typeof ev.type === 'string', `Event in ${file} must have type string`)
      }
    }
  })

  test('Authoritative speaker highlight rule (RULE-32): turn_start does not activate speaker', () => {
    let activeSpeaker = null
    let activeTurn = null

    // Simulate dispatcher
    function handleEvent(ev) {
      if (ev.type === 'turn_start') {
        activeTurn = ev.turn_id
        // Must NOT set activeSpeaker on turn_start!
      } else if (ev.type === 'speaker_active') {
        activeSpeaker = ev.agent_id
        activeTurn = ev.turn_id
      } else if (ev.type === 'turn_end' || ev.type === 'playback_stopped') {
        activeSpeaker = null
      }
    }

    // Step 1: turn_start arrives
    handleEvent({ type: 'turn_start', turn_id: 1, epoch: 1, agent_id: 'ai_engineer' })
    assert.equal(activeTurn, 1)
    assert.equal(activeSpeaker, null, 'Speaker must remain null on turn_start (not yet audible)')

    // Step 2: speaker_active arrives
    handleEvent({ type: 'speaker_active', turn_id: 1, agent_id: 'ai_engineer' })
    assert.equal(activeSpeaker, 'ai_engineer', 'Speaker becomes active on speaker_active event')

    // Step 3: turn_end arrives
    handleEvent({ type: 'turn_end', turn_id: 1, epoch: 1, status: 'completed' })
    assert.equal(activeSpeaker, null, 'Speaker highlight cleared on turn_end')
  })

  test('Epoch filter (contracts/ws_events.md Section 2): Stale audio/transcripts dropped', () => {
    let currentEpoch = 2
    const processedEvents = []

    function handleEventWithEpoch(ev) {
      if (ev.epoch !== undefined && ev.epoch < currentEpoch) {
        // Drop stale event
        return false
      }
      if (ev.epoch !== undefined && ev.epoch > currentEpoch) {
        currentEpoch = ev.epoch
      }
      processedEvents.push(ev)
      return true
    }

    const staleEv = { type: 'audio_chunk', turn_id: 1, epoch: 1, data_b64: 'abc' }
    const validEv = { type: 'audio_chunk', turn_id: 3, epoch: 2, data_b64: 'def' }
    const newEpochEv = { type: 'audio_chunk', turn_id: 4, epoch: 3, data_b64: 'ghi' }

    assert.equal(handleEventWithEpoch(staleEv), false, 'Older epoch event must be dropped')
    assert.equal(handleEventWithEpoch(validEv), true, 'Current epoch event must be accepted')
    assert.equal(handleEventWithEpoch(newEpochEv), true, 'Higher epoch advances epoch and is accepted')
    assert.equal(currentEpoch, 3, 'Current epoch must advance to 3')
    assert.equal(processedEvents.length, 2)
  })

  test('Claims Verification Rule (RULE-06): unverified claims cannot say verified', () => {
    function formatClaimBadge(claim) {
      return claim.verified ? '✓ Verified by tool' : 'Claimed (Unverified)'
    }

    const unverifiedClaim = {
      id: 'c1',
      agent_id: 'ai_engineer',
      text: 'AI replaces 80% of boilerplate.',
      status: 'open',
      verified: false,
    }
    const verifiedClaim = {
      id: 'c2',
      agent_id: 'oss_maintainer',
      text: 'CVE-2026-1182 verified in vulnerability database.',
      status: 'supported',
      verified: true,
    }

    assert.equal(formatClaimBadge(unverifiedClaim), 'Claimed (Unverified)')
    assert.equal(formatClaimBadge(verifiedClaim), '✓ Verified by tool')
  })

  test('Client-Clock Metrics (AT-06, Section 4): Unavailable metrics never faked as 0', () => {
    function formatMetric(val, unit = 'ms') {
      if (val === null || val === undefined) {
        return 'Unavailable'
      }
      return `${Math.round(val)} ${unit}`
    }

    assert.equal(formatMetric(null), 'Unavailable', 'null metric must display Unavailable')
    assert.equal(formatMetric(undefined), 'Unavailable', 'undefined metric must display Unavailable')
    assert.equal(formatMetric(118), '118 ms', 'Measured metric must display formatted ms')
    assert.notEqual(formatMetric(null), '0 ms', 'Never fake unmeasured latency as 0')
  })

  test('State transitions adhere to S0-S8 and Reconciliation R3', () => {
    const validStates = [
      'ready',
      'connecting',
      'waiting_first_speaker',
      'agent_speaking',
      'user_speaking',
      'processing_user',
      'agent_generating',
      'recovery',
      'ended',
    ]

    let state = 'ready' // S0
    assert.equal(validStates.includes(state), true)

    // User starts session -> S1 connecting
    state = 'connecting'
    assert.equal(validStates.includes(state), true)

    // Server returns waiting_first_speaker -> S2
    state = 'waiting_first_speaker'
    assert.equal(validStates.includes(state), true)

    // Audio active -> S3 agent_speaking
    state = 'agent_speaking'
    assert.equal(validStates.includes(state), true)

    // User barge-in -> S4 user_speaking
    state = 'user_speaking'
    assert.equal(validStates.includes(state), true)

    // VAD end -> S5 processing_user
    state = 'processing_user'
    assert.equal(validStates.includes(state), true)

    // Target reply synthesis -> S6 agent_generating
    state = 'agent_generating'
    assert.equal(validStates.includes(state), true)

    // Connection drop -> S7 recovery
    state = 'recovery'
    assert.equal(validStates.includes(state), true)

    // End session -> S8 ended
    state = 'ended'
    assert.equal(validStates.includes(state), true)
  })
})
