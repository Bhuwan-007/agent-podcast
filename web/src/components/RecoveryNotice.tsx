import React from 'react'
import type { Notice } from '../types/protocol'

interface RecoveryNoticeProps {
  notice: Notice
  onDismiss?: () => void
  onRetry?: () => void
}

export const RecoveryNotice: React.FC<RecoveryNoticeProps> = ({
  notice,
  onDismiss,
  onRetry,
}) => {
  const getLevelColor = () => {
    switch (notice.level) {
      case 'error':
        return {
          border: 'var(--color-error)',
          bg: 'var(--color-error-subtle)',
          text: 'var(--color-error)',
        }
      case 'warn':
        return {
          border: 'var(--color-warning)',
          bg: 'var(--color-warning-subtle)',
          text: 'var(--color-warning)',
        }
      case 'info':
      default:
        return {
          border: 'var(--color-info)',
          bg: 'rgba(112, 184, 255, 0.1)',
          text: 'var(--color-info)',
        }
    }
  }

  const colors = getLevelColor()

  return (
    <div
      className="notice-root"
      role="alert"
      style={{
        borderColor: colors.border,
        background: colors.bg,
      }}
    >
      <div className="notice-icon" style={{ color: colors.text }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>

      <div className="notice-body">
        <span className="notice-code" style={{ color: colors.text }}>
          {notice.code.toUpperCase()}
        </span>
        <p className="notice-text">{notice.text}</p>
      </div>

      <div className="notice-actions">
        {notice.recoverable && onRetry && (
          <button type="button" onClick={onRetry} className="notice-retry-btn">
            Retry
          </button>
        )}
        {onDismiss && (
          <button type="button" onClick={onDismiss} className="notice-dismiss-btn" aria-label="Dismiss notice">
            &times;
          </button>
        )}
      </div>

      <style>{`
        .notice-root {
          border: 1px solid;
          border-radius: var(--radius-control);
          padding: var(--space-3) var(--space-4);
          display: flex;
          align-items: center;
          gap: var(--space-3);
          margin-bottom: var(--space-3);
        }
        .notice-icon {
          flex-shrink: 0;
          display: flex;
          align-items: center;
        }
        .notice-body {
          flex: 1;
        }
        .notice-code {
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.05em;
          display: block;
          margin-bottom: 2px;
        }
        .notice-text {
          font-size: 13px;
          color: var(--color-text);
          line-height: 1.4;
        }
        .notice-actions {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          flex-shrink: 0;
        }
        .notice-retry-btn {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          color: var(--color-text);
          padding: 4px 10px;
          border-radius: var(--radius-sm);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .notice-retry-btn:hover {
          background: var(--color-surface-elevated);
        }
        .notice-dismiss-btn {
          font-size: 18px;
          color: var(--color-text-dim);
          padding: 0 4px;
          line-height: 1;
        }
        .notice-dismiss-btn:hover {
          color: var(--color-text);
        }
      `}</style>
    </div>
  )
}
