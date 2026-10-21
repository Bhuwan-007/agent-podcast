import React, { useState } from 'react'
import { Header } from './components/Header'
import { RoundTable } from './components/RoundTable'
import { CinematicTable } from './components/CinematicTable'
import { MinutesDrawer } from './components/MinutesDrawer'
import { TableCard } from './components/TableCard'
import { Slip } from './components/Slip'
import { ScreenSwitcher, type ScreenId } from './components/ScreenSwitcher'
import { TOPICS, DEFAULT_TOPIC } from './data/topics'
import { useGatewayWs } from './hooks/useGatewayWs'

export const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('B')
  const [isMobilePreview, setIsMobilePreview] = useState<boolean>(false)
  const [selectedTopicId, setSelectedTopicId] = useState<string>(DEFAULT_TOPIC.topic_id)
  const [isMinutesOpen, setIsMinutesOpen] = useState<boolean>(true)
  const [micOn, setMicOn] = useState<boolean>(false)

  // Real WebSocket state from mock gateway
  const {
    connected,
    sessionState,
    sessionMode,
    activeSpeakerId,
    addressedAgentId,
    activeThread,
    speechSlip,
    transcripts,
    claims,
    traces,
    metrics,
    notices,
    startSession,
    bargeIn,
    addressAgent,
    endSession,
    triggerMockEvent,
    dismissNotice,
    simulateSpeaker,
  } = useGatewayWs()

  const selectedTopic = TOPICS.find((t) => t.topic_id === selectedTopicId) || DEFAULT_TOPIC

  // Find active speaker name for header
  const activeAgent = selectedTopic.agents.find((a) => a.agent_id === activeSpeakerId)
  const activeSpeakerDisplayName = activeAgent?.display_name

  const handleStartSession = () => {
    startSession(selectedTopic.topic_id)
    setCurrentScreen('B')
  }

  const handleMicToggle = () => {
    setMicOn(!micOn)
  }

  const handleBargeIn = () => {
    bargeIn()
    if (currentScreen !== 'B' && currentScreen !== 'C') {
      setCurrentScreen('D')
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
        {/* Universal Header with ink on brass Mock banner and paper state plate */}
        <Header
          state={sessionState}
          mode={sessionMode}
          activeSpeakerName={
            sessionState === 'user_speaking'
              ? 'You'
              : activeSpeakerDisplayName
          }
          connected={connected}
          showEndButton={currentScreen !== 'A' && currentScreen !== 'F'}
          onEndSession={() => {
            endSession()
            setCurrentScreen('F')
          }}
        />

        {/* Global Notices Pinboard */}
        {notices.length > 0 && (
          <aside className="notices-pinboard container" aria-label="Notices">
            {notices.map((n, idx) => (
              <Slip
                key={`${n.code}-${idx}`}
                notice={n}
                onDismiss={() => dismissNotice(idx)}
                onRetry={() => {
                  if (n.code === 'disconnected') window.location.reload()
                }}
              />
            ))}
          </aside>
        )}

        <main className="table-room-main">
          {/* ============================================================ */}
          {/* SCREEN A: LOBBY — CHOOSE A TABLE                             */}
          {/* ============================================================ */}
          {currentScreen === 'A' && (
            <section className="screen-lobby container" aria-label="Screen A: Choose a table">
              <header className="lobby-heading">
                <span className="lobby-badge">FOSS Forge 2.0 • ElevenLabs Track</span>
                <h2 className="lobby-title">Choose a Roundtable</h2>
                <p className="lobby-desc">
                  Three autonomous perspectives. One live room. Listen to continuous voice debate,
                  and pull your chair into the light whenever you wish to interrupt.
                </p>
              </header>

              <div className="lobby-tables-row">
                {TOPICS.map((topic) => (
                  <TableCard
                    key={topic.topic_id}
                    topic={topic}
                    isSelected={selectedTopicId === topic.topic_id}
                    onSelect={() => setSelectedTopicId(topic.topic_id)}
                  />
                ))}
              </div>

              {/* Selected Topic Brief & Opening Inscription */}
              <div className="table-inscription-panel paper-surface">
                <div className="inscription-meta">
                  <span className="inscription-tag">Selected Roundtable:</span>
                  <h3 className="inscription-title">{selectedTopic.title}</h3>
                  <p className="inscription-background">{selectedTopic.background}</p>

                  <div className="opening-quote-box">
                    <span className="quote-label">Opening prompt (verbatim from doc 05):</span>
                    <blockquote className="quote-text">
                      "{selectedTopic.opening_prompt}"
                    </blockquote>
                  </div>

                  <div className="disclosure-slip paper-slip">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    <span>
                      Live speech synthesized via <strong>ElevenLabs WebSocket</strong>. Microphone echo-cancellation and client VAD active.
                    </span>
                  </div>
                </div>

                <div className="inscription-cta-col">
                  <button
                    id="btn-join-roundtable"
                    type="button"
                    className="join-roundtable-btn"
                    onClick={handleStartSession}
                  >
                    Join this Roundtable
                  </button>
                  <span className="cta-note">Opens WebSocket session on topic</span>
                </div>
              </div>
            </section>
          )}

          {/* ============================================================ */}
          {/* SCREEN B: ACTIVE DESKTOP SESSION — "THE TABLE" (1440x900)   */}
          {/* ============================================================ */}
          {currentScreen === 'B' && (
            <section className="screen-table-desktop" aria-label="Screen B: Live Roundtable Table">
              <div className="table-stage-area">
                {/* Dev Mock Trigger Controls */}
                <aside className="dev-gateway-controls" aria-label="Dev Gateway Triggers">
                  <span className="dev-tag">VOICE FOCUS DEV TRIGGERS:</span>
                  <button
                    id="btn-speak-alex"
                    type="button"
                    className="dev-btn"
                    onClick={() =>
                      simulateSpeaker(
                        'ai_engineer',
                        'The economics of software development are shifting. When code generation cost drops toward zero, architectural judgment becomes the primary differentiator.'
                      )
                    }
                  >
                    Speak: Alex
                  </button>
                  <button
                    id="btn-speak-sam"
                    type="button"
                    className="dev-btn"
                    onClick={() =>
                      simulateSpeaker(
                        'software_developer',
                        'From a team and labor policy standpoint, senior engineers will direct synthetic agents, but the entry-level career progression path requires formal rethinking.'
                      )
                    }
                  >
                    Speak: Sam
                  </button>
                  <button
                    id="btn-speak-maya"
                    type="button"
                    className="dev-btn"
                    onClick={() =>
                      simulateSpeaker(
                        'oss_maintainer',
                        'Autonomous code commit pipelines present unaccountable failure loops. Security telemetry must be verified before deployment.'
                      )
                    }
                  >
                    Speak: Maya
                  </button>
                  <button
                    id="btn-barge-in"
                    type="button"
                    className="dev-btn"
                    onClick={handleBargeIn}
                  >
                    Barge-in: You
                  </button>
                  <button
                    id="btn-overview"
                    type="button"
                    className="dev-btn"
                    onClick={() => simulateSpeaker(null)}
                  >
                    Reset Overview
                  </button>
                  <button
                    id="btn-replay-debate"
                    type="button"
                    className="dev-btn"
                    onClick={() => startSession(selectedTopic.topic_id)}
                  >
                    Replay Gateway Fixtures
                  </button>
                  <button
                    id="btn-mock-unknown"
                    type="button"
                    className="dev-btn"
                    onClick={() => triggerMockEvent('unknown_target')}
                  >
                    Unknown Target
                  </button>
                  <button
                    id="btn-mock-disconnect"
                    type="button"
                    className="dev-btn"
                    onClick={() => triggerMockEvent('disconnect')}
                  >
                    Disconnect
                  </button>
                </aside>

                {/* The Cinematic Voice-Focused Round Table */}
                <CinematicTable
                  topic={selectedTopic}
                  activeSpeakerId={activeSpeakerId}
                  addressedAgentId={addressedAgentId}
                  activeThread={activeThread}
                  speechSlip={speechSlip}
                  isUserListening={sessionState === 'user_speaking'}
                  isUserProcessing={sessionState === 'processing_user'}
                  micOn={micOn}
                  onAddressAgent={addressAgent}
                  onMicToggle={handleMicToggle}
                  onBargeIn={handleBargeIn}
                />
              </div>

              {/* The Minutes Drawer */}
              <MinutesDrawer
                transcripts={transcripts}
                claims={claims}
                traces={traces}
                metrics={metrics}
                isOpen={isMinutesOpen}
                onToggle={() => setIsMinutesOpen(!isMinutesOpen)}
              />
            </section>
          )}

          {/* ============================================================ */}
          {/* SCREEN C: MOBILE SESSION (390px Viewport)                   */}
          {/* ============================================================ */}
          {currentScreen === 'C' && (
            <section className="screen-mobile-session" aria-label="Screen C: Mobile View">
              <div className="mobile-table-header">
                <span className="mobile-tag">Roundtable Session</span>
                <h2 className="mobile-title">{selectedTopic.title}</h2>
              </div>

              {/* Mobile Table Arc Representation */}
              <div className="mobile-arc-wrap">
                <RoundTable
                  topic={selectedTopic}
                  activeSpeakerId={activeSpeakerId}
                  addressedAgentId={addressedAgentId}
                  activeThread={activeThread}
                  speechSlip={speechSlip}
                  isUserListening={sessionState === 'user_speaking'}
                  isUserProcessing={sessionState === 'processing_user'}
                  micOn={micOn}
                  onAddressAgent={addressAgent}
                  onMicToggle={handleMicToggle}
                  onBargeIn={handleBargeIn}
                />
              </div>

              {/* Mobile Minutes Bottom Sheet */}
              <div className="mobile-minutes-sheet">
                <MinutesDrawer
                  transcripts={transcripts}
                  claims={claims}
                  traces={traces}
                  metrics={metrics}
                  isOpen={true}
                  onToggle={() => {}}
                />
              </div>
            </section>
          )}

          {/* ============================================================ */}
          {/* SCREEN D: INTERRUPTED / LISTENING STATE                     */}
          {/* ============================================================ */}
          {currentScreen === 'D' && (
            <section className="screen-interrupted-state container" aria-label="Screen D: Interrupted">
              <div className="interrupted-slip-banner paper-surface">
                <div className="banner-pin" aria-hidden="true" />
                <div className="banner-content">
                  <span className="banner-code">[S4: USER_SPEAKING &rarr; S5: PROCESSING_USER]</span>
                  <h2 className="banner-title">Mid-Sentence Spoken Interruption Detected</h2>
                  <p className="banner-desc">
                    Client VAD captured human speech. Prior agent playback halted in 118 ms; floor transferred to you.
                  </p>
                </div>
              </div>

              <div className="interrupted-table-view">
                <RoundTable
                  topic={selectedTopic}
                  activeSpeakerId={null}
                  addressedAgentId="oss_maintainer"
                  activeThread={{
                    from: 'human',
                    to: 'oss_maintainer',
                    summary: 'passing floor to Open-Source Maintainer',
                    ts: Date.now(),
                  }}
                  speechSlip={{
                    text: 'Wait, Maya, what specific security vulnerabilities are maintainers seeing from generated PRs?',
                    final: true,
                  }}
                  isUserListening={true}
                  isUserProcessing={false}
                  micOn={true}
                  onAddressAgent={addressAgent}
                  onMicToggle={handleMicToggle}
                  onBargeIn={handleBargeIn}
                />
              </div>
            </section>
          )}

          {/* ============================================================ */}
          {/* SCREEN E: ERROR & RECOVERY STATES                           */}
          {/* ============================================================ */}
          {currentScreen === 'E' && (
            <section className="screen-recovery-state container" aria-label="Screen E: Recovery">
              <header className="recovery-header">
                <h2 className="recovery-title">Resilience & Failure Recovery</h2>
                <p className="recovery-desc">
                  Honest error slips pinned to the table rim. Mocks and failures are transparently stated.
                </p>
              </header>

              <div className="slips-container">
                <Slip
                  notice={{
                    code: 'mic_denied',
                    level: 'error',
                    text: 'Microphone permission blocked. Enable browser mic access to speak or interrupt.',
                    recoverable: true,
                  }}
                  onRetry={() => alert('Requesting mic permissions…')}
                />
                <Slip
                  notice={{
                    code: 'disconnected',
                    level: 'warn',
                    text: 'Connection to gateway was lost. Attempting automatic reconnection…',
                    recoverable: true,
                  }}
                  onRetry={() => window.location.reload()}
                />
                <Slip
                  notice={{
                    code: 'agent_timeout',
                    level: 'warn',
                    text: 'AI Engineer response timed out (>4 s). Seat is marked Away; floor granted to Software Developer.',
                    recoverable: false,
                  }}
                />
              </div>

              <div className="recovery-table-preview">
                <RoundTable
                  topic={selectedTopic}
                  activeSpeakerId={null}
                  addressedAgentId={null}
                  activeThread={null}
                  speechSlip={null}
                  isUserListening={false}
                  isUserProcessing={false}
                  micOn={false}
                  onAddressAgent={addressAgent}
                  onMicToggle={handleMicToggle}
                  onBargeIn={handleBargeIn}
                />
              </div>
            </section>
          )}

          {/* ============================================================ */}
          {/* SCREEN F: ROUNDTABLE CONCLUDED                              */}
          {/* ============================================================ */}
          {currentScreen === 'F' && (
            <section className="screen-ended-state container" aria-label="Screen F: Ended">
              <div className="ended-panel paper-surface">
                <h2 className="ended-title">Roundtable Ended</h2>
                <p className="ended-desc">
                  Session closed (S8). Lights down, chairs pushed back, all audio streams and queues discarded.
                </p>
                <button
                  type="button"
                  className="start-new-btn"
                  onClick={() => {
                    setCurrentScreen('A')
                  }}
                >
                  Join Another Roundtable
                </button>
              </div>

              <div className="ended-minutes-wrap">
                <MinutesDrawer
                  transcripts={transcripts}
                  claims={claims}
                  traces={traces}
                  metrics={metrics}
                  isOpen={true}
                  onToggle={() => {}}
                />
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
          background: var(--room);
          background: radial-gradient(circle at 45% 45%, var(--room) 0%, var(--room-edge) 100%);
          color: var(--text);
        }
        .app-viewport {
          flex: 1;
          display: flex;
          flex-direction: column;
          width: 100%;
        }
        .table-room-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          position: relative;
        }

        .container {
          width: 100%;
          max-width: 1440px;
          margin: 0 auto;
          padding: 0 var(--space-4);
        }

        .notices-pinboard {
          padding-top: var(--space-3);
        }

        /* Screen A: Lobby */
        .screen-lobby {
          padding: var(--space-8) var(--space-4) var(--space-12);
        }
        .lobby-heading {
          text-align: center;
          margin-bottom: var(--space-8);
        }
        .lobby-badge {
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 600;
          color: var(--inlay-line);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          display: inline-block;
          margin-bottom: var(--space-2);
        }
        .lobby-title {
          font-family: var(--font-display);
          font-size: 40px;
          font-weight: 700;
          color: var(--text);
          margin-bottom: var(--space-2);
        }
        .lobby-desc {
          font-family: var(--font-body);
          font-size: 16px;
          color: var(--text-muted);
          max-width: 600px;
          margin: 0 auto;
          line-height: 1.5;
        }
        .lobby-tables-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: var(--space-6);
          margin-bottom: var(--space-8);
        }
        .table-inscription-panel {
          padding: var(--space-6);
          display: flex;
          justify-content: space-between;
          gap: var(--space-6);
          flex-wrap: wrap;
          align-items: center;
        }
        .inscription-meta {
          flex: 1;
          min-width: 300px;
        }
        .inscription-tag {
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 700;
          color: #7D6D5F;
          text-transform: uppercase;
        }
        .inscription-title {
          font-family: var(--font-display);
          font-size: 20px;
          font-weight: 700;
          color: var(--ink);
          margin: 2px 0 var(--space-2);
        }
        .inscription-background {
          font-family: var(--font-body);
          font-size: 14px;
          color: #4A3E36;
          margin-bottom: var(--space-3);
          line-height: 1.45;
        }
        .opening-quote-box {
          background: rgba(0, 0, 0, 0.04);
          border-left: 3px solid var(--inlay-line);
          padding: 8px 12px;
          margin-bottom: var(--space-3);
        }
        .quote-label {
          display: block;
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 700;
          color: #6C5B4E;
          text-transform: uppercase;
          margin-bottom: 2px;
        }
        .quote-text {
          font-family: var(--font-body);
          font-size: 13px;
          color: var(--ink);
          font-style: italic;
          margin: 0;
          line-height: 1.4;
        }
        .disclosure-slip {
          font-size: 12px;
          color: #4A3E36;
        }
        .inscription-cta-col {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }
        .join-roundtable-btn {
          font-family: var(--font-sans);
          font-size: 15px;
          font-weight: 700;
          background: var(--ink);
          color: var(--paper);
          padding: 12px 28px;
          border-radius: var(--radius-slip);
          transition: background var(--transition-fast), transform var(--transition-fast);
        }
        .join-roundtable-btn:hover {
          background: #362B24;
          transform: translateY(-2px);
        }
        .cta-note {
          font-family: var(--font-mono);
          font-size: 10px;
          color: #7D6D5F;
        }

        /* Screen B: Desktop Session */
        .screen-table-desktop {
          flex: 1;
          display: flex;
          height: calc(100vh - 80px);
          overflow: hidden;
        }
        .table-stage-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: auto;
          padding: var(--space-4);
        }
        .dev-gateway-controls {
          position: absolute;
          top: 12px;
          left: 16px;
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
          background: rgba(23, 18, 15, 0.85);
          border: 1px solid var(--wood-edge);
          padding: 6px 10px;
          border-radius: var(--radius-slip);
          z-index: 30;
        }
        .dev-tag {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 700;
          color: var(--inlay-line);
        }
        .dev-btn {
          font-family: var(--font-sans);
          font-size: 11px;
          font-weight: 600;
          background: #2A1F18;
          color: var(--text-muted);
          border: 1px solid var(--wood-edge);
          padding: 3px 8px;
          border-radius: var(--radius-slip);
        }
        .dev-btn:hover {
          color: var(--paper);
          border-color: var(--inlay-line);
        }

        /* Screen C: Mobile View */
        .simulated-mobile-wrap {
          background: #080605;
          align-items: center;
        }
        .mobile-frame {
          max-width: 390px !important;
          min-height: 844px;
          border: 4px solid var(--wood-edge);
          border-radius: 36px;
          margin: var(--space-4) auto;
          overflow: hidden;
          background: var(--room);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.9);
        }
        .screen-mobile-session {
          padding: var(--space-3);
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }
        .mobile-table-header {
          text-align: center;
        }
        .mobile-tag {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--inlay-line);
          text-transform: uppercase;
        }
        .mobile-title {
          font-family: var(--font-display);
          font-size: 16px;
          font-weight: 700;
          margin: 0;
        }
        .mobile-arc-wrap {
          transform: scale(0.5);
          transform-origin: top center;
          height: 380px;
          margin-bottom: -160px;
        }
        .mobile-minutes-sheet {
          flex: 1;
        }

        /* Screen D: Interrupted */
        .screen-interrupted-state {
          padding: var(--space-6) var(--space-4);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-6);
        }
        .interrupted-slip-banner {
          max-width: 600px;
          padding: var(--space-4);
          border-left: 4px solid var(--seat-1);
          display: flex;
          gap: 12px;
        }
        .banner-pin {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--seat-1);
          margin-top: 4px;
        }
        .banner-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .banner-code {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 700;
          color: #7D6D5F;
        }
        .banner-title {
          font-family: var(--font-display);
          font-size: 18px;
          font-weight: 700;
          color: var(--ink);
          margin: 0;
        }
        .banner-desc {
          font-family: var(--font-body);
          font-size: 13px;
          color: #4A3E36;
          margin: 0;
        }

        /* Screen E: Recovery */
        .screen-recovery-state {
          padding: var(--space-6) var(--space-4);
        }
        .recovery-header {
          text-align: center;
          margin-bottom: var(--space-4);
        }
        .recovery-title {
          font-family: var(--font-display);
          font-size: 28px;
          color: var(--text);
          margin-bottom: 4px;
        }
        .recovery-desc {
          font-family: var(--font-body);
          color: var(--text-muted);
          font-size: 14px;
        }
        .slips-container {
          max-width: 680px;
          margin: 0 auto var(--space-6);
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        /* Screen F: Ended */
        .screen-ended-state {
          padding: var(--space-8) var(--space-4);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-6);
        }
        .ended-panel {
          padding: var(--space-8);
          max-width: 500px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-3);
        }
        .ended-title {
          font-family: var(--font-display);
          font-size: 26px;
          font-weight: 700;
          color: var(--ink);
          margin: 0;
        }
        .ended-desc {
          font-family: var(--font-body);
          font-size: 14px;
          color: #4A3E36;
          margin: 0;
        }
        .start-new-btn {
          font-family: var(--font-sans);
          font-size: 14px;
          font-weight: 700;
          background: var(--ink);
          color: var(--paper);
          padding: 10px 22px;
          border-radius: var(--radius-slip);
          margin-top: var(--space-2);
        }
        .ended-minutes-wrap {
          width: 100%;
          max-width: 700px;
          height: 400px;
        }
      `}</style>
    </div>
  )
}

export default App
