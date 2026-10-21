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
  const displayedRef = useRef('')

  useEffect(() => {
    fullTextRef.current = text
    if (!text) {
      displayedRef.current = ''
      const t = setTimeout(() => {
        setDisplayedText('')
        setIsTyping(false)
      }, 0)
      return () => clearTimeout(t)
    }

    let charIndex = displayedRef.current.length
    if (charIndex > text.length || !text.startsWith(displayedRef.current)) {
      charIndex = 0
      displayedRef.current = ''
    }

    const startTimeout = setTimeout(() => {
      setIsTyping(true)
    }, 0)

    const timer = window.setInterval(() => {
      charIndex++
      const current = fullTextRef.current
      if (charIndex <= current.length) {
        const next = current.slice(0, charIndex)
        displayedRef.current = next
        setDisplayedText(next)
      } else {
        clearInterval(timer)
        setIsTyping(!isFinal)
      }
    }, speed)

    return () => {
      clearTimeout(startTimeout)
      clearInterval(timer)
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
