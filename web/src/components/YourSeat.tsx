import React from 'react'

interface YourSeatProps {
  x: number
  y: number
  isListening: boolean
  isProcessing: boolean
  isBlocked: boolean
  micOn: boolean
  micAudioLevel?: number
  onMicToggle: () => void
  onBargeIn: () => void
}

export const YourSeat: React.FC<YourSeatProps> = ({
  x,
  y,
  isListening,
  isProcessing,
  isBlocked,
  micOn,
  micAudioLevel = 0,
  onMicToggle,
  onBargeIn,
}) => {
  const getMicStatusText = () => {
    if (isBlocked) return 'Mic blocked'
    if (isListening) return 'Listening to you'
    if (isProcessing) return 'Routing question'
    if (micOn) return 'Mic armed'
    return 'Mic off'
  }

  const statusText = getMicStatusText()

  return (
    <div
      className={`your-seat-root ${isListening ? 'seat-listening' : ''}`}
      style={{
        left: `${x}px`,
        top: `${y}px`,
      }}
    >
      <div className="chair-visual">
        <svg width="68" height="68" viewBox="0 0 68 68">
          {/* Backrest curved arc for You (Ivory) */}
          <path
            d="M 10 34 A 24 24 0 0 0 58 34"
            fill="none"
            stroke="var(--you)"
            strokeWidth="7"
            strokeLinecap="round"
          />
          {/* Circular seat cushion */}
          <circle cx="34" cy="32" r="18" fill="var(--room)" stroke="var(--you)" strokeWidth="2.5" />
          {/* Desk mic glyph */}
          <g transform="translate(24, 22)">
            <path
              d="M10 2a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"
              fill={isListening ? 'var(--paper)' : 'none'}
              stroke="var(--you)"
              strokeWidth="1.5"
            />
            <path d="M16 8v2a6 6 0 0 1-12 0V8" fill="none" stroke="var(--you)" strokeWidth="1.5" />
            <line x1="10" y1="16" x2="10" y2="19" stroke="var(--you)" strokeWidth="1.5" />
          </g>
        </svg>
      </div>

      <div className="your-plate paper-surface">
        <div className="your-plate-top">
          <span className="your-label">YOU (Human Listener)</span>
          <div className="status-with-wave">
            {micOn && (
              <div className="mic-live-waveform" aria-hidden="true" title="Live mic audio input">
                <span className="wave-bar" style={{ height: `${Math.max(3, Math.min(18, micAudioLevel * 24 * 0.7))}px` }} />
                <span className="wave-bar" style={{ height: `${Math.max(3, Math.min(22, micAudioLevel * 28 * 1.1))}px` }} />
                <span className="wave-bar" style={{ height: `${Math.max(3, Math.min(24, micAudioLevel * 32 * 1.4))}px` }} />
                <span className="wave-bar" style={{ height: `${Math.max(3, Math.min(20, micAudioLevel * 26 * 0.9))}px` }} />
                <span className="wave-bar" style={{ height: `${Math.max(3, Math.min(16, micAudioLevel * 20 * 0.6))}px` }} />
              </div>
            )}
            <span className={`your-tag ${isListening ? 'tag-listening' : ''}`}>{statusText}</span>
          </div>
        </div>
        <div className="your-actions">
          <button
            type="button"
            className={`mic-toggle-btn ${micOn ? 'btn-on' : ''}`}
            onClick={onMicToggle}
            title="Toggle client microphone"
          >
            {micOn ? 'Mute' : 'Arm Mic'}
          </button>
          <button
            type="button"
            className="interrupt-btn"
            onClick={onBargeIn}
            title="Speak or push to interrupt current speaker mid-sentence"
          >
            Interrupt Now
          </button>
        </div>
      </div>

      <style>{`
        .your-seat-root {
          position: absolute;
          transform: translate(-50%, -50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          z-index: 15;
        }
        .your-plate {
          width: 210px;
          padding: 8px 12px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .your-plate-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .your-label {
          font-family: var(--font-display);
          font-size: 12px;
          font-weight: 700;
          color: var(--ink);
        }
        .status-with-wave {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .mic-live-waveform {
          display: flex;
          align-items: flex-end;
          gap: 2px;
          height: 16px;
          padding: 0 2px;
        }
        .wave-bar {
          width: 2.5px;
          background: #F43F5E;
          border-radius: 1px;
          transition: height 0.08s ease;
        }
        .your-tag {
          font-family: var(--font-mono);
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          background: rgba(244, 63, 94, 0.18);
          padding: 1px 5px;
          border-radius: var(--radius-slip);
          color: #FDA4AF;
        }
        .tag-listening {
          background: #F43F5E;
          color: #FFFFFF;
        }
        .your-actions {
          display: flex;
          gap: 6px;
        }
        .mic-toggle-btn {
          flex: 1;
          padding: 5px 8px;
          font-family: var(--font-sans);
          font-size: 11px;
          font-weight: 600;
          background: rgba(244, 63, 94, 0.2);
          color: #FDFCFE;
          border: 1px solid rgba(244, 63, 94, 0.35);
          border-radius: var(--radius-slip);
        }
        .mic-toggle-btn.btn-on {
          background: #E11D48;
          color: #FFFFFF;
          border-color: #FB7185;
        }
        .interrupt-btn {
          flex: 1.2;
          padding: 5px 8px;
          font-family: var(--font-sans);
          font-size: 11px;
          font-weight: 700;
          background: #E11D48;
          color: #FFFFFF;
          border: 1px solid #F43F5E;
          border-radius: var(--radius-slip);
          transition: background var(--transition-fast);
        }
        .interrupt-btn:hover {
          background: #F43F5E;
        }
      `}</style>
    </div>
  )
}
