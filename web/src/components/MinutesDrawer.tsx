import React, { useState, useRef, useEffect } from 'react'
import type { TranscriptItem, Claim, TraceEvent, MetricsState } from '../types/protocol'

interface MinutesDrawerProps {
  transcripts: TranscriptItem[]
  claims: Claim[]
  traces: TraceEvent[]
  metrics: MetricsState
  isOpen: boolean
  onToggle: () => void
}

type TabId = 'transcript' | 'claims' | 'trace' | 'metrics'

export const MinutesDrawer: React.FC<MinutesDrawerProps> = ({
  transcripts,
  claims,
  traces,
  metrics,
  isOpen,
  onToggle,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('transcript')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (activeTab === 'transcript') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [transcripts, activeTab])

  const formatMetric = (val: number | null, unit = 'ms') => {
    if (val === null || val === undefined) {
      return 'Unavailable'
    }
    return `${Math.round(val)} ${unit}`
  }

  return (
    <aside className={`minutes-drawer paper-surface ${isOpen ? 'is-open' : 'is-closed'}`} aria-label="Meeting Minutes">
      <div className="drawer-header">
        <div className="header-left">
          <button type="button" onClick={onToggle} className="toggle-btn" aria-label="Toggle Minutes">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {isOpen ? (
                <polyline points="9 18 15 12 9 6" />
              ) : (
                <polyline points="15 18 9 12 15 6" />
              )}
            </svg>
          </button>
          <h3 className="drawer-title">The Minutes</h3>
        </div>

        <nav className="tab-buttons">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'transcript' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('transcript')}
          >
            Transcript ({transcripts.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'claims' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('claims')}
          >
            Claims ({claims.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'trace' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('trace')}
          >
            Trace ({traces.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'metrics' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('metrics')}
          >
            Metrics
          </button>
        </nav>
      </div>

      <div className="drawer-content">
        {/* TRANSCRIPT TAB */}
        {activeTab === 'transcript' && (
          <div className="tab-pane transcript-pane">
            {transcripts.length === 0 ? (
              <p className="empty-text">Awaiting discussion record…</p>
            ) : (
              <div className="transcript-entries">
                {transcripts.map((item) => {
                  const isHuman = item.speaker === 'human' || item.speaker === 'user'
                  return (
                    <article key={item.id} className={`transcript-entry ${!item.final ? 'entry-draft' : ''}`}>
                      <div className="entry-header">
                        <span className="entry-speaker">
                          {isHuman ? 'You' : item.speaker.replace('_', ' ')}
                        </span>
                        <div className="entry-tags">
                          {!item.final && <span className="entry-tag draft-tag">Draft</span>}
                          {item.turn_id && <span className="entry-turn">#{item.turn_id}</span>}
                        </div>
                      </div>
                      <p className="entry-body">{item.text}</p>
                    </article>
                  )
                })}
                <div ref={bottomRef} />
              </div>
            )}
          </div>
        )}

        {/* CLAIMS TAB */}
        {activeTab === 'claims' && (
          <div className="tab-pane claims-pane">
            {claims.length === 0 ? (
              <p className="empty-text">No claims formally entered yet.</p>
            ) : (
              <ul className="claims-ledger-list">
                {claims.map((claim) => (
                  <li key={claim.id} className="claim-entry">
                    <div className="claim-meta">
                      <span className="claim-id">{claim.id.toUpperCase()}</span>
                      <span className="claim-speaker">{claim.agent_id.replace('_', ' ')}</span>
                      <span className="claim-status-badge">{claim.status}</span>
                      {claim.verified ? (
                        <span className="verified-badge">✓ Verified by tool</span>
                      ) : (
                        <span className="unverified-badge">Claimed (Unverified)</span>
                      )}
                    </div>
                    <blockquote className="claim-quote">"{claim.text}"</blockquote>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* TRACE TAB */}
        {activeTab === 'trace' && (
          <div className="tab-pane trace-pane">
            {traces.length === 0 ? (
              <p className="empty-text">Awaiting A2A floor communication…</p>
            ) : (
              <ul className="trace-mono-list">
                {traces.map((trace, i) => (
                  <li key={i} className="trace-row">
                    <span className="trace-time">{trace.ts}</span>
                    <span className="trace-flow">
                      {trace.from} &rarr; {trace.to}
                    </span>
                    <span className="trace-msgtype">[{trace.msg_type}]</span>
                    <span className="trace-summary">{trace.summary}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* METRICS TAB */}
        {activeTab === 'metrics' && (
          <div className="tab-pane metrics-pane">
            <table className="metrics-mono-table">
              <thead>
                <tr>
                  <th>Client-Clock Metric</th>
                  <th>Observed</th>
                  <th>Target</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Barge-In to Silence</td>
                  <td className="val">{formatMetric(metrics.interrupt_to_silence_ms)}</td>
                  <td className="target">&lt;150 ms (demo &le;700 ms)</td>
                </tr>
                <tr>
                  <td>Question to First Audio</td>
                  <td className="val">{formatMetric(metrics.user_question_to_first_audio_ms)}</td>
                  <td className="target">&lt;1.5 s (demo &le;4.0 s)</td>
                </tr>
                <tr>
                  <td>Grant to First Audio</td>
                  <td className="val">{formatMetric(metrics.grant_to_first_audio_ms)}</td>
                  <td className="target">&lt;1.2 s</td>
                </tr>
              </tbody>
            </table>
            <p className="metrics-disclaimer">
              Measured from client <code>performance.now()</code>. Unavailable metrics are never faked as 0.
            </p>
          </div>
        )}
      </div>

      <style>{`
        .minutes-drawer {
          width: 380px;
          height: 100%;
          border-left: 1px solid var(--paper-shade);
          display: flex;
          flex-direction: column;
          z-index: 40;
          transition: transform var(--transition-fast);
        }
        .drawer-header {
          padding: var(--space-3) var(--space-4);
          border-bottom: 1px solid var(--paper-shade);
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }
        .header-left {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }
        .toggle-btn {
          color: var(--ink);
          display: flex;
          align-items: center;
        }
        .drawer-title {
          font-family: var(--font-display);
          font-size: 16px;
          font-weight: 700;
          color: var(--ink);
          margin: 0;
        }
        .tab-buttons {
          display: flex;
          gap: 4px;
          border-bottom: 1px solid var(--paper-shade);
          padding-bottom: 4px;
          overflow-x: auto;
        }
        .tab-btn {
          font-family: var(--font-sans);
          font-size: 12px;
          font-weight: 600;
          color: #6C5B4E;
          padding: 3px 8px;
          border-radius: var(--radius-slip);
          white-space: nowrap;
        }
        .tab-btn:hover {
          color: var(--ink);
        }
        .tab-active {
          background: var(--paper-shade);
          color: var(--ink);
        }
        .drawer-content {
          flex: 1;
          overflow-y: auto;
          padding: var(--space-4);
        }
        .empty-text {
          font-family: var(--font-body);
          font-size: 14px;
          color: #7D6D5F;
          font-style: italic;
          text-align: center;
          padding: var(--space-6) 0;
        }
        .transcript-entries {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }
        .transcript-entry {
          padding: var(--space-2) var(--space-3);
          background: rgba(0, 0, 0, 0.02);
          border-bottom: 1px solid var(--paper-shade);
        }
        .entry-draft {
          border-left: 2px dashed #8A6A4B;
          font-style: italic;
        }
        .entry-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2px;
        }
        .entry-speaker {
          font-family: var(--font-display);
          font-size: 13px;
          font-weight: 700;
          color: var(--ink);
          text-transform: capitalize;
        }
        .entry-tags {
          display: flex;
          gap: 4px;
        }
        .draft-tag {
          font-family: var(--font-mono);
          font-size: 9px;
          background: rgba(0,0,0,0.06);
          padding: 1px 4px;
          border-radius: 2px;
        }
        .entry-turn {
          font-family: var(--font-mono);
          font-size: 10px;
          color: #7D6D5F;
        }
        .entry-body {
          font-family: var(--font-body);
          font-size: 14px;
          color: var(--ink);
          line-height: 1.45;
          margin: 0;
        }
        .claims-ledger-list {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }
        .claim-entry {
          padding: var(--space-2) 0;
          border-bottom: 1px solid var(--paper-shade);
        }
        .claim-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          margin-bottom: 4px;
          flex-wrap: wrap;
        }
        .claim-id {
          font-family: var(--font-mono);
          font-weight: 700;
        }
        .claim-speaker {
          font-family: var(--font-sans);
          font-weight: 600;
          text-transform: capitalize;
        }
        .claim-status-badge {
          background: rgba(0, 0, 0, 0.06);
          padding: 1px 4px;
          border-radius: 2px;
          font-family: var(--font-mono);
          font-size: 9px;
          text-transform: uppercase;
        }
        .verified-badge {
          background: #4A6E53;
          color: #fff;
          padding: 1px 5px;
          border-radius: 2px;
          font-size: 9px;
          font-family: var(--font-mono);
        }
        .unverified-badge {
          background: rgba(0,0,0,0.05);
          color: #5E5045;
          padding: 1px 5px;
          border-radius: 2px;
          font-size: 9px;
          font-family: var(--font-mono);
        }
        .claim-quote {
          font-family: var(--font-body);
          font-size: 13px;
          color: var(--ink);
          margin: 0;
          line-height: 1.4;
        }
        .trace-mono-list {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-family: var(--font-mono);
          font-size: 11px;
        }
        .trace-row {
          padding: 4px 6px;
          background: rgba(0, 0, 0, 0.03);
          border-radius: 3px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .trace-time {
          font-size: 10px;
          color: #7D6D5F;
        }
        .trace-flow {
          font-weight: 600;
          color: var(--ink);
        }
        .trace-msgtype {
          color: #8A6A4B;
        }
        .trace-summary {
          color: #4A3E36;
          word-break: break-word;
        }
        .metrics-mono-table {
          width: 100%;
          border-collapse: collapse;
          font-family: var(--font-mono);
          font-size: 12px;
        }
        .metrics-mono-table th {
          text-align: left;
          border-bottom: 1px solid var(--paper-shade);
          padding: 6px 4px;
          font-family: var(--font-sans);
          font-size: 11px;
          color: #6C5B4E;
        }
        .metrics-mono-table td {
          padding: 6px 4px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.05);
        }
        .metrics-mono-table .val {
          font-weight: 700;
          color: var(--ink);
        }
        .metrics-mono-table .target {
          color: #7D6D5F;
          font-size: 10px;
        }
        .metrics-disclaimer {
          margin-top: var(--space-4);
          font-family: var(--font-sans);
          font-size: 11px;
          color: #7D6D5F;
        }
      `}</style>
    </aside>
  )
}
