// One-shot capture; real transcription is performed by the gateway.
export interface ClientVadCallbacks {
  onSpeechStart: (time: number) => void
  onSpeechEnd: (time: number) => void
  onAudioLevel?: (level: number) => void
  onAudio?: (blob: Blob, endedAt: number) => void
}
export class ClientVad {
  private context: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private recorder: MediaRecorder | null = null
  private stream: MediaStream | null = null
  private frame = 0
  private timer: ReturnType<typeof setTimeout> | null = null
  private active = false
  private detected = false
  private firstVoice = 0
  private lastVoice = 0
  constructor(private callbacks: ClientVadCallbacks) {}
  start(stream: MediaStream) {
    this.stream = stream
    this.context = new AudioContext()
    void this.context.resume()
    const source = this.context.createMediaStreamSource(stream)
    this.analyser = this.context.createAnalyser()
    this.analyser.fftSize = 1024
    source.connect(this.analyser)
    const chunks: Blob[] = []
    const recorder = new MediaRecorder(stream)
    this.recorder = recorder
    recorder.ondataavailable = event => {if (event.data.size) chunks.push(event.data)}
    recorder.onstop = () => {if (this.detected) this.callbacks.onAudio?.(new Blob(chunks, {type: recorder.mimeType}), this.lastVoice)}
    this.active = true
    recorder.start()
    const data = new Float32Array(this.analyser.fftSize)
    const sample = () => {
      if (!this.active || !this.analyser) return
      this.analyser.getFloatTimeDomainData(data)
      const rms = Math.sqrt(data.reduce((sum, value) => sum + value * value, 0) / data.length)
      const now = performance.now()
      this.callbacks.onAudioLevel?.(Math.min(1, rms * 8))
      if (rms > .025) {
        this.firstVoice ||= now; this.lastVoice = now
        if (!this.detected && now - this.firstVoice >= 250) {
          this.detected = true; this.callbacks.onSpeechStart(this.firstVoice)
        }
      } else if (!this.detected) this.firstVoice = 0
      else if (now - this.lastVoice >= 600) {this.finish(); return}
      this.frame = requestAnimationFrame(sample)
    }
    sample(); this.timer = setTimeout(() => this.finish(), 25000)
  }
  private finish() {
    this.cleanup()
    if (this.detected) this.callbacks.onSpeechEnd(this.lastVoice)
    else this.callbacks.onAudio?.(new Blob(), performance.now())
  }
  private cleanup() {
    this.active = false; cancelAnimationFrame(this.frame)
    if (this.timer) clearTimeout(this.timer)
    if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop()
    this.stream?.getTracks().forEach(track => track.stop())
    if (this.context && this.context.state !== 'closed') void this.context.close()
  }
  stop() {this.detected = false; this.cleanup()}
  getAnalyser() {return this.analyser}
}
