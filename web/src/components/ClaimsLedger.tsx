import React from 'react'
import type { Claim } from '../types/protocol'

interface ClaimsLedgerProps {
  claims: Claim[]
}

export const ClaimsLedger: React.FC<ClaimsLedgerProps> = ({ claims }) => {
  return (
    <div className="claims-root" aria-label="Active Roundtable Claims Ledger">
      <div className="claims-header">
        <div className="header-title-group">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <span className="claims-title">Claims Ledger</span>
        </div>
        <span className="claims-count">{claims.length} arguments tracked</span>
      </div>

      <div className="claims-body">
        {claims.length === 0 ? (
          <div className="claims-empty">
            <span>No formal claims recorded yet this session.</span>
          </div>
        ) : (
          <ul className="claims-list">
            {claims.map((claim) => (
              <li key={claim.id} className={`claim-card status-${claim.status}`}>
                <div className="claim-top">
                  <span className="claim-id">{claim.id.toUpperCase()}</span>
                  <span className="claim-agent">{claim.agent_id}</span>
                  <span className={`claim-status status-badge-${claim.status}`}>
                    {claim.status}
                  </span>
                  {claim.verified ? (
                    <span className="claim-verified-tag" title="Verified by tool observation">
                      VERIFIED
                    </span>
                  ) : (
                    <span className="claim-unverified-tag" title="Unverified assertion">
                      UNVERIFIED
                    </span>
                  )}
                </div>
                <p className="claim-text">"{claim.text}"</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <style>{`
        .claims-root {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-card);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .claims-header {
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
        .claims-title {
          font-size: 13px;
          font-weight: 700;
          color: var(--color-text);
          letter-spacing: 0.02em;
        }
        .claims-count {
          font-size: 11px;
          color: var(--color-text-dim);
        }
        .claims-body {
          padding: var(--space-3);
          max-height: 240px;
          overflow-y: auto;
        }
        .claims-empty {
          padding: var(--space-4);
          text-align: center;
          color: var(--color-text-dim);
          font-size: 13px;
        }
        .claims-list {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }
        .claim-card {
          background: var(--color-surface-elevated);
          border: 1px solid var(--color-border-subtle);
          border-radius: var(--radius-sm);
          padding: var(--space-3);
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .claim-top {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-size: 11px;
        }
        .claim-id {
          font-family: var(--font-mono);
          color: var(--color-text-dim);
          font-weight: 600;
        }
        .claim-agent {
          color: var(--color-accent);
          font-weight: 600;
          text-transform: capitalize;
        }
        .claim-status {
          margin-left: auto;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          padding: 1px 6px;
          border-radius: var(--radius-pill);
        }
        .status-badge-open {
          background: var(--color-surface);
          color: var(--color-info);
          border: 1px solid var(--color-info);
        }
        .status-badge-challenged {
          background: var(--color-warning-subtle);
          color: var(--color-warning);
          border: 1px solid var(--color-warning);
        }
        .status-badge-conceded {
          background: var(--color-surface);
          color: var(--color-text-dim);
        }
        .claim-verified-tag {
          font-size: 10px;
          font-weight: 700;
          color: var(--color-success);
          background: var(--color-success-subtle);
          padding: 1px 6px;
          border-radius: var(--radius-pill);
        }
        .claim-unverified-tag {
          font-size: 10px;
          font-weight: 600;
          color: var(--color-text-dim);
          background: rgba(255, 255, 255, 0.04);
          padding: 1px 6px;
          border-radius: var(--radius-pill);
        }
        .claim-text {
          font-size: 13px;
          color: var(--color-text);
          line-height: 1.4;
        }
      `}</style>
    </div>
  )
}
