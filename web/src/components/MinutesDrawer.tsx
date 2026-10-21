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
    <aside className={`minutes-drawer ${isOpen ? 'is-open' : 'is-closed'}`} aria-label="Meeting Minutes">
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
          position: fixed;
          top: 60px;
          right: 0;
          bottom: 0;
          width: min(440px, 92vw);
          background: rgba(18, 11, 32, 0.94);
          border-left: 1px solid rgba(168, 85, 247, 0.28);
          box-shadow: -16px 0 48px rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(28px);
          display: flex;
          flex-direction: column;
          z-index: 50;
          transition: transform 260ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .minutes-drawer.is-closed {
          transform: translateX(100%);
          pointer-events: none;
        }
        .minutes-drawer.is-open {
          transform: translateX(0);
          pointer-events: auto;
        }
        .drawer-header {
          padding: 14px 18px;
          border-bottom: 1px solid rgba(168, 85, 247, 0.2);
          display: flex;
          flex-direction: column;
          gap: 12px;
          background: rgba(24, 15, 42, 0.7);
        }
        .header-left {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .toggle-btn {
          color: #B8B0CC;
          display: flex;
          align-items: center;
          padding: 4px;
          border-radius: 6px;
          transition: all 160ms ease;
        }
        .toggle-btn:hover {
          color: #FDFCFE;
          background: rgba(168, 85, 247, 0.2);
        }
        .drawer-title {
          font-family: var(--font-sans);
          font-size: 16px;
          font-weight: 700;
          color: #FDFCFE;
          margin: 0;
          letter-spacing: 0.02em;
        }
        .tab-buttons {
          display: flex;
          gap: 6px;
          padding-bottom: 2px;
          overflow-x: auto;
        }
        .tab-btn {
          font-family: var(--font-sans);
          font-size: 11px;
          font-weight: 600;
          color: #B8B0CC;
          padding: 5px 10px;
          border-radius: 9999px;
          white-space: nowrap;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid transparent;
          transition: all 160ms ease;
        }
        .tab-btn:hover {
          color: #FDFCFE;
          border-color: rgba(168, 85, 247, 0.3);
        }
        .tab-active {
          background: #A855F7;
          color: #FFFFFF;
          border-color: #C084FC;
          box-shadow: 0 2px 10px rgba(168, 85, 247, 0.4);
        }
        .drawer-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }
        .empty-text {
          font-family: var(--font-sans);
          font-size: 13px;
          color: #7E7497;
          font-style: italic;
          text-align: center;
          padding: 32px 0;
        }
        .transcript-entries {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .transcript-entry {
          padding: 10px 14px;
          background: rgba(26, 17, 46, 0.6);
          border: 1px solid rgba(168, 85, 247, 0.18);
          border-radius: 8px;
        }
        .entry-draft {
          border-left: 3px solid #F43F5E;
          font-style: italic;
        }
        .entry-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }
        .entry-speaker {
          font-family: var(--font-sans);
          font-size: 12px;
          font-weight: 700;
          color: #F43F5E;
          text-transform: capitalize;
        }
        .entry-tags {
          display: flex;
          gap: 6px;
        }
        .draft-tag {
          font-family: var(--font-mono);
          font-size: 9px;
          background: rgba(244, 63, 94, 0.2);
          color: #FDA4AF;
          padding: 1px 6px;
          border-radius: 4px;
        }
        .entry-turn {
          font-family: var(--font-mono);
          font-size: 10px;
          color: #7E7497;
        }
        .entry-body {
          font-family: var(--font-sans);
          font-size: 13px;
          color: #FDFCFE;
          line-height: 1.5;
          margin: 0;
        }
        .claims-ledger-list {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .claim-entry {
          padding: 12px 14px;
          background: rgba(26, 17, 46, 0.6);
          border: 1px solid rgba(168, 85, 247, 0.18);
          border-radius: 8px;
        }
        .claim-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          margin-bottom: 6px;
          flex-wrap: wrap;
        }
        .claim-id {
          font-family: var(--font-mono);
          font-weight: 700;
          color: #C084FC;
        }
        .claim-speaker {
          font-family: var(--font-sans);
          font-weight: 600;
          color: #FDFCFE;
          text-transform: capitalize;
        }
        .claim-status-badge {
          background: rgba(168, 85, 247, 0.2);
          color: #E9D5FF;
          padding: 2px 6px;
          border-radius: 4px;
          font-family: var(--font-mono);
          font-size: 9px;
          text-transform: uppercase;
        }
        .verified-badge {
          background: #9333EA;
          color: #FFFFFF;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 9px;
          font-family: var(--font-mono);
          font-weight: 600;
        }
        .unverified-badge {
          background: rgba(225, 29, 72, 0.2);
          color: #FDA4AF;
          border: 1px solid rgba(225, 29, 72, 0.35);
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 9px;
          font-family: var(--font-mono);
        }
        .claim-quote {
          font-family: var(--font-sans);
          font-size: 12.5px;
          color: #E9D5FF;
          margin: 0;
          line-height: 1.45;
        }
        .trace-mono-list {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 8px;
          font-family: var(--font-mono);
          font-size: 11px;
        }
        .trace-row {
          padding: 8px 10px;
          background: rgba(26, 17, 46, 0.6);
          border: 1px solid rgba(168, 85, 247, 0.18);
          border-radius: 6px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .trace-time {
          font-size: 10px;
          color: #7E7497;
        }
        .trace-flow {
          font-weight: 600;
          color: #FDFCFE;
        }
        .trace-msgtype {
          color: #C084FC;
        }
        .trace-summary {
          color: #C8BEDE;
          word-break: break-word;
        }
        .metrics-mono-table {
          width: 100%;
          border-collapse: collapse;
          font-family: var(--font-mono);
          font-size: 11px;
        }
        .metrics-mono-table th {
          text-align: left;
          border-bottom: 1px solid rgba(168, 85, 247, 0.25);
          padding: 8px 6px;
          font-family: var(--font-sans);
          font-size: 11px;
          color: #B8B0CC;
        }
        .metrics-mono-table td {
          padding: 8px 6px;
          border-bottom: 1px solid rgba(168, 85, 247, 0.1);
        }
        .metrics-mono-table .val {
          font-weight: 700;
          color: #FDFCFE;
        }
        .metrics-mono-table .target {
          color: #C084FC;
          font-size: 10px;
        }
        .metrics-disclaimer {
          margin-top: 16px;
          font-family: var(--font-sans);
          font-size: 11px;
          color: #7E7497;
        }
      `}</style>
    </aside>
  )
}
