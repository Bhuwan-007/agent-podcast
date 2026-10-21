// Exercise the teammate's unmodified mock server over a real local socket.
// Use an ephemeral test port so the real A1 gateway can remain on 8000.
import http from 'node:http';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';

const require = createRequire(new URL('../web/package.json', import.meta.url));
const { WebSocket } = require('ws');
const originalListen = http.Server.prototype.listen;
let server, ready, socket;
const events = [];
try {
  http.Server.prototype.listen = function (port, ...args) {
    server = this;
    ready = once(this, 'listening');
    return originalListen.call(this, 0, ...args);
  };
  await import('../web/dev/mock_gateway.mjs');
  http.Server.prototype.listen = originalListen;
  await ready;
  const port = server.address().port;
  const health = await fetch(`http://127.0.0.1:${port}/health`).then(r => r.json());
  assert.equal(health.mode, 'mock');
  socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  socket.on('message', raw => events.push(JSON.parse(raw)));
  await once(socket, 'open');
  async function waitFor(predicate) {
    const deadline = Date.now() + 10000;
    while (!events.some(predicate)) {
      if (Date.now() > deadline) throw new Error('Timed out waiting for mock event');
      await delay(25);
    }
    return events.find(predicate);
  }
  socket.send(JSON.stringify({type:'start_session', topic_id:'topic_1', session_id:null}));
  await waitFor(e => e.type === 'topic_config');
  const audio = await waitFor(e => e.type === 'audio_chunk');
  assert.equal(audio.mime, 'audio/wav');
  const bytes = Buffer.from(audio.data_b64, 'base64');
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.ok(events.filter(e => e.type === 'session_state').every(e => e.mode === 'mock'));
  socket.send(JSON.stringify({type:'end_session'}));
  const ended = await waitFor(e => e.type === 'session_state' && e.state === 'ended');
  const endIndex = events.indexOf(ended);
  await delay(700);
  assert.ok(!events.slice(endIndex + 1).some(e => e.type === 'audio_chunk'));
  console.log(JSON.stringify({health:'passed', start_fixture:'passed', wav_fixture:'passed',
    mock_mode:'passed', pending_audio_cancelled_on_end:'passed',
    scope:'Mock server only; no AI generation, speech playback or spoken interruption proved.'}, null, 2));
} finally {
  http.Server.prototype.listen = originalListen;
  if (socket && socket.readyState !== WebSocket.CLOSED) {
    socket.close(); await once(socket, 'close');
  }
  if (server) await new Promise(resolve => server.close(resolve));
}
