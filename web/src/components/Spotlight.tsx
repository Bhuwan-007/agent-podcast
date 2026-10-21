import React from 'react'

interface SpotlightProps {
  x: number
  y: number
  active: boolean
}

export const Spotlight: React.FC<SpotlightProps> = ({ x, y, active }) => {
  if (!active) return null

  return (
    <div
      className="spotlight-pool"
      style={{
        left: `${x}px`,
        top: `${y}px`,
      }}
      aria-hidden="true"
    >
      <style>{`
        .spotlight-pool {
          position: absolute;
          width: 380px;
          height: 380px;
          border-radius: 50%;
          transform: translate(-50%, -50%);
          background: radial-gradient(circle, var(--light) 0%, rgba(255, 226, 170, 0.05) 55%, transparent 75%);
          pointer-events: none;
          z-index: 1;
          transition: opacity var(--transition-spotlight), transform var(--transition-spotlight);
          animation: poolFade 350ms ease-out;
        }
        @keyframes poolFade {
          from {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.9);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }
      `}</style>
    </div>
  )
}
