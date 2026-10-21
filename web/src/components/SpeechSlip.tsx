import React from 'react'

interface SpeechSlipProps {
  text: string
  final: boolean
  speakerName?: string
}

export const SpeechSlip: React.FC<SpeechSlipProps> = ({
  text,
  final,
  speakerName,
}) => {
  if (!text) return null

  return (
    <div className={`speech-slip paper-surface ${final ? 'slip-final' : 'slip-draft'}`} role="status">
      <div className="slip-pin" aria-hidden="true" />
      <div className="slip-content">
        {speakerName && <span className="slip-speaker">{speakerName}:</span>}
        <p className="slip-text">"{text}"</p>
      </div>
      {!final && <span className="draft-pill">draft</span>}

      <style>{`
        .speech-slip {
          padding: 8px 14px;
          border-radius: var(--radius-slip);
          max-width: 340px;
          display: flex;
          align-items: flex-start;
          gap: 8px;
          position: relative;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45);
          animation: slipFade 250ms ease-out;
        }
        @keyframes slipFade {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .slip-pin {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--inlay-line);
          margin-top: 6px;
          flex-shrink: 0;
          box-shadow: 0 1px 2px rgba(0,0,0,0.5);
        }
        .slip-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .slip-speaker {
          font-family: var(--font-display);
          font-size: 11px;
          font-weight: 700;
          color: #4A3E36;
          text-transform: uppercase;
        }
        .slip-text {
          font-family: var(--font-body);
          font-size: 14px;
          color: var(--ink);
          line-height: 1.4;
          margin: 0;
        }
        .slip-draft .slip-text {
          font-style: italic;
          color: #43372E;
        }
        .slip-final .slip-text {
          font-style: normal;
          color: var(--ink);
        }
        .draft-pill {
          font-family: var(--font-mono);
          font-size: 9px;
          text-transform: uppercase;
          background: rgba(0, 0, 0, 0.08);
          padding: 1px 5px;
          border-radius: var(--radius-slip);
          color: #6C5B4E;
          align-self: flex-start;
        }
      `}</style>
    </div>
  )
}
