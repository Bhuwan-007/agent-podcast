import React from 'react'
import type { TopicConfig } from '../types/protocol'

interface TableCardProps {
  topic: TopicConfig
  isSelected: boolean
  onSelect: () => void
}

export const TableCard: React.FC<TableCardProps> = ({
  topic,
  isSelected,
  onSelect,
}) => {
  const isAvailable = topic.available

  return (
    <div
      className={`table-card ${isSelected ? 'is-selected' : ''} ${!isAvailable ? 'is-closed' : ''}`}
      onClick={() => isAvailable && onSelect()}
      role={isAvailable ? 'button' : undefined}
      tabIndex={isAvailable ? 0 : undefined}
      onKeyDown={(e) => {
        if (isAvailable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onSelect()
        }
      }}
    >
      {/* Top-down mini table illustration */}
      <div className="mini-table-visual">
        <svg width="180" height="180" viewBox="0 0 180 180" className="mini-table-svg">
          {/* Table surface */}
          <circle cx="90" cy="90" r="65" fill="#18151C" stroke="#BE123C" strokeWidth="2" />
          <circle cx="90" cy="90" r="56" fill="none" stroke="#FB7185" strokeWidth="0.75" strokeDasharray="3 3" />
          <circle cx="90" cy="90" r="30" fill="#0C0A0E" stroke="#F43F5E" strokeWidth="1" />

          {/* Mini seats surrounding the table */}
          {/* Expert 1: Alex */}
          <circle cx="48" cy="54" r="8" fill="#F43F5E" stroke="#18151C" strokeWidth="1.5" />
          {/* Expert 2: Sam */}
          <circle cx="90" cy="36" r="8" fill="#FB7185" stroke="#18151C" strokeWidth="1.5" />
          {/* Expert 3: Maya */}
          <circle cx="132" cy="54" r="8" fill="#BE123C" stroke="#18151C" strokeWidth="1.5" />
          {/* You */}
          <circle cx="90" cy="144" r="8" fill="#FFF1F2" stroke="#18151C" strokeWidth="1.5" />
        </svg>

        {/* Cloth overlay if unavailable per doc 04 section 5 */}
        {!isAvailable && (
          <div className="closed-cloth-overlay">
            <span className="closed-slip paper-slip">Closed, in development</span>
          </div>
        )}
      </div>

      <div className="table-card-body">
        <div className="table-card-header">
          <span className="table-number">{topic.topic_id.replace('_', ' ').toUpperCase()}</span>
          {isAvailable ? (
            <span className="paper-slip available-slip">Open</span>
          ) : (
            <span className="paper-slip unavailable-slip">Unavailable</span>
          )}
        </div>

        <h3 className="table-title">{topic.title}</h3>
        <p className="table-brief">{topic.background}</p>

        {/* Roles list */}
        <div className="table-roles-list">
          <span className="roles-title">Seated Experts:</span>
          <div className="roles-row">
            {topic.agents.map((ag) => (
              <span key={ag.agent_id} className="role-badge">
                <strong>{ag.display_name}</strong> ({ag.role})
              </span>
            ))}
          </div>
        </div>

        <div className="table-select-action">
          <button
            type="button"
            disabled={!isAvailable}
            className={`join-table-btn ${isSelected ? 'btn-selected' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              if (isAvailable) onSelect()
            }}
          >
            {isAvailable ? (isSelected ? 'Table Selected' : 'Choose Table') : 'Closed'}
          </button>
        </div>
      </div>

      <style>{`
        .table-card {
          background: rgba(24, 20, 27, 0.88);
          border: 1px solid rgba(244, 63, 94, 0.25);
          border-radius: var(--radius-card);
          padding: var(--space-4);
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
          cursor: pointer;
          backdrop-filter: blur(16px);
          transition: border-color var(--transition-fast), transform var(--transition-fast);
          position: relative;
        }
        .table-card:hover:not(.is-closed) {
          border-color: #FB7185;
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(244, 63, 94, 0.25);
        }
        .table-card.is-selected {
          border-color: #F43F5E;
          box-shadow: 0 0 0 2px #F43F5E, 0 8px 30px rgba(244, 63, 94, 0.35);
          background: rgba(32, 26, 36, 0.95);
        }
        .table-card.is-closed {
          cursor: not-allowed;
          opacity: 0.65;
        }
        .mini-table-visual {
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          padding: var(--space-2) 0;
        }
        .closed-cloth-overlay {
          position: absolute;
          inset: 0;
          background: rgba(23, 18, 15, 0.7);
          backdrop-filter: grayscale(0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-card);
        }
        .closed-slip {
          font-family: var(--font-body);
          font-size: 12px;
          color: var(--ink);
        }
        .table-card-body {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
          flex: 1;
        }
        .table-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .table-number {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--text-muted);
          letter-spacing: 0.05em;
        }
        .available-slip {
          font-size: 11px;
          padding: 2px 6px;
        }
        .unavailable-slip {
          font-size: 11px;
          padding: 2px 6px;
          background: #D5C6AA;
          color: #6C5B4E;
        }
        .table-title {
          font-family: var(--font-display);
          font-size: 18px;
          font-weight: 700;
          color: var(--text);
          line-height: 1.3;
          margin: 0;
        }
        .table-brief {
          font-family: var(--font-body);
          font-size: 13px;
          color: var(--text-muted);
          line-height: 1.45;
          margin: 0;
        }
        .table-roles-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-top: auto;
          padding-top: var(--space-2);
        }
        .roles-title {
          font-family: var(--font-sans);
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
        }
        .roles-row {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }
        .role-badge {
          font-family: var(--font-sans);
          font-size: 11px;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid var(--wood-edge);
          padding: 2px 6px;
          border-radius: var(--radius-slip);
          color: var(--text-muted);
        }
        .role-badge strong {
          color: var(--text);
        }
        .table-select-action {
          margin-top: var(--space-2);
        }
        .join-table-btn {
          width: 100%;
          padding: 8px 14px;
          font-family: var(--font-sans);
          font-size: 13px;
          font-weight: 600;
          background: #2A1F18;
          color: var(--text);
          border: 1px solid var(--wood-edge);
          border-radius: var(--radius-slip);
          transition: background var(--transition-fast), border-color var(--transition-fast);
        }
        .join-table-btn:hover:not(:disabled) {
          background: var(--wood);
          border-color: var(--inlay-line);
        }
        .join-table-btn.btn-selected {
          background: var(--paper);
          color: var(--ink);
          border-color: var(--paper);
          font-weight: 700;
        }
      `}</style>
    </div>
  )
}
