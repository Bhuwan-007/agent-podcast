import React, { useState, useEffect, useRef } from 'react'
import { ThreeTableScene } from './ThreeTableScene'
import { RoundTable } from './RoundTable'
import { TypewriterText } from './TypewriterText'
import type { TopicConfig } from '../types/protocol'
import type { ActiveThread } from '../hooks/useGatewayWs'

interface CinematicTableProps {
  topic: TopicConfig
  activeSpeakerId: string | null
  addressedAgentId: string | null
  activeThread: ActiveThread | null
  speechSlip: { text: string; final: boolean } | null
  isUserListening: boolean
  isUserProcessing: boolean
  micOn: boolean
  speakerAudioLevel?: number
  micAudioLevel?: number
  onAddressAgent: (agentId: string | null) => void
  onMicToggle: () => void
  onBargeIn: () => void
}

export const CinematicTable: React.FC<CinematicTableProps> = ({
  topic,
  activeSpeakerId,
  addressedAgentId,
  activeThread,
  speechSlip,
  isUserListening,
  isUserProcessing,
  micOn,
  speakerAudioLevel = 0,
  micAudioLevel = 0,
  onAddressAgent,
  onMicToggle,
  onBargeIn,
}) => {
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d')
  const [hoveredAgentId, setHoveredAgentId] = useState<string | null>(null)
  const [audioOnline, setAudioOnline] = useState<boolean>(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Web Audio Studio Engine
  const audioCtxRef = useRef<AudioContext | null>(null)
  const droneGainRef = useRef<GainNode | null>(null)

  const toggleStudioAudio = () => {
    try {
      if (!audioCtxRef.current) {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        const ctx = new AudioContextClass()
        audioCtxRef.current = ctx

        // Low warm studio room tone drone
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = 55

        const filter = ctx.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.value = 180

        const gain = ctx.createGain()
        gain.gain.value = 0.08
        droneGainRef.current = gain

        osc.connect(filter)
        filter.connect(gain)
        gain.connect(ctx.destination)
        osc.start()

        setAudioOnline(true)
      } else {
        if (audioCtxRef.current.state === 'running') {
          audioCtxRef.current.suspend()
          setAudioOnline(false)
        } else {
          audioCtxRef.current.resume()
          setAudioOnline(true)
        }
      }
    } catch (e) {
      console.warn('Audio engine initialization error:', e)
    }
  }

  const playClickChime = () => {
    if (!audioCtxRef.current || audioCtxRef.current.state !== 'running') return
    try {
      const ctx = audioCtxRef.current
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(640, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.08)
      gain.gain.setValueAtTime(0.12, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.08)
    } catch {
      // Ignore audio chime errors
    }
  }

  // Sci-Fi Targeting Cursor Physics inside the container
  const cursorDotRef = useRef<HTMLDivElement>(null)
  const cursorRingRef = useRef<HTMLDivElement>(null)
  const mouseCoords = useRef({ x: -100, y: -100, targetX: -100, targetY: -100 })
  const isInsideRef = useRef(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      mouseCoords.current.targetX = e.clientX - rect.left
      mouseCoords.current.targetY = e.clientY - rect.top
      isInsideRef.current = true
    }

    const handleMouseLeave = () => {
      isInsideRef.current = false
      if (cursorDotRef.current) cursorDotRef.current.style.opacity = '0'
      if (cursorRingRef.current) cursorRingRef.current.style.opacity = '0'
    }

    const handleMouseEnter = () => {
      isInsideRef.current = true
      if (cursorDotRef.current) cursorDotRef.current.style.opacity = '1'
      if (cursorRingRef.current) cursorRingRef.current.style.opacity = '1'
    }

    container.addEventListener('mousemove', handleMouseMove)
    container.addEventListener('mouseleave', handleMouseLeave)
    container.addEventListener('mouseenter', handleMouseEnter)

    let animId: number
    const animateCursor = () => {
      animId = requestAnimationFrame(animateCursor)
      if (!isInsideRef.current) return

      const coords = mouseCoords.current
      coords.x += (coords.targetX - coords.x) * 0.45
      coords.y += (coords.targetY - coords.y) * 0.45

      if (cursorDotRef.current) {
        cursorDotRef.current.style.transform = `translate3d(${coords.x}px, ${coords.y}px, 0) translate(-50%, -50%)`
      }
      if (cursorRingRef.current) {
        cursorRingRef.current.style.transform = `translate3d(${coords.x}px, ${coords.y}px, 0) translate(-50%, -50%)`
      }
    }
    animateCursor()

    return () => {
      cancelAnimationFrame(animId)
      container.removeEventListener('mousemove', handleMouseMove)
      container.removeEventListener('mouseleave', handleMouseLeave)
      container.removeEventListener('mouseenter', handleMouseEnter)
    }
  }, [])

  // Find active speaker display details with fallback to aliases
  const activeAgent = topic.agents.find(
    (a) =>
      a.agent_id === activeSpeakerId ||
      a.agent_id.toLowerCase() === activeSpeakerId?.toLowerCase() ||
      a.aliases.includes(activeSpeakerId?.toLowerCase() || '') ||
      a.display_name.toLowerCase() === activeSpeakerId?.toLowerCase()
  )
  const isLocked = Boolean(activeSpeakerId || isUserListening || hoveredAgentId)

  const handleAgentSelect = (agentId: string | null) => {
    playClickChime()
    onAddressAgent(agentId)
  }

  return (
    <div className="cinematic-table-wrapper" ref={containerRef}>
      {/* Sci-Fi Targeting Cursor inside the table viewport */}
      <div id="table-cursor-dot" ref={cursorDotRef} aria-hidden="true" />
      <div
        id="table-cursor-ring"
        ref={cursorRingRef}
        className={isLocked ? 'locked' : ''}
        aria-hidden="true"
      />

      {/* Top Utility Controls Bar: View Switcher & Audio Override */}
      <div className="cinematic-controls-bar">
        <div className="view-mode-toggle" role="tablist" aria-label="Perspective View">
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === '3d'}
            className={`view-toggle-btn ${viewMode === '3d' ? 'active' : ''}`}
            onClick={() => {
              playClickChime()
              setViewMode('3d')
            }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            3D Voice Focus
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === '2d'}
            className={`view-toggle-btn ${viewMode === '2d' ? 'active' : ''}`}
            onClick={() => {
              playClickChime()
              setViewMode('2d')
            }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" />
            </svg>
            2D Table Blueprint
          </button>
        </div>

        <button
          type="button"
          className={`studio-audio-btn ${audioOnline ? 'audio-online' : ''}`}
          onClick={toggleStudioAudio}
          title="Toggle ambient studio room tone acoustics"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5 19h4l5 5V0L9 5H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          {audioOnline ? 'Room Acoustics Online' : 'Acoustics Override'}
        </button>
      </div>

      {/* Voice Telemetry HUD Banner */}
      <div className="voice-telemetry-hud">
        <div className="telemetry-badge">
          <span className={`status-beacon ${isLocked ? 'beacon-pulse' : ''}`} />
          {isUserListening ? (
            <span className="telemetry-text user-focus">
              HOST OVERRIDE LOCKED • DESK MIC CAPTURING VOICE
            </span>
          ) : activeAgent ? (
            <span className="telemetry-text agent-focus">
              VOICE FOCUS LOCKED • {activeAgent.display_name.toUpperCase()} [{activeAgent.role.toUpperCase()}]
            </span>
          ) : (
            <span className="telemetry-text room-idle">
              ROOM TELEMETRY IDLE • VOICE DRIVES CAMERA FOCUS • DRAG TO ORBIT
            </span>
          )}
        </div>

        {addressedAgentId && (
          <div className="addressed-badge">
            Targeting: {topic.agents.find((a) => a.agent_id === addressedAgentId)?.display_name}
            <button
              type="button"
              className="clear-target-btn"
              onClick={() => onAddressAgent(null)}
              title="Clear direct target"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* Viewport Centerpiece: 3D Scene or 2D Diagram */}
      <div className="table-viewport-container">
        {viewMode === '3d' ? (
          <ThreeTableScene
            topic={topic}
            activeSpeakerId={activeSpeakerId}
            addressedAgentId={addressedAgentId}
            activeThread={activeThread}
            isUserSpeaking={isUserListening}
            isUserProcessing={isUserProcessing}
            speakerAudioLevel={speakerAudioLevel}
            micAudioLevel={micAudioLevel}
            onSelectAgent={handleAgentSelect}
            onHoverAgent={setHoveredAgentId}
          />
        ) : (
          <div className="twod-table-center">
            <RoundTable
              topic={topic}
              activeSpeakerId={activeSpeakerId}
              addressedAgentId={addressedAgentId}
              activeThread={activeThread}
              speechSlip={speechSlip}
              isUserListening={isUserListening}
              isUserProcessing={isUserProcessing}
              micOn={micOn}
              micAudioLevel={micAudioLevel}
              onAddressAgent={handleAgentSelect}
              onMicToggle={onMicToggle}
              onBargeIn={onBargeIn}
            />
          </div>
        )}
      </div>

      {/* Real-Time Typewriter Speech Slip & Bottom Subtitle HUD */}
      <div className="cinematic-subtitles-dock">
        {speechSlip && speechSlip.text ? (
          <div className="live-speech-card paper-surface">
            <div className="speech-card-header">
              <div className="speaker-identity">
                <span className="speaker-role-chip">
                  {isUserListening
                    ? 'YOU (HOST)'
                    : activeAgent
                    ? `${activeAgent.display_name.toUpperCase()} • ${activeAgent.role.toUpperCase()}`
                    : 'ROUNDTABLE DEBATE'}
                </span>
                {!speechSlip.final && <span className="draft-beacon">STREAMING TELEMETRY</span>}
              </div>

              <div className="barge-action-row">
                <button
                  type="button"
                  className={`pull-chair-btn ${isUserListening ? 'chair-pulled' : ''}`}
                  onClick={onBargeIn}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
                  </svg>
                  {isUserListening ? 'Chair Pulled (Speaking...)' : 'Interrupt / Pull Chair'}
                </button>
              </div>
            </div>

            <p className="typewriter-speech-text">
              "
              <TypewriterText
                text={speechSlip.text}
                speed={16}
                isFinal={speechSlip.final}
              />
              "
            </p>
          </div>
        ) : (
          <div className="idle-telemetry-card">
            <div className="idle-hint-row">
              <span className="idle-dot" />
              <span className="idle-label">
                Roundtable Active: Speak into your microphone or click "Interrupt / Pull Chair" to take the floor.
              </span>
            </div>
            <button
              type="button"
              className="pull-chair-btn inline-barge"
              onClick={onBargeIn}
            >
              Interrupt / Pull Chair
            </button>
          </div>
        )}
      </div>

      <style>{`
        .cinematic-table-wrapper {
          position: relative;
          width: 100%;
          min-height: 640px;
          display: flex;
          flex-direction: column;
          background: #17120F;
          border-radius: var(--radius-card, 4px);
          overflow: hidden;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.65);
        }

        /* Sci-Fi Targeting Cursor inside the table */
        #table-cursor-dot, #table-cursor-ring {
          position: absolute;
          top: 0;
          left: 0;
          pointer-events: none;
          z-index: 9999;
          will-change: transform;
          opacity: 0;
          transition: opacity 0.2s ease;
        }

        #table-cursor-dot {
          width: 5px;
          height: 5px;
          background: #EADFC8;
          border-radius: 50%;
          box-shadow: 0 0 8px rgba(234, 223, 200, 0.8);
        }

        #table-cursor-ring {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          border: 1px solid rgba(234, 223, 200, 0.35);
          transition: width 0.3s, height 0.3s, border-radius 0.3s, border 0.3s;
        }

        #table-cursor-ring.locked {
          width: 54px;
          height: 54px;
          border-radius: 0;
          border: none;
          background: 
            linear-gradient(to right, #D69E2E 2px, transparent 2px) 0 0,
            linear-gradient(to right, #D69E2E 2px, transparent 2px) 0 100%,
            linear-gradient(to left, #D69E2E 2px, transparent 2px) 100% 0,
            linear-gradient(to left, #D69E2E 2px, transparent 2px) 100% 100%,
            linear-gradient(to bottom, #D69E2E 2px, transparent 2px) 0 0,
            linear-gradient(to bottom, #D69E2E 2px, transparent 2px) 100% 0,
            linear-gradient(to top, #D69E2E 2px, transparent 2px) 0 100%,
            linear-gradient(to top, #D69E2E 2px, transparent 2px) 100% 100%;
          background-repeat: no-repeat;
          background-size: 12px 12px;
          animation: reticleSpin 10s linear infinite;
        }

        @keyframes reticleSpin {
          100% {
            transform: translate(-50%, -50%) rotate(180deg);
          }
        }

        /* Top Controls Bar */
        .cinematic-controls-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 14px;
          background: rgba(18, 14, 12, 0.9);
          border-bottom: 1px solid rgba(138, 106, 75, 0.2);
          z-index: 20;
          backdrop-filter: blur(12px);
        }

        .view-mode-toggle {
          display: inline-flex;
          background: rgba(26, 19, 15, 0.85);
          border: 1px solid rgba(138, 106, 75, 0.25);
          border-radius: 9999px;
          padding: 2px;
          gap: 2px;
        }

        .view-toggle-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-family: var(--font-control, system-ui);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          padding: 3px 10px;
          background: transparent;
          color: #8A7563;
          border: none;
          border-radius: 9999px;
          cursor: pointer;
          transition: all 160ms ease;
        }

        .view-toggle-btn:hover {
          color: #EADFC8;
        }

        .view-toggle-btn.active {
          background: rgba(138, 106, 75, 0.35);
          color: #FAF5EB;
          border: 1px solid rgba(214, 158, 46, 0.4);
        }

        .studio-audio-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-mono, monospace);
          font-size: 10px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          background: rgba(30, 22, 17, 0.7);
          color: #B3A18F;
          border: 1px solid rgba(138, 106, 75, 0.25);
          padding: 4px 10px;
          border-radius: 9999px;
          cursor: pointer;
          transition: all 160ms ease;
        }

        .studio-audio-btn:hover {
          border-color: rgba(214, 158, 46, 0.5);
          color: #FAF5EB;
        }

        .studio-audio-btn.audio-online {
          background: rgba(46, 92, 60, 0.35);
          color: #8CE6A8;
          border-color: rgba(85, 221, 136, 0.45);
        }

        /* Telemetry HUD */
        .voice-telemetry-hud {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 14px;
          background: rgba(16, 12, 10, 0.65);
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
          z-index: 15;
        }

        .telemetry-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .status-beacon {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--muted, #8A7563);
        }

        .status-beacon.beacon-pulse {
          background: var(--inlay-line, #D69E2E);
          box-shadow: 0 0 10px rgba(214, 158, 46, 0.8);
          animation: beaconPulse 1.4s ease-in-out infinite;
        }

        @keyframes beaconPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.6; }
        }

        .telemetry-text {
          font-family: var(--font-mono, monospace);
          font-size: 11px;
          letter-spacing: 0.06em;
          color: var(--muted-light, #B3A18F);
        }

        .telemetry-text.agent-focus {
          color: #F8E7C9;
          font-weight: 500;
        }

        .telemetry-text.user-focus {
          color: #8CE6A8;
          font-weight: 600;
        }

        .addressed-badge {
          font-family: var(--font-mono, monospace);
          font-size: 11px;
          color: var(--inlay-line, #D69E2E);
          background: rgba(42, 31, 25, 0.7);
          border: 1px solid rgba(214, 158, 46, 0.4);
          padding: 2px 8px;
          border-radius: 3px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .clear-target-btn {
          background: transparent;
          border: none;
          color: inherit;
          cursor: pointer;
          font-weight: bold;
          font-size: 14px;
        }

        /* Viewport Centerpiece */
        .table-viewport-container {
          flex: 1;
          min-height: 540px;
          height: 560px;
          position: relative;
        }

        .twod-table-center {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          min-height: 540px;
        }

        /* Floating Subtitles & Speech Slip Dock (always visible on canvas) */
        .cinematic-subtitles-dock {
          position: absolute;
          bottom: 16px;
          left: 24px;
          right: 24px;
          max-width: 860px;
          margin: 0 auto;
          padding: 12px 18px;
          background: rgba(23, 18, 15, 0.92);
          border: 1px solid rgba(138, 106, 75, 0.4);
          border-radius: var(--radius-card, 6px);
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.75);
          z-index: 30;
          backdrop-filter: blur(12px);
        }

        .live-speech-card {
          padding: 12px 16px;
          border-radius: var(--radius-slip, 2px);
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.5);
          animation: slipFade 220ms ease-out;
        }

        .speech-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 6px;
        }

        .speaker-identity {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .speaker-role-chip {
          font-family: var(--font-mono, monospace);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.05em;
          color: #1C1612;
        }

        .draft-beacon {
          font-family: var(--font-mono, monospace);
          font-size: 9px;
          padding: 1px 6px;
          border-radius: 2px;
          background: rgba(42, 31, 25, 0.15);
          color: #5A3F2E;
          letter-spacing: 0.08em;
          font-weight: 600;
        }

        .typewriter-speech-text {
          font-family: var(--font-body, serif);
          font-size: 1.08rem;
          line-height: 1.45;
          color: #1C1612;
          margin: 0;
        }

        .pull-chair-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-control, system-ui);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.03em;
          background: #5A3F2E;
          color: #EADFC8;
          border: 1px solid #8A6A4B;
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
          transition: all 180ms ease;
        }

        .pull-chair-btn:hover {
          background: #73513C;
        }

        .pull-chair-btn.chair-pulled {
          background: #2E5C3C;
          border-color: #8CE6A8;
          color: #8CE6A8;
        }

        .idle-telemetry-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          background: rgba(34, 24, 19, 0.6);
          border: 1px dashed rgba(138, 106, 75, 0.3);
          border-radius: 4px;
        }

        .idle-hint-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .idle-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: rgba(234, 223, 200, 0.5);
        }

        .idle-label {
          font-family: var(--font-control, system-ui);
          font-size: 12px;
          color: var(--muted-light, #B3A18F);
        }

        .pull-chair-btn.inline-barge {
          padding: 5px 12px;
          font-size: 11px;
        }
      `}</style>
    </div>
  )
}
