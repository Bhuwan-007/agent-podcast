// web/src/audio/AudioPlayer.ts
// Real Web Audio API player for streaming MP3 and WAV chunks in sentence order
// Adheres strictly to contracts/ws_events.md playback events and epoch invalidation

export interface PlaybackCallbacks {
  onPlaybackStarted: (turnId: number, epoch: number, sentenceIdx: number, tClientMs: number) => void
  onPlaybackProgress: (turnId: number, epoch: number, sentenceIdx: number, playedMs: number) => void
  onPlaybackStopped: (turnId: number, epoch: number, reason: 'finished' | 'barge_in' | 'end' | 'error', tClientMs: number) => void
  onAnalyserNode?: (analyser: AnalyserNode) => void
}

interface QueuedChunk {
  turnId: number
  epoch: number
  sentenceIdx: number
  seq: number
  mime: string
  dataB64: string
}

export class AudioPlayer {
  private audioCtx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private callbacks: PlaybackCallbacks
  private queue: QueuedChunk[] = []
  private isPlaying = false
  private currentSource: AudioBufferSourceNode | null = null
  private currentChunk: QueuedChunk | null = null
  private currentEpoch = 1
  private progressInterval: ReturnType<typeof setInterval> | null = null
  private chunkStartTime = 0

  constructor(callbacks: PlaybackCallbacks) {
    this.callbacks = callbacks
  }

  private initContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.audioCtx = new AudioCtxClass()

      this.analyser = this.audioCtx.createAnalyser()
      this.analyser.fftSize = 256
      this.analyser.smoothingTimeConstant = 0.8
      this.analyser.connect(this.audioCtx.destination)

      if (this.callbacks.onAnalyserNode && this.analyser) {
        this.callbacks.onAnalyserNode(this.analyser)
      }
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume()
    }
    return this.audioCtx
  }

  public setEpoch(epoch: number): void {
    if (epoch > this.currentEpoch) {
      this.currentEpoch = epoch
      this.stop('barge_in')
    }
  }

  public enqueueChunk(chunk: QueuedChunk): void {
    // Drop older epochs (contracts/ws_events.md Section 2)
    if (chunk.epoch < this.currentEpoch) {
      console.log(`[AudioPlayer] Dropping chunk from stale epoch ${chunk.epoch} < current ${this.currentEpoch}`)
      return
    }

    if (chunk.epoch > this.currentEpoch) {
      this.setEpoch(chunk.epoch)
    }

    // Insert chunk into queue sorted by sentence_idx, then seq
    this.queue.push(chunk)
    this.queue.sort((a, b) => {
      if (a.sentenceIdx !== b.sentenceIdx) {
        return a.sentenceIdx - b.sentenceIdx
      }
      return a.seq - b.seq
    })

    if (!this.isPlaying) {
      this.playNext()
    }
  }

  private async playNext(): Promise<void> {
    if (this.queue.length === 0) {
      this.isPlaying = false
      this.currentChunk = null
      return
    }

    const chunk = this.queue.shift()!
    if (chunk.epoch < this.currentEpoch) {
      this.playNext()
      return
    }

    this.isPlaying = true
    this.currentChunk = chunk

    try {
      const ctx = this.initContext()

      // Decode base64 to binary ArrayBuffer
      const binaryStr = atob(chunk.dataB64)
      const bytes = new Uint8Array(binaryStr.length)
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i)
      }

      // decodeAudioData consumes the buffer
      const audioBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0))

      // Check if epoch changed during decode
      if (chunk.epoch < this.currentEpoch) {
        this.playNext()
        return
      }

      const source = ctx.createBufferSource()
      source.buffer = audioBuffer

      if (this.analyser) {
        source.connect(this.analyser)
      } else {
        source.connect(ctx.destination)
      }

      this.currentSource = source
      this.chunkStartTime = ctx.currentTime

      const tStartClient = performance.now()
      this.callbacks.onPlaybackStarted(
        chunk.turnId,
        chunk.epoch,
        chunk.sentenceIdx,
        tStartClient
      )

      // Start progress reports every 200ms
      if (this.progressInterval) clearInterval(this.progressInterval)
      this.progressInterval = setInterval(() => {
        if (!this.isPlaying || !this.currentChunk) return
        const elapsedMs = (ctx.currentTime - this.chunkStartTime) * 1000
        this.callbacks.onPlaybackProgress(
          chunk.turnId,
          chunk.epoch,
          chunk.sentenceIdx,
          Math.min(Math.round(elapsedMs), Math.round(audioBuffer.duration * 1000))
        )
      }, 200)

      source.onended = () => {
        if (this.progressInterval) {
          clearInterval(this.progressInterval)
          this.progressInterval = null
        }
        if (this.currentSource === source) {
          this.currentSource = null
          const tStopClient = performance.now()
          this.callbacks.onPlaybackStopped(
            chunk.turnId,
            chunk.epoch,
            'finished',
            tStopClient
          )
          this.playNext()
        }
      }

      source.start(0)
    } catch (err) {
      console.error('[AudioPlayer] Error decoding/playing audio chunk:', err)
      this.callbacks.onPlaybackStopped(
        chunk.turnId,
        chunk.epoch,
        'error',
        performance.now()
      )
      this.playNext()
    }
  }

  public stop(reason: 'finished' | 'barge_in' | 'end' | 'error' = 'barge_in'): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval)
      this.progressInterval = null
    }

    this.queue = []

    if (this.currentSource) {
      try {
        this.currentSource.stop()
        this.currentSource.disconnect()
      } catch {
        // Source may already be stopped
      }
      this.currentSource = null
    }

    if (this.currentChunk) {
      const chunk = this.currentChunk
      this.currentChunk = null
      this.callbacks.onPlaybackStopped(
        chunk.turnId,
        chunk.epoch,
        reason,
        performance.now()
      )
    }

    this.isPlaying = false
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser
  }

  public close(): void {
    this.stop('end')
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close()
      this.audioCtx = null
    }
  }
}
