import React from 'react'

export type MicState = 'on' | 'off' | 'listening' | 'processing' | 'denied' | 'unavailable'

interface MicrophoneControlProps {
  state: MicState
  onToggle: () => void
  disabled?: boolean
}

export const MicrophoneControl: React.FC<MicrophoneControlProps> = ({
  state,
  onToggle,
  disabled = false,
}) => {
  const getMicInfo = () => {
    switch (state) {
      case 'listening':
        return {
          label: 'Listening — Speak to Interrupt',
          subtext: 'Your voice takes immediate priority over agents',
          className: 'mic-listening',
          iconColor: 'var(--color-success)',
        }
      case 'processing':
        return {
          label: 'Routing Your Question…',
          subtext: 'Matching target expert or addressing panel',
          className: 'mic-processing',
          iconColor: 'var(--color-accent)',
        }
      case 'denied':
        return {
          label: 'Microphone Permission Denied',
          subtext: 'Enable browser mic access to speak/interrupt',
          className: 'mic-denied',
          iconColor: 'var(--color-error)',
        }
      case 'unavailable':
        return {
          label: 'Microphone Unavailable',
          subtext: 'Audio input hardware not detected',
          className: 'mic-unavailable',
          iconColor: 'var(--color-error)',
        }
      case 'on':
        return {
          label: 'Mic Armed (VAD Active)',
          subtext: 'Speak anytime to interrupt',
          className: 'mic-armed',
          iconColor: 'var(--color-text)',
        }
      case 'off':
      default:
        return {
          label: 'Enable Mic to Interrupt',
          subtext: 'Click or press Space to enable voice participation',
          className: 'mic-off',
          iconColor: 'var(--color-text-dim)',
        }
    }
  }

  const info = getMicInfo()
  const isDenied = state === 'denied' || state === 'unavailable'

  return (
    <div className={`mic-control-root ${info.className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={onToggle}
        className="mic-action-btn"
        aria-label={`Microphone: ${info.label}`}
        title={info.label}
      >
        <div className="mic-icon-circle">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {isDenied ? (
              <>
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </>
            ) : (
              <>
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </>
            )}
          </svg>
        </div>

        <div className="mic-text-content">
          <span className="mic-primary-label">{info.label}</span>
          <span className="mic-subtext-label">{info.subtext}</span>
        </div>
      </button>

      <style>{`
        .mic-control-root {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-control);
          padding: var(--space-2) var(--space-3);
          transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
        }
        .mic-action-btn {
          width: 100%;
          display: flex;
          align-items: center;
          gap: var(--space-3);
          text-align: left;
        }
        .mic-icon-circle {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: var(--color-surface-elevated);
          border: 1px solid var(--color-border);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-text);
          flex-shrink: 0;
          transition: background var(--transition-fast), color var(--transition-fast);
        }
        .mic-listening .mic-icon-circle {
          background: rgba(86, 204, 157, 0.2);
          border-color: var(--color-success);
          color: var(--color-success);
          box-shadow: 0 0 12px rgba(86, 204, 157, 0.4);
        }
        .mic-processing .mic-icon-circle {
          background: rgba(181, 160, 255, 0.2);
          border-color: var(--color-accent);
          color: var(--color-accent);
        }
        .mic-denied .mic-icon-circle {
          background: rgba(255, 122, 138, 0.2);
          border-color: var(--color-error);
          color: var(--color-error);
        }
        .mic-text-content {
          display: flex;
          flex-direction: column;
        }
        .mic-primary-label {
          font-size: 14px;
          font-weight: 700;
          color: var(--color-text);
        }
        .mic-subtext-label {
          font-size: 12px;
          color: var(--color-text-dim);
        }
      `}</style>
    </div>
  )
}
