// Actual TypeScript player, MOCKED Web Audio. No acoustic/real decoding claim.
import fs from 'node:fs';
import ts from '../web/node_modules/typescript/lib/typescript.js';
import assert from 'node:assert/strict';
import test from 'node:test';
const raw = fs.readFileSync(new URL('../web/src/audio/AudioPlayer.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(raw, {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {AudioPlayer} = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const settle = async () => {for(let i=0;i<10;i++) await Promise.resolve();};
function harness() {
  const pending=[],sources=[],events=[];
  class Context {
    state='running';currentTime=0;destination={};
    createAnalyser(){return {connect(){}};}
    decodeAudioData(){return new Promise(resolve=>pending.push(resolve));}
    createBufferSource(){const source={started:false,connect(){},disconnect(){},start(){this.started=true;},stop(){this.onended?.();}};sources.push(source);return source;}
    close(){this.state='closed';}
  }
  globalThis.window={AudioContext:Context};
  const player=new AudioPlayer({onPlaybackStarted:(...args)=>events.push(['start',...args]),
    onPlaybackProgress(){},onPlaybackStopped:(...args)=>events.push(['stop',...args])});
  const chunk=(idx,turnId=1,epoch=0)=>player.enqueueChunk({turnId,epoch,sentenceIdx:idx,seq:idx+1,mime:'audio/mpeg',dataB64:'AQID'});
  const resolve=async idx=>{pending[idx]({duration:1});await settle();};
  return {player,pending,sources,events,chunk,resolve};
}

test('out-of-order decoding preserves sentence order and never finishes before playback',async()=>{
  const h=harness();h.chunk(0);h.chunk(1);h.player.endTurn(1);
  assert.equal(h.events.length,0);await h.resolve(1);assert.equal(h.sources.length,0);
  await h.resolve(0);assert.deepEqual(h.events.filter(e=>e[0]==='start').map(e=>e[3]),[0]);
  h.sources[0].onended();assert.deepEqual(h.events.filter(e=>e[0]==='start').map(e=>e[3]),[0,1]);
  assert.equal(h.events.some(e=>e[3]==='finished'),false);
  h.sources[1].onended();assert.equal(h.events.filter(e=>e[3]==='finished').length,1);h.player.close();
});

test('End during decode invalidates pending sources and late chunks of that turn',async()=>{
  const h=harness();h.chunk(0);h.player.endTurn(1);h.player.stop('end');
  await h.resolve(0);h.chunk(0);h.player.endTurn(1);await settle();
  assert.equal(h.sources.length,0);assert.equal(h.pending.length,1);
  assert.equal(h.events.some(e=>e[3]==='finished'),false);h.player.close();
});

test('next turn starts sentence zero with clean buffers in the same epoch',async()=>{
  const h=harness();h.chunk(0);h.player.endTurn(1);await h.resolve(0);h.sources[0].onended();
  h.chunk(0,2);h.player.endTurn(2);await h.resolve(1);h.sources[1].onended();
  assert.deepEqual(h.events.filter(e=>e[0]==='start').map(e=>[e[1],e[3]]),[[1,0],[2,0]]);h.player.close();
});

test('epoch advance cancels pending decode and rejects old epoch chunks',async()=>{
  const h=harness();h.chunk(0);h.player.flushSentence(0);h.player.setEpoch(1);await h.resolve(0);h.chunk(1,1,0);
  assert.equal(h.sources.length,0);assert.equal(h.pending.length,1);
  h.chunk(0,2,1);h.player.endTurn(2);await h.resolve(1);h.sources[0].onended();h.player.close();
});

test('generation completion after playback drained still reports finished once',async()=>{
  const h=harness();h.chunk(0);h.player.flushSentence(0);await h.resolve(0);h.sources[0].onended();
  assert.equal(h.events.some(e=>e[3]==='finished'),false);
  h.player.endTurn(1);h.player.endTurn(1);assert.equal(h.events.filter(e=>e[3]==='finished').length,1);h.player.close();
});

test('a second foreground turn cannot overlap the active turn',async()=>{
  const h=harness();h.chunk(0);h.player.endTurn(1);await h.resolve(0);h.chunk(0,2);
  assert.equal(h.sources.length,1);assert.ok(h.events.some(e=>e[1]===2&&e[3]==='error'));h.player.close();
});
