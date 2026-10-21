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
  sessionState?: string
  isUserListening: boolean
  isUserProcessing: boolean
  micOn: boolean
  speakerAudioLevel?: number
  micAudioLevel?: number
  onAddressAgent: (agentId: string | null) => void
  onMicToggle: () => void
  onBargeIn: () => void
  onSendUtterance?: (text: string) => void
}

export const CinematicTable: React.FC<CinematicTableProps> = ({
  topic,
  activeSpeakerId,
  addressedAgentId,
  activeThread,
  speechSlip,
  sessionState: _sessionState,
  isUserListening,
  isUserProcessing,
  micOn,
  speakerAudioLevel = 0,
  micAudioLevel = 0,
  onAddressAgent,
  onMicToggle,
  onBargeIn,
  onSendUtterance,
}) => {
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d')
  const [hoveredAgentId, setHoveredAgentId] = useState<string | null>(null)
  const [audioOnline, setAudioOnline] = useState<boolean>(false)
  const [inputText, setInputText] = useState<string>('')
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

  const handleSendQuestion = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputText.trim()) return
    onSendUtterance?.(inputText.trim())
    setInputText('')
  }

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
                {isUserProcessing
                  ? 'Generating response...'
                  : isUserListening
                  ? 'Listening to your voice...'
                  : 'Alex (AI Engineer) is listening. Ask a question or speak into your mic.'}
              </span>
            </div>

            <form className="ask-question-form" onSubmit={handleSendQuestion}>
              <input
                type="text"
                className="question-input"
                placeholder="Ask Alex a question about open weights vs frontier models..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={Boolean(activeSpeakerId) || isUserProcessing}
              />
              <button
                type="submit"
                className="ask-btn"
                disabled={!inputText.trim() || Boolean(activeSpeakerId) || isUserProcessing}
              >
                Ask Alex
              </button>
              <button
                type="button"
                className={`pull-chair-btn inline-barge ${isUserListening ? 'chair-pulled' : ''}`}
                onClick={onBargeIn}
              >
                {isUserListening ? 'Speaking...' : 'Interrupt / Pull Chair'}
              </button>
            </form>
          </div>
        )}
      </div>

      <style>{`
        .cinematic-table-wrapper {
          position: relative;
          width: 100%;
          height: 100%;
          flex: 1;
          display: flex;
          flex-direction: column;
          background: #090611;
          overflow: hidden;
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
          background: #F43F5E;
          border-radius: 50%;
          box-shadow: 0 0 10px rgba(244, 63, 94, 0.9);
        }

        #table-cursor-ring {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          border: 1px solid rgba(251, 113, 133, 0.45);
          transition: width 0.3s, height 0.3s, border-radius 0.3s, border 0.3s;
        }

        #table-cursor-ring.locked {
          width: 54px;
          height: 54px;
          border-radius: 0;
          border: none;
          background: 
            linear-gradient(to right, #F43F5E 2px, transparent 2px) 0 0,
            linear-gradient(to right, #F43F5E 2px, transparent 2px) 0 100%,
            linear-gradient(to left, #F43F5E 2px, transparent 2px) 100% 0,
            linear-gradient(to left, #F43F5E 2px, transparent 2px) 100% 100%,
            linear-gradient(to bottom, #F43F5E 2px, transparent 2px) 0 0,
            linear-gradient(to bottom, #F43F5E 2px, transparent 2px) 100% 0,
            linear-gradient(to top, #F43F5E 2px, transparent 2px) 0 100%,
            linear-gradient(to top, #F43F5E 2px, transparent 2px) 100% 100%;
          background-repeat: no-repeat;
          background-size: 12px 12px;
          animation: reticleSpin 10s linear infinite;
        }

        @keyframes reticleSpin {
          100% {
            transform: translate(-50%, -50%) rotate(180deg);
          }
        }

        /* Top Floating Controls Bar */
        .cinematic-controls-bar {
          position: absolute;
          top: 16px;
          left: 20px;
          display: flex;
          align-items: center;
          gap: 8px;
          z-index: 25;
        }

        .view-mode-toggle {
          display: inline-flex;
          background: rgba(24, 20, 27, 0.88);
          border: 1px solid rgba(244, 63, 94, 0.28);
          border-radius: 9999px;
          padding: 3px;
          gap: 3px;
          backdrop-filter: blur(16px);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        }

        .view-toggle-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-family: var(--font-sans);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.03em;
          padding: 5px 12px;
          background: transparent;
          color: #A8A29E;
          border: none;
          border-radius: 9999px;
          cursor: pointer;
          transition: all 160ms ease;
        }

        .view-toggle-btn:hover {
          color: #FDFCFE;
        }

        .view-toggle-btn.active {
          background: #E11D48;
          color: #FFFFFF;
          box-shadow: 0 2px 12px rgba(225, 29, 72, 0.45);
        }

        .studio-audio-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-sans);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.03em;
          background: rgba(24, 20, 27, 0.88);
          color: #FB7185;
          border: 1px solid rgba(244, 63, 94, 0.28);
          padding: 5px 12px;
          border-radius: 9999px;
          cursor: pointer;
          backdrop-filter: blur(16px);
          transition: all 160ms ease;
        }

        .studio-audio-btn:hover {
          border-color: #FB7185;
          color: #FDFCFE;
        }

        .studio-audio-btn.audio-online {
          background: rgba(251, 113, 133, 0.22);
          color: #FFF1F2;
          border-color: #FB7185;
        }

        /* Top Right Voice Telemetry HUD */
        .voice-telemetry-hud {
          position: absolute;
          top: 16px;
          right: 20px;
          display: flex;
          align-items: center;
          gap: 8px;
          z-index: 25;
        }

        .telemetry-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          background: rgba(24, 20, 27, 0.88);
          border: 1px solid rgba(244, 63, 94, 0.25);
          border-radius: 9999px;
          backdrop-filter: blur(16px);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        }

        .status-beacon {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #7E7497;
        }

        .status-beacon.beacon-pulse {
          background: #F43F5E;
          box-shadow: 0 0 10px rgba(244, 63, 94, 0.9);
          animation: beaconPulse 1.4s ease-in-out infinite;
        }

        @keyframes beaconPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.6; }
        }

        .telemetry-text {
          font-family: var(--font-mono, monospace);
          font-size: 11px;
          letter-spacing: 0.04em;
          color: #A8A29E;
        }

        .telemetry-text.agent-focus {
          color: #FDFCFE;
          font-weight: 600;
        }

        .telemetry-text.user-focus {
          color: #F43F5E;
          font-weight: 700;
        }

        .addressed-badge {
          font-family: var(--font-sans);
          font-size: 11px;
          font-weight: 600;
          color: #FDFCFE;
          background: rgba(244, 63, 94, 0.25);
          border: 1px solid #F43F5E;
          padding: 4px 10px;
          border-radius: 9999px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          backdrop-filter: blur(16px);
        }

        .clear-target-btn {
          background: transparent;
          border: none;
          color: inherit;
          cursor: pointer;
          font-weight: bold;
          font-size: 14px;
        }

        /* Viewport Centerpiece - Fills Stage 100% */
        .table-viewport-container {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
        }

        .twod-table-center {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          padding: 60px 20px 100px;
          overflow: auto;
        }

        /* Floating Subtitles & Speech Slip Dock (Glassmorphism bottom centerpiece) */
        .cinematic-subtitles-dock {
          position: absolute;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          width: min(880px, calc(100% - 32px));
          padding: 14px 20px;
          background: rgba(24, 20, 27, 0.92);
          border: 1px solid rgba(244, 63, 94, 0.28);
          border-radius: 16px;
          box-shadow: 0 20px 48px rgba(0, 0, 0, 0.8);
          z-index: 30;
          backdrop-filter: blur(24px);
        }

        .live-speech-card {
          animation: slipFade 220ms ease-out;
        }

        .speech-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .speaker-identity {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .speaker-role-chip {
          font-family: var(--font-sans);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.05em;
          color: #F43F5E;
        }

        .draft-beacon {
          font-family: var(--font-mono, monospace);
          font-size: 9px;
          padding: 2px 7px;
          border-radius: 9999px;
          background: rgba(244, 63, 94, 0.2);
          color: #FB7185;
          letter-spacing: 0.08em;
          font-weight: 600;
        }

        .typewriter-speech-text {
          font-family: var(--font-sans);
          font-size: 1.06rem;
          line-height: 1.5;
          color: #FDFCFE;
          margin: 0;
          font-weight: 400;
        }

        .pull-chair-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-sans);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.03em;
          background: #E11D48;
          color: #FFFFFF;
          border: 1px solid #F43F5E;
          padding: 6px 14px;
          border-radius: 9999px;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(225, 29, 72, 0.4);
          transition: all 180ms ease;
        }

        .pull-chair-btn:hover {
          background: #F43F5E;
          transform: translateY(-1px);
        }

        .pull-chair-btn.chair-pulled {
          background: #9F1239;
          border-color: #FB7185;
          color: #FFFFFF;
        }

        .idle-telemetry-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .idle-hint-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .idle-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #F43F5E;
          box-shadow: 0 0 8px rgba(244, 63, 94, 0.8);
        }

        .idle-label {
          font-family: var(--font-sans);
          font-size: 12px;
          color: #A8A29E;
        }

        .pull-chair-btn.inline-barge {
          padding: 6px 14px;
          font-size: 12px;
        }

        .ask-question-form {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          margin-top: 8px;
        }

        .question-input {
          flex: 1;
          background: rgba(14, 11, 18, 0.9);
          border: 1px solid rgba(244, 63, 94, 0.28);
          color: #FFFFFF;
          font-family: var(--font-sans);
          font-size: 13px;
          padding: 7px 14px;
          border-radius: 9999px;
          outline: none;
          transition: border-color 160ms, box-shadow 160ms;
        }

        .question-input:focus {
          border-color: #FB7185;
          box-shadow: 0 0 10px rgba(244, 63, 94, 0.3);
        }

        .question-input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .ask-btn {
          background: #E11D48;
          color: #FFFFFF;
          font-family: var(--font-sans);
          font-size: 12px;
          font-weight: 700;
          padding: 7px 16px;
          border-radius: 9999px;
          border: 1px solid #F43F5E;
          cursor: pointer;
          transition: all 160ms ease;
          white-space: nowrap;
        }

        .ask-btn:hover:not(:disabled) {
          background: #F43F5E;
          transform: translateY(-1px);
          box-shadow: 0 2px 10px rgba(244, 63, 94, 0.4);
        }

        .ask-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        @media (max-width: 768px) {
          .cinematic-controls-bar {
            top: 10px;
            left: 10px;
          }
          .voice-telemetry-hud {
            top: 10px;
            right: 10px;
          }
          .cinematic-subtitles-dock {
            bottom: 12px;
            padding: 10px 14px;
            width: calc(100% - 20px);
          }
          .typewriter-speech-text {
            font-size: 0.95rem;
          }
        }
      `}</style>
    </div>
  )
}
