import { useEffect, useState } from 'react'
import { CLIENT_CONFIG } from '../config/clientConfig'

const base = CLIENT_CONFIG.gatewayWsUrl.replace(/^ws/, 'http').replace(/\/ws\/?$/, '')
async function post(path: string, body = {}) {
  const response = await fetch(base + path, {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Roundtable-Client': '1'}, body: JSON.stringify(body)})
  if (!response.ok) throw Error(`Gateway request failed (${response.status}). Check the notice and retry.`)
  return response.json()
}
interface Props {
  sessionId: string | null
  state: string
  onStart: (setup: string) => void
  onUnlock: () => void
  onStopAudio: () => void
}
export function EpisodeControls({sessionId, state, onStart, onUnlock, onStopAudio}: Props) {
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('Run preflight to check real providers. Use headphones for microphone questions.')
  const [paused, setPaused] = useState(false)
  const [concluded, setConcluded] = useState(false)
  const [duration, setDuration] = useState('3')
  const running = !!sessionId && state !== 'ended' && state !== 'ready'
  useEffect(() => {
    if (!sessionId) return
    let active = true
    const refresh = async () => {
      try {
        const response = await fetch(base + '/api/episodes/' + sessionId)
        if (response.ok && active) {
          const report = await response.json()
          if (!active) return
          setPaused(report.paused); setConcluded(report.concluded)
        }
      } catch { /* Keep the last confirmed state during a network interruption. */ }
    }
    void refresh(); const timer = setInterval(refresh, 1000)
    return () => {active = false; clearInterval(timer)}
  }, [sessionId])
  async function perform(action: () => Promise<void>) {
    setBusy(true)
    try {await action()} catch (error) {setMessage(error instanceof Error ? error.message : 'Request failed')}
    finally {setBusy(false)}
  }
  return <section aria-label="Live episode controls" style={{padding: '10px 20px', background: '#201b24', color: '#fff', position: 'relative', zIndex: 20}}>
    <div style={{display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center'}}>
      <button disabled={busy || running} onClick={() => {
        const context = new AudioContext(); void context.resume()
        onUnlock()
        void perform(async () => {
          try {
            const result = await post('/api/preflight'); setReady(result.ready)
            setMessage(result.ready ? 'Real providers ready. Start an episode when you hear the sample.' : 'Preflight failed. Check provider configuration/quota; see the backend check page for details.')
            if (result.sample_audio_b64) {
              const bytes = Uint8Array.from(atob(result.sample_audio_b64), c => c.charCodeAt(0))
              const buffer = await context.decodeAudioData(bytes.buffer)
              const source = context.createBufferSource(); source.buffer = buffer; source.connect(context.destination)
              source.onended = () => {void context.close()}; source.start()
            } else await context.close()
          } catch (error) {setReady(false); await context.close(); throw error}
        })
      }}>Run real preflight</button>
      <label>Length <select value={duration} disabled={running} onChange={e => setDuration(e.target.value)}>
        <option value="1">1 minute</option><option value="3">3 minutes</option><option value="5">5 minutes</option>
      </select></label>
      <button disabled={!ready || busy || running} onClick={() => {
        onUnlock()
        void perform(async () => {
          const setup = await post('/api/episodes/prepare', {duration_minutes: Number(duration)})
          setPaused(false); setConcluded(false); onStart(setup.setup_id)
          setMessage('Live episode started. Click a chair to address an expert, or use the question bar.')
        })
      }}>Start live episode</button>
      <button disabled={!running || busy || concluded} onClick={() => void perform(async () => {
        if (!paused) onStopAudio(); else onUnlock()
        const report = await post('/api/episodes/' + sessionId + '/control', {action: paused ? 'resume' : 'pause'})
        setPaused(report.paused)
      })}>{paused ? 'Resume' : 'Pause'}</button>
      <button disabled={!running || busy || concluded} onClick={() => void perform(async () => {
        onStopAudio(); await post('/api/episodes/' + sessionId + '/control', {action: 'finish'})
      })}>Finish with takeaways</button>
      <button disabled={!sessionId || busy} onClick={() => void perform(async () => {
        const response = await fetch(base + '/api/episodes/' + sessionId + '/export')
        if (!response.ok) throw Error('Transcript expired or unavailable. Export before leaving the episode.')
        const url = URL.createObjectURL(new Blob([JSON.stringify(await response.json(), null, 2)], {type: 'application/json'}))
        const link = document.createElement('a'); link.href = url; link.download = 'roundtable-transcript.json'; link.click(); URL.revokeObjectURL(url)
      })}>Download transcript</button>
      <a href={base + '/dev/roundtable'} target="_blank" rel="noopener">Source review / advanced controls</a>
    </div>
    <p role="status" style={{fontSize: 13, margin: '8px 0 0'}}>{concluded ? 'Episode concluded. Download your delivered transcript.' : message}</p>
  </section>
}
