// Pairing diagnostic: actual B5 TypeScript player, explicitly mocked Web Audio APIs.
// No provider calls, real decoding, audible playback or acoustic timing claim.
import fs from 'node:fs';
import ts from '../web/node_modules/typescript/lib/typescript.js';

const pending = [], events = [], sources = [];
class MockContext {
  state = 'running'; currentTime = 0; destination = {};
  createAnalyser() { return { connect() {} }; }
  decodeAudioData() { return new Promise(resolve => pending.push(resolve)); }
  createBufferSource() {
    const source = { connect() {}, disconnect() {}, start() {}, stop() {} };
    sources.push(source);
    return source;
  }
  close() { this.state = 'closed'; }
}
globalThis.window = { AudioContext: MockContext };
const source = fs.readFileSync(new URL('../web/src/audio/AudioPlayer.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022,
} }).outputText;
const { AudioPlayer } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const player = new AudioPlayer({
  onPlaybackStarted: (...args) => events.push(['started', ...args]),
  onPlaybackProgress() {},
  onPlaybackStopped: (...args) => events.push(['stopped', ...args]),
});
const chunk = sentenceIdx => ({ turnId: 1, epoch: 0, sentenceIdx,
  seq: sentenceIdx + 1, mime: 'audio/mpeg', dataB64: 'AQID' });
player.enqueueChunk(chunk(0));
player.enqueueChunk(chunk(1));
player.endTurn(1);
const premature = events.some(e => e[0] === 'stopped' && e[3] === 'finished');
for (const resolve of pending) resolve({ duration: 1 });
await new Promise(resolve => setImmediate(resolve));
// Complete each mock source, allowing a correctly queued second sentence to start.
for (const audioSource of sources) audioSource.onended?.();
const starts = events.filter(e => e[0] === 'started').map(e => e[3]);
player.stop('end');
const report = {
  mode: 'mocked-browser-APIs / actual B5 AudioPlayer source',
  premature_finished_before_decode: premature,
  expected_sentence_starts: [0, 1], observed_sentence_starts: starts,
  decode_requests: pending.length,
};
fs.writeFileSync(new URL('../docs/b5_player_pairing_diagnostic.json', import.meta.url),
  JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
process.exitCode = premature || JSON.stringify(starts) !== '[0,1]' ? 1 : 0;
