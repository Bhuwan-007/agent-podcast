import React, { useState } from 'react'
import { Header } from './components/Header'
import { TopicCard } from './components/TopicCard'
import { ExpertCard } from './components/ExpertCard'
import { TranscriptPanel } from './components/TranscriptPanel'
import { TargetSelector } from './components/TargetSelector'
import { MicrophoneControl, type MicState } from './components/MicrophoneControl'
import { ClaimsLedger } from './components/ClaimsLedger'
import { TracePanel } from './components/TracePanel'
import { MetricsPanel } from './components/MetricsPanel'
import { RecoveryNotice } from './components/RecoveryNotice'
import { ScreenSwitcher, type ScreenId } from './components/ScreenSwitcher'
import { TOPICS, DEFAULT_TOPIC } from './data/topics'
import type {
  SessionStateName,
  SessionMode,
  TranscriptItem,
  Claim,
  TraceEvent,
  MetricsState,
  Notice,
} from './types/protocol'

// Static sample data representing live roundtable state
const SAMPLE_TRANSCRIPTS: TranscriptItem[] = [
  {
    id: 't1',
    turn_id: 1,
    epoch: 1,
    speaker: 'Alex (AI Engineer)',
    text: 'AI coding tools are advancing past simple autocomplete. We are now seeing autonomous systems construct whole modules and resolve regressions overnight.',
    final: true,
  },
  {
    id: 't2',
    turn_id: 2,
    epoch: 1,
    speaker: 'Sam (Software Developer)',
    text: 'Generating syntax is the easy part. Software engineering is primarily about requirements clarity, domain modeling, and living with the code you ship for five years.',
    final: true,
  },
  {
    id: 't3',
    turn_id: 3,
    epoch: 1,
    speaker: 'Maya (OSS Maintainer)',
    text: 'From an open-source perspective, AI pull requests have exploded review fatigue. Who verifies the supply chain security and edge cases when nobody wrote it by hand?',
    final: true,
  },
  {
    id: 't4',
    turn_id: 4,
    epoch: 1,
    speaker: 'Sam (Software Developer)',
    text: 'Exactly, Maya. When an incident occurs at 3 AM, you need mental models, not just generated boilerplate that passed a green test suite.',
    final: false, // Live draft demonstrating final: false
  },
]

const SAMPLE_CLAIMS: Claim[] = [
  {
    id: 'c1',
    agent_id: 'ai_engineer',
    text: 'AI automation will absorb majority of routine CRUD and boilerplate coding.',
    status: 'open',
    verified: false, // Never verified without tool observation per contract
  },
  {
    id: 'c2',
    agent_id: 'software_developer',
    text: 'Architecture and long-term maintenance judgment cannot be replaced by statistical generation.',
    status: 'challenged',
    verified: false,
  },
  {
    id: 'c3',
    agent_id: 'oss_maintainer',
    text: 'Unchecked AI PRs increase volunteer burnout and supply chain security vulnerabilities.',
    status: 'open',
    verified: false,
  },
]

const SAMPLE_TRACES: TraceEvent[] = [
  {
    ts: '12:04:15.120',
    from: 'software_developer',
    to: 'moderator',
    msg_type: 'floor.bid',
    summary: 'challenge c1: dispute maintenance claim (urgency: 0.85)',
  },
  {
    ts: '12:04:15.450',
    from: 'moderator',
    to: 'software_developer',
    msg_type: 'floor.grant',
    summary: 'granted floor: highest urgency and relevance score',
  },
  {
    ts: '12:04:17.200',
    from: 'oss_maintainer',
    to: 'ai_engineer',
    msg_type: 'agent.direct',
    summary: 'direct challenge: review capacity bottleneck',
  },
]

const SAMPLE_METRICS: MetricsState = {
  interrupt_to_silence_ms: 124,
  user_question_to_first_audio_ms: 1420,
  grant_to_first_audio_ms: 890,
}

const SAMPLE_NOTICES: Notice[] = [
  {
    code: 'mic_denied',
    level: 'error',
    text: 'Microphone access is blocked in your browser. Enable permissions to interrupt by voice.',
    recoverable: true,
  },
  {
    code: 'disconnected',
    level: 'warn',
    text: 'Connection lost to gateway. Attempting backoff reconnection (attempt 1/3)…',
    recoverable: true,
  },
]

export const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('A')
  const [isMobilePreview, setIsMobilePreview] = useState<boolean>(false)
  const [selectedTopicId, setSelectedTopicId] = useState<string>(DEFAULT_TOPIC.topic_id)
  const [targetedAgentId, setTargetedAgentId] = useState<string | null>(null)
  const [micState, setMicState] = useState<MicState>('off')
  const [sessionMode] = useState<SessionMode>('mock')

  const selectedTopic = TOPICS.find((t) => t.topic_id === selectedTopicId) || DEFAULT_TOPIC

  // Determine active state per screen
  const getScreenState = (): SessionStateName => {
    switch (currentScreen) {
      case 'A':
        return 'ready'
      case 'B':
      case 'C':
        return 'agent_speaking'
      case 'D':
        return 'user_speaking'
      case 'E':
        return 'recovery'
      case 'F':
        return 'ended'
      default:
        return 'ready'
    }
  }

  const sessionState = getScreenState()

  const handleMicToggle = () => {
    if (micState === 'off') {
      setMicState('listening')
    } else if (micState === 'listening') {
      setMicState('off')
    } else if (micState === 'denied') {
      setMicState('listening')
    }
  }

  return (
    <div className={`app-root ${isMobilePreview ? 'simulated-mobile-wrap' : ''}`}>
      {/* Top development screen navigation bar */}
      <ScreenSwitcher
        currentScreen={currentScreen}
        onSelectScreen={setCurrentScreen}
        isMobilePreview={isMobilePreview}
        onToggleMobilePreview={() => setIsMobilePreview(!isMobilePreview)}
      />

      <div className={`app-viewport ${isMobilePreview ? 'mobile-frame' : ''}`}>
        {/* Universal Header */}
        <Header
          state={sessionState}
          mode={sessionMode}
          activeSpeakerName={
            currentScreen === 'B' || currentScreen === 'C'
              ? 'Sam'
              : currentScreen === 'D'
              ? 'You (Human)'
              : undefined
          }
          connected={currentScreen !== 'E'}
          showEndButton={currentScreen !== 'A' && currentScreen !== 'F'}
          onEndSession={() => setCurrentScreen('F')}
        />

        <main className="main-content">
          {/* ============================================================ */}
          {/* SCREEN A: TOPIC SELECTION / LOBBY                            */}
          {/* ============================================================ */}
          {currentScreen === 'A' && (
            <section className="screen-lobby container" aria-label="Screen A: Topic Selection">
              <div className="hero-banner">
                <span className="hero-badge">FOSS Forge 2.0 • ElevenLabs Track</span>
                <h2 className="hero-title">Three perspectives. One live conversation.</h2>
                <p className="hero-tagline">
                  Choose an official topic to begin. Listen to autonomous AI experts debate dynamically,
                  and speak to interrupt at any second.
                </p>
              </div>

              <div className="topics-grid">
                {TOPICS.map((topic) => (
                  <TopicCard
                    key={topic.topic_id}
                    topic={topic}
                    isSelected={selectedTopicId === topic.topic_id}
                    onSelect={() => setSelectedTopicId(topic.topic_id)}
                  />
                ))}
              </div>

              <div className="lobby-footer-card">
                <div className="footer-meta">
                  <h3 className="footer-title">Starting Configuration: {selectedTopic.title}</h3>
                  <p className="footer-desc">
                    Opening prompt will be injected verbatim from official organizer materials.
                  </p>
                  <div className="permissions-notice">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    <span>
                      Voice synthesis powered by <strong>ElevenLabs streaming WebSocket</strong>.
                      Microphone capture uses browser echo-cancellation and local client VAD.
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  className="start-roundtable-btn"
                  onClick={() => setCurrentScreen('B')}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  Start Live Roundtable
                </button>
              </div>
            </section>
          )}

          {/* ============================================================ */}
          {/* SCREEN B: ACTIVE DESKTOP SESSION (1440px layout)             */}
          {/* ============================================================ */}
          {currentScreen === 'B' && (
            <section className="screen-desktop container" aria-label="Screen B: Desktop Live Session">
              <div className="session-subnav">
                <div className="topic-context">
                  <span className="context-label">Current Topic:</span>
                  <h2 className="context-title">{selectedTopic.title}</h2>
                </div>
                <div className="angle-badge">
                  <span>Perspective: Engineering vs Automation</span>
                </div>
              </div>

              {/* 3 Expert Cards */}
              <div className="experts-grid">
                {selectedTopic.agents.map((agent) => {
                  let status: 'idle' | 'listening' | 'speaking' | 'addressed' = 'listening'
                  if (agent.agent_id === 'software_developer') status = 'speaking'
                  if (targetedAgentId === agent.agent_id) status = 'addressed'

                  return (
                    <ExpertCard
                      key={agent.agent_id}
                      agent={agent}
                      status={status}
                      isTargeted={targetedAgentId === agent.agent_id}
                      onClick={() =>
                        setTargetedAgentId(
                          targetedAgentId === agent.agent_id ? null : agent.agent_id
                        )
                      }
                    />
                  )
                })}
              </div>

              {/* Main Panel Layout */}
              <div className="session-body-grid">
                <div className="main-stage-col">
                  {/* Current Active Speaker Spotlight */}
                  <div className="speaker-spotlight">
                    <div className="spotlight-header">
                      <span className="spotlight-tag">Authoritative Speaker (Audio Active)</span>
                      <span className="spotlight-voice">Voice: Pragmatic Builder (ElevenLabs)</span>
                    </div>
                    <blockquote className="spotlight-quote">
                      "Generating syntax is the easy part. Software engineering is primarily about requirements
                      clarity, domain modeling, and living with the code you ship for five years."
                    </blockquote>
                  </div>

                  {/* Interruption & Directing Controls */}
                  <div className="session-controls-card">
                    <TargetSelector
                      agents={selectedTopic.agents}
                      selectedAgentId={targetedAgentId}
                      onSelectAgent={setTargetedAgentId}
                    />

                    <div className="controls-row">
                      <MicrophoneControl state={micState} onToggle={handleMicToggle} />
                    </div>
                  </div>

                  {/* Claims & Protocol Traces */}
                  <div className="evidence-grid">
                    <ClaimsLedger claims={SAMPLE_CLAIMS} />
                    <TracePanel traces={SAMPLE_TRACES} />
                  </div>
                </div>

                <div className="sidebar-col">
                  <TranscriptPanel items={SAMPLE_TRANSCRIPTS} currentSpeaker="Sam (Software Developer)" />
                  <MetricsPanel metrics={SAMPLE_METRICS} />
                </div>
              </div>
            </section>
          )}

          {/* ============================================================ */}
          {/* SCREEN C: MOBILE SESSION (390px layout)                      */}
          {/* ============================================================ */}
          {currentScreen === 'C' && (
            <section className="screen-mobile container" aria-label="Screen C: Mobile Session">
              <div className="mobile-topic-header">
                <span className="mobile-topic-tag">Topic 1</span>
                <h2 className="mobile-topic-title">{selectedTopic.title}</h2>
              </div>

              {/* Vertically stacked role cards */}
              <div className="mobile-experts-list">
                {selectedTopic.agents.map((agent) => (
                  <ExpertCard
                    key={agent.agent_id}
                    agent={agent}
                    status={agent.agent_id === 'software_developer' ? 'speaking' : 'listening'}
                    isTargeted={targetedAgentId === agent.agent_id}
                    onClick={() =>
                      setTargetedAgentId(
                        targetedAgentId === agent.agent_id ? null : agent.agent_id
                      )
                    }
                  />
                ))}
              </div>

              {/* Mobile Transcript */}
              <div className="mobile-transcript-wrap">
                <TranscriptPanel items={SAMPLE_TRANSCRIPTS} currentSpeaker="Sam (Software Developer)" />
              </div>

              {/* Sticky bottom mobile action panel */}
              <div className="mobile-action-bar">
                <TargetSelector
                  agents={selectedTopic.agents}
                  selectedAgentId={targetedAgentId}
                  onSelectAgent={setTargetedAgentId}
                />
                <MicrophoneControl state={micState} onToggle={handleMicToggle} />
              </div>
            </section>
          )}

          {/* ============================================================ */}
          {/* SCREEN D: INTERRUPTED / LISTENING STATE                      */}
          {/* ============================================================ */}
          {currentScreen === 'D' && (
            <section className="screen-interrupted container" aria-label="Screen D: Interrupted State">
              <div className="interrupted-banner">
                <div className="interrupted-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <div>
                  <h2 className="interrupted-title">Mid-Sentence Spoken Interruption Detected</h2>
                  <p className="interrupted-desc">
                    Client VAD triggered barge-in. Agent playback stopped within 124 ms.
                    Incoming human speech has priority.
                  </p>
                </div>
              </div>

              <div className="interrupted-cards-row">
                {selectedTopic.agents.map((agent) => (
                  <ExpertCard
                    key={agent.agent_id}
                    agent={agent}
                    status={
                      agent.agent_id === 'software_developer'
                        ? 'listening'
                        : agent.agent_id === 'oss_maintainer'
                        ? 'addressed'
                        : 'idle'
                    }
                    isTargeted={agent.agent_id === 'oss_maintainer'}
                  />
                ))}
              </div>

              <div className="user-interrupted-stage">
                <div className="user-listening-box">
                  <span className="live-mic-pulse" />
                  <div className="listening-details">
                    <span className="listening-status">S4: user_speaking &rarr; S5: processing_user</span>
                    <h3 className="user-utterance-text">
                      "Wait, Maya, what specific security vulnerabilities are maintainers seeing from generated PRs?"
                    </h3>
                    <span className="routing-note">
                      Router: Explicit name match &rarr; Directing to <strong>Maya (Open-Source Maintainer)</strong>
                    </span>
                  </div>
                </div>

                <div className="interrupted-actions">
                  <button
                    type="button"
                    className="resume-demo-btn"
                    onClick={() => setCurrentScreen('B')}
                  >
                    Simulate Addressed Response
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* ============================================================ */}
          {/* SCREEN E: ERROR AND RECOVERY STATES                          */}
          {/* ============================================================ */}
          {currentScreen === 'E' && (
            <section className="screen-recovery container" aria-label="Screen E: Recovery State">
              <div className="recovery-header">
                <h2>Resilience & Failure Recovery (ERR-01 .. ERR-10)</h2>
                <p>
                  Truthful feedback: errors are disclosed honestly rather than masked with fake waveforms or synthetic successes.
                </p>
              </div>

              <div className="notices-list">
                {SAMPLE_NOTICES.map((notice, idx) => (
                  <RecoveryNotice
                    key={idx}
                    notice={notice}
                    onRetry={() => alert(`Retrying recovery action for ${notice.code}`)}
                    onDismiss={() => {}}
                  />
                ))}

                <RecoveryNotice
                  notice={{
                    code: 'agent_timeout',
                    level: 'warn',
                    text: 'AI Engineer bid timed out (>400 ms). Floor was safely granted to Software Developer.',
                    recoverable: false,
                  }}
                />
              </div>

              <div className="recovery-actions-card">
                <button
                  type="button"
                  className="retry-all-btn"
                  onClick={() => setCurrentScreen('B')}
                >
                  Clear Errors & Resume Session
                </button>
              </div>
            </section>
          )}

          {/* ============================================================ */}
          {/* SCREEN F: SESSION CONCLUDED / ENDED                          */}
          {/* ============================================================ */}
          {currentScreen === 'F' && (
            <section className="screen-ended container" aria-label="Screen F: Ended State">
              <div className="ended-card">
                <div className="ended-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="9 11 12 14 22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                </div>
                <h2 className="ended-title">Roundtable Concluded</h2>
                <p className="ended-desc">
                  Session ended (S8). All WebSocket audio playback stopped, and queued audio buffers have been discarded.
                </p>

                <div className="ended-actions">
                  <button
                    type="button"
                    className="start-new-btn"
                    onClick={() => {
                      setCurrentScreen('A')
                      setMicState('off')
                      setTargetedAgentId(null)
                    }}
                  >
                    Start New Roundtable
                  </button>
                </div>
              </div>

              <div className="ended-transcript-review">
                <h3>Session Transcript Review</h3>
                <TranscriptPanel items={SAMPLE_TRANSCRIPTS} />
              </div>
            </section>
          )}
        </main>
      </div>

      <style>{`
        .app-root {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: var(--color-bg);
          color: var(--color-text);
        }
        .app-viewport {
          flex: 1;
          display: flex;
          flex-direction: column;
          width: 100%;
        }
        .main-content {
          flex: 1;
          padding: var(--space-6) 0 var(--space-12);
        }

        /* Mobile simulation frame */
        .simulated-mobile-wrap {
          background: #080A10;
          align-items: center;
        }
        .mobile-frame {
          max-width: 390px !important;
          min-height: 844px;
          border: 4px solid #2A2F43;
          border-radius: 36px;
          margin: var(--space-6) auto;
          overflow: hidden;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8);
          background: var(--color-bg);
        }

        /* Screen A: Lobby */
        .hero-banner {
          text-align: center;
          margin-bottom: var(--space-8);
        }
        .hero-badge {
          display: inline-block;
          font-size: 12px;
          font-weight: 700;
          color: var(--color-accent);
          background: var(--color-accent-subtle);
          border: 1px solid var(--color-accent);
          padding: 4px 12px;
          border-radius: var(--radius-pill);
          text-transform: uppercase;
          margin-bottom: var(--space-3);
        }
        .hero-title {
          font-size: 36px;
          font-weight: 800;
          line-height: 1.2;
          color: var(--color-text);
          margin-bottom: var(--space-2);
        }
        .hero-tagline {
          font-size: 16px;
          color: var(--color-text-muted);
          max-width: 600px;
          margin: 0 auto;
        }
        .topics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: var(--space-6);
          margin-bottom: var(--space-8);
        }
        .lobby-footer-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-card);
          padding: var(--space-6);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-6);
          flex-wrap: wrap;
        }
        .footer-meta {
          flex: 1;
          min-width: 280px;
        }
        .footer-title {
          font-size: 16px;
          font-weight: 700;
          color: var(--color-text);
          margin-bottom: 4px;
        }
        .footer-desc {
          font-size: 13px;
          color: var(--color-text-muted);
          margin-bottom: var(--space-2);
        }
        .permissions-notice {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-size: 12px;
          color: var(--color-text-dim);
        }
        .start-roundtable-btn {
          background: var(--color-accent);
          color: #0b0e14;
          font-size: 16px;
          font-weight: 700;
          padding: 14px 28px;
          border-radius: var(--radius-control);
          display: flex;
          align-items: center;
          gap: var(--space-2);
          transition: background var(--transition-fast), transform var(--transition-fast);
        }
        .start-roundtable-btn:hover {
          background: var(--color-accent-hover);
          transform: translateY(-2px);
        }

        /* Screen B: Desktop Live */
        .session-subnav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--space-4);
          gap: var(--space-4);
        }
        .context-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--color-text-dim);
          text-transform: uppercase;
          display: block;
        }
        .context-title {
          font-size: 22px;
          font-weight: 800;
          color: var(--color-text);
          margin: 0;
        }
        .angle-badge {
          background: var(--color-surface-elevated);
          border: 1px solid var(--color-border);
          padding: 4px 12px;
          border-radius: var(--radius-pill);
          font-size: 12px;
          color: var(--color-text-muted);
        }
        .experts-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--space-4);
          margin-bottom: var(--space-6);
        }
        .session-body-grid {
          display: grid;
          grid-template-columns: 1fr 420px;
          gap: var(--space-6);
        }
        .main-stage-col {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }
        .speaker-spotlight {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-left: 4px solid var(--color-agent-dev);
          border-radius: var(--radius-card);
          padding: var(--space-4) var(--space-6);
        }
        .spotlight-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--space-2);
        }
        .spotlight-tag {
          font-size: 11px;
          font-weight: 700;
          color: var(--color-agent-dev);
          text-transform: uppercase;
        }
        .spotlight-voice {
          font-size: 11px;
          color: var(--color-text-dim);
        }
        .spotlight-quote {
          font-size: 17px;
          color: var(--color-text);
          line-height: 1.6;
          font-style: italic;
          margin: 0;
        }
        .session-controls-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-card);
          padding: var(--space-4);
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }
        .evidence-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-4);
        }
        .sidebar-col {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        /* Screen C: Mobile */
        .mobile-topic-header {
          margin-bottom: var(--space-3);
        }
        .mobile-topic-tag {
          font-size: 11px;
          color: var(--color-accent);
          text-transform: uppercase;
          font-weight: 700;
        }
        .mobile-topic-title {
          font-size: 18px;
          font-weight: 700;
          margin: 0;
        }
        .mobile-experts-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
          margin-bottom: var(--space-4);
        }
        .mobile-transcript-wrap {
          margin-bottom: var(--space-4);
        }
        .mobile-action-bar {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
          position: sticky;
          bottom: 0;
          background: var(--color-bg);
          padding: var(--space-2) 0;
        }

        /* Screen D: Interrupted */
        .interrupted-banner {
          background: rgba(181, 160, 255, 0.1);
          border: 1px solid var(--color-accent);
          border-radius: var(--radius-card);
          padding: var(--space-4) var(--space-6);
          display: flex;
          align-items: center;
          gap: var(--space-4);
          margin-bottom: var(--space-6);
        }
        .interrupted-icon {
          color: var(--color-accent);
        }
        .interrupted-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--color-text);
          margin-bottom: 2px;
        }
        .interrupted-desc {
          font-size: 13px;
          color: var(--color-text-muted);
          margin: 0;
        }
        .interrupted-cards-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--space-4);
          margin-bottom: var(--space-6);
        }
        .user-interrupted-stage {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-card);
          padding: var(--space-6);
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }
        .user-listening-box {
          display: flex;
          align-items: flex-start;
          gap: var(--space-4);
          background: var(--color-surface-elevated);
          padding: var(--space-4);
          border-radius: var(--radius-control);
          border: 1px solid var(--color-accent);
        }
        .live-mic-pulse {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: var(--color-success);
          margin-top: 4px;
          box-shadow: 0 0 10px var(--color-success);
        }
        .listening-details {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
        }
        .listening-status {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--color-accent);
          font-weight: 700;
        }
        .user-utterance-text {
          font-size: 18px;
          color: var(--color-text);
          font-weight: 600;
        }
        .routing-note {
          font-size: 12px;
          color: var(--color-text-dim);
        }
        .resume-demo-btn {
          align-self: flex-start;
          background: var(--color-accent);
          color: #0b0e14;
          font-weight: 700;
          padding: 10px 20px;
          border-radius: var(--radius-control);
          font-size: 14px;
        }

        /* Screen E: Recovery */
        .recovery-header {
          margin-bottom: var(--space-6);
        }
        .recovery-header h2 {
          font-size: 24px;
          font-weight: 800;
          margin-bottom: var(--space-1);
        }
        .recovery-header p {
          color: var(--color-text-muted);
          font-size: 14px;
        }
        .notices-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
          margin-bottom: var(--space-6);
        }
        .retry-all-btn {
          background: var(--color-surface-elevated);
          border: 1px solid var(--color-border);
          color: var(--color-text);
          font-weight: 600;
          padding: 12px 24px;
          border-radius: var(--radius-control);
          font-size: 14px;
        }

        /* Screen F: Ended */
        .ended-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-card);
          padding: var(--space-8);
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-3);
          margin-bottom: var(--space-6);
        }
        .ended-icon {
          color: var(--color-success);
        }
        .ended-title {
          font-size: 26px;
          font-weight: 800;
          color: var(--color-text);
          margin: 0;
        }
        .ended-desc {
          font-size: 14px;
          color: var(--color-text-muted);
          max-width: 500px;
          margin: 0 auto;
        }
        .start-new-btn {
          background: var(--color-accent);
          color: #0b0e14;
          font-size: 15px;
          font-weight: 700;
          padding: 12px 24px;
          border-radius: var(--radius-control);
          margin-top: var(--space-2);
        }
        .ended-transcript-review h3 {
          font-size: 16px;
          font-weight: 700;
          margin-bottom: var(--space-3);
        }

        @media (max-width: 1024px) {
          .experts-grid {
            grid-template-columns: 1fr;
          }
          .session-body-grid {
            grid-template-columns: 1fr;
          }
          .evidence-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}
export default App
