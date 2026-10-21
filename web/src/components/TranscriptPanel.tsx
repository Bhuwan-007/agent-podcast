import React, { useRef, useEffect } from 'react'
import type { TranscriptItem } from '../types/protocol'

interface TranscriptPanelProps {
  items: TranscriptItem[]
  currentSpeaker?: string
}

export const TranscriptPanel: React.FC<TranscriptPanelProps> = ({
  items,
  currentSpeaker,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [items])

  return (
    <div className="transcript-root" aria-label="Live Roundtable Transcript">
      <div className="transcript-header">
        <div className="header-left">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span className="transcript-title">Live Transcript</span>
        </div>
        <span className="transcript-badge">
          {items.length === 0 ? 'Awaiting dialogue' : `${items.length} turns`}
        </span>
      </div>

      <div className="transcript-scroll-area">
        {items.length === 0 ? (
          <div className="transcript-empty">
            <p>The panel discussion transcript will stream here in real time.</p>
            <span className="empty-subtext">Distinguishes live drafts from verified turns.</span>
          </div>
        ) : (
          <div className="transcript-list">
            {items.map((item) => {
              const isHuman = item.speaker === 'human' || item.speaker === 'user'
              const isPartial = !item.final
              const isCurrent = currentSpeaker === item.speaker

              return (
                <article
                  key={item.id}
                  className={`transcript-item ${isHuman ? 'item-human' : 'item-agent'} ${
                    isPartial ? 'item-partial' : 'item-final'
                  } ${isCurrent ? 'item-current' : ''}`}
                >
                  <div className="item-meta">
                    <span className="speaker-label">{item.speaker}</span>
                    <span className="item-tags">
                      {isPartial && <span className="tag-draft">DRAFT</span>}
                      {item.turn_id && <span className="tag-turn">Turn #{item.turn_id}</span>}
                    </span>
                  </div>

                  <p className="item-text">{item.text}</p>
                </article>
              )
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <style>{`
        .transcript-root {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-card);
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 380px;
          overflow: hidden;
        }
        .transcript-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-3) var(--space-4);
          background: var(--color-surface-elevated);
          border-bottom: 1px solid var(--color-border);
        }
        .header-left {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          color: var(--color-accent);
        }
        .transcript-title {
          font-size: 14px;
          font-weight: 700;
          color: var(--color-text);
          letter-spacing: 0.02em;
        }
        .transcript-badge {
          font-size: 11px;
          color: var(--color-text-dim);
          background: rgba(0, 0, 0, 0.2);
          padding: 2px 8px;
          border-radius: var(--radius-pill);
        }
        .transcript-scroll-area {
          flex: 1;
          overflow-y: auto;
          padding: var(--space-4);
        }
        .transcript-empty {
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: var(--color-text-dim);
          text-align: center;
          padding: var(--space-8);
          gap: var(--space-1);
        }
        .empty-subtext {
          font-size: 12px;
          color: var(--color-text-dim);
          opacity: 0.7;
        }
        .transcript-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }
        .transcript-item {
          padding: var(--space-3);
          border-radius: var(--radius-control);
          border: 1px solid var(--color-border);
          background: var(--color-surface-elevated);
          transition: border-color var(--transition-fast);
        }
        .item-human {
          border-color: var(--color-accent);
          background: rgba(181, 160, 255, 0.08);
          align-self: flex-end;
          width: 90%;
        }
        .item-agent {
          align-self: flex-start;
          width: 95%;
        }
        .item-partial {
          border-style: dashed;
          opacity: 0.85;
          font-style: italic;
        }
        .item-current {
          border-color: var(--color-success);
        }
        .item-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--space-1);
        }
        .speaker-label {
          font-size: 12px;
          font-weight: 700;
          color: var(--color-accent);
          text-transform: capitalize;
        }
        .item-tags {
          display: flex;
          gap: 4px;
        }
        .tag-draft {
          font-size: 10px;
          font-weight: 700;
          color: var(--color-warning);
          background: var(--color-warning-subtle);
          padding: 1px 6px;
          border-radius: var(--radius-pill);
        }
        .tag-turn {
          font-size: 10px;
          font-family: var(--font-mono);
          color: var(--color-text-dim);
        }
        .item-text {
          font-size: 14px;
          color: var(--color-text);
          line-height: 1.5;
        }
      `}</style>
    </div>
  )
}
