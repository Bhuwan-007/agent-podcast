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
        return { code: 'S0', label: 'Room Ready', color: '#B3A18F' }
      case 'connecting':
        return { code: 'S1', label: 'Connecting…', color: '#D69E2E' }
      case 'waiting_first_speaker':
        return { code: 'S2', label: 'Table Convening…', color: '#D69E2E' }
      case 'agent_speaking':
        return {
          code: 'S3',
          label: activeSpeakerName ? `${activeSpeakerName} speaking` : 'Speaker active',
          color: '#FAF5EB',
          isSpeaking: true,
        }
      case 'user_speaking':
        return { code: 'S4', label: 'You have the floor', color: '#8CE6A8', isSpeaking: true }
      case 'processing_user':
        return { code: 'S5', label: 'Processing inquiry…', color: '#D69E2E' }
      case 'agent_generating':
        return { code: 'S6', label: 'Synthesizing voice…', color: '#D69E2E' }
      case 'recovery':
        return { code: 'S7', label: 'Degraded / Reconnecting', color: '#E06A66' }
      case 'ended':
        return { code: 'S8', label: 'Session Concluded', color: '#8A7563' }
      default:
        return { code: '', label: state, color: '#B3A18F' }
    }
  }

  const stateInfo = getStateInfo()

  return (
    <header className="broadcast-header">
      {/* Refined Mock Mode Top Telemetry Ribbon */}
      {mode === 'mock' && (
        <div className="telemetry-mock-ribbon" role="status" aria-label="Mock mode notice">
          <div className="ribbon-inner container">
            <span className="ribbon-indicator">
              <span className="ribbon-dot" />
              <strong>MOCK GATEWAY ACTIVE</strong>
            </span>
            <span className="ribbon-separator">•</span>
            <span className="ribbon-desc">
              Streaming golden protocol fixtures (contracts/ws_events.md) • 24kHz PCM WAV
            </span>
          </div>
        </div>
      )}

      <div className="header-main-bar container">
        {/* Brand & Broadcast Title */}
        <div className="brand-section">
          <div className="brand-emblem" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="10" stroke="#8A6A4B" />
              <circle cx="12" cy="12" r="5" stroke="#EADFC8" />
              <circle cx="12" cy="12" r="1.5" fill="#55DD88" />
            </svg>
          </div>

          <div className="brand-meta">
            <div className="brand-title-row">
              <span className="brand-name">ROUNDTABLE AI</span>
              <span className="on-air-pill">
                <span className="on-air-beacon" />
                ON AIR
              </span>
            </div>
            <span className="brand-subtitle">Real-Time Autonomous Voice Debate</span>
          </div>
        </div>

        {/* Right Status & Actions */}
        <div className="header-status-panel">
          {/* Connection telemetry indicator */}
          <div className="conn-status-pill" title={connected ? 'Connected to WebSocket Gateway' : 'Gateway Disconnected'}>
            <span className={`status-led ${connected ? 'led-online' : 'led-offline'}`} />
            <span className="conn-status-text">{connected ? 'Gateway Online' : 'Offline'}</span>
          </div>

          {/* Session State Badge */}
          <div className="session-state-badge" style={{ borderColor: stateInfo.isSpeaking ? '#8A6A4B' : 'rgba(138, 106, 75, 0.3)' }}>
            {stateInfo.isSpeaking && (
              <span className="soundwave-anim" aria-hidden="true">
                <span className="sw-bar" />
                <span className="sw-bar" />
                <span className="sw-bar" />
              </span>
            )}
            <span className="state-protocol-code">{stateInfo.code}</span>
            <span className="state-title" style={{ color: stateInfo.color }}>
              {stateInfo.label}
            </span>
          </div>

          {/* End Session Button */}
          {showEndButton && state !== 'ended' && (
            <button
              type="button"
              onClick={onEndSession}
              className="end-session-button"
              aria-label="End roundtable session"
            >
              Leave Room
            </button>
          )}
        </div>
      </div>

      <style>{`
        .broadcast-header {
          background: #100C0A;
          border-bottom: 1px solid rgba(138, 106, 75, 0.22);
          position: sticky;
          top: 0;
          z-index: 50;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.45);
        }

        /* Mock Telemetry Ribbon */
        .telemetry-mock-ribbon {
          background: rgba(30, 22, 17, 0.95);
          border-bottom: 1px solid rgba(214, 158, 46, 0.25);
          padding: 3px 0;
          font-family: var(--font-mono, monospace);
          font-size: 11px;
          color: #B3A18F;
          letter-spacing: 0.04em;
        }

        .ribbon-inner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .ribbon-indicator {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #D69E2E;
        }

        .ribbon-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #D69E2E;
          box-shadow: 0 0 6px rgba(214, 158, 46, 0.8);
          animation: ribbonPulse 1.8s ease-in-out infinite;
        }

        @keyframes ribbonPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }

        .ribbon-separator {
          color: rgba(138, 106, 75, 0.4);
        }

        .ribbon-desc {
          color: #8A7563;
        }

        /* Main Header Bar */
        .header-main-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 24px;
          gap: 16px;
        }

        .brand-section {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .brand-emblem {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          border-radius: 8px;
          background: rgba(42, 31, 25, 0.6);
          border: 1px solid rgba(138, 106, 75, 0.3);
        }

        .brand-meta {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .brand-title-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .brand-name {
          font-family: var(--font-display, 'Fraunces', serif);
          font-size: 19px;
          font-weight: 700;
          letter-spacing: 0.04em;
          color: #FAF5EB;
          line-height: 1.1;
        }

        .on-air-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 2px 7px;
          border-radius: 9999px;
          background: rgba(46, 92, 60, 0.35);
          border: 1px solid rgba(85, 221, 136, 0.4);
          font-family: var(--font-mono, monospace);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.08em;
          color: #8CE6A8;
        }

        .on-air-beacon {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #55DD88;
          box-shadow: 0 0 6px #55DD88;
          animation: onAirBlink 1.2s ease-in-out infinite;
        }

        @keyframes onAirBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        .brand-subtitle {
          font-family: var(--font-sans, system-ui);
          font-size: 11px;
          color: #8A7563;
          letter-spacing: 0.03em;
        }

        /* Status & Actions */
        .header-status-panel {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .conn-status-pill {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 9999px;
          background: rgba(23, 18, 15, 0.8);
          border: 1px solid rgba(138, 106, 75, 0.2);
          font-family: var(--font-mono, monospace);
          font-size: 11px;
          color: #B3A18F;
        }

        .status-led {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }

        .led-online {
          background: #55DD88;
          box-shadow: 0 0 6px rgba(85, 221, 136, 0.8);
        }

        .led-offline {
          background: #E06A66;
          box-shadow: 0 0 6px rgba(224, 106, 102, 0.8);
        }

        /* Session State Badge */
        .session-state-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 5px 12px;
          border-radius: 9999px;
          background: rgba(34, 25, 20, 0.9);
          border: 1px solid rgba(138, 106, 75, 0.35);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
          transition: border-color 200ms ease;
        }

        .soundwave-anim {
          display: flex;
          align-items: center;
          gap: 2px;
          height: 12px;
        }

        .sw-bar {
          width: 2px;
          height: 100%;
          background: #D69E2E;
          border-radius: 1px;
          animation: soundwave 1s ease-in-out infinite alternate;
        }

        .sw-bar:nth-child(2) {
          animation-delay: 0.25s;
          height: 65%;
        }

        .sw-bar:nth-child(3) {
          animation-delay: 0.5s;
          height: 80%;
        }

        @keyframes soundwave {
          0% { height: 30%; }
          100% { height: 100%; }
        }

        .state-protocol-code {
          font-family: var(--font-mono, monospace);
          font-size: 10px;
          font-weight: 700;
          color: #8A6A4B;
          background: rgba(138, 106, 75, 0.15);
          padding: 1px 5px;
          border-radius: 3px;
        }

        .state-title {
          font-family: var(--font-sans, system-ui);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.02em;
        }

        /* End Session Button */
        .end-session-button {
          font-family: var(--font-sans, system-ui);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          background: rgba(156, 74, 71, 0.12);
          color: #E0A09E;
          border: 1px solid rgba(156, 74, 71, 0.4);
          border-radius: 6px;
          padding: 6px 14px;
          cursor: pointer;
          transition: all 180ms ease;
        }

        .end-session-button:hover {
          background: rgba(156, 74, 71, 0.28);
          border-color: #E06A66;
          color: #FAF5EB;
        }

        @media (max-width: 768px) {
          .brand-subtitle, .conn-status-pill {
            display: none;
          }
          .ribbon-desc {
            display: none;
          }
        }
      `}</style>
    </header>
  )
}
