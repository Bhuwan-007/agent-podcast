// Actual capture class with mocked browser devices; no physical microphone claim.
import fs from 'node:fs';
import ts from '../web/node_modules/typescript/lib/typescript.js';
import test from 'node:test';
import assert from 'node:assert/strict';
const raw=fs.readFileSync(new URL('../web/src/audio/ClientVad.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(raw,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {ClientVad}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
function harness(){
  let clock=100,energy=0,next,stopped=false;const events=[];
  Object.defineProperty(globalThis,'performance',{configurable:true,value:{now:()=>clock}});
  globalThis.requestAnimationFrame=fn=>{next=fn;return 1};globalThis.cancelAnimationFrame=()=>{};
  globalThis.AudioContext=class {state='running';resume(){return Promise.resolve()};close(){return Promise.resolve()};createMediaStreamSource(){return {connect(){}}};createAnalyser(){return {fftSize:1024,getFloatTimeDomainData:data=>data.fill(energy)}}};
  globalThis.MediaRecorder=class {state='inactive';mimeType='audio/webm';start(){this.state='recording'};stop(){this.state='inactive';queueMicrotask(()=>{this.ondataavailable({data:new Blob(['recorded'])});this.onstop()})}};
  const vad=new ClientVad({onSpeechStart:t=>events.push(['start',t]),onSpeechEnd:t=>events.push(['end',t]),onAudio:(blob,t)=>events.push(['audio',blob.size,t])});
  vad.start({getTracks:()=>[{stop(){stopped=true}}]});
  return {vad,events,step(t,e){clock=t;energy=e;next()},stopped:()=>stopped};
}
test('speech capture submits one recording after VAD ends and releases tracks',async()=>{
  const h=harness();h.step(100,.1);h.step(400,.1);h.step(1100,0);await Promise.resolve();
  assert.deepEqual(h.events.map(e=>e[0]),['start','end','audio']);
  assert.equal(h.events[0][1],100);assert.ok(h.events[2][1]>0);assert.ok(h.stopped());
});
test('End during speech discards pending recorder callback',async()=>{
  const h=harness();h.step(100,.1);h.step(400,.1);h.vad.stop();await Promise.resolve();
  assert.deepEqual(h.events.map(e=>e[0]),['start']);assert.ok(h.stopped());
});
test('mic disabled before speech sends no recording',async()=>{
  const h=harness();h.vad.stop();await Promise.resolve();assert.deepEqual(h.events,[]);assert.ok(h.stopped());
});
