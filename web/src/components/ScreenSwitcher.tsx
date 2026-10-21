import React from 'react'

export type ScreenId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F'

interface ScreenSwitcherProps {
  currentScreen: ScreenId
  onSelectScreen: (screen: ScreenId) => void
  isMobilePreview: boolean
  onToggleMobilePreview: () => void
}

export const ScreenSwitcher: React.FC<ScreenSwitcherProps> = ({
  currentScreen,
  onSelectScreen,
  isMobilePreview,
  onToggleMobilePreview,
}) => {
  const screens: { id: ScreenId; label: string; desc: string }[] = [
    { id: 'A', label: 'Screen A: Topic Select', desc: 'Lobby & Topic Selection' },
    { id: 'B', label: 'Screen B: Desktop Session', desc: '1440px Live Roundtable' },
    { id: 'C', label: 'Screen C: Mobile Session', desc: '390px Mobile Viewport' },
    { id: 'D', label: 'Screen D: Interrupted', desc: 'Barge-In / Listening State' },
    { id: 'E', label: 'Screen E: Recovery', desc: 'Error & Notice States' },
    { id: 'F', label: 'Screen F: Ended', desc: 'Session Concluded' },
  ]

  return (
    <nav className="switcher-root" aria-label="Development Screen Navigator">
      <div className="switcher-inner container">
        <span className="switcher-title">Screen Preview:</span>
        <div className="switcher-buttons">
          {screens.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`switcher-btn ${currentScreen === s.id ? 'active' : ''}`}
              onClick={() => {
                if (s.id === 'C' && !isMobilePreview) {
                  onToggleMobilePreview()
                } else if (s.id !== 'C' && isMobilePreview) {
                  onToggleMobilePreview()
                }
                onSelectScreen(s.id)
              }}
              title={s.desc}
            >
              {s.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          className={`mobile-toggle-btn ${isMobilePreview ? 'active' : ''}`}
          onClick={onToggleMobilePreview}
          title="Toggle 390px mobile simulation frame"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
            <line x1="12" y1="18" x2="12.01" y2="18" />
          </svg>
          <span>{isMobilePreview ? 'Mobile Frame: ON' : 'Mobile Frame: OFF'}</span>
        </button>
      </div>

      <style>{`
        .switcher-root {
          background: #171B26;
          border-bottom: 1px solid var(--color-border);
          padding: 6px 0;
          font-size: 12px;
          z-index: 60;
          position: sticky;
          top: 0;
        }
        .switcher-inner {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          flex-wrap: wrap;
          justify-content: space-between;
        }
        .switcher-title {
          font-weight: 700;
          color: var(--color-accent);
          font-family: var(--font-mono);
          text-transform: uppercase;
        }
        .switcher-buttons {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .switcher-btn {
          padding: 4px 10px;
          border-radius: var(--radius-sm);
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          color: var(--color-text-muted);
          font-size: 11px;
          font-weight: 600;
          transition: background var(--transition-fast), border-color var(--transition-fast);
        }
        .switcher-btn:hover {
          background: var(--color-surface-elevated);
          color: var(--color-text);
        }
        .switcher-btn.active {
          background: var(--color-accent);
          color: #0b0e14;
          border-color: var(--color-accent);
        }
        .mobile-toggle-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: var(--radius-sm);
          background: var(--color-surface-elevated);
          border: 1px solid var(--color-border);
          color: var(--color-text-dim);
          font-size: 11px;
          font-weight: 600;
        }
        .mobile-toggle-btn.active {
          border-color: var(--color-warning);
          color: var(--color-warning);
          background: var(--color-warning-subtle);
        }
      `}</style>
    </nav>
  )
}
