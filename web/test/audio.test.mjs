import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

describe('Phase B4: Audio Player & Sentence Ordering Unit Tests', () => {
  test('Queue correctly sorts incoming audio chunks by sentence_idx and seq', () => {
    const queue = [
      { turnId: 1, epoch: 1, sentenceIdx: 1, seq: 1 },
      { turnId: 1, epoch: 1, sentenceIdx: 0, seq: 2 },
      { turnId: 1, epoch: 1, sentenceIdx: 0, seq: 1 },
      { turnId: 1, epoch: 1, sentenceIdx: 2, seq: 1 },
    ]

    queue.sort((a, b) => {
      if (a.sentenceIdx !== b.sentenceIdx) {
        return a.sentenceIdx - b.sentenceIdx
      }
      return a.seq - b.seq
    })

    assert.equal(queue[0].sentenceIdx, 0)
    assert.equal(queue[0].seq, 1)
    assert.equal(queue[1].sentenceIdx, 0)
    assert.equal(queue[1].seq, 2)
    assert.equal(queue[2].sentenceIdx, 1)
    assert.equal(queue[3].sentenceIdx, 2)
  })

  test('Epoch advancement discards queued chunks and active playback', () => {
    let currentEpoch = 1
    let queue = [
      { turnId: 1, epoch: 1, sentenceIdx: 0 },
      { turnId: 1, epoch: 1, sentenceIdx: 1 },
    ]
    let isPlaying = true

    function advanceEpoch(newEpoch) {
      if (newEpoch > currentEpoch) {
        currentEpoch = newEpoch
        queue = []
        isPlaying = false
      }
    }

    advanceEpoch(2)
    assert.equal(currentEpoch, 2)
    assert.equal(queue.length, 0, 'Queue must be empty after epoch advance')
    assert.equal(isPlaying, false, 'Playback must be halted')
  })

  test('Stale epoch audio chunks are rejected before decoding', () => {
    const currentEpoch = 3
    function shouldAcceptChunk(chunkEpoch) {
      return chunkEpoch >= currentEpoch
    }

    assert.equal(shouldAcceptChunk(1), false, 'Epoch 1 must be rejected')
    assert.equal(shouldAcceptChunk(2), false, 'Epoch 2 must be rejected')
    assert.equal(shouldAcceptChunk(3), true, 'Current epoch 3 accepted')
    assert.equal(shouldAcceptChunk(4), true, 'Higher epoch 4 accepted')
  })

  test('Transcript sentence accumulation preserves all turns and sentences', () => {
    let transcripts = []

    function addTranscript(data) {
      const existingIdx = transcripts.findIndex(
        (t) =>
          t.turn_id === data.turn_id &&
          t.speaker === data.speaker &&
          (data.sentence_idx === undefined || t.sentence_idx === data.sentence_idx)
      )
      const newItem = {
        id: `t_${data.turn_id}_${data.epoch}_${data.speaker}_${data.sentence_idx ?? 0}`,
        turn_id: data.turn_id,
        epoch: data.epoch,
        speaker: data.speaker,
        text: data.text,
        final: data.final,
        sentence_idx: data.sentence_idx,
      }
      if (existingIdx >= 0) {
        transcripts[existingIdx] = newItem
      } else {
        transcripts.push(newItem)
      }
    }

    // Turn 1 sentence 0 draft
    addTranscript({ turn_id: 1, epoch: 1, speaker: 'ai_engineer', text: 'AI is advancing.', final: false, sentence_idx: 0 })
    assert.equal(transcripts.length, 1)
    assert.equal(transcripts[0].final, false)

    // Turn 1 sentence 0 final
    addTranscript({ turn_id: 1, epoch: 1, speaker: 'ai_engineer', text: 'AI is advancing rapidly.', final: true, sentence_idx: 0 })
    assert.equal(transcripts.length, 1)
    assert.equal(transcripts[0].final, true)
    assert.equal(transcripts[0].text, 'AI is advancing rapidly.')

    // Turn 1 sentence 1 arrives -> must NOT overwrite sentence 0!
    addTranscript({ turn_id: 1, epoch: 1, speaker: 'ai_engineer', text: 'We build entire modules.', final: true, sentence_idx: 1 })
    assert.equal(transcripts.length, 2, 'Sentence 1 must be appended, sentence 0 preserved')
    assert.equal(transcripts[0].text, 'AI is advancing rapidly.')
    assert.equal(transcripts[1].text, 'We build entire modules.')

    // Turn 2 from another speaker arrives
    addTranscript({ turn_id: 2, epoch: 1, speaker: 'software_developer', text: 'Syntax is easy.', final: true, sentence_idx: 0 })
    assert.equal(transcripts.length, 3, 'Turn 2 must be preserved alongside Turn 1')
  })
})
