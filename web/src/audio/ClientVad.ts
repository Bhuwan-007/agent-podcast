// web/src/audio/ClientVad.ts
// Real-time Client Voice Activity Detection (VAD) and Web Speech Recognizer
// Triggers spoken barge-in and dispatches vad(start/end) and user_utterance

export interface ClientVadCallbacks {
  onSpeechStart: (tClientMs: number) => void
  onSpeechEnd: (tClientMs: number) => void
  onAudioLevel?: (level: number) => void
  onUtterance?: (text: string, isFinal: boolean, targetHint: string | null) => void
}

export interface ClientVadOptions {
  energyThreshold?: number // RMS energy threshold to trigger voice (default 0.028)
  silenceDurationMs?: number // Silence duration before speech end (default 800ms)
  speechMinFrames?: number // Min consecutive active frames to confirm speech (default 3)
}

export class ClientVad {
  private audioCtx: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private analyser: AnalyserNode | null = null
  private callbacks: ClientVadCallbacks
  private options: Required<ClientVadOptions>

  private isRunning = false
  private isSpeaking = false
  private consecutiveSpeechFrames = 0
  private silenceTimer: ReturnType<typeof setTimeout> | null = null
  private animFrameId: number | null = null
  private speechRecognition: any = null

  constructor(callbacks: ClientVadCallbacks, options: ClientVadOptions = {}) {
    this.callbacks = callbacks
    this.options = {
      energyThreshold: options.energyThreshold ?? 0.028,
      silenceDurationMs: options.silenceDurationMs ?? 800,
      speechMinFrames: options.speechMinFrames ?? 3,
    }
  }

  public start(stream: MediaStream): void {
    if (this.isRunning) return
    this.mediaStream = stream
    this.isRunning = true

    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.audioCtx = new AudioCtxClass()

      this.sourceNode = this.audioCtx.createMediaStreamSource(stream)
      this.analyser = this.audioCtx.createAnalyser()
      this.analyser.fftSize = 512
      this.analyser.smoothingTimeConstant = 0.3

      this.sourceNode.connect(this.analyser)

      // Start Web Speech Recognition if available in the browser
      this.initSpeechRecognition()

      // Start energy sampling loop
      this.sampleAudio()
    } catch (err) {
      console.warn('[ClientVad] Could not initialize Web Audio VAD:', err)
    }
  }

  private initSpeechRecognition(): void {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      console.log('[ClientVad] Web Speech API not available; falling back to pure energy VAD')
      return
    }

    try {
      const recognizer = new SpeechRecognition()
      recognizer.continuous = true
      recognizer.interimResults = true
      recognizer.lang = 'en-US'

      recognizer.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i]
          const text = res[0].transcript.trim()
          const isFinal = res.isFinal

          // Detect target hint from spoken words
          const lower = text.toLowerCase()
          let targetHint: string | null = null
          if (lower.includes('maya') || lower.includes('maintainer') || lower.includes('open source')) {
            targetHint = 'oss_maintainer'
          } else if (lower.includes('alex') || lower.includes('ai engineer') || lower.includes('engineer')) {
            targetHint = 'ai_engineer'
          } else if (lower.includes('sam') || lower.includes('developer') || lower.includes('software')) {
            targetHint = 'software_developer'
          }

          if (this.callbacks.onUtterance) {
            this.callbacks.onUtterance(text, isFinal, targetHint)
          }
        }
      }

      recognizer.onerror = (e: any) => {
        // Recognition aborted or no speech is normal during pauses
        if (e.error !== 'no-speech' && e.error !== 'aborted') {
          console.log('[ClientVad] Speech recognition notice:', e.error)
        }
      }

      recognizer.onend = () => {
        // Keep recognizer running while mic is active
        if (this.isRunning) {
          try {
            recognizer.start()
          } catch {
            // Already started
          }
        }
      }

      recognizer.start()
      this.speechRecognition = recognizer
    } catch (err) {
      console.log('[ClientVad] Speech recognition start error:', err)
    }
  }

  private sampleAudio = (): void => {
    if (!this.isRunning || !this.analyser) return

    const buffer = new Float32Array(this.analyser.fftSize)
    this.analyser.getFloatTimeDomainData(buffer)

    // Compute RMS Energy
    let sum = 0
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i]
    }
    const rms = Math.sqrt(sum / buffer.length)

    // Report audio level for UI waveforms (clamped 0 to 1)
    const level = Math.min(1.0, rms * 8)
    if (this.callbacks.onAudioLevel) {
      this.callbacks.onAudioLevel(level)
    }

    const isAboveThreshold = rms >= this.options.energyThreshold

    if (isAboveThreshold) {
      this.consecutiveSpeechFrames++
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer)
        this.silenceTimer = null
      }

      if (!this.isSpeaking && this.consecutiveSpeechFrames >= this.options.speechMinFrames) {
        this.isSpeaking = true
        const tStart = performance.now()
        console.log('[ClientVad] Voice detected (VAD START):', rms.toFixed(4))
        this.callbacks.onSpeechStart(tStart)
      }
    } else {
      this.consecutiveSpeechFrames = 0

      if (this.isSpeaking && !this.silenceTimer) {
        this.silenceTimer = setTimeout(() => {
          this.isSpeaking = false
          this.silenceTimer = null
          const tEnd = performance.now()
          console.log('[ClientVad] Silence detected (VAD END)')
          this.callbacks.onSpeechEnd(tEnd)
        }, this.options.silenceDurationMs)
      }
    }

    this.animFrameId = requestAnimationFrame(this.sampleAudio)
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser
  }

  public stop(): void {
    this.isRunning = false
    this.isSpeaking = false
    this.consecutiveSpeechFrames = 0

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId)
      this.animFrameId = null
    }

    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer)
      this.silenceTimer = null
    }

    if (this.speechRecognition) {
      try {
        this.speechRecognition.stop()
      } catch {
        // Recognizer already stopped
      }
      this.speechRecognition = null
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect()
      this.sourceNode = null
    }

    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close()
      this.audioCtx = null
    }
  }
}
