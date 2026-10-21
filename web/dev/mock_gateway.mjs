// web/dev/mock_gateway.mjs
// Node.js mock gateway listening on ws://localhost:8000/ws
// Replays contracts/examples/*.jsonl golden event fixtures

import { WebSocketServer } from 'ws'
import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.resolve(__dirname, 'fixtures')

const PORT = 8000
const WS_PATH = '/ws'

function loadFixture(filename) {
  const filePath = path.join(fixturesDir, filename)
  if (!fs.existsSync(filePath)) {
    console.error(`Fixture not found: ${filePath}`)
    return []
  }
  const lines = fs.readFileSync(filePath, 'utf8').trim().split('\n')
  return lines.filter(Boolean).map((l) => JSON.parse(l))
}

const fixtures = {
  start: loadFixture('start.jsonl'),
  normal_turn: loadFixture('normal_turn.jsonl'),
  barge_in: loadFixture('barge_in.jsonl'),
  unknown_target: loadFixture('unknown_target.jsonl'),
  no_speech: loadFixture('no_speech.jsonl'),
  disconnect: loadFixture('disconnect.jsonl'),
  end: loadFixture('end.jsonl'),
}

// HTTP server for health check and WebSocket upgrade
const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', service: 'mock_gateway', mode: 'mock' }))
    return
  }

  res.writeHead(404)
  res.end('Not Found')
})

const wss = new WebSocketServer({ server, path: WS_PATH })

console.log(`Mock Gateway starting on port ${PORT}...`)

wss.on('connection', (ws) => {
  console.log('[MockGateway] Client connected to WebSocket')
  let currentEpoch = 1
  let activeTimers = []

  function clearTimers() {
    activeTimers.forEach((t) => clearTimeout(t))
    activeTimers = []
  }

  function sendEvent(event) {
    if (ws.readyState === ws.OPEN) {
      // Ensure mode: "mock" on any session_state
      if (event.type === 'session_state') {
        event.mode = 'mock'
      }
      ws.send(JSON.stringify(event))
    }
  }

  function replayEvents(eventList, delayBetweenMs = 400) {
    eventList.forEach((ev, idx) => {
      const timer = setTimeout(() => {
        sendEvent(ev)
      }, idx * delayBetweenMs)
      activeTimers.push(timer)
    })
  }

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString())
      console.log(`[MockGateway] Received client event: ${data.type}`, data)

      switch (data.type) {
        case 'start_session': {
          clearTimers()
          currentEpoch = 1
          console.log('[MockGateway] Starting session on topic:', data.topic_id)
          // Replay start fixture immediately
          replayEvents(fixtures.start, 200)

          // After start, replay normal debate turn
          const startDelay = fixtures.start.length * 200 + 400
          const debateTimer = setTimeout(() => {
            replayEvents(fixtures.normal_turn, 450)
          }, startDelay)
          activeTimers.push(debateTimer)
          break
        }

        case 'barge_in': {
          console.log('[MockGateway] Barge-in triggered! Invalidating current turn audio...')
          clearTimers()
          currentEpoch++
          // Replay barge_in fixture with epoch update
          const updatedBargeIn = fixtures.barge_in.map((ev) => {
            const copy = { ...ev }
            if (copy.epoch !== undefined && copy.epoch > 1) {
              copy.epoch = currentEpoch
            }
            return copy
          })
          replayEvents(updatedBargeIn, 350)
          break
        }

        case 'address_agent': {
          console.log(`[MockGateway] Client addressed agent: ${data.agent_id}`)
          sendEvent({
            type: 'routing',
            utterance_id: 'u_dir',
            kind: data.agent_id ? 'targeted' : 'general',
            target: data.agent_id,
            question: null,
          })
          break
        }

        case 'end_session': {
          console.log('[MockGateway] Ending session...')
          clearTimers()
          currentEpoch++
          const endEvs = fixtures.end.map((e) => ({
            ...e,
            epoch: currentEpoch,
          }))
          replayEvents(endEvs, 150)
          break
        }

        case 'resume_session': {
          console.log('[MockGateway] Resuming session:', data.session_id)
          sendEvent({
            type: 'session_state',
            state: 'agent_speaking',
            mode: 'mock',
            session_id: data.session_id,
            epoch: currentEpoch,
          })
          break
        }

        case 'trigger_unknown_target': {
          replayEvents(fixtures.unknown_target, 200)
          break
        }

        case 'trigger_no_speech': {
          replayEvents(fixtures.no_speech, 100)
          break
        }

        case 'trigger_disconnect': {
          replayEvents(fixtures.disconnect, 200)
          break
        }

        default:
          console.log(`[MockGateway] Client ack/info: ${data.type}`)
          break
      }
    } catch (err) {
      console.error('[MockGateway] Error handling message:', err)
    }
  })

  ws.on('close', () => {
    console.log('[MockGateway] Client disconnected')
    clearTimers()
  })
})

server.listen(PORT, () => {
  console.log(`✓ Mock Gateway listening on http://localhost:${PORT} and ws://localhost:${PORT}${WS_PATH}`)
})
