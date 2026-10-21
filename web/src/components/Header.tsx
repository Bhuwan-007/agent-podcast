import React from 'react'
import type { SessionStateName, SessionMode } from '../types/protocol'

interface HeaderProps {
  state: SessionStateName
  mode: SessionMode
  activeSpeakerName?: string
  connected: boolean
  onEndSession?: () => void
  showEndButton?: boolean
}

export const Header: React.FC<HeaderProps> = ({
  state,
  mode,
  activeSpeakerName,
  connected,
  onEndSession,
  showEndButton = false,
}) => {
  const getStateInfo = () => {
    switch (state) {
      case 'ready':
        return { code: 'S0', label: 'Table Ready', glyph: '○' }
      case 'connecting':
        return { code: 'S1', label: 'Joining roundtable…', glyph: '◌' }
      case 'waiting_first_speaker':
        return { code: 'S2', label: 'Preparing first perspective', glyph: '⋯' }
      case 'agent_speaking':
        return {
          code: 'S3',
          label: activeSpeakerName ? `${activeSpeakerName} is speaking` : 'Speaker active',
          glyph: '●',
        }
      case 'user_speaking':
        return { code: 'S4', label: 'Listening to you', glyph: '▲' }
      case 'processing_user':
        return { code: 'S5', label: 'Routing your inquiry…', glyph: '⟳' }
      case 'agent_generating':
        return { code: 'S6', label: 'Preparing response…', glyph: '⋯' }
      case 'recovery':
        return { code: 'S7', label: 'Recovery / Degraded', glyph: '!' }
      case 'ended':
        return { code: 'S8', label: 'Roundtable ended', glyph: '■' }
      default:
        return { code: '', label: state, glyph: '·' }
    }
  }

  const stateInfo = getStateInfo()

  return (
    <header className="room-header">
      {/* Persistent ink on brass Mock data banner per doc 04 section 8 */}
      {mode === 'mock' && (
        <div className="mock-brass-strip" role="status" aria-label="Mock mode warning">
          <span className="brass-pin" aria-hidden="true">◆</span>
          <span><strong>MOCK DATA</strong> — Replaying golden gateway fixtures (contracts/ws_events.md)</span>
        </div>
      )}

      <div className="header-bar container">
        <div className="brand-group">
          <h1 className="brand-title">Roundtable AI</h1>
          <span className="brand-pipe">|</span>
          <span className="brand-tagline">Real-Time Multi-Agent Voice Podcast</span>
        </div>

        <div className="header-status-group">
          {/* Connection status */}
          <div className="connection-glyph-wrap" title={connected ? 'Connected to gateway' : 'Disconnected'}>
            <span className={`conn-glyph ${connected ? 'conn-ok' : 'conn-down'}`} />
            <span className="conn-label">{connected ? 'Connected' : 'Offline'}</span>
          </div>

          {/* Session state paper plate */}
          <div className="state-plate paper-surface" title={`Protocol State: ${stateInfo.code} (${state})`}>
            <span className="state-code-glyph">{stateInfo.glyph}</span>
            <span className="state-code-num">{stateInfo.code}</span>
            <span className="state-label">{stateInfo.label}</span>
          </div>

          {/* End session button */}
          {showEndButton && state !== 'ended' && (
            <button
              type="button"
              onClick={onEndSession}
              className="end-table-btn"
              title="Leave roundtable and stop audio"
              aria-label="End roundtable session"
            >
              End Session
            </button>
          )}
        </div>
      </div>

      <style>{`
        .room-header {
          background: #140F0D;
          border-bottom: 1px solid var(--wood-edge);
          position: sticky;
          top: 0;
          z-index: 50;
        }
        .mock-brass-strip {
          background: #B8975A;
          color: #1C1612;
          font-family: var(--font-sans);
          font-size: 12px;
          font-weight: 600;
          padding: 4px var(--space-4);
          text-align: center;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          border-bottom: 1px solid #8A6A4B;
        }
        .brass-pin {
          font-size: 9px;
        }
        .header-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px var(--space-4);
          gap: var(--space-4);
        }
        .brand-group {
          display: flex;
          align-items: baseline;
          gap: var(--space-2);
        }
        .brand-title {
          font-family: var(--font-display);
          font-size: 21px;
          font-weight: 700;
          color: var(--text);
          letter-spacing: 0.02em;
          margin: 0;
          line-height: 1;
        }
        .brand-pipe {
          color: var(--wood-edge);
          font-size: 14px;
        }
        .brand-tagline {
          font-family: var(--font-body);
          font-size: 13px;
          color: var(--text-muted);
          font-style: italic;
        }
        .header-status-group {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }
        .connection-glyph-wrap {
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--text-muted);
        }
        .conn-glyph {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--inlay-line);
        }
        .conn-ok {
          background: #8A6A4B;
          box-shadow: 0 0 6px rgba(138, 106, 75, 0.5);
        }
        .conn-down {
          background: var(--seat-1);
        }
        .state-plate {
          padding: 4px 10px;
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--ink);
        }
        .state-code-glyph {
          font-size: 11px;
          color: #5A3F2E;
        }
        .state-code-num {
          font-family: var(--font-mono);
          font-weight: 700;
          color: #7D6D5F;
        }
        .state-label {
          font-family: var(--font-sans);
          font-weight: 600;
        }
        .end-table-btn {
          font-family: var(--font-sans);
          font-size: 12px;
          font-weight: 600;
          background: transparent;
          color: var(--text-muted);
          border: 1px solid var(--wood-edge);
          border-radius: var(--radius-slip);
          padding: 5px 12px;
          transition: border-color var(--transition-fast), color var(--transition-fast);
        }
        .end-table-btn:hover {
          border-color: var(--seat-1);
          color: var(--text);
        }
        @media (max-width: 640px) {
          .brand-tagline, .brand-pipe {
            display: none;
          }
          .conn-label {
            display: none;
          }
        }
      `}</style>
    </header>
  )
}
