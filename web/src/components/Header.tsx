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
  const getStateLabel = () => {
    switch (state) {
      case 'ready':
        return { code: 'S0', label: 'Ready', class: 'badge-neutral' }
      case 'connecting':
        return { code: 'S1', label: 'Connecting…', class: 'badge-neutral' }
      case 'waiting_first_speaker':
        return { code: 'S2', label: 'Preparing first speaker', class: 'badge-neutral' }
      case 'agent_speaking':
        return {
          code: 'S3',
          label: activeSpeakerName ? `${activeSpeakerName} speaking` : 'Agent speaking',
          class: 'badge-live',
        }
      case 'user_speaking':
        return { code: 'S4', label: 'Listening to you', class: 'badge-live' }
      case 'processing_user':
        return { code: 'S5', label: 'Routing your input…', class: 'badge-neutral' }
      case 'agent_generating':
        return { code: 'S6', label: 'Synthesizing response…', class: 'badge-neutral' }
      case 'recovery':
        return { code: 'S7', label: 'Recovery / Degraded', class: 'badge-error' }
      case 'ended':
        return { code: 'S8', label: 'Session ended', class: 'badge-neutral' }
      default:
        return { code: '', label: state, class: 'badge-neutral' }
    }
  }

  const stateInfo = getStateLabel()

  return (
    <header className="header-root">
      {mode === 'mock' && (
        <aside className="mock-banner" role="status" aria-label="Mock mode warning">
          <span className="mock-pulse" />
          <strong>MOCK-DEV:</strong> Playing simulated gateway event fixtures.
        </aside>
      )}

      <div className="header-inner container">
        <div className="brand-group">
          <div className="brand-logo" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
              <path d="M2 12h20" />
            </svg>
          </div>
          <div>
            <h1 className="brand-title">ROUNDTABLE AI</h1>
            <span className="brand-subtitle">Real-Time Multi-Agent Voice Podcast</span>
          </div>
        </div>

        <div className="status-group">
          <div className="connection-indicator" title={connected ? 'Connected to gateway' : 'Offline'}>
            <span className={`status-dot ${connected ? 'dot-connected' : 'dot-disconnected'}`} />
            <span className="connection-text">{connected ? 'Gateway connected' : 'Disconnected'}</span>
          </div>

          <div className={`badge ${stateInfo.class}`} title={`Protocol State: ${stateInfo.code} (${state})`}>
            <span className="state-code">{stateInfo.code}</span>
            <span>{stateInfo.label}</span>
          </div>

          {showEndButton && state !== 'ended' && (
            <button
              onClick={onEndSession}
              className="end-session-btn"
              title="End roundtable session"
              aria-label="End session"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              </svg>
              End Session
            </button>
          )}
        </div>
      </div>

      <style>{`
        .header-root {
          background: var(--color-surface);
          border-bottom: 1px solid var(--color-border);
          position: sticky;
          top: 0;
          z-index: 50;
        }
        .mock-banner {
          background: #3B2A15;
          color: var(--color-warning);
          border-bottom: 1px solid var(--color-warning);
          padding: 6px var(--space-4);
          font-size: 13px;
          text-align: center;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-2);
        }
        .mock-pulse {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--color-warning);
          display: inline-block;
        }
        .header-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: var(--space-3);
          padding-bottom: var(--space-3);
          gap: var(--space-4);
        }
        .brand-group {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }
        .brand-logo {
          color: var(--color-accent);
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--color-surface-elevated);
          padding: var(--space-2);
          border-radius: var(--radius-sm);
          border: 1px solid var(--color-border);
        }
        .brand-title {
          font-size: 18px;
          font-weight: 700;
          letter-spacing: 0.05em;
          color: var(--color-text);
          margin: 0;
          line-height: 1.2;
        }
        .brand-subtitle {
          font-size: 11px;
          color: var(--color-text-dim);
          display: block;
        }
        .status-group {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }
        .connection-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--color-text-muted);
        }
        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .dot-connected {
          background: var(--color-success);
          box-shadow: 0 0 8px rgba(86, 204, 157, 0.6);
        }
        .dot-disconnected {
          background: var(--color-error);
        }
        .state-code {
          font-family: var(--font-mono);
          opacity: 0.7;
          margin-right: 4px;
        }
        .end-session-btn {
          background: rgba(255, 122, 138, 0.15);
          color: var(--color-error);
          border: 1px solid var(--color-error);
          padding: 6px 14px;
          border-radius: var(--radius-control);
          font-size: 13px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: background var(--transition-fast);
        }
        .end-session-btn:hover {
          background: rgba(255, 122, 138, 0.25);
        }
        @media (max-width: 640px) {
          .connection-text {
            display: none;
          }
          .brand-subtitle {
            display: none;
          }
          .brand-title {
            font-size: 15px;
          }
        }
      `}</style>
    </header>
  )
}
