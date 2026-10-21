import React from 'react'
import type { AgentConfig } from '../types/protocol'

interface NamePlateProps {
  agent: AgentConfig
  isSpeaking: boolean
  isAddressed: boolean
  isInterrupted?: boolean
  onClick: () => void
}

export const NamePlate: React.FC<NamePlateProps> = ({
  agent,
  isSpeaking,
  isAddressed,
  isInterrupted = false,
  onClick,
}) => {
  return (
    <button
      type="button"
      className={`name-plate paper-surface ${isSpeaking ? 'plate-speaking' : ''} ${
        isAddressed ? 'plate-addressed' : ''
      }`}
      onClick={onClick}
      aria-label={`Address ${agent.display_name}, ${agent.role}`}
      title={`Click to address ${agent.display_name} (${agent.role})`}
    >
      <div className="plate-top">
        <span className="plate-name">{agent.display_name}</span>
        {isAddressed && <span className="plate-tag addressed-tag">Addressed</span>}
        {isInterrupted && <span className="plate-tag interrupted-tag">Interrupted</span>}
        {isSpeaking && !isInterrupted && (
          <span className="plate-tag speaking-tag">Speaking</span>
        )}
      </div>
      <div className="plate-role">{agent.role}</div>
      <div className="plate-voice">{agent.voice_label}</div>

      <style>{`
        .name-plate {
          width: 170px;
          padding: 8px 12px;
          text-align: left;
          display: flex;
          flex-direction: column;
          gap: 2px;
          transition: transform var(--transition-fast), border-color var(--transition-fast), box-shadow var(--transition-fast);
          cursor: pointer;
          user-select: none;
        }
        .name-plate:hover {
          border-color: var(--ink);
          transform: translateY(-2px);
        }
        .name-plate:focus-visible {
          outline: 2px solid var(--paper);
          outline-offset: 3px;
        }
        .plate-speaking {
          border-color: var(--wood-edge);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5), 0 0 0 1px var(--wood);
        }
        .plate-addressed {
          border-color: var(--inlay-line);
          box-shadow: 0 0 0 2px var(--inlay-line);
        }
        .plate-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .plate-name {
          font-family: var(--font-display);
          font-size: 15px;
          font-weight: 700;
          color: var(--ink);
          line-height: 1.2;
        }
        .plate-tag {
          font-family: var(--font-mono);
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          padding: 1px 5px;
          border-radius: var(--radius-slip);
          line-height: 1.2;
        }
        .speaking-tag {
          background: var(--ink);
          color: var(--paper);
        }
        .addressed-tag {
          background: var(--inlay-line);
          color: var(--paper);
        }
        .interrupted-tag {
          background: var(--seat-1);
          color: var(--paper);
        }
        .plate-role {
          font-family: var(--font-sans);
          font-size: 11px;
          font-weight: 600;
          color: #4A3E36;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .plate-voice {
          font-family: var(--font-sans);
          font-size: 10px;
          color: #7D6D5F;
        }
      `}</style>
    </button>
  )
}
