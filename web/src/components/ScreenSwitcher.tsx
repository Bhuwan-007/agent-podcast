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
    { id: 'A', label: 'Screen A: Lobby', desc: 'Choose a Roundtable' },
    { id: 'B', label: 'Screen B: 3D Session', desc: 'Live Roundtable Table' },
    { id: 'C', label: 'Screen C: Mobile', desc: '390px Mobile Viewport' },
    { id: 'D', label: 'Screen D: Interrupted', desc: 'Barge-In Demonstration' },
    { id: 'E', label: 'Screen E: Recovery', desc: 'Error Notices & Fallbacks' },
    { id: 'F', label: 'Screen F: Concluded', desc: 'Session Wrap & Download' },
  ]

  return (
    <nav className="switcher-root" aria-label="Development Screen Navigator">
      <div className="switcher-inner container">
        <div className="switcher-left">
          <span className="dev-tag">DEV STAGE</span>
          <div className="switcher-buttons">
            {screens.map((s) => (
              <button
                key={s.id}
                id={`screen-tab-${s.id.toLowerCase()}`}
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
        </div>

        <button
          type="button"
          className={`mobile-toggle-btn ${isMobilePreview ? 'active' : ''}`}
          onClick={onToggleMobilePreview}
          title="Toggle 390px mobile viewport preview"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
            <line x1="12" y1="18" x2="12.01" y2="18" />
          </svg>
          <span>{isMobilePreview ? 'Mobile: ON' : 'Mobile: OFF'}</span>
        </button>
      </div>

      <style>{`
        .switcher-root {
          background: #0B0807;
          border-bottom: 1px solid rgba(138, 106, 75, 0.15);
          padding: 4px 0;
          font-size: 11px;
          z-index: 60;
          position: sticky;
          top: 0;
        }
        .switcher-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          gap: 12px;
        }
        .switcher-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .dev-tag {
          font-family: var(--font-mono, monospace);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.1em;
          color: #8A6A4B;
          background: rgba(138, 106, 75, 0.12);
          padding: 2px 6px;
          border-radius: 3px;
        }
        .switcher-buttons {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .switcher-btn {
          padding: 3px 9px;
          border-radius: 4px;
          background: transparent;
          border: 1px solid transparent;
          color: #8A7563;
          font-family: var(--font-sans, system-ui);
          font-size: 11px;
          font-weight: 500;
          transition: all 140ms ease;
          cursor: pointer;
        }
        .switcher-btn:hover {
          color: #EADFC8;
          background: rgba(234, 223, 200, 0.05);
        }
        .switcher-btn.active {
          background: rgba(138, 106, 75, 0.22);
          color: #FAF5EB;
          border-color: rgba(138, 106, 75, 0.45);
          font-weight: 600;
        }
        .mobile-toggle-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 8px;
          border-radius: 4px;
          background: rgba(30, 22, 17, 0.6);
          border: 1px solid rgba(138, 106, 75, 0.25);
          color: #B3A18F;
          font-family: var(--font-mono, monospace);
          font-size: 10px;
          cursor: pointer;
        }
        .mobile-toggle-btn.active {
          border-color: #D69E2E;
          color: #D69E2E;
          background: rgba(214, 158, 46, 0.12);
        }
      `}</style>
    </nav>
  )
}
