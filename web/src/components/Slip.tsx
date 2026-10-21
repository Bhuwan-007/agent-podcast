import React from 'react'
import type { Notice } from '../types/protocol'

interface SlipProps {
  notice: Notice
  onDismiss?: () => void
  onRetry?: () => void
  onAddressAgent?: (agentId: string) => void
}

export const Slip: React.FC<SlipProps> = ({ notice, onDismiss, onRetry, onAddressAgent }) => {
  const isError = notice.level === 'error'

  return (
    <div className={`recovery-slip paper-surface ${isError ? 'slip-error' : 'slip-warn'}`} role="alert">
      <div className="slip-pin-metal" aria-hidden="true" />
      <div className="slip-glyph">
        {notice.code === 'mic_denied' && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        )}
        {notice.code === 'disconnected' && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
          </svg>
        )}
        {notice.code !== 'mic_denied' && notice.code !== 'disconnected' && (
          <span className="alert-glyph">!</span>
        )}
      </div>

      <div className="slip-message">
        <span className="slip-code">[{notice.code.replace('_', ' ')}]</span>
        <span className="slip-text">{notice.text}</span>

        {notice.code === 'unknown_target' && onAddressAgent && (
          <div className="slip-quick-targets">
            <span className="quick-label">Select:</span>
            <button
              type="button"
              className="quick-agent-btn"
              onClick={() => {
                onAddressAgent('ai_engineer')
                onDismiss?.()
              }}
            >
              Alex (AI Eng)
            </button>
            <button
              type="button"
              className="quick-agent-btn"
              onClick={() => {
                onAddressAgent('software_developer')
                onDismiss?.()
              }}
            >
              Sam (Dev)
            </button>
            <button
              type="button"
              className="quick-agent-btn"
              onClick={() => {
                onAddressAgent('oss_maintainer')
                onDismiss?.()
              }}
            >
              Maya (OSS)
            </button>
          </div>
        )}
      </div>

      <div className="slip-actions">
        {notice.recoverable && onRetry && (
          <button type="button" onClick={onRetry} className="slip-action-btn">
            Retry
          </button>
        )}
        {onDismiss && (
          <button type="button" onClick={onDismiss} className="slip-close-btn" aria-label="Dismiss">
            &times;
          </button>
        )}
      </div>

      <style>{`
        .recovery-slip {
          padding: 8px 14px;
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: var(--space-2);
          border-left: 4px solid var(--inlay-line);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        }
        .slip-error {
          border-left-color: var(--seat-1);
        }
        .slip-warn {
          border-left-color: var(--seat-2);
        }
        .slip-pin-metal {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #4A3E36;
          box-shadow: 0 1px 2px rgba(0,0,0,0.6);
          flex-shrink: 0;
        }
        .slip-glyph {
          color: var(--ink);
          display: flex;
          align-items: center;
        }
        .alert-glyph {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 16px;
        }
        .slip-message {
          flex: 1;
          display: flex;
          align-items: baseline;
          gap: 6px;
          flex-wrap: wrap;
        }
        .slip-code {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 700;
          color: #7D6D5F;
          text-transform: uppercase;
        }
        .slip-text {
          font-family: var(--font-body);
          font-size: 13px;
          color: var(--ink);
          line-height: 1.4;
        }
        .slip-actions {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .slip-action-btn {
          font-family: var(--font-sans);
          font-size: 11px;
          font-weight: 700;
          padding: 3px 8px;
          background: var(--paper-shade);
          color: var(--ink);
          border: 1px solid #B0A284;
          border-radius: var(--radius-slip);
        }
        .slip-action-btn:hover {
          background: #BFAF91;
        }
        .slip-quick-targets {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-left: 8px;
        }
        .quick-label {
          font-family: var(--font-sans);
          font-size: 11px;
          color: #7D6D5F;
          font-weight: 600;
        }
        .quick-agent-btn {
          font-family: var(--font-sans);
          font-size: 11px;
          font-weight: 600;
          padding: 2px 7px;
          background: rgba(234, 223, 200, 0.9);
          border: 1px solid #B0A284;
          border-radius: var(--radius-slip);
          color: var(--ink);
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .quick-agent-btn:hover {
          background: #D8CCA8;
          border-color: #8C7D6B;
        }
        .slip-close-btn {
          font-size: 16px;
          color: #7D6D5F;
          padding: 0 4px;
        }
        .slip-close-btn:hover {
          color: var(--ink);
        }
      `}</style>
    </div>
  )
}
