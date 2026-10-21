import React, { useEffect, useState, useRef } from 'react'

interface TypewriterTextProps {
  text: string
  speed?: number
  isFinal?: boolean
  className?: string
}

export const TypewriterText: React.FC<TypewriterTextProps> = ({
  text,
  speed = 18,
  isFinal = false,
  className = '',
}) => {
  const [displayedText, setDisplayedText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const fullTextRef = useRef(text)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    fullTextRef.current = text
    if (!text) {
      setDisplayedText('')
      setIsTyping(false)
      return
    }

    // If text was extended (streaming), keep existing displayed characters and continue typing
    let charIndex = displayedText.length
    if (charIndex > text.length || !text.startsWith(displayedText)) {
      charIndex = 0
    }

    setIsTyping(true)

    if (timerRef.current) {
      clearInterval(timerRef.current)
    }

    timerRef.current = window.setInterval(() => {
      charIndex++
      const current = fullTextRef.current
      if (charIndex <= current.length) {
        setDisplayedText(current.slice(0, charIndex))
      } else {
        if (timerRef.current) clearInterval(timerRef.current)
        setIsTyping(!isFinal)
      }
    }, speed)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [text, speed, isFinal])

  return (
    <span className={`typewriter-wrap ${className}`}>
      {displayedText}
      {(!isFinal || isTyping) && <span className="typing-cursor" aria-hidden="true" />}
      <style>{`
        .typing-cursor::after {
          content: '█';
          animation: typewriterBlink 1s step-start infinite;
          color: var(--inlay-line, #D69E2E);
          margin-left: 3px;
          font-weight: 300;
          font-size: 0.9em;
        }
        @keyframes typewriterBlink {
          50% { opacity: 0; }
        }
      `}</style>
    </span>
  )
}
