import React from 'react'
import type { SessionStateName, SessionMode } from '../types/protocol'

interface HeaderProps {
  state: SessionStateName
  mode: SessionMode
  activeSpeakerName?: string
  connected: boolean
  onEndSession?: () => void
  showEndButton?: boolean
  isMinutesOpen?: boolean
  onToggleMinutes?: () => void
  minutesCount?: number
  isDevOpen?: boolean
  onToggleDev?: () => void
  micState?: 'on' | 'off' | 'denied' | 'unavailable'
  onToggleMic?: () => void
  onBargeIn?: () => void
  topicTitle?: string
}

export const Header: React.FC<HeaderProps> = ({
  state,
  mode,
  activeSpeakerName,
  connected,
  onEndSession,
  showEndButton = false,
  isMinutesOpen = false,
  onToggleMinutes,
  minutesCount = 0,
  isDevOpen = false,
  onToggleDev,
  micState = 'off',
  onToggleMic,
  onBargeIn,
  topicTitle,
}) => {
  const getStateInfo = () => {
    switch (state) {
      case 'ready':
        return { code: 'S0', label: 'Room Ready', color: '#B8B0CC' }
      case 'connecting':
        return { code: 'S1', label: 'Connecting…', color: '#C084FC' }
      case 'waiting_first_speaker':
        return { code: 'S2', label: 'Table Convening…', color: '#C084FC' }
      case 'agent_speaking':
        return {
          code: 'S3',
          label: activeSpeakerName ? `${activeSpeakerName} speaking` : 'Speaker active',
          color: '#FDFCFE',
          isSpeaking: true,
        }
      case 'user_speaking':
        return { code: 'S4', label: 'You have the floor', color: '#F43F5E', isSpeaking: true }
      case 'processing_user':
        return { code: 'S5', label: 'Processing inquiry…', color: '#C084FC' }
      case 'agent_generating':
        return { code: 'S6', label: 'Synthesizing voice…', color: '#C084FC' }
      case 'recovery':
        return { code: 'S7', label: 'Reconnecting…', color: '#E11D48' }
      case 'ended':
        return { code: 'S8', label: 'Session Concluded', color: '#7E7497' }
      default:
        return { code: '', label: state, color: '#B8B0CC' }
    }
  }

  const stateInfo = getStateInfo()

  return (
    <header className="broadcast-header">
      <div className="header-inner container">
        {/* Left: Brand Emblem & Title */}
        <div className="brand-section">
          <div className="brand-emblem" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#A855F7" strokeWidth="1.8" />
              <circle cx="12" cy="12" r="5" stroke="#F43F5E" strokeWidth="1.8" />
              <circle cx="12" cy="12" r="2" fill="#FF1493" />
            </svg>
          </div>

          <div className="brand-titles">
            <div className="brand-name-row">
              <span className="brand-name">ROUNDTABLE</span>
              <span className="live-badge">
                <span className="live-dot" />
                LIVE
              </span>
              {mode === 'mock' && <span className="mock-chip" title="Simulated gateway fixtures">MOCK</span>}
            </div>
            {topicTitle && <span className="topic-subtitle" title={topicTitle}>{topicTitle}</span>}
          </div>
        </div>

        {/* Center: Active Floor / State Status Badge */}
        <div className="header-center-status">
          <div className={`status-pill ${stateInfo.isSpeaking ? 'pill-speaking' : ''}`}>
            {stateInfo.isSpeaking && (
              <span className="voice-wave-bars" aria-hidden="true">
                <span className="bar" />
                <span className="bar" />
                <span className="bar" />
              </span>
            )}
            <span className="status-code">{stateInfo.code}</span>
            <span className="status-label" style={{ color: stateInfo.color }}>
              {stateInfo.label}
            </span>
          </div>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="header-right-panel">
          {/* Connection status */}
          <div className={`conn-indicator ${connected ? 'is-connected' : 'is-disconnected'}`} title={connected ? 'Gateway Connected' : 'Gateway Offline'}>
            <span className="conn-dot" />
            <span className="conn-label">{connected ? 'Online' : 'Offline'}</span>
          </div>

          {/* Mic Toggle Button */}
          {onToggleMic && (
            <button
              type="button"
              className={`action-btn mic-btn ${micState === 'on' ? 'mic-active' : ''}`}
              onClick={onToggleMic}
              title={micState === 'on' ? 'Mute microphone' : 'Unmute microphone'}
              aria-label="Toggle Microphone"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
              <span>{micState === 'on' ? 'Mic On' : 'Mic Off'}</span>
            </button>
          )}

          {/* Quick Interrupt Button */}
          {onBargeIn && state !== 'user_speaking' && (
            <button
              type="button"
              className="action-btn barge-btn"
              onClick={onBargeIn}
              title="Interrupt and speak now"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
              <span>Interrupt</span>
            </button>
          )}

          {/* Minutes Drawer Toggle */}
          {onToggleMinutes && (
            <button
              type="button"
              className={`action-btn minutes-toggle-btn ${isMinutesOpen ? 'active' : ''}`}
              onClick={onToggleMinutes}
              title="Toggle Meeting Minutes"
              aria-label="Toggle Minutes"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <span>Minutes</span>
              {minutesCount > 0 && <span className="counter-badge">{minutesCount}</span>}
            </button>
          )}

          {/* Dev Drawer Toggle (clean icon) */}
          {onToggleDev && (
            <button
              type="button"
              className={`action-btn dev-toggle-btn ${isDevOpen ? 'active' : ''}`}
              onClick={onToggleDev}
              title="Toggle Dev Gateway Controls"
              aria-label="Dev Controls"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </button>
          )}

          {/* End Session Button */}
          {showEndButton && state !== 'ended' && onEndSession && (
            <button
              type="button"
              onClick={onEndSession}
              className="action-btn leave-btn"
              aria-label="Leave roundtable"
            >
              Leave
            </button>
          )}
        </div>
      </div>

      <style>{`
        .broadcast-header {
          background: rgba(13, 9, 23, 0.88);
          border-bottom: 1px solid rgba(168, 85, 247, 0.22);
          position: sticky;
          top: 0;
          z-index: 50;
          height: 56px;
          display: flex;
          align-items: center;
          backdrop-filter: blur(20px);
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.6);
        }

        .header-inner {
          width: 100%;
          max-width: 1600px;
          margin: 0 auto;
          padding: 0 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        /* Brand */
        .brand-section {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }

        .brand-emblem {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: rgba(168, 85, 247, 0.12);
          border: 1px solid rgba(168, 85, 247, 0.3);
          border-radius: 8px;
        }

        .brand-titles {
          display: flex;
          flex-direction: column;
        }

        .brand-name-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .brand-name {
          font-family: var(--font-sans);
          font-size: 15px;
          font-weight: 800;
          letter-spacing: 0.08em;
          color: #FDFCFE;
        }

        .live-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: rgba(244, 63, 94, 0.18);
          border: 1px solid rgba(244, 63, 94, 0.4);
          color: #F43F5E;
          font-family: var(--font-sans);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.08em;
          padding: 1px 6px;
          border-radius: 9999px;
        }

        .live-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #F43F5E;
          box-shadow: 0 0 8px rgba(244, 63, 94, 0.9);
          animation: livePulse 1.4s ease-in-out infinite;
        }

        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.3); }
        }

        .mock-chip {
          font-family: var(--font-mono);
          font-size: 9px;
          font-weight: 700;
          background: rgba(192, 132, 252, 0.18);
          color: #C084FC;
          border: 1px solid rgba(192, 132, 252, 0.35);
          padding: 1px 5px;
          border-radius: 4px;
        }

        .topic-subtitle {
          font-family: var(--font-sans);
          font-size: 11px;
          color: #B8B0CC;
          max-width: 260px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* Center Status Badge */
        .header-center-status {
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 1;
        }

        .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 5px 14px;
          background: rgba(22, 14, 38, 0.8);
          border: 1px solid rgba(168, 85, 247, 0.25);
          border-radius: 9999px;
          transition: all 200ms ease;
        }

        .status-pill.pill-speaking {
          border-color: #F43F5E;
          box-shadow: 0 0 16px rgba(244, 63, 94, 0.35);
        }

        .status-code {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 700;
          color: #C084FC;
        }

        .status-label {
          font-family: var(--font-sans);
          font-size: 12px;
          font-weight: 600;
        }

        .voice-wave-bars {
          display: flex;
          align-items: flex-end;
          gap: 2px;
          height: 12px;
        }

        .voice-wave-bars .bar {
          width: 2px;
          background: #F43F5E;
          border-radius: 1px;
          animation: waveBar 0.8s ease-in-out infinite alternate;
        }

        .voice-wave-bars .bar:nth-child(1) { height: 6px; animation-delay: 0.1s; }
        .voice-wave-bars .bar:nth-child(2) { height: 12px; animation-delay: 0.3s; }
        .voice-wave-bars .bar:nth-child(3) { height: 8px; animation-delay: 0.2s; }

        @keyframes waveBar {
          0% { height: 4px; }
          100% { height: 12px; }
        }

        /* Right Panel */
        .header-right-panel {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }

        .conn-indicator {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-family: var(--font-sans);
          font-size: 11px;
          font-weight: 500;
          color: #B8B0CC;
        }

        .conn-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }

        .conn-indicator.is-connected .conn-dot {
          background: #C084FC;
          box-shadow: 0 0 6px rgba(192, 132, 252, 0.8);
        }

        .conn-indicator.is-disconnected .conn-dot {
          background: #E11D48;
        }

        .action-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-sans);
          font-size: 11px;
          font-weight: 600;
          padding: 6px 12px;
          border-radius: 9999px;
          border: 1px solid rgba(168, 85, 247, 0.28);
          background: rgba(22, 14, 38, 0.8);
          color: #FDFCFE;
          cursor: pointer;
          transition: all 160ms ease;
        }

        .action-btn:hover {
          background: rgba(168, 85, 247, 0.25);
          border-color: #C084FC;
          transform: translateY(-1px);
        }

        .mic-btn.mic-active {
          background: rgba(244, 63, 94, 0.2);
          border-color: #F43F5E;
          color: #FDFCFE;
        }

        .barge-btn {
          background: #E11D48;
          border-color: #F43F5E;
          color: #FFFFFF;
          box-shadow: 0 2px 10px rgba(225, 29, 72, 0.35);
        }

        .barge-btn:hover {
          background: #F43F5E;
        }

        .minutes-toggle-btn.active {
          background: #A855F7;
          border-color: #C084FC;
          color: #FFFFFF;
          box-shadow: 0 2px 10px rgba(168, 85, 247, 0.4);
        }

        .counter-badge {
          background: #F43F5E;
          color: #FFFFFF;
          font-size: 9px;
          font-weight: 700;
          padding: 1px 5px;
          border-radius: 9999px;
        }

        .dev-toggle-btn {
          padding: 6px 9px;
          color: #C084FC;
        }

        .dev-toggle-btn.active {
          background: rgba(192, 132, 252, 0.25);
          border-color: #C084FC;
        }

        .leave-btn {
          border-color: rgba(225, 29, 72, 0.35);
          color: #FDA4AF;
        }

        .leave-btn:hover {
          background: rgba(225, 29, 72, 0.25);
          color: #FFFFFF;
          border-color: #E11D48;
        }

        @media (max-width: 900px) {
          .header-center-status {
            display: none;
          }
          .topic-subtitle {
            display: none;
          }
        }

        @media (max-width: 600px) {
          .action-btn span {
            display: none;
          }
          .action-btn {
            padding: 6px 8px;
          }
          .brand-name {
            font-size: 13px;
          }
        }
      `}</style>
    </header>
  )
}
