import React, { useState } from 'react'
import { Header } from './components/Header'
import { CinematicTable } from './components/CinematicTable'
import { MinutesDrawer } from './components/MinutesDrawer'
import { TableCard } from './components/TableCard'
import { Slip } from './components/Slip'
import { TOPICS, DEFAULT_TOPIC } from './data/topics'
import { useGatewayWs } from './hooks/useGatewayWs'
import { EpisodeControls } from './components/EpisodeControls'

export const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<'A' | 'B' | 'F'>('B')
  const [selectedTopicId, setSelectedTopicId] = useState<string>(DEFAULT_TOPIC.topic_id)
  const [isMinutesOpen, setIsMinutesOpen] = useState<boolean>(false)
  const [isDevOpen, setIsDevOpen] = useState<boolean>(false)

  // Real WebSocket state from gateway/mock gateway
  const {
    connected,
    sessionState,
    sessionMode,
    sessionId,
    unlockAudio,
    stopLocalAudio,
    activeSpeakerId,
    addressedAgentId,
    activeThread,
    speechSlip,
    transcripts,
    claims,
    traces,
    metrics,
    notices,
    micState,
    micAudioLevel,
    speakerAudioLevel,
    startSession,
    bargeIn,
    addressAgent,
    sendUtterance,
    endSession,
    toggleMic,
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

  const handleBargeIn = () => {
    bargeIn()
  }

  return (
    <div className="app-root">
      {/* Sleek, Unified 56px Broadcast Header */}
      <Header
        state={sessionState}
        mode={sessionMode}
        activeSpeakerName={
          sessionState === 'user_speaking'
            ? 'You'
            : activeSpeakerDisplayName
        }
        connected={connected}
        showEndButton={currentScreen === 'B'}
        onEndSession={() => {
          endSession()
          setCurrentScreen('F')
        }}
        isMinutesOpen={isMinutesOpen}
        onToggleMinutes={() => setIsMinutesOpen(!isMinutesOpen)}
        minutesCount={transcripts.length + claims.length}
        isDevOpen={isDevOpen}
        onToggleDev={import.meta.env.DEV ? () => setIsDevOpen(!isDevOpen) : undefined}
        micState={micState}
        onToggleMic={toggleMic}
        onBargeIn={handleBargeIn}
        topicTitle={selectedTopic.title}
      />

      <EpisodeControls sessionId={sessionId} state={sessionState} onUnlock={unlockAudio}
        onStopAudio={stopLocalAudio} onStart={setup => {startSession('topic_1', setup); setCurrentScreen('B')}} />
      {/* Global Notices Pinboard */}
      {notices.length > 0 && (
        <aside className="notices-pinboard" aria-label="Notices">
          {notices.map((n, idx) => (
            <Slip
              key={`${n.code}-${idx}`}
              notice={n}
              onDismiss={() => dismissNotice(idx)}
              onRetry={() => {
                if (n.code === 'disconnected') window.location.reload()
              }}
              onAddressAgent={addressAgent}
            />
          ))}
        </aside>
      )}

      <main className="table-room-main">
        {/* ============================================================ */}
        {/* SCREEN A: LOBBY — CHOOSE A TABLE                             */}
        {/* ============================================================ */}
        {currentScreen === 'A' && (
          <section className="screen-lobby" aria-label="Screen A: Choose a table">
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
                <span className="inscription-tag">Selected Roundtable</span>
                <h3 className="inscription-title">{selectedTopic.title}</h3>
                <p className="inscription-background">{selectedTopic.background}</p>

                <div className="opening-quote-box">
                  <span className="quote-label">Opening prompt:</span>
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
        {/* SCREEN B: ACTIVE WIDESCREEN SESSION (100% Full Width)        */}
        {/* ============================================================ */}
        {currentScreen === 'B' && (
          <section className="screen-table-stage" aria-label="Screen B: Live Roundtable Table">
            {/* The Cinematic Voice-Focused Round Table covering full width and height */}
            <CinematicTable
              topic={selectedTopic}
              activeSpeakerId={activeSpeakerId}
              addressedAgentId={addressedAgentId}
              activeThread={activeThread}
              speechSlip={speechSlip}
              sessionState={sessionState}
              isUserListening={sessionState === 'user_speaking'}
              isUserProcessing={sessionState === 'processing_user'}
              micOn={micState === 'on'}
              speakerAudioLevel={speakerAudioLevel}
              micAudioLevel={micAudioLevel}
              onAddressAgent={addressAgent}
              onMicToggle={toggleMic}
              onBargeIn={handleBargeIn}
              onSendUtterance={sendUtterance}
            />

            {/* Slide-Over Meeting Minutes Drawer */}
            <MinutesDrawer
              transcripts={transcripts}
              claims={claims}
              traces={traces}
              metrics={metrics}
              isOpen={isMinutesOpen}
              onToggle={() => setIsMinutesOpen(!isMinutesOpen)}
            />

            {/* Floating Collapsible Dev Controls */}
            {isDevOpen && (
              <aside className="dev-floating-drawer" aria-label="Dev Gateway Triggers">
                <div className="dev-drawer-header">
                  <div className="dev-header-left">
                    <span className="dev-beacon" />
                    <span className="dev-drawer-title">⚡ PROTOCOL & GATEWAY DEV LAB</span>
                  </div>
                  <button
                    type="button"
                    className="dev-close-btn"
                    onClick={() => setIsDevOpen(false)}
                    aria-label="Close Dev Controls"
                  >
                    ✕
                  </button>
                </div>
                <div className="dev-buttons-row">
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
                </div>
              </aside>
            )}
          </section>
        )}

        {/* ============================================================ */}
        {/* SCREEN F: CONCLUDED SESSION                                  */}
        {/* ============================================================ */}
        {currentScreen === 'F' && (
          <section className="screen-ended-state" aria-label="Screen F: Session Concluded">
            <div className="ended-panel paper-surface">
              <span className="ended-badge">DEBATE ADJOURNED</span>
              <h2 className="ended-title">Roundtable Adjourned</h2>
              <p className="ended-desc">
                The autonomous participants have signed off on the discussion records.
                The full transcript, claims ledger, and timing telemetry are preserved below.
              </p>

              <button
                type="button"
                className="start-new-btn"
                onClick={() => setCurrentScreen('A')}
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

      <style>{`
        .app-root {
          min-height: 100vh;
          width: 100vw;
          display: flex;
          flex-direction: column;
          background: #090611;
          color: #FDFCFE;
          overflow-x: hidden;
        }

        .table-room-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          position: relative;
          height: calc(100vh - 56px);
          overflow: hidden;
        }

        .notices-pinboard {
          position: absolute;
          top: 64px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 45;
          display: flex;
          flex-direction: column;
          gap: 6px;
          max-width: 600px;
          width: calc(100% - 32px);
        }

        /* Screen A: Lobby */
        .screen-lobby {
          flex: 1;
          overflow-y: auto;
          padding: 40px 24px 60px;
          max-width: 1200px;
          margin: 0 auto;
          width: 100%;
        }

        .lobby-heading {
          text-align: center;
          margin-bottom: 36px;
        }

        .lobby-badge {
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 700;
          color: #FB7185;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          display: inline-block;
          margin-bottom: 8px;
        }

        .lobby-title {
          font-family: var(--font-sans);
          font-size: 38px;
          font-weight: 800;
          color: #FDFCFE;
          letter-spacing: -0.02em;
          margin-bottom: 8px;
        }

        .lobby-desc {
          font-family: var(--font-sans);
          font-size: 15px;
          color: #A8A29E;
          max-width: 620px;
          margin: 0 auto;
          line-height: 1.6;
        }

        .lobby-tables-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 20px;
          margin-bottom: 32px;
        }

        .table-inscription-panel {
          padding: 24px;
          display: flex;
          justify-content: space-between;
          gap: 24px;
          flex-wrap: wrap;
          align-items: center;
          background: rgba(24, 20, 27, 0.88);
          border: 1px solid rgba(244, 63, 94, 0.25);
          border-radius: 16px;
        }

        .inscription-meta {
          flex: 1;
          min-width: 300px;
        }

        .inscription-tag {
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 700;
          color: #FB7185;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .inscription-title {
          font-family: var(--font-sans);
          font-size: 22px;
          font-weight: 800;
          color: #FDFCFE;
          margin: 4px 0 10px;
        }

        .inscription-background {
          font-family: var(--font-sans);
          font-size: 14px;
          color: #A8A29E;
          margin-bottom: 14px;
          line-height: 1.5;
        }

        .opening-quote-box {
          background: rgba(244, 63, 94, 0.1);
          border-left: 3px solid #F43F5E;
          padding: 10px 14px;
          margin-bottom: 14px;
          border-radius: 0 8px 8px 0;
        }

        .quote-label {
          display: block;
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 700;
          color: #FB7185;
          text-transform: uppercase;
          margin-bottom: 4px;
        }

        .quote-text {
          font-family: var(--font-sans);
          font-size: 13.5px;
          color: #FDFCFE;
          font-style: italic;
          margin: 0;
          line-height: 1.45;
        }

        .disclosure-slip {
          font-size: 12px;
          color: #D6D3D1;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(244, 63, 94, 0.2);
          border-radius: 6px;
          padding: 6px 12px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .inscription-cta-col {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }

        .join-roundtable-btn {
          font-family: var(--font-sans);
          font-size: 15px;
          font-weight: 700;
          background: #E11D48;
          color: #FFFFFF;
          padding: 14px 32px;
          border-radius: 9999px;
          border: 1px solid #F43F5E;
          box-shadow: 0 4px 20px rgba(225, 29, 72, 0.45);
          transition: all 160ms ease;
        }

        .join-roundtable-btn:hover {
          background: #F43F5E;
          transform: translateY(-2px);
          box-shadow: 0 6px 24px rgba(244, 63, 94, 0.55);
        }

        .cta-note {
          font-family: var(--font-mono);
          font-size: 10px;
          color: #7E7497;
        }

        /* Screen B: Full Widescreen Stage */
        .screen-table-stage {
          position: absolute;
          inset: 0;
          width: 100vw;
          height: 100%;
          overflow: hidden;
        }

        /* Floating Dev Controls Drawer */
        .dev-floating-drawer {
          position: absolute;
          bottom: 16px;
          left: 50%;
          transform: translateX(-50%);
          width: min(960px, calc(100% - 32px));
          background: rgba(24, 20, 27, 0.95);
          border: 1px solid rgba(244, 63, 94, 0.35);
          border-radius: 14px;
          box-shadow: 0 16px 48px rgba(0, 0, 0, 0.9);
          backdrop-filter: blur(24px);
          padding: 12px 18px;
          z-index: 45;
          animation: slideUp 200ms ease-out;
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translate(-50%, 20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }

        .dev-drawer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
          padding-bottom: 6px;
          border-bottom: 1px solid rgba(244, 63, 94, 0.2);
        }

        .dev-header-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .dev-beacon {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #F43F5E;
          box-shadow: 0 0 8px rgba(244, 63, 94, 0.9);
        }

        .dev-drawer-title {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
          color: #FB7185;
        }

        .dev-close-btn {
          color: #A8A29E;
          font-size: 14px;
          padding: 2px 6px;
          border-radius: 4px;
          transition: all 140ms ease;
        }

        .dev-close-btn:hover {
          color: #FDFCFE;
          background: rgba(255, 255, 255, 0.1);
        }

        .dev-buttons-row {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }

        .dev-btn {
          font-family: var(--font-sans);
          font-size: 11px;
          font-weight: 600;
          background: rgba(32, 26, 36, 0.85);
          color: #D6D3D1;
          border: 1px solid rgba(244, 63, 94, 0.28);
          padding: 5px 10px;
          border-radius: 6px;
          transition: all 140ms ease;
        }

        .dev-btn:hover {
          color: #FFFFFF;
          border-color: #FB7185;
          background: rgba(244, 63, 94, 0.25);
        }

        /* Screen F: Ended State */
        .screen-ended-state {
          flex: 1;
          overflow-y: auto;
          padding: 40px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 24px;
        }

        .ended-panel {
          padding: 32px;
          max-width: 540px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          background: rgba(24, 20, 27, 0.92);
          border: 1px solid rgba(244, 63, 94, 0.3);
          border-radius: 16px;
        }

        .ended-badge {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.1em;
          color: #F43F5E;
          background: rgba(244, 63, 94, 0.15);
          padding: 2px 8px;
          border-radius: 9999px;
        }

        .ended-title {
          font-family: var(--font-sans);
          font-size: 26px;
          font-weight: 800;
          color: #FDFCFE;
          margin: 0;
        }

        .ended-desc {
          font-family: var(--font-sans);
          font-size: 14px;
          color: #A8A29E;
          margin: 0;
          line-height: 1.5;
        }

        .start-new-btn {
          font-family: var(--font-sans);
          font-size: 14px;
          font-weight: 700;
          background: #E11D48;
          color: #FFFFFF;
          padding: 10px 24px;
          border-radius: 9999px;
          border: 1px solid #F43F5E;
          margin-top: 8px;
          transition: all 160ms ease;
        }

        .start-new-btn:hover {
          background: #F43F5E;
          transform: translateY(-1px);
        }

        .ended-minutes-wrap {
          width: 100%;
          max-width: 800px;
          height: 480px;
          position: relative;
        }

        .ended-minutes-wrap .minutes-drawer {
          position: static;
          width: 100%;
          height: 100%;
          transform: none;
          border-radius: 16px;
          border: 1px solid rgba(244, 63, 94, 0.25);
        }
      `}</style>
    </div>
  )
}

export default App
