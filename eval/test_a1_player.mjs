// Browser-API MOCKS. These test queue lifecycle, not real MP3 decoding/audibility.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const page = process.env.PANEL_PLAYER_TEST ? '../gateway/dev_roundtable.html' : '../gateway/dev_a1.html';
const script = readFileSync(new URL(page, import.meta.url), 'utf8')
  .split('<script>')[1].split('</script>')[0];
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

async function harness({holdDecode = false} = {}) {
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, {textContent: '', disabled: false, value: ''});
    return elements.get(id);
  };
  let socket, releaseDecode;
  const nodes = [];
  class MockSocket {
    static OPEN = 1;
    readyState = 1;
    sent = [];
    constructor() {socket = this;}
    send(raw) {this.sent.push(JSON.parse(raw));}
    emit(event) {this.onmessage({data:JSON.stringify(event)});}
  }
  class MockAudio {
    currentTime = 0;
    destination = {};
    async resume() {}
    async decodeAudioData(bytes) {
      assert.ok(bytes.byteLength > 0);
      if (holdDecode) await new Promise(resolve => {releaseDecode = resolve;});
      return {mockBuffer:true};
    }
    createBufferSource() {
      const node = {started:false, connect() {}, start() {this.started = true;},
        stop() {this.onended?.();}};
      nodes.push(node); return node;
    }
  }
  const context = vm.createContext({document:{getElementById:get}, AudioContext:MockAudio,
    WebSocket:MockSocket, location:{protocol:'http:', host:'localhost:8000'},
    performance:{now:() => 123}, crypto:{randomUUID:() => 'mock-id'},
    atob:s => Buffer.from(s,'base64').toString('binary'),
    setInterval:() => 1, clearInterval() {}});
  vm.runInContext(script, context);
  await get('start').onclick();
  socket.onopen();
  const turn = {turn_id:1,epoch:0};
  function response() {
    socket.emit({type:'turn_start', ...turn});
    socket.emit({type:'transcript', ...turn, speaker:'ai_engineer', text:'Test.', final:false, sentence_idx:0});
    socket.emit({type:'audio_chunk', ...turn, sentence_idx:0, data_b64:'eA=='});
  }
  return {socket, get, nodes, response, turn, release:() => releaseDecode()};
}

test('playback acks follow source start and actual queue completion', async () => {
  const h = await harness(); h.response();
  assert.equal(h.nodes.length, 0);
  assert.equal(h.socket.sent.some(e => e.type === 'playback_started'), false);
  h.socket.emit({type:'turn_end', ...h.turn, status:'completed'});
  await settle();
  assert.equal(h.nodes[0].started, true);
  assert.equal(h.socket.sent.some(e => e.type === 'playback_started'), true);
  assert.equal(h.socket.sent.some(e => e.type === 'playback_stopped'), false);
  h.nodes[0].onended(); await settle();
  assert.equal(h.socket.sent.at(-1).reason, 'finished');
});

test('End during asynchronous decoding cannot start obsolete audio', async () => {
  const h = await harness({holdDecode:true}); h.response();
  h.socket.emit({type:'turn_end', ...h.turn, status:'completed'});
  await settle(); h.get('end').onclick(); h.release(); await settle();
  assert.equal(h.nodes.length, 0);
  assert.equal(h.socket.sent.some(e => e.type === 'playback_started'), false);
  assert.equal(h.socket.sent.at(-1).type, 'end_session');
});

test('higher epoch stops old playback and suppresses its finished acknowledgement', async () => {
  const h = await harness(); h.response();
  h.socket.emit({type:'turn_end', ...h.turn, status:'completed'}); await settle();
  h.socket.emit({type:'session_state', state:'recovery', epoch:1}); await settle();
  assert.equal(h.socket.sent.some(e => e.type === 'playback_stopped' && e.reason === 'finished'), false);
});

test('three sentence responses play in order without overlap', async () => {
  const h = await harness(); h.response();
  for (let idx = 1; idx < 3; idx++) {
    h.socket.emit({type:'transcript', ...h.turn, speaker:'ai_engineer', text:'Next.', final:false, sentence_idx:idx});
    h.socket.emit({type:'audio_chunk', ...h.turn, sentence_idx:idx, data_b64:'eA=='});
  }
  h.socket.emit({type:'turn_end', ...h.turn, status:'completed'});
  await settle();
  for (let idx = 0; idx < 3; idx++) {
    assert.equal(h.nodes.length, idx + 1);
    assert.equal(h.nodes[idx].started, true);
    const starts = h.socket.sent.filter(e => e.type === 'playback_started');
    assert.equal(starts.at(-1).sentence_idx, idx);
    assert.equal(h.socket.sent.some(e => e.type === 'playback_stopped'), false);
    h.nodes[idx].onended(); await settle();
  }
  assert.equal(h.socket.sent.at(-1).reason, 'finished');
});
