import React, { useState } from 'react'
import { Seat } from './Seat'
import { YourSeat } from './YourSeat'
import { Spotlight } from './Spotlight'
import { ThreadLayer } from './ThreadLayer'
import type { TopicConfig } from '../types/protocol'
import type { ActiveThread } from '../hooks/useGatewayWs'

interface RoundTableProps {
  topic: TopicConfig
  activeSpeakerId: string | null
  addressedAgentId: string | null
  activeThread: ActiveThread | null
  speechSlip: { text: string; final: boolean } | null
  isUserListening: boolean
  isUserProcessing: boolean
  micOn: boolean
  micAudioLevel?: number
  onAddressAgent: (agentId: string | null) => void
  onMicToggle: () => void
  onBargeIn: () => void
}

export const RoundTable: React.FC<RoundTableProps> = ({
  topic,
  activeSpeakerId,
  addressedAgentId,
  activeThread,
  speechSlip,
  isUserListening,
  isUserProcessing,
  micOn,
  micAudioLevel = 0,
  onAddressAgent,
  onMicToggle,
  onBargeIn,
}) => {
  const [showPromptInscription, setShowPromptInscription] = useState(false)

  // Geometry configuration
  const width = 760
  const height = 760
  const centerX = width / 2
  const centerY = height / 2
  const tableRadius = 265
  const seatRadius = 300

  // Calculate seat positions
  // Experts spread across top 200 degrees: 215 deg, 270 deg, 325 deg (radians)
  const expertAngles = [
    (215 * Math.PI) / 180,
    (270 * Math.PI) / 180,
    (325 * Math.PI) / 180,
    (345 * Math.PI) / 180, // fallback if 4th expert
  ]

  const expertCoords: Record<string, { x: number; y: number }> = {}

  topic.agents.forEach((agent, idx) => {
    const angle = expertAngles[idx % expertAngles.length]
    expertCoords[agent.agent_id] = {
      x: centerX + Math.cos(angle) * seatRadius,
      y: centerY + Math.sin(angle) * seatRadius,
    }
  })

  // You coordinate at 6 o'clock (90 deg)
  const youCoord = {
    x: centerX,
    y: centerY + seatRadius - 10,
  }

  // Consolidated coords for ThreadLayer
  const allSeatCoords: Record<string, { x: number; y: number }> = {
    ...expertCoords,
    human: youCoord,
    user: youCoord,
  }

  // Determine active speaker position for Spotlight
  let spotlightCoord: { x: number; y: number } | null = null
  if (isUserListening) {
    spotlightCoord = youCoord
  } else if (activeSpeakerId && expertCoords[activeSpeakerId]) {
    spotlightCoord = expertCoords[activeSpeakerId]
  }

  return (
    <div className="round-table-container" style={{ width: `${width}px`, height: `${height}px` }}>
      {/* Background Dim Layer when speaking */}
      <div className={`table-dim-layer ${(activeSpeakerId || isUserListening) ? 'is-dimmed' : ''}`} />

      {/* Spotlight Pool */}
      {spotlightCoord && (
        <Spotlight x={spotlightCoord.x} y={spotlightCoord.y} active={true} />
      )}

      {/* Data-driven thread layer between seats */}
      <ThreadLayer thread={activeThread} seatCoords={allSeatCoords} />

      {/* SVG Table Top */}
      <svg width={width} height={height} className="table-svg" aria-hidden="true">
        <defs>
          {/* Subtle two-tone wood linear gradient */}
          <linearGradient id="wood-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#5E4331" />
            <stop offset="100%" stopColor="#4C3425" />
          </linearGradient>

          {/* Inlay radial gradient */}
          <radialGradient id="inlay-gradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#2F231C" />
            <stop offset="100%" stopColor="#231A15" />
          </radialGradient>
        </defs>

        {/* Outer wood rim shadow */}
        <circle cx={centerX} cy={centerY} r={tableRadius + 8} fill="var(--room-edge)" opacity="0.6" />

        {/* Outer wood rim */}
        <circle
          cx={centerX}
          cy={centerY}
          r={tableRadius + 4}
          fill="var(--wood-edge)"
          stroke="var(--wood)"
          strokeWidth="1.5"
        />

        {/* Table Top Surface */}
        <circle
          cx={centerX}
          cy={centerY}
          r={tableRadius}
          fill="url(#wood-gradient)"
          stroke="var(--inlay-line)"
          strokeWidth="1.5"
        />

        {/* Engraved inlay line */}
        <circle
          cx={centerX}
          cy={centerY}
          r={tableRadius - 35}
          fill="none"
          stroke="var(--inlay-line)"
          strokeWidth="1"
          strokeDasharray="6 4"
          opacity="0.6"
        />

        {/* Table Center Topic Inlay Circle */}
        <circle
          cx={centerX}
          cy={centerY}
          r={135}
          fill="url(#inlay-gradient)"
          stroke="var(--inlay-line)"
          strokeWidth="1.5"
        />

        {/* Inner concentric ring */}
        <circle
          cx={centerX}
          cy={centerY}
          r={120}
          fill="none"
          stroke="var(--inlay-line)"
          strokeWidth="0.75"
          opacity="0.4"
        />
      </svg>

      {/* Table Center HTML Content (Topic Title & Inscription Toggle) */}
      <div
        className="table-center-content"
        style={{
          left: `${centerX}px`,
          top: `${centerY}px`,
        }}
      >
        <span className="inlay-tag">Topic Inlay</span>
        <h2 className="inlay-title">{topic.title}</h2>

        <button
          type="button"
          className="question-toggle-btn"
          onClick={() => setShowPromptInscription(!showPromptInscription)}
          aria-expanded={showPromptInscription}
        >
          {showPromptInscription ? 'Hide Question' : 'Read the Question'}
        </button>

        {showPromptInscription && (
          <div className="prompt-inscription-overlay paper-surface">
            <span className="inscription-header">Opening Inscription:</span>
            <p className="inscription-text">"{topic.opening_prompt}"</p>
          </div>
        )}
      </div>

      {/* Expert Seats */}
      {topic.agents.map((agent, idx) => {
        const coord = expertCoords[agent.agent_id]
        if (!coord) return null

        const isSpeaking = activeSpeakerId === agent.agent_id
        const isAddressed = addressedAgentId === agent.agent_id

        return (
          <Seat
            key={agent.agent_id}
            agent={agent}
            index={idx}
            x={coord.x}
            y={coord.y}
            centerX={centerX}
            centerY={centerY}
            isSpeaking={isSpeaking}
            isAddressed={isAddressed}
            speechSlip={isSpeaking ? speechSlip : null}
            onAddress={() =>
              onAddressAgent(addressedAgentId === agent.agent_id ? null : agent.agent_id)
            }
          />
        )
      })}

      {/* Your Seat at 6 o'clock */}
      <YourSeat
        x={youCoord.x}
        y={youCoord.y}
        isListening={isUserListening}
        isProcessing={isUserProcessing}
        isBlocked={false}
        micOn={micOn}
        micAudioLevel={micAudioLevel}
        onMicToggle={onMicToggle}
        onBargeIn={onBargeIn}
      />

      <style>{`
        .round-table-container {
          position: relative;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          user-select: none;
        }
        .table-dim-layer {
          position: absolute;
          inset: 0;
          background: rgba(14, 10, 8, 0.45);
          pointer-events: none;
          opacity: 0;
          transition: opacity var(--transition-dim);
          z-index: 2;
        }
        .table-dim-layer.is-dimmed {
          opacity: 1;
        }
        .table-svg {
          position: absolute;
          inset: 0;
          z-index: 1;
        }
        .table-center-content {
          position: absolute;
          transform: translate(-50%, -50%);
          width: 230px;
          text-align: center;
          z-index: 4;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }
        .inlay-tag {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.08em;
          color: var(--inlay-line);
          text-transform: uppercase;
        }
        .inlay-title {
          font-family: var(--font-display);
          font-size: 16px;
          font-weight: 700;
          color: var(--text);
          line-height: 1.35;
          margin: 0;
        }
        .question-toggle-btn {
          font-family: var(--font-sans);
          font-size: 11px;
          color: var(--text-muted);
          text-decoration: underline;
          text-underline-offset: 3px;
          padding: 2px 6px;
          transition: color var(--transition-fast);
        }
        .question-toggle-btn:hover {
          color: var(--paper);
        }
        .prompt-inscription-overlay {
          position: absolute;
          top: 110%;
          left: 50%;
          transform: translateX(-50%);
          width: 280px;
          padding: 10px 14px;
          text-align: left;
          z-index: 50;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
        }
        .inscription-header {
          font-family: var(--font-display);
          font-size: 11px;
          font-weight: 700;
          color: #4A3E36;
          text-transform: uppercase;
          display: block;
          margin-bottom: 4px;
        }
        .inscription-text {
          font-family: var(--font-body);
          font-size: 13px;
          color: var(--ink);
          font-style: italic;
          line-height: 1.45;
          margin: 0;
        }
      `}</style>
    </div>
  )
}
