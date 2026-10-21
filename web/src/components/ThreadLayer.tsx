import React from 'react'
import type { ActiveThread } from '../hooks/useGatewayWs'

interface ThreadLayerProps {
  thread: ActiveThread | null
  seatCoords: Record<string, { x: number; y: number }>
}

export const ThreadLayer: React.FC<ThreadLayerProps> = ({ thread, seatCoords }) => {
  if (!thread) return null

  const fromCoord = seatCoords[thread.from]
  const toCoord = seatCoords[thread.to]

  if (!fromCoord || !toCoord) return null

  // Midpoint for label
  const midX = (fromCoord.x + toCoord.x) / 2
  const midY = (fromCoord.y + toCoord.y) / 2

  return (
    <svg className="thread-layer-svg" aria-hidden="true">
      <line
        x1={fromCoord.x}
        y1={fromCoord.y}
        x2={toCoord.x}
        y2={toCoord.y}
        className="thread-line"
      />
      <circle cx={fromCoord.x} cy={fromCoord.y} r="4" className="thread-endpoint" />
      <circle cx={toCoord.x} cy={toCoord.y} r="4" className="thread-endpoint" />

      {/* Thread Summary Tag */}
      <g transform={`translate(${midX}, ${midY})`}>
        <rect
          x="-90"
          y="-11"
          width="180"
          height="22"
          rx="3"
          className="thread-tag-bg"
        />
        <text
          x="0"
          y="4"
          textAnchor="middle"
          className="thread-tag-text"
        >
          {thread.summary.length > 28 ? `${thread.summary.slice(0, 26)}…` : thread.summary}
        </text>
      </g>

      <style>{`
        .thread-layer-svg {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 10;
        }
        .thread-line {
          stroke: var(--inlay-line);
          stroke-width: 1.5;
          stroke-dasharray: 400;
          stroke-dashoffset: 400;
          animation: drawThread 600ms cubic-bezier(0.2, 0.8, 0.4, 1) forwards;
          opacity: 0.9;
        }
        @keyframes drawThread {
          to {
            stroke-dashoffset: 0;
          }
        }
        .thread-endpoint {
          fill: var(--inlay-line);
        }
        .thread-tag-bg {
          fill: var(--inlay);
          stroke: var(--inlay-line);
          stroke-width: 1;
        }
        .thread-tag-text {
          fill: var(--text);
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.02em;
        }
      `}</style>
    </svg>
  )
}
