import React from 'react'
import { NamePlate } from './NamePlate'
import { SpeechSlip } from './SpeechSlip'
import type { AgentConfig } from '../types/protocol'

interface SeatProps {
  agent: AgentConfig
  index: number
  x: number
  y: number
  centerX: number
  centerY: number
  isSpeaking: boolean
  isAddressed: boolean
  isInterrupted?: boolean
  speechSlip?: { text: string; final: boolean } | null
  onAddress: () => void
}

export const Seat: React.FC<SeatProps> = ({
  agent,
  index,
  x,
  y,
  centerX,
  centerY,
  isSpeaking,
  isAddressed,
  isInterrupted = false,
  speechSlip,
  onAddress,
}) => {
  // Determine expert seat color
  const seatColors = ['var(--seat-1)', 'var(--seat-2)', 'var(--seat-3)', 'var(--seat-4)']
  const seatColor = seatColors[index % seatColors.length]

  // Distinct geometric shape: 0: circle, 1: square, 2: diamond, 3: hexagon
  const shapeType = index % 4

  // Lean towards table center when speaking (~10px)
  const angleToCenter = Math.atan2(centerY - y, centerX - x)
  const leanOffset = isSpeaking ? 10 : 0
  const leanX = Math.cos(angleToCenter) * leanOffset
  const leanY = Math.sin(angleToCenter) * leanOffset

  const monogram = agent.display_name.charAt(0)

  return (
    <div
      className={`seat-root ${isSpeaking ? 'seat-speaking' : ''} ${isAddressed ? 'seat-addressed' : ''}`}
      style={{
        left: `${x + leanX}px`,
        top: `${y + leanY}px`,
      }}
    >
      {/* Top-down chair backrest arc and geometric seat cushion */}
      <div className="chair-visual">
        <svg width="68" height="68" viewBox="0 0 68 68" className="chair-svg">
          {/* Backrest curved arc */}
          <path
            d="M 10 34 A 24 24 0 0 1 58 34"
            fill="none"
            stroke={seatColor}
            strokeWidth="8"
            strokeLinecap="round"
            className="chair-backrest"
          />

          {/* Distinct geometric seat cushion */}
          {shapeType === 0 && (
            // Circle
            <circle cx="34" cy="36" r="18" fill="var(--room)" stroke={seatColor} strokeWidth="2.5" />
          )}
          {shapeType === 1 && (
            // Square
            <rect x="18" y="20" width="32" height="32" rx="4" fill="var(--room)" stroke={seatColor} strokeWidth="2.5" />
          )}
          {shapeType === 2 && (
            // Diamond
            <polygon points="34,16 52,34 34,52 16,34" fill="var(--room)" stroke={seatColor} strokeWidth="2.5" />
          )}
          {shapeType === 3 && (
            // Hexagon
            <polygon points="34,16 50,25 50,43 34,52 18,43 18,25" fill="var(--room)" stroke={seatColor} strokeWidth="2.5" />
          )}

          {/* Monogram in serif */}
          <text
            x="34"
            y="42"
            textAnchor="middle"
            fill="var(--text)"
            fontFamily="var(--font-display)"
            fontSize="18"
            fontWeight="700"
          >
            {monogram}
          </text>
        </svg>
      </div>

      {/* Name plate card */}
      <div className="plate-wrapper">
        <NamePlate
          agent={agent}
          isSpeaking={isSpeaking}
          isAddressed={isAddressed}
          isInterrupted={isInterrupted}
          onClick={onAddress}
        />
      </div>

      {/* Speech slip attached when speaking */}
      {isSpeaking && speechSlip && (
        <div className="speech-slip-wrapper">
          <SpeechSlip
            text={speechSlip.text}
            final={speechSlip.final}
            speakerName={agent.display_name}
          />
        </div>
      )}

      <style>{`
        .seat-root {
          position: absolute;
          transform: translate(-50%, -50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          transition: left var(--transition-lean), top var(--transition-lean);
          z-index: 5;
        }
        .seat-root.seat-speaking {
          z-index: 20;
        }
        .chair-visual {
          width: 68px;
          height: 68px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .plate-wrapper {
          position: relative;
        }
        .speech-slip-wrapper {
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          margin-top: 8px;
          z-index: 30;
          white-space: normal;
        }
      `}</style>
    </div>
  )
}
