import React from 'react'
import type { AgentConfig } from '../types/protocol'

export type ExpertStatus = 'idle' | 'listening' | 'speaking' | 'addressed' | 'unavailable'

interface ExpertCardProps {
  agent: AgentConfig
  status: ExpertStatus
  isTargeted?: boolean
  onClick?: () => void
}

export const ExpertCard: React.FC<ExpertCardProps> = ({
  agent,
  status,
  isTargeted = false,
  onClick,
}) => {
  const getRoleColor = () => {
    switch (agent.agent_id) {
      case 'ai_engineer':
        return 'var(--color-agent-ai)'
      case 'software_developer':
        return 'var(--color-agent-dev)'
      case 'oss_maintainer':
        return 'var(--color-agent-oss)'
      default:
        return 'var(--color-accent)'
    }
  }

  const roleColor = getRoleColor()

  const getStatusBadge = () => {
    switch (status) {
      case 'speaking':
        return (
          <span className="expert-badge badge-speaking" role="status">
            <span className="speaking-dot" />
            SPEAKING
          </span>
        )
      case 'addressed':
        return (
          <span className="expert-badge badge-addressed">
            ADDRESSED
          </span>
        )
      case 'listening':
        return <span className="expert-badge badge-listening">LISTENING</span>
      case 'unavailable':
        return <span className="expert-badge badge-unavailable">UNAVAILABLE</span>
      case 'idle':
      default:
        return <span className="expert-badge badge-idle">READY</span>
    }
  }

  const isSpeaking = status === 'speaking'

  return (
    <div
      className={`expert-card ${isSpeaking ? 'is-speaking' : ''} ${isTargeted ? 'is-targeted' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={`${agent.display_name}, ${agent.role}, status: ${status}`}
      style={{ '--agent-accent': roleColor } as React.CSSProperties}
    >
      <div className="card-top">
        <div className="avatar-wrapper">
          <div className="agent-avatar" style={{ background: roleColor }}>
            {agent.display_name.charAt(0)}
          </div>
          {isSpeaking && <span className="avatar-live-indicator" aria-hidden="true" />}
        </div>
        <div className="status-container">{getStatusBadge()}</div>
      </div>

      <div className="expert-meta">
        <h3 className="expert-name">{agent.display_name}</h3>
        <p className="expert-role">{agent.role}</p>
        <div className="expert-voice-tag" title={`Voice Profile: ${agent.voice_label}`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          </svg>
          <span>{agent.voice_label}</span>
        </div>
      </div>

      {agent.stance && (
        <p className="expert-stance" title={agent.stance}>
          "{agent.stance}"
        </p>
      )}

      <style>{`
        .expert-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-card);
          padding: var(--space-4);
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
          position: relative;
          transition: border-color var(--transition-fast), box-shadow var(--transition-fast), transform var(--transition-fast);
        }
        .expert-card:hover {
          border-color: var(--agent-accent);
        }
        .expert-card.is-speaking {
          border-color: var(--agent-accent);
          box-shadow: 0 0 20px rgba(181, 160, 255, 0.15), 0 0 0 2px var(--agent-accent);
          background: linear-gradient(180deg, var(--color-surface-elevated) 0%, var(--color-surface) 100%);
        }
        .expert-card.is-targeted {
          outline: 2px dashed var(--color-accent);
          outline-offset: 2px;
        }
        .card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .avatar-wrapper {
          position: relative;
        }
        .agent-avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          color: #0b0e14;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 18px;
          border: 2px solid var(--color-surface);
        }
        .avatar-live-indicator {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: var(--color-success);
          border: 2px solid var(--color-surface);
        }
        .expert-badge {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.05em;
          padding: 3px 8px;
          border-radius: var(--radius-pill);
          text-transform: uppercase;
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }
        .badge-speaking {
          background: rgba(86, 204, 157, 0.2);
          color: var(--color-success);
          border: 1px solid var(--color-success);
        }
        .speaking-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--color-success);
        }
        .badge-addressed {
          background: rgba(181, 160, 255, 0.2);
          color: var(--color-accent);
          border: 1px solid var(--color-accent);
        }
        .badge-listening {
          background: var(--color-surface-elevated);
          color: var(--color-text-dim);
          border: 1px solid var(--color-border);
        }
        .badge-idle {
          background: var(--color-surface-elevated);
          color: var(--color-text-muted);
          border: 1px solid var(--color-border);
        }
        .badge-unavailable {
          background: rgba(255, 122, 138, 0.1);
          color: var(--color-error);
          border: 1px solid var(--color-error);
        }
        .expert-name {
          font-size: 17px;
          font-weight: 700;
          color: var(--color-text);
          margin-bottom: 2px;
        }
        .expert-role {
          font-size: 13px;
          color: var(--agent-accent);
          font-weight: 600;
          margin-bottom: var(--space-1);
        }
        .expert-voice-tag {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: var(--color-text-dim);
          background: rgba(255, 255, 255, 0.04);
          padding: 2px 6px;
          border-radius: var(--radius-sm);
        }
        .expert-stance {
          font-size: 12px;
          color: var(--color-text-muted);
          font-style: italic;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          margin-top: auto;
          border-top: 1px solid var(--color-border-subtle);
          padding-top: var(--space-2);
        }
      `}</style>
    </div>
  )
}
