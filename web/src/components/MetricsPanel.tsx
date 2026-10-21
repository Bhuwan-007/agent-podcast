import React from 'react'
import type { MetricsState } from '../types/protocol'

interface MetricsPanelProps {
  metrics: MetricsState
}

export const MetricsPanel: React.FC<MetricsPanelProps> = ({ metrics }) => {
  const formatMetric = (val: number | null, unit = 'ms') => {
    if (val === null || val === undefined) {
      return { text: 'Unavailable', isAvailable: false }
    }
    return { text: `${Math.round(val)} ${unit}`, isAvailable: true }
  }

  const interrupt = formatMetric(metrics.interrupt_to_silence_ms)
  const userToAudio = formatMetric(metrics.user_question_to_first_audio_ms)
  const grantToAudio = formatMetric(metrics.grant_to_first_audio_ms)

  return (
    <div className="metrics-root" aria-label="Live Latency Metrics">
      <div className="metrics-header">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <span className="metrics-title">Client-Clock Latency Metrics</span>
      </div>

      <div className="metrics-grid">
        <div className="metric-box">
          <span className="metric-label">Barge-In to Silence</span>
          <span className={`metric-value ${interrupt.isAvailable ? 'val-available' : 'val-unavailable'}`}>
            {interrupt.text}
          </span>
          <span className="metric-target">Target: &lt;150 ms (demo &le;700ms)</span>
        </div>

        <div className="metric-box">
          <span className="metric-label">Question to First Audio</span>
          <span className={`metric-value ${userToAudio.isAvailable ? 'val-available' : 'val-unavailable'}`}>
            {userToAudio.text}
          </span>
          <span className="metric-target">Target: &lt;1.5 s (demo &le;4.0s)</span>
        </div>

        <div className="metric-box">
          <span className="metric-label">Grant to First Audio</span>
          <span className={`metric-value ${grantToAudio.isAvailable ? 'val-available' : 'val-unavailable'}`}>
            {grantToAudio.text}
          </span>
          <span className="metric-target">Target: &lt;1.2 s</span>
        </div>
      </div>

      <style>{`
        .metrics-root {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-card);
          padding: var(--space-3) var(--space-4);
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }
        .metrics-header {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          color: var(--color-accent);
          font-size: 13px;
          font-weight: 700;
        }
        .metrics-title {
          color: var(--color-text);
        }
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: var(--space-3);
        }
        .metric-box {
          background: var(--color-surface-elevated);
          border: 1px solid var(--color-border-subtle);
          border-radius: var(--radius-control);
          padding: var(--space-3);
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .metric-label {
          font-size: 11px;
          color: var(--color-text-dim);
          font-weight: 600;
          text-transform: uppercase;
        }
        .metric-value {
          font-family: var(--font-mono);
          font-size: 18px;
          font-weight: 700;
        }
        .val-available {
          color: var(--color-success);
        }
        .val-unavailable {
          color: var(--color-text-dim);
          font-style: italic;
          font-size: 14px;
        }
        .metric-target {
          font-size: 10px;
          color: var(--color-text-dim);
          margin-top: 4px;
        }
      `}</style>
    </div>
  )
}
