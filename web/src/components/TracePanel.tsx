import React from 'react'
import type { TraceEvent } from '../types/protocol'

interface TracePanelProps {
  traces: TraceEvent[]
}

export const TracePanel: React.FC<TracePanelProps> = ({ traces }) => {
  return (
    <div className="trace-root" aria-label="A2A Agent Communication Trace">
      <div className="trace-header">
        <div className="header-title-group">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <span className="trace-title">A2A Protocol Traces</span>
        </div>
        <span className="trace-count">{traces.length} events logged</span>
      </div>

      <div className="trace-body">
        {traces.length === 0 ? (
          <div className="trace-empty">
            <span>Awaiting A2A floor coordination events (bids, grants, messages).</span>
          </div>
        ) : (
          <ul className="trace-list">
            {traces.map((trace, idx) => (
              <li key={`${trace.ts}-${idx}`} className="trace-item">
                <div className="trace-item-header">
                  <span className="trace-time">{trace.ts}</span>
                  <span className="trace-type">{trace.msg_type}</span>
                  <div className="trace-route">
                    <span className="trace-actor from">{trace.from}</span>
                    <span className="trace-arrow">→</span>
                    <span className="trace-actor to">{trace.to}</span>
                  </div>
                </div>
                <div className="trace-summary">{trace.summary}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <style>{`
        .trace-root {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-card);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .trace-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-3) var(--space-4);
          background: var(--color-surface-elevated);
          border-bottom: 1px solid var(--color-border);
        }
        .header-title-group {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          color: var(--color-accent);
        }
        .trace-title {
          font-size: 13px;
          font-weight: 700;
          color: var(--color-text);
          letter-spacing: 0.02em;
        }
        .trace-count {
          font-size: 11px;
          color: var(--color-text-dim);
        }
        .trace-body {
          padding: var(--space-3);
          max-height: 240px;
          overflow-y: auto;
          font-family: var(--font-mono);
        }
        .trace-empty {
          padding: var(--space-4);
          text-align: center;
          color: var(--color-text-dim);
          font-size: 12px;
        }
        .trace-list {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }
        .trace-item {
          background: var(--color-surface-elevated);
          border: 1px solid var(--color-border-subtle);
          border-radius: var(--radius-sm);
          padding: var(--space-2) var(--space-3);
          font-size: 12px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .trace-item-header {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          flex-wrap: wrap;
        }
        .trace-time {
          color: var(--color-text-dim);
          font-size: 10px;
        }
        .trace-type {
          color: var(--color-accent);
          font-weight: 600;
          font-size: 11px;
        }
        .trace-route {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
        }
        .trace-actor {
          color: var(--color-text);
          font-weight: 500;
        }
        .trace-arrow {
          color: var(--color-text-dim);
        }
        .trace-summary {
          color: var(--color-text-muted);
          font-size: 11px;
          word-break: break-word;
        }
      `}</style>
    </div>
  )
}
