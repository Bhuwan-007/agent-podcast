// web/src/audio/AudioPlayer.ts
// Real Web Audio API player for streaming MP3 and WAV chunks in sentence order
// Adheres strictly to contracts/ws_events.md playback events, A1 streaming, and epoch invalidation

export interface PlaybackCallbacks {
  onPlaybackStarted: (turnId: number, epoch: number, sentenceIdx: number, tClientMs: number) => void
  onPlaybackProgress: (turnId: number, epoch: number, sentenceIdx: number, playedMs: number) => void
  onPlaybackStopped: (turnId: number, epoch: number, reason: 'finished' | 'barge_in' | 'end' | 'error', tClientMs: number) => void
  onAnalyserNode?: (analyser: AnalyserNode) => void
}

export interface QueuedChunk {
  turnId: number
  epoch: number
  sentenceIdx: number
  seq: number
  mime: string
  dataB64: string
}

interface AssembledSentence {
  turnId: number
  epoch: number
  sentenceIdx: number
  bytes: Uint8Array
}

interface PlayableSentence {
  turnId: number
  epoch: number
  sentenceIdx: number
  buffer: AudioBuffer
}

export class AudioPlayer {
  private audioCtx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private callbacks: PlaybackCallbacks

  // Epoch state
  private currentEpoch = 0

  // Sentence accumulation buffer: Map of sentenceIdx -> pieces
  private sentenceBuffers = new Map<number, { turnId: number; epoch: number; seqMap: Map<number, Uint8Array> }>()
  private flushedSentences = new Set<number>()
  private currentActiveTurnId: number | null = null
  private currentTurnEpoch = 0
  private isGenerationCompleted = false

  // Playback queues and lifecycle
  private playQueue: PlayableSentence[] = []
  private isPlaying = false
  private currentSource: AudioBufferSourceNode | null = null
  private activePlayingSentence: PlayableSentence | null = null
  private progressInterval: ReturnType<typeof setInterval> | null = null
  private chunkStartTime = 0

  // Token to cancel in-flight async decoding
  private playbackToken = 0
  private pendingDecodes = 0
  private nextSentenceIdx = 0
  private finishedReported = false
  private discardedTurns = new Set<string>()

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
    return this.audioCtx
  }

  public setEpoch(epoch: number): void {
    if (epoch > this.currentEpoch) {
      this.currentEpoch = epoch
      this.stop('barge_in')
    }
  }

  public getPlaybackPosition() {
    const sentence = this.activePlayingSentence;
    return sentence ? {turn_id: sentence.turnId, epoch: sentence.epoch,
      sentence_idx: sentence.sentenceIdx,
      played_ms: Math.max(0, ((this.audioCtx?.currentTime ?? this.chunkStartTime) - this.chunkStartTime) * 1000)} : null;
  }

  public discardTurn(turnId: number, epoch: number) {
    this.discardedTurns.add(`${epoch}:${turnId}`)
    this.stop('barge_in')
  }

  public reset(initialEpoch = 0): void {
    this.stop('end')
    this.currentEpoch = initialEpoch
    this.sentenceBuffers.clear()
    this.flushedSentences.clear()
    this.currentActiveTurnId = null
    this.isGenerationCompleted = false
    this.discardedTurns.clear()
    // reset is called by the Start button: unlock audio within that user gesture.
    try {
      const ctx = this.initContext()
      if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
    } catch { /* A decode/play attempt will report the actionable playback error. */ }
  }

  public enqueueChunk(chunk: QueuedChunk): void {
    if (this.discardedTurns.has(`${chunk.epoch}:${chunk.turnId}`)) return
    // Drop older epochs (contracts/ws_events.md Section 2)
    if (chunk.epoch < this.currentEpoch) {
      return
    }

    if (chunk.epoch > this.currentEpoch) {
      this.setEpoch(chunk.epoch)
    }

    if (this.currentActiveTurnId !== chunk.turnId) {
      if (this.currentActiveTurnId !== null && !this.finishedReported) {
        // Never mix two foreground turns; the gateway will recover from the error.
        this.callbacks.onPlaybackStopped(chunk.turnId, chunk.epoch, 'error', performance.now())
        return
      }
      this.sentenceBuffers.clear()
      this.flushedSentences.clear()
      this.isGenerationCompleted = false
      this.finishedReported = false
      this.nextSentenceIdx = 0
      this.currentActiveTurnId = chunk.turnId
      this.currentTurnEpoch = chunk.epoch
    }
    if (this.finishedReported || this.flushedSentences.has(chunk.sentenceIdx)) return

    // Decode base64 bytes for this chunk
    let pieceBytes: Uint8Array
    try {
      const binaryStr = atob(chunk.dataB64)
      pieceBytes = new Uint8Array(binaryStr.length)
      for (let i = 0; i < binaryStr.length; i++) {
        pieceBytes[i] = binaryStr.charCodeAt(i)
      }
    } catch (e) {
      console.warn('[AudioPlayer] Failed to base64 decode audio chunk', e)
      return
    }

    // Auto-flush any earlier sentences if this is a newer sentenceIdx
    for (const [sIdx] of this.sentenceBuffers.entries()) {
      if (sIdx < chunk.sentenceIdx && !this.flushedSentences.has(sIdx)) {
        this.flushSentence(sIdx)
      }
    }

    // Accumulate piece
    if (!this.sentenceBuffers.has(chunk.sentenceIdx)) {
      this.sentenceBuffers.set(chunk.sentenceIdx, {
        turnId: chunk.turnId,
        epoch: chunk.epoch,
        seqMap: new Map(),
      })
    }

    const sb = this.sentenceBuffers.get(chunk.sentenceIdx)!
    sb.seqMap.set(chunk.seq, pieceBytes)
  }

  public flushSentence(sentenceIdx: number): void {
    if (this.flushedSentences.has(sentenceIdx)) return
    const sb = this.sentenceBuffers.get(sentenceIdx)
    if (!sb || sb.seqMap.size === 0) return

    this.flushedSentences.add(sentenceIdx)

    // Sort pieces by seq
    const sortedSeqs = Array.from(sb.seqMap.keys()).sort((a, b) => a - b)
    let totalBytes = 0
    for (const s of sortedSeqs) {
      totalBytes += sb.seqMap.get(s)!.length
    }

    const assembled = new Uint8Array(totalBytes)
    let offset = 0
    for (const s of sortedSeqs) {
      const p = sb.seqMap.get(s)!
      assembled.set(p, offset)
      offset += p.length
    }

    this.decodeAndEnqueueSentence({
      turnId: sb.turnId,
      epoch: sb.epoch,
      sentenceIdx,
      bytes: assembled,
    })
  }

  public endTurn(turnId: number): void {
    if (this.currentActiveTurnId !== turnId || this.finishedReported) return
    this.isGenerationCompleted = true

    // Flush any pending unflushed sentences for this turn
    for (const [sIdx] of this.sentenceBuffers.entries()) {
      if (!this.flushedSentences.has(sIdx)) {
        this.flushSentence(sIdx)
      }
    }

    // If nothing was buffered or playing at all, report completion
    this.reportFinished()
  }

  private reportFinished(): void {
    if (this.isGenerationCompleted && !this.finishedReported && !this.isPlaying &&
        this.pendingDecodes === 0 && this.playQueue.length === 0 && this.nextSentenceIdx > 0 &&
        this.currentActiveTurnId !== null) {
      this.finishedReported = true
      this.callbacks.onPlaybackStopped(this.currentActiveTurnId, this.currentEpoch, 'finished', performance.now())
    }
  }

  private async decodeAndEnqueueSentence(sentence: AssembledSentence): Promise<void> {
    const token = this.playbackToken
    this.pendingDecodes++

    try {
      const ctx = this.initContext()
      if (ctx.state === 'suspended') await ctx.resume()
      if (ctx.state !== 'running') throw new Error('Browser audio is not running')
      // Copy bytes buffer slice so decodeAudioData can detach it safely
      const arrayBuffer = sentence.bytes.buffer.slice(
        sentence.bytes.byteOffset,
        sentence.bytes.byteOffset + sentence.bytes.byteLength
      ) as ArrayBuffer
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer)

      if (token !== this.playbackToken || sentence.epoch < this.currentEpoch) {
        return
      }

      const playable: PlayableSentence = {
        turnId: sentence.turnId,
        epoch: sentence.epoch,
        sentenceIdx: sentence.sentenceIdx,
        buffer: audioBuffer,
      }

      this.playQueue.push(playable)
      this.playQueue.sort((a, b) => a.sentenceIdx - b.sentenceIdx)

      if (!this.isPlaying) {
        this.playNext()
      }
    } catch (err) {
      console.warn('[AudioPlayer] decodeAudioData error for sentence', sentence.sentenceIdx, err)
      if (token === this.playbackToken) {
        this.stop('error')
      }
    } finally {
      if (token === this.playbackToken) {
        this.pendingDecodes--
        this.reportFinished()
      }
    }
  }

  private playNext(): void {
    if (this.isPlaying) return
    if (this.playQueue.length === 0) {
      this.isPlaying = false
      this.activePlayingSentence = null
      this.reportFinished()
      return
    }

    // decodeAudioData may finish out of order; wait for the expected sentence.
    if (this.playQueue[0].sentenceIdx !== this.nextSentenceIdx) return

    const item = this.playQueue.shift()!
    if (item.epoch < this.currentEpoch) {
      this.playNext()
      return
    }

    this.isPlaying = true
    this.nextSentenceIdx++
    this.activePlayingSentence = item

    const ctx = this.initContext()
    const source = ctx.createBufferSource()
    source.buffer = item.buffer

    if (this.analyser) {
      source.connect(this.analyser)
    } else {
      source.connect(ctx.destination)
    }

    this.currentSource = source
    this.chunkStartTime = ctx.currentTime

    // Progress interval every 200ms
    if (this.progressInterval) clearInterval(this.progressInterval)
    this.progressInterval = setInterval(() => {
      if (!this.isPlaying || !this.activePlayingSentence) return
      const elapsedMs = (ctx.currentTime - this.chunkStartTime) * 1000
      this.callbacks.onPlaybackProgress(
        item.turnId,
        item.epoch,
        item.sentenceIdx,
        Math.min(Math.round(elapsedMs), Math.round(item.buffer.duration * 1000))
      )
    }, 200)

    source.onended = () => {
      if (this.currentSource !== source) return
      if (this.progressInterval) {
        clearInterval(this.progressInterval)
        this.progressInterval = null
      }

      if (this.currentSource === source) {
        this.currentSource = null
        this.isPlaying = false
        this.activePlayingSentence = null
        // Advance to next sentence in queue without emitting 'finished' prematurely!
        this.playNext()
      }
    }

    try {
      source.start(0)
      this.callbacks.onPlaybackStarted(item.turnId, item.epoch, item.sentenceIdx, performance.now())
    } catch {
      this.stop('error')
    }
  }

  public stop(reason: 'finished' | 'barge_in' | 'end' | 'error' = 'barge_in'): void {
    this.playbackToken++
    const stoppedTurn = this.currentActiveTurnId
    const stoppedEpoch = this.currentTurnEpoch
    if (stoppedTurn !== null) {
      this.discardedTurns.add(`${stoppedEpoch}:${stoppedTurn}`)
      if (this.discardedTurns.size > 64) this.discardedTurns.delete(this.discardedTurns.values().next().value!)
    }
    this.pendingDecodes = 0

    if (this.progressInterval) {
      clearInterval(this.progressInterval)
      this.progressInterval = null
    }

    this.playQueue = []
    this.sentenceBuffers.clear()
    this.flushedSentences.clear()

    if (this.currentSource) {
      this.currentSource.onended = null
      try {
        this.currentSource.stop()
        this.currentSource.disconnect()
      } catch {
        // Source may already be stopped
      }
      this.currentSource = null
    }

    this.activePlayingSentence = null
    if (stoppedTurn !== null && !this.finishedReported) {
      this.callbacks.onPlaybackStopped(
        stoppedTurn,
        stoppedEpoch,
        reason,
        performance.now()
      )
    }

    this.isPlaying = false
    this.isGenerationCompleted = false
    this.currentActiveTurnId = null
    this.nextSentenceIdx = 0
    this.finishedReported = false
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
