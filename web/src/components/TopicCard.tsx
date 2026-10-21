import React from 'react'
import type { TopicConfig } from '../types/protocol'

interface TopicCardProps {
  topic: TopicConfig
  isSelected: boolean
  onSelect: () => void
}

export const TopicCard: React.FC<TopicCardProps> = ({
  topic,
  isSelected,
  onSelect,
}) => {
  const isAvailable = topic.available

  return (
    <div
      className={`topic-card ${isSelected ? 'is-selected' : ''} ${!isAvailable ? 'is-unavailable' : ''}`}
      onClick={() => isAvailable && onSelect()}
      role={isAvailable ? 'button' : undefined}
      aria-disabled={!isAvailable}
      tabIndex={isAvailable ? 0 : undefined}
      onKeyDown={(e) => {
        if (isAvailable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onSelect()
        }
      }}
    >
      <div className="topic-header">
        <span className="topic-id">{topic.topic_id.toUpperCase()}</span>
        <span className={`badge ${isAvailable ? 'badge-live' : 'badge-neutral'}`}>
          {isAvailable ? 'Available' : 'Unavailable (In Dev)'}
        </span>
      </div>

      <h3 className="topic-title">{topic.title}</h3>
      <p className="topic-background">{topic.background}</p>

      <div className="topic-prompt-box">
        <span className="prompt-label">Opening prompt (verbatim):</span>
        <blockquote className="prompt-quote">
          "{topic.opening_prompt}"
        </blockquote>
      </div>

      <div className="topic-roles-preview">
        <span className="roles-label">Panel Experts:</span>
        <div className="roles-tags">
          {topic.agents.map((agent) => (
            <span key={agent.agent_id} className="role-tag">
              <strong>{agent.display_name}</strong> ({agent.role})
            </span>
          ))}
        </div>
      </div>

      <div className="topic-card-action">
        <button
          type="button"
          disabled={!isAvailable}
          className={`select-btn ${isSelected ? 'btn-active' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            if (isAvailable) onSelect()
          }}
        >
          {isAvailable ? (isSelected ? 'Selected' : 'Select Topic') : 'Not Available'}
        </button>
      </div>

      <style>{`
        .topic-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-card);
          padding: var(--space-6);
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
          transition: border-color var(--transition-fast), transform var(--transition-fast);
          cursor: pointer;
        }
        .topic-card:hover:not(.is-unavailable) {
          border-color: var(--color-accent);
          transform: translateY(-2px);
        }
        .topic-card.is-selected {
          border-color: var(--color-accent);
          box-shadow: 0 0 0 2px var(--color-accent);
          background: linear-gradient(180deg, var(--color-surface-elevated) 0%, var(--color-surface) 100%);
        }
        .topic-card.is-unavailable {
          opacity: 0.6;
          cursor: not-allowed;
          filter: grayscale(0.2);
        }
        .topic-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .topic-id {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--color-text-dim);
          letter-spacing: 0.05em;
        }
        .topic-title {
          font-size: 20px;
          font-weight: 700;
          color: var(--color-text);
          line-height: 1.3;
        }
        .topic-background {
          font-size: 14px;
          color: var(--color-text-muted);
          line-height: 1.5;
        }
        .topic-prompt-box {
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid var(--color-border-subtle);
          border-radius: var(--radius-control);
          padding: var(--space-3);
        }
        .prompt-label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          color: var(--color-accent);
          text-transform: uppercase;
          margin-bottom: var(--space-1);
        }
        .prompt-quote {
          font-size: 13px;
          color: var(--color-text);
          font-style: italic;
          line-height: 1.5;
          margin: 0;
        }
        .topic-roles-preview {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }
        .roles-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--color-text-dim);
        }
        .roles-tags {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
        }
        .role-tag {
          font-size: 12px;
          background: var(--color-surface-elevated);
          border: 1px solid var(--color-border);
          padding: 3px 8px;
          border-radius: var(--radius-sm);
          color: var(--color-text-muted);
        }
        .role-tag strong {
          color: var(--color-text);
        }
        .topic-card-action {
          margin-top: auto;
          padding-top: var(--space-2);
        }
        .select-btn {
          width: 100%;
          padding: 10px var(--space-4);
          background: var(--color-surface-elevated);
          color: var(--color-text);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-control);
          font-weight: 600;
          font-size: 14px;
          transition: background var(--transition-fast), border-color var(--transition-fast);
        }
        .select-btn:hover:not(:disabled) {
          background: var(--color-accent-subtle);
          border-color: var(--color-accent);
          color: var(--color-accent);
        }
        .select-btn.btn-active {
          background: var(--color-accent);
          color: #0b0e14;
          border-color: var(--color-accent);
        }
      `}</style>
    </div>
  )
}
