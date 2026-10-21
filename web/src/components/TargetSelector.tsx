import React from 'react'
import type { AgentConfig } from '../types/protocol'

interface TargetSelectorProps {
  agents: AgentConfig[]
  selectedAgentId: string | null
  onSelectAgent: (agentId: string | null) => void
  disabled?: boolean
}

export const TargetSelector: React.FC<TargetSelectorProps> = ({
  agents,
  selectedAgentId,
  onSelectAgent,
  disabled = false,
}) => {
  return (
    <div className="target-selector-root" aria-label="Direct question to expert">
      <span className="selector-label">Direct Question To:</span>
      <div className="chips-row">
        <button
          type="button"
          disabled={disabled}
          className={`chip ${selectedAgentId === null ? 'chip-active' : ''}`}
          onClick={() => onSelectAgent(null)}
          aria-pressed={selectedAgentId === null}
        >
          Open Floor (All)
        </button>

        {agents.map((agent) => (
          <button
            key={agent.agent_id}
            type="button"
            disabled={disabled || !agent.available}
            className={`chip ${selectedAgentId === agent.agent_id ? 'chip-active' : ''}`}
            onClick={() => onSelectAgent(agent.agent_id)}
            aria-pressed={selectedAgentId === agent.agent_id}
          >
            {agent.display_name} <span className="chip-sub">({agent.role})</span>
          </button>
        ))}
      </div>

      <style>{`
        .target-selector-root {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          flex-wrap: wrap;
        }
        .selector-label {
          font-size: 13px;
          font-weight: 600;
          color: var(--color-text-dim);
          white-space: nowrap;
        }
        .chips-row {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          flex-wrap: wrap;
        }
        .chip {
          padding: 6px 12px;
          border-radius: var(--radius-pill);
          font-size: 13px;
          font-weight: 500;
          background: var(--color-surface-elevated);
          color: var(--color-text-muted);
          border: 1px solid var(--color-border);
          transition: background var(--transition-fast), border-color var(--transition-fast);
        }
        .chip:hover:not(:disabled) {
          border-color: var(--color-accent);
          color: var(--color-text);
        }
        .chip-active {
          background: var(--color-accent-subtle);
          color: var(--color-accent);
          border-color: var(--color-accent);
          font-weight: 600;
        }
        .chip-sub {
          font-size: 11px;
          opacity: 0.7;
        }
      `}</style>
    </div>
  )
}
